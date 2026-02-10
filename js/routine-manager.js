// ========================================
// Routine Manager - Build and manage skincare routines
// ========================================

console.log('🔧 routine-manager.js is loading...');

class RoutineManager {
    constructor() {
        this.currentRoutine = 'morning';
        this.routines = {
            morning: [],
            evening: []
        };
        this.draggedElement = null;

        // Timer state
        this.timerInterval = null;
        this.timerTimeLeft = 0;
        this.timerTotalTime = 0;
        this.isTimerPaused = false;
        this.currentTimerRoutine = null;
        this.currentTimerStepIndex = -1;
        this.isWaitTime = false;

        // init() removed from constructor to prevent race conditions
    }

    /**
     * Initialize routine manager
     */
    async init() {
        // Load saved routines
        await this.loadRoutines();

        // Setup event listeners
        this.setupRoutineTabs();
        this.setupAddProductButtons();
        this.setupLayeringGuideToggle();
        this.setupRoutineTimer();

        // Render routines
        this.renderRoutine('morning');
        this.renderRoutine('evening');

        // Migrate legacy statistics
        this.migrateLegacyRoutineHistory();

        // Initial tab status check
        this.updateTabStatus();
    }

    /**
     * Load routines from storage
     */
    async loadRoutines() {
        // Load from localStorage first (default/offline state)
        this.routines = StorageManager.load('routines', {
            morning: [],
            evening: []
        });

        // Merge from cloud if authenticated
        const user = window.firebaseAuth?.currentUser;
        if (user && window.FirebaseStorage) {
            try {
                const cloudData = await window.FirebaseStorage.getRoutines();
                console.log('☁️ Merging cloud routines:', cloudData);

                if (cloudData.morning.length > 0) this.routines.morning = cloudData.morning;
                if (cloudData.evening.length > 0) this.routines.evening = cloudData.evening;

                // Sync counts and history
                const stats = StorageManager.load('routineStats', { morning: 0, evening: 0 });
                stats.morning = Math.max(stats.morning, cloudData.morningCount || 0);
                stats.evening = Math.max(stats.evening, cloudData.eveningCount || 0);
                StorageManager.save('routineStats', stats);

                // Sync morning/evening specific history
                const morningHistory = StorageManager.load('morningHistory', []);
                const mergedMorning = [...new Set([...morningHistory, ...(cloudData.morningDates || [])])];
                StorageManager.save('morningHistory', mergedMorning);

                const eveningHistory = StorageManager.load('eveningHistory', []);
                const mergedEvening = [...new Set([...eveningHistory, ...(cloudData.eveningDates || [])])];
                StorageManager.save('eveningHistory', mergedEvening);

                // Sync global routineHistory for streaks
                const routineHistory = StorageManager.load('routineHistory', []);
                const mergedGlobal = [...new Set([...routineHistory, ...mergedMorning, ...mergedEvening])];
                StorageManager.save('routineHistory', mergedGlobal);

                // Sync routines_{date} flags for dashboard
                [...mergedMorning, ...mergedEvening].forEach(dateStr => {
                    const daily = StorageManager.load(`routines_${dateStr}`, { morning: false, evening: false });
                    if (mergedMorning.includes(dateStr)) daily.morning = true;
                    if (mergedEvening.includes(dateStr)) daily.evening = true;
                    StorageManager.save(`routines_${dateStr}`, daily);
                });

                // Save merged routines back to localStorage
                StorageManager.save('routines', this.routines);

                console.log('✅ Routines & History merged from cloud');
            } catch (error) {
                console.error('Error loading routines from cloud:', error);
            }
        }

        // Migrate and sort
        this.migrateRoutines();
        this.sortRoutine('morning');
        this.sortRoutine('evening');
    }

    /**
     * Migrate existing routines to update isActive flags
     */
    migrateRoutines() {
        console.log('🔧 Starting routine migration...');
        let needsSave = false;

        ['morning', 'evening'].forEach(routineType => {
            console.log(`Checking ${routineType} routine...`);
            this.routines[routineType].forEach(step => {
                // Recalculate isActive based on current logic
                const shouldBeActive = this.isActiveIngredient(step.category);

                console.log(`  Step: ${step.name} | Category: ${step.category} | Current isActive: ${step.isActive} | Should be: ${shouldBeActive}`);

                if (step.isActive !== shouldBeActive) {
                    console.log(`  🔄 Migrating ${step.name}: isActive ${step.isActive} → ${shouldBeActive}`);
                    step.isActive = shouldBeActive;
                    needsSave = true;
                }

                // Add waitTime if missing
                if (step.waitTime === undefined) {
                    step.waitTime = this.getWaitTimeForCategory(step.category, shouldBeActive);
                    console.log(`  ⏱️ Added waitTime ${step.waitTime} to ${step.name}`);
                    needsSave = true;
                }
            });
        });

        console.log(`Migration complete. Needs save: ${needsSave}`);
        if (needsSave) {
            console.log('💾 Saving migrated routines...');
            this.saveRoutines();

            // Re-render both routines to update the UI
            console.log('🎨 Re-rendering routines after migration...');
            this.renderRoutine('morning');
            this.renderRoutine('evening');
        }
    }

    /**
     * Save routines to storage
     */
    async saveRoutines() {
        // Save to localStorage first (for immediate access)
        StorageManager.save('routines', this.routines);

        // If user is authenticated, also save to Firestore
        const user = window.firebaseAuth?.currentUser;
        if (user && window.FirebaseStorage) {
            try {
                const stats = StorageManager.load('routineStats', { morning: 0, evening: 0 });
                const morningHistory = StorageManager.load('morningHistory', []);
                const eveningHistory = StorageManager.load('eveningHistory', []);

                // Save both morning and evening routines with their completion counts and history
                await window.FirebaseStorage.saveRoutine('morning', this.routines.morning, stats.morning, morningHistory);
                await window.FirebaseStorage.saveRoutine('evening', this.routines.evening, stats.evening, eveningHistory);
                console.log('✅ Routines, stats & history synced to Firestore');
            } catch (error) {
                console.error('Error saving routines to Firestore:', error);
                showToast('Routines saved locally, but failed to sync to cloud', 'warning');
            }
        }

        // Update dashboard stats if we're on the home screen
        if (window.app) {
            window.app.loadInventoryStats();
        }
    }

    /**
     * Setup routine tab switching
     */
    setupRoutineTabs() {
        const tabs = document.querySelectorAll('.routine-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const routineType = tab.dataset.routine;
                this.switchRoutine(routineType);
            });
        });
    }

    /**
     * Switch between morning and evening routines
     * @param {string} type - 'morning' or 'evening'
     * @param {boolean} force - Skip timing check (for initialization)
     */
    switchRoutine(type, force = false) {
        // Timing Check
        if (!force && this.currentRoutine !== type) {
            const now = new Date();
            const hour = now.getHours();
            const isMorningTime = hour < 16;

            if ((type === 'evening' && isMorningTime) || (type === 'morning' && !isMorningTime)) {
                console.log(`🚫 Switching to ${type} blocked at ${hour}:00`);
                const tab = document.querySelector(`.routine-tab[data-routine="${type}"]`);
                const message = type === 'evening' ? 'Available after 4 PM' : 'Available tomorrow';
                if (tab) this.showTabNudge(tab, message);
                return;
            }
        }

        this.currentRoutine = type;

        // Update tab active state
        document.querySelectorAll('.routine-tab').forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.routine-tab[data-routine="${type}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Update builder active state
        document.querySelectorAll('.routine-builder').forEach(b => b.classList.remove('active'));
        const activeBuilder = document.getElementById(`${type}Routine`);
        if (activeBuilder) activeBuilder.classList.add('active');

        AccessibilityManager.announceNavigation(`${type} routine`);
    }

    /**
     * Show a pulse nudge message under the tab subtitle
     */
    showTabNudge(tab, message) {
        // Check if message already exists to avoid duplicates
        if (tab.querySelector('.tab-nudge-message')) return;

        const subtitle = tab.querySelector('.routine-tab-subtitle');
        if (!subtitle) return;

        // Store original text
        const originalText = subtitle.textContent;

        // Temporarily change text and color
        subtitle.textContent = message;
        subtitle.classList.add('status-highlight');
        setTimeout(() => {
            subtitle.textContent = originalText;
            subtitle.classList.remove('status-highlight');
        }, 1500);
    }

    /**
     * Update visual status of tabs based on current time
     */
    updateTabStatus() {
        const now = new Date();
        const currentHour = now.getHours();
        const isMorningTime = currentHour < 16;

        const morningTab = document.querySelector('.routine-tab[data-routine="morning"]');
        const eveningTab = document.querySelector('.routine-tab[data-routine="evening"]');

        if (morningTab) {
            morningTab.classList.toggle('timing-restricted', !isMorningTime);
        }
        if (eveningTab) {
            eveningTab.classList.toggle('timing-restricted', isMorningTime);
        }

        // Update big start buttons on the routine page
        const startMorningBtn = document.getElementById('startMorningRoutine');
        const startEveningBtn = document.getElementById('startEveningRoutine');

        if (startMorningBtn) {
            startMorningBtn.classList.toggle('btn-disabled-timing', !isMorningTime);
            // Re-setup click handler to include nudge if restricted
            startMorningBtn.onclick = (e) => {
                if (!isMorningTime) {
                    e.preventDefault();
                    if (morningTab) this.showTabNudge(morningTab, 'Available tomorrow');
                } else {
                    this.startRoutine('morning');
                }
            };
        }

        if (startEveningBtn) {
            startEveningBtn.classList.toggle('btn-disabled-timing', isMorningTime);
            // Re-setup click handler to include nudge if restricted
            startEveningBtn.onclick = (e) => {
                if (isMorningTime) {
                    e.preventDefault();
                    if (eveningTab) this.showTabNudge(eveningTab, 'Available after 4 PM');
                } else {
                    this.startRoutine('evening');
                }
            };
        }

        // Ensure we are viewing the correct tab initially if possible
        const targetRoutine = isMorningTime ? 'morning' : 'evening';
        if (this.currentRoutine !== targetRoutine) {
            this.switchRoutine(targetRoutine, true); // Use force flag for initial auto-switch
        }
    }

    /**
     * Setup add product buttons
     */
    setupAddProductButtons() {
        document.getElementById('addMorningProduct')?.addEventListener('click', () => {
            this.showAddProductModal('morning');
        });

        document.getElementById('addEveningProduct')?.addEventListener('click', () => {
            this.showAddProductModal('evening');
        });
    }

    /**
     * Setup layering guide toggle
     */
    setupLayeringGuideToggle() {
        const layeringGuide = document.querySelector('.layering-guide');
        const toggleHeader = document.getElementById('layeringGuideToggle');

        if (!layeringGuide || !toggleHeader) {
            console.warn('Layering guide elements not found');
            return;
        }

        // Load saved state from localStorage
        const isCollapsed = localStorage.getItem('layeringGuideCollapsed') === 'true';
        if (isCollapsed) {
            layeringGuide.classList.add('collapsed');
        }

        // Add click event listener to the entire header
        toggleHeader.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            layeringGuide.classList.toggle('collapsed');

            // Save state to localStorage
            const collapsed = layeringGuide.classList.contains('collapsed');
            localStorage.setItem('layeringGuideCollapsed', collapsed.toString());

            // Announce to screen reader
            const state = collapsed ? 'collapsed' : 'expanded';
            if (typeof AccessibilityManager !== 'undefined') {
                AccessibilityManager.announceNavigation(`Layering guide ${state}`);
            }

            console.log(`Layering guide ${state}`);
        });
    }

    /**
     * Show add product modal with available products from Digital Shelf
     */
    async showAddProductModal(routineType) {
        // Get products from Digital Shelf (Product Manager)
        const products = window.app?.productManager?.products || [];

        if (products.length === 0) {
            showToast('Add products to your Digital Shelf first', 'warning');
            return;
        }

        // Filter out products already in this routine
        const productsInRoutine = this.routines[routineType].map(step => step.productId);
        const availableProducts = products.filter(p => !productsInRoutine.includes(p.id));

        // Filter by routine type (morning/evening) if applicable
        const filteredProducts = availableProducts.filter(p => {
            // Sunscreen only in morning
            if (p.category === 'Sunscreen' && routineType === 'evening') return false;
            // You can add more routine-specific filters here
            return true;
        });

        if (filteredProducts.length === 0) {
            showToast('All your products are already in this routine', 'info');
            return;
        }

        // Show product selection modal
        this.showProductSelectionModal(routineType, filteredProducts);
    }

    /**
     * Show modal with available products to choose from
     */
    showProductSelectionModal(routineType, products) {
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay active" id="routineProductSelectionModal">
                <div class="modal" role="dialog" aria-labelledby="routineProductSelectionTitle">
                    <div class="modal-header">
                        <h3 class="modal-title" id="routineProductSelectionTitle">Add Product to ${routineType === 'morning' ? 'Morning' : 'Evening'} Routine</h3>
                        <button class="btn btn-icon" id="closeRoutineProductSelection" aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: var(--space-md); color: var(--color-text-secondary);">
                            Select a product from your Digital Shelf
                        </p>
                        <div class="product-selection-grid">
                            ${products.map(product => `
                                <div class="product-selection-item" data-product-id="${product.id}">
                                    ${product.photo
                ? `<img src="${product.photo}" alt="${product.name}" class="product-selection-photo">`
                : `<div class="product-selection-no-photo">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                                <path d="M16 10a4 4 0 0 1-8 0"></path>
                                            </svg>
                                          </div>`
            }
                                    <div class="product-selection-info">
                                        <div class="product-selection-name">${sanitizeHTML(product.name)}</div>
                                        ${product.brand ? `<div class="product-selection-brand">${sanitizeHTML(product.brand)}</div>` : ''}
                                        ${product.category ? `<div class="product-selection-category">${sanitizeHTML(product.category)}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Inject modal into DOM
        const existingModal = document.getElementById('routineProductSelectionModal');
        if (existingModal) {
            existingModal.remove();
        }
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listeners
        const modal = document.getElementById('routineProductSelectionModal');
        const closeBtn = document.getElementById('closeRoutineProductSelection');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Add click listeners to product items
        document.querySelectorAll('.product-selection-item').forEach(item => {
            item.addEventListener('click', () => {
                const productId = parseInt(item.dataset.productId);
                const product = products.find(p => p.id === productId);
                if (product) {
                    this.addProductToRoutine(routineType, product);
                    showToast(`Added ${product.name} to ${routineType} routine`, 'success');
                    modal.remove();
                }
            });
        });
    }

    /**
     * Add product to routine
     */
    addProductToRoutine(routineType, product) {
        // Check if product is already in this routine
        const isDuplicate = this.routines[routineType].some(step =>
            step.productId && step.productId === product.id
        );

        if (isDuplicate) {
            showToast(`${product.name} is already in your ${routineType} routine`, 'warning');
            return;
        }

        // Map Digital Shelf category to routine category
        const routineCategory = this.mapCategoryToRoutineCategory(product.category);
        const order = this.getCategoryOrder(routineCategory);
        // IMPORTANT: Use routineCategory for isActive check since that's what gets stored in step.category
        const isActive = this.isActiveIngredient(routineCategory);

        console.log(`➕ Adding product: ${product.name}`);
        console.log(`   Digital Shelf category: ${product.category} → Routine category: ${routineCategory}`);
        console.log(`   isActive: ${isActive}`);

        const step = {
            id: generateId(),
            productId: product.id, // Reference to product in Digital Shelf
            name: product.name,
            brand: product.brand || '',
            category: routineCategory,
            order: order,
            duration: 1,
            waitTime: this.getWaitTimeForCategory(routineCategory, isActive),
            isActive: isActive,
            instructions: this.getInstructionsForCategory(routineCategory),
            photo: product.photo || null
        };

        this.routines[routineType].push(step);
        this.sortRoutine(routineType);
        this.saveRoutines();
        this.renderRoutine(routineType);
    }

    /**
     * Map Digital Shelf category to Routine category
     */
    mapCategoryToRoutineCategory(category) {
        const categoryMap = {
            'Cleanser': 'cleanser',
            'Toner': 'toner',
            'Essence': 'essence',
            'Serum': 'serum-water-based', // Default to water-based
            'Moisturizer': 'moisturizer',
            'Sunscreen': 'spf',
            'Eye Cream': 'eye-cream',
            'Face Oil': 'serum-oil-based',
            'Treatment': 'treatment',
            'Exfoliator': 'exfoliator',  // ✅ Fixed: Exfoliators get their own category
            'Face Mask': 'serum-water-based',
            'Other': 'serum-water-based'
        };

        return categoryMap[category] || 'serum-water-based';
    }

    /**
     * Get order number for category
     */
    getCategoryOrder(category) {
        const orderMap = {
            'cleanser': 1,
            'exfoliator': 2,      // After cleansing
            'toner': 3,
            'essence': 3,
            'treatment': 4,       // After toner/essence
            'serum-water-based': 4,
            'serum-oil-based': 4,
            'eye-cream': 5,
            'moisturizer': 6,
            'oil': 7,
            'spf': 8
        };

        return orderMap[category] || 4;
    }

    /**
     * Check if product category typically contains active ingredients
     */
    isActiveIngredient(category) {
        // Check both Digital Shelf categories and routine categories
        const activeCategories = [
            'Serum',                // Digital Shelf
            'Treatment',            // Digital Shelf
            'Exfoliator',           // Digital Shelf
            'serum-water-based',    // Routine
            'serum-oil-based',      // Routine
            'treatment',            // Routine
            'exfoliator',           // Routine ✅ ADDED
            'essence',              // Routine
            'toner'                 // Routine
        ];
        return activeCategories.includes(category);
    }

    /**
     * Get instructions for product category
     */
    getInstructionsForCategory(category) {
        const instructions = {
            'cleanser': 'Massage gently for 60 seconds, rinse with lukewarm water',
            'exfoliator': 'Apply to damp skin, massage gently, rinse thoroughly',
            'toner': 'Pat gently into skin, don\'t rub',
            'essence': 'Press into skin with palms',
            'treatment': 'Apply thin layer to affected areas, avoid eye area',
            'serum-water-based': 'Apply 2-3 drops, pat until absorbed',
            'serum-oil-based': 'Warm between palms, press into skin',
            'eye-cream': 'Tap gently around orbital bone',
            'moisturizer': 'Apply in upward motions',
            'oil': 'Warm between palms, press into skin',
            'spf': 'Apply liberally, reapply every 2 hours'
        };

        return instructions[category] || 'Apply as directed';
    }

    /**
     * Get wait time for product category (in minutes)
     */
    getWaitTimeForCategory(category, isActive) {
        // Products that typically need wait time
        const waitTimes = {
            // Digital Shelf categories
            'Exfoliator': 5,           // Chemical exfoliants need time to work
            'Treatment': 10,           // Treatments like retinol, acids
            'Serum': isActive ? 3 : 0, // Active serums need absorption time
            'Sunscreen': 15,           // SPF needs time to form protective film

            // Routine categories
            'exfoliator': 5,           // Chemical exfoliants
            'treatment': 10,           // Treatment actives
            'serum-water-based': isActive ? 3 : 0,
            'serum-oil-based': isActive ? 3 : 0,
            'spf': 15,                 // Sunscreen
            'essence': isActive ? 2 : 0,
            'toner': isActive ? 1 : 0
        };

        return waitTimes[category] || 0;
    }

    /**
     * Sort routine by layering order
     */
    sortRoutine(routineType) {
        this.routines[routineType].sort((a, b) => a.order - b.order);
    }

    /**
     * Render routine
     */
    renderRoutine(routineType) {
        console.log(`🎨 Rendering ${routineType} routine...`);
        const container = document.getElementById(`${routineType}Steps`);
        if (!container) {
            console.error(`❌ Container not found: ${routineType}Steps`);
            return;
        }

        const steps = this.routines[routineType];
        console.log(`📋 ${routineType} routine has ${steps.length} steps:`, steps);

        if (steps.length === 0) {
            container.innerHTML = `
        <div class="routine-empty">
          <div class="routine-empty-icon">✨</div>
          <h3>No products yet</h3>
          <p>Add your first product to get started with your ${routineType} routine</p>
        </div>
      `;
            this.updateSummary(routineType);
            return;
        }

        container.innerHTML = steps.map((step, index) => this.renderStep(step, index + 1, routineType)).join('');
        console.log(`✅ Rendered ${steps.length} steps for ${routineType}`);

        // Setup drag and drop
        this.setupDragAndDrop(routineType);

        // Update summary
        this.updateSummary(routineType);

        // Update layering guide to show only categories in use
        this.updateLayeringGuide();
    }

    /**
     * Update layering guide to show only categories currently in routine
     */
    updateLayeringGuide() {
        const layeringOrder = document.getElementById('layeringOrder');
        if (!layeringOrder) return;

        // Get all unique categories from both routines
        const allCategories = new Set();
        ['morning', 'evening'].forEach(routineType => {
            this.routines[routineType].forEach(step => {
                allCategories.add(step.category);
            });
        });

        // If no products, show a message
        if (allCategories.size === 0) {
            layeringOrder.innerHTML = `
                <div class="text-secondary" style="text-align: center; padding: var(--space-md); font-size: var(--font-size-sm);">
                    Add products to your routine to see the layering order
                </div>
            `;
            return;
        }

        // Define category display info with order
        const categoryInfo = {
            'cleanser': { order: 1, label: 'Cleanser' },
            'exfoliator': { order: 2, label: 'Exfoliator' },
            'toner': { order: 3, label: 'Toner' },
            'essence': { order: 3, label: 'Essence' },
            'treatment': { order: 4, label: 'Treatment' },
            'serum-water-based': { order: 4, label: 'Serum (water-based)' },
            'serum-oil-based': { order: 5, label: 'Serum (oil-based)' },
            'eye-cream': { order: 6, label: 'Eye Cream' },
            'moisturizer': { order: 7, label: 'Moisturizer' },
            'oil': { order: 8, label: 'Face Oil (optional)' },
            'spf': { order: 9, label: 'SPF (AM only - always last!)' }
        };

        // Convert to array and sort by order
        const categoriesArray = Array.from(allCategories)
            .filter(cat => categoryInfo[cat]) // Only include known categories
            .map(cat => ({
                category: cat,
                ...categoryInfo[cat]
            }))
            .sort((a, b) => a.order - b.order);

        // Generate HTML
        let html = '';
        categoriesArray.forEach((item, index) => {
            html += `
                <div class="layering-order-item">
                    <span class="layering-order-number">${index + 1}</span>
                    <span>${item.label}</span>
                </div>
            `;
        });

        layeringOrder.innerHTML = html;
    }

    /**
     * Render individual step
     */
    renderStep(step, number, routineType) {
        const layeringTip = this.getLayeringTip(step.category);
        const brandInfo = step.brand ? `<span class="step-brand">${step.brand}</span>` : '';
        const waitTimeBadge = (step.waitTime && step.waitTime > 0)
            ? `<div class="step-wait-time">⏱️ Wait ${step.waitTime} min</div>`
            : '';

        return `
      <div class="routine-step" draggable="true" data-step-id="${step.id}" data-routine="${routineType}">
        <span class="step-drag-handle">⋮⋮</span>
        <div class="step-number">${number}</div>
        <div class="step-content">
          <div class="step-product-name">${step.name} ${brandInfo}</div>
          <div class="step-product-type">${this.getCategoryLabel(step.category)}</div>
          ${step.instructions ? `<div class="step-instructions">${step.instructions}</div>` : ''}
          ${waitTimeBadge}
          ${layeringTip ? `<div class="step-layering-tip">💡 ${layeringTip}</div>` : ''}
        </div>
        <div class="step-actions">
          <button class="step-action-btn delete" onclick="routineManager.removeStep('${routineType}', '${step.id}')" aria-label="Remove step">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    }

    /**
     * Get category label
     */
    getCategoryLabel(category) {
        const labels = {
            'cleanser': 'Cleanser',
            'toner': 'Toner',
            'essence': 'Essence',
            'serum-water-based': 'Water-based Serum',
            'serum-oil-based': 'Oil-based Serum',
            'eye-cream': 'Eye Cream',
            'moisturizer': 'Moisturizer',
            'oil': 'Facial Oil',
            'spf': 'Sunscreen'
        };

        return labels[category] || category;
    }

    /**
     * Get layering tip for category
     */
    getLayeringTip(category) {
        const tips = {
            'serum-water-based': 'Apply before oil-based products',
            'serum-oil-based': 'Apply after water-based serums',
            'spf': 'Always apply as the last step in your morning routine',
            'eye-cream': 'Use ring finger for gentle application'
        };

        return tips[category] || null;
    }

    /**
     * Remove step from routine
     */
    removeStep(routineType, stepId) {
        this.routines[routineType] = this.routines[routineType].filter(s => s.id !== stepId);
        this.saveRoutines();
        this.renderRoutine(routineType);
        showToast('Product removed from routine', 'success');
    }

    /**
     * Setup drag and drop
     */
    setupDragAndDrop(routineType) {
        const steps = document.querySelectorAll(`.routine-step[data-routine="${routineType}"]`);

        steps.forEach(step => {
            step.addEventListener('dragstart', (e) => this.handleDragStart(e));
            step.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            step.addEventListener('dragover', (e) => this.handleDragOver(e));
            step.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            step.addEventListener('drop', (e) => this.handleDrop(e, routineType));
            step.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });
    }

    /**
     * Handle drag start
     */
    handleDragStart(e) {
        this.draggedElement = e.currentTarget;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        console.log('🎯 Drag started:', this.draggedElement.dataset.stepId);
    }

    /**
     * Handle drag enter
     */
    handleDragEnter(e) {
        e.preventDefault();
        const target = e.currentTarget;
        if (target !== this.draggedElement) {
            target.classList.add('drag-over');
        }
    }

    /**
     * Handle drag over
     */
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(e) {
        const target = e.currentTarget;
        target.classList.remove('drag-over');
    }

    /**
     * Handle drop
     */
    handleDrop(e, routineType) {
        e.preventDefault();
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        const target = e.currentTarget;
        target.classList.remove('drag-over');

        if (this.draggedElement !== target) {
            // Reorder steps
            const draggedId = this.draggedElement.dataset.stepId;
            const targetId = target.dataset.stepId;

            console.log('🔄 Reordering:', { draggedId, targetId, routineType });

            const routine = this.routines[routineType];
            const draggedIndex = routine.findIndex(s => s.id === draggedId);
            const targetIndex = routine.findIndex(s => s.id === targetId);

            console.log('📍 Indices:', { draggedIndex, targetIndex });

            // Swap
            const [draggedStep] = routine.splice(draggedIndex, 1);
            routine.splice(targetIndex, 0, draggedStep);

            console.log('✅ New routine order:', routine.map(s => s.name));

            this.saveRoutines();
            this.renderRoutine(routineType);

            showToast('Routine order updated', 'success');
        } else {
            console.log('⚠️ Dropped on same element');
        }

        return false;
    }

    /**
     * Handle drag end
     */
    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');

        document.querySelectorAll('.routine-step').forEach(step => {
            step.classList.remove('drag-over');
        });
    }

    /**
     * Update routine summary
     */
    updateSummary(routineType) {
        const steps = this.routines[routineType];
        const stepCount = steps.length;
        const duration = steps.reduce((sum, step) => sum + (step.duration || 1), 0);
        const waitTime = steps.reduce((sum, step) => sum + (step.waitTime || 0), 0);
        const actives = steps.filter(step => step.isActive).length;

        document.getElementById(`${routineType}StepCount`).textContent = stepCount;
        document.getElementById(`${routineType}Duration`).textContent = `~${duration} min`;
        document.getElementById(`${routineType}WaitTime`).textContent = waitTime > 0 ? `${waitTime} min` : '0 min';
        document.getElementById(`${routineType}Actives`).textContent = actives;

        // Update next routine countdown
        this.updateNextRoutineCountdown(routineType);
    }

    /**
     * Update next routine countdown
     */
    updateNextRoutineCountdown(routineType) {
        const countdownEl = document.getElementById(`${routineType}NextRoutine`);
        if (!countdownEl) return;

        const now = new Date();
        const currentHour = now.getHours();

        let nextRoutineTime;
        let nextRoutineName;

        if (routineType === 'morning') {
            // Next routine is evening (assume 8 PM)
            nextRoutineTime = new Date(now);
            nextRoutineTime.setHours(20, 0, 0, 0);

            // If it's already past 8 PM, set to tomorrow morning
            if (currentHour >= 20) {
                nextRoutineTime.setDate(nextRoutineTime.getDate() + 1);
                nextRoutineTime.setHours(7, 0, 0, 0);
                nextRoutineName = 'Morning Routine';
            } else {
                nextRoutineName = 'Evening Routine';
            }
        } else {
            // Next routine is morning (assume 7 AM)
            nextRoutineTime = new Date(now);
            nextRoutineTime.setDate(nextRoutineTime.getDate() + 1);
            nextRoutineTime.setHours(7, 0, 0, 0);
            nextRoutineName = 'Morning Routine';
        }

        const hoursUntil = Math.floor((nextRoutineTime - now) / (1000 * 60 * 60));
        const minutesUntil = Math.floor(((nextRoutineTime - now) % (1000 * 60 * 60)) / (1000 * 60));

        let countdownText;
        if (hoursUntil > 0) {
            countdownText = `Next: ${nextRoutineName} in ${hoursUntil}h ${minutesUntil}m`;
        } else {
            countdownText = `Next: ${nextRoutineName} in ${minutesUntil}m`;
        }

        countdownEl.querySelector('span').textContent = countdownText;
    }

    /**
     * Toggle active ingredients breakdown (inline)
     */
    toggleActiveIngredientsBreakdown(routineType) {
        const breakdown = document.getElementById(`${routineType}ActiveBreakdown`);
        const content = document.getElementById(`${routineType}ActiveContent`);

        // Toggle collapsed state
        const isCollapsed = breakdown.classList.contains('collapsed');

        if (isCollapsed) {
            // Populate content before showing
            const steps = this.routines[routineType];

            console.log('🔍 Active Ingredients Breakdown for', routineType);
            console.log('Total steps:', steps.length);

            // Track ingredients and their concentrations
            const ingredientsMap = new Map();

            // Process each step to extract active ingredients
            steps.forEach(step => {
                console.log('Processing step:', step.name, '| Category:', step.category, '| isActive:', step.isActive);

                if (step.isActive) {
                    const ingredientKey = step.category;
                    const ingredientName = this.getIngredientNameFromCategory(step.category);

                    console.log('✅ Active ingredient found:', ingredientName);

                    if (!ingredientsMap.has(ingredientKey)) {
                        ingredientsMap.set(ingredientKey, {
                            name: ingredientName,
                            concentration: 0,
                            products: []
                        });
                    }

                    const ingredient = ingredientsMap.get(ingredientKey);
                    const estimatedConcentration = this.getEstimatedConcentration(step.category);
                    ingredient.concentration += estimatedConcentration;
                    ingredient.products.push(step.name);
                }
            });

            console.log('📊 Ingredients Map size:', ingredientsMap.size);

            // Generate HTML
            if (ingredientsMap.size === 0) {
                content.innerHTML = `
                    <div class="no-actives-message">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <h4>No Active Ingredients</h4>
                        <p>Add products with active ingredients to see the breakdown here.</p>
                    </div>
                `;
            } else {
                let html = '<div class="ingredient-breakdown-list">';
                let warnings = [];

                ingredientsMap.forEach((ingredient, key) => {
                    html += `
                        <div class="ingredient-item">
                            <div class="ingredient-header">
                                <div class="ingredient-name">${ingredient.name}</div>
                                <div class="ingredient-concentration">${ingredient.concentration}%</div>
                            </div>
                            <div class="ingredient-products">
                                <strong>Found in:</strong> ${ingredient.products.join(', ')}
                            </div>
                        </div>
                    `;

                    // Check for high concentrations
                    if (this.isConcentrationTooHigh(key, ingredient.concentration)) {
                        warnings.push({
                            ingredient: ingredient.name,
                            concentration: ingredient.concentration,
                            recommendation: this.getConcentrationWarning(key)
                        });
                    }
                });

                html += '</div>';

                // Add warnings if any
                if (warnings.length > 0) {
                    html += warnings.map(warning => `
                        <div class="concentration-warning">
                            <div class="concentration-warning-icon">⚠️</div>
                            <div class="concentration-warning-content">
                                <h4>High Concentration Alert: ${warning.ingredient}</h4>
                                <p>You're using ${warning.concentration}% total concentration across multiple products. ${warning.recommendation}</p>
                            </div>
                        </div>
                    `).join('');
                }

                content.innerHTML = html;
            }

            // Show the breakdown
            breakdown.classList.remove('collapsed');
        } else {
            // Hide the breakdown
            breakdown.classList.add('collapsed');
        }
    }

    /**
     * Close active ingredients modal (legacy - kept for compatibility)
     */
    closeActiveIngredientsModal() {
        // This method is no longer used but kept for backward compatibility
        console.log('closeActiveIngredientsModal called - this is now handled by toggleActiveIngredientsBreakdown');
    }

    /**
     * Get ingredient name from category
     */
    getIngredientNameFromCategory(category) {
        const names = {
            'cleanser': 'Cleansing Agents',
            'exfoliator': 'Chemical Exfoliants',  // Routine category
            'toner': 'Toner Actives',
            'essence': 'Essence Complex',
            'treatment': 'Treatment Actives',     // Routine category
            'serum-water-based': 'Water-Based Serum Actives',
            'serum-oil-based': 'Oil-Based Serum Actives',
            'eye-cream': 'Eye Treatment Actives',
            'moisturizer': 'Moisturizing Actives',
            'oil': 'Facial Oil Blend',
            'spf': 'UV Protection Filters',
            'Serum': 'Active Serum Complex',      // Digital Shelf category
            'Treatment': 'Treatment Actives',     // Digital Shelf category
            'Exfoliator': 'Chemical Exfoliants',  // Digital Shelf category
            'Sunscreen': 'UV Filters'
        };
        return names[category] || category;
    }

    /**
     * Get estimated concentration for category
     */
    getEstimatedConcentration(category) {
        const concentrations = {
            'cleanser': 2,
            'toner': 3,
            'essence': 4,
            'serum-water-based': 5,
            'serum-oil-based': 5,
            'eye-cream': 3,
            'moisturizer': 2,
            'oil': 4,
            'spf': 15,
            'Serum': 5,
            'Treatment': 10,
            'Exfoliator': 8,
            'Sunscreen': 15
        };
        return concentrations[category] || 3;
    }

    /**
     * Check if concentration is too high
     */
    isConcentrationTooHigh(category, concentration) {
        const limits = {
            'cleanser': 5,
            'toner': 8,
            'essence': 10,
            'serum-water-based': 10,
            'serum-oil-based': 10,
            'eye-cream': 8,
            'moisturizer': 6,
            'oil': 10,
            'spf': 20,
            'Serum': 10,
            'Treatment': 15,
            'Exfoliator': 10,
            'Sunscreen': 20
        };
        return concentration > (limits[category] || 15);
    }

    /**
     * Get concentration warning
     */
    getConcentrationWarning(category) {
        const warnings = {
            'cleanser': 'Using multiple cleansers may strip your skin. One gentle cleanser is usually sufficient.',
            'toner': 'Layering multiple toners can be excessive. Choose one that addresses your main concern.',
            'essence': 'Multiple essences may be redundant. Focus on one high-quality essence.',
            'serum-water-based': 'Too many water-based serums can overwhelm your skin. Stick to 1-2 key serums.',
            'serum-oil-based': 'Layering multiple oils can feel heavy. One nourishing oil is typically enough.',
            'eye-cream': 'The eye area is delicate. One targeted eye cream is sufficient.',
            'moisturizer': 'Multiple moisturizers can clog pores. Choose one appropriate for your skin type.',
            'oil': 'Too many facial oils can be comedogenic. One well-formulated oil is best.',
            'spf': 'Layering multiple sunscreens may cause pilling. One broad-spectrum SPF 30+ is sufficient.',
            'Serum': 'Consider using only one active serum per routine to avoid irritation.',
            'Treatment': 'High concentrations of treatment actives can cause sensitivity. Consider alternating products.',
            'Exfoliator': 'Over-exfoliation can damage your skin barrier. Use exfoliants 2-3 times per week maximum.',
            'Sunscreen': 'While SPF is important, layering multiple sunscreens may cause pilling. One broad-spectrum SPF 30+ is sufficient.'
        };
        return warnings[category] || 'Consider reducing the number of products with this ingredient to avoid potential irritation.';
    }

    /**
     * Setup routine timer listeners
     */
    setupRoutineTimer() {
        const startMorning = document.getElementById('startMorningRoutine');
        const startEvening = document.getElementById('startEveningRoutine');
        const dashStartMorning = document.getElementById('startMorningBtn');
        const dashStartEvening = document.getElementById('startEveningBtn');
        const btnPause = document.getElementById('btnTimerPause');
        const btnStop = document.getElementById('btnTimerStop');
        const btnClose = document.getElementById('btnTimerClose');

        if (startMorning) {
            startMorning.onclick = () => this.startRoutine('morning');
        }
        if (startEvening) {
            startEvening.onclick = () => this.startRoutine('evening');
        }
        if (dashStartMorning) {
            dashStartMorning.onclick = () => this.startRoutine('morning');
        }
        if (dashStartEvening) {
            dashStartEvening.onclick = () => this.startRoutine('evening');
        }
        if (btnPause) {
            btnPause.onclick = () => this.togglePause();
        }
        if (btnStop) {
            btnStop.onclick = () => this.stopRoutine();
        }
        if (btnClose) {
            btnClose.onclick = () => this.stopRoutine();
        }
    }

    /**
     * Start the guided routine
     */
    startRoutine(routineType) {
        const steps = this.routines[routineType];
        if (!steps || steps.length === 0) {
            alert('Please add some products to your routine first!');
            return;
        }

        this.currentTimerRoutine = routineType;
        this.currentTimerStepIndex = -1;
        this.isTimerPaused = false;
        this.isWaitTime = false;

        // Reset UI
        const overlay = document.getElementById('routineTimerOverlay');
        const preparation = document.getElementById('timerPreparation');
        const active = document.getElementById('timerActive');
        const complete = document.getElementById('timerComplete');

        overlay.classList.add('active');
        preparation.classList.remove('hidden');
        active.classList.add('hidden');
        complete.classList.add('hidden');

        // Start preparation countdown
        this.startPreparationCountdown();
    }

    /**
     * Start the 5-second preparation countdown
     */
    startPreparationCountdown() {
        let count = 5;
        const display = document.getElementById('preparationCountdown');
        display.textContent = count;

        this.timerInterval = setInterval(() => {
            if (this.isTimerPaused) return;

            count--;
            display.textContent = count;

            if (count <= 0) {
                clearInterval(this.timerInterval);
                this.startNextStep();
            }
        }, 1000);
    }

    /**
     * Move to the next step in the routine
     */
    startNextStep() {
        this.currentTimerStepIndex++;
        const steps = this.routines[this.currentTimerRoutine];

        if (this.currentTimerStepIndex >= steps.length) {
            this.showCompletion();
            return;
        }

        const step = steps[this.currentTimerStepIndex];
        this.isWaitTime = false;

        // Update UI
        document.getElementById('timerPreparation').classList.add('hidden');
        document.getElementById('timerActive').classList.remove('hidden');
        document.getElementById('timerWaitNotice').classList.add('hidden');

        document.getElementById('timerStepNumber').textContent = `Step ${this.currentTimerStepIndex + 1}/${steps.length}`;
        document.getElementById('timerStepName').textContent = step.name;
        document.getElementById('timerStepInstructions').textContent = this.getInstructionsForCategory(step.category);

        // Set duration (default 60s for application, or use wait time if applicable)
        this.timerTotalTime = 60; // 60 seconds for application
        this.timerTimeLeft = this.timerTotalTime;

        // Highlight in background routine list
        this.highlightStep(this.currentTimerStepIndex);

        this.startTimer();
    }

    /**
     * Highlight the current step in the routine list
     */
    highlightStep(index) {
        const container = document.getElementById(`${this.currentTimerRoutine}Steps`);
        if (!container) return;

        const steps = container.querySelectorAll('.routine-step');
        steps.forEach((s, i) => {
            if (i === index) {
                s.classList.add('timer-active-step');
                s.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                s.classList.remove('timer-active-step');
            }
        });
    }

    /**
     * Start the actual countdown timer
     */
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.updateTimerUI();

        this.timerInterval = setInterval(() => {
            if (this.isTimerPaused) return;

            this.timerTimeLeft--;
            this.updateTimerUI();

            if (this.timerTimeLeft <= 0) {
                clearInterval(this.timerInterval);

                // If we just finished application, check if there's a wait time
                if (!this.isWaitTime) {
                    const step = this.routines[this.currentTimerRoutine][this.currentTimerStepIndex];
                    const waitTime = this.getWaitTimeForCategory(step.category, step.isActive);

                    if (waitTime > 0) {
                        this.startWaitTimer(waitTime);
                    } else {
                        this.startNextStep();
                    }
                } else {
                    this.startNextStep();
                }
            }
        }, 1000);
    }

    /**
     * Start the wait time timer
     */
    startWaitTimer(minutes) {
        this.isWaitTime = true;
        this.timerTotalTime = minutes * 60;
        this.timerTimeLeft = this.timerTotalTime;

        document.getElementById('timerWaitNotice').classList.remove('hidden');
        document.getElementById('timerWaitTime').textContent = `${minutes} min`;
        document.getElementById('timerStepInstructions').textContent = 'Waiting for absorption...';

        this.startTimer();
    }

    /**
     * Update the timer UI (circle and text)
     */
    updateTimerUI() {
        const minutes = Math.floor(this.timerTimeLeft / 60);
        const seconds = this.timerTimeLeft % 60;
        document.getElementById('timerTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Update circle progress
        const progress = document.getElementById('timerCircleProgress');
        if (progress) {
            const circumference = 2 * Math.PI * 90;
            const offset = circumference - (this.timerTimeLeft / this.timerTotalTime) * circumference;
            progress.style.strokeDashoffset = offset;
        }
    }

    /**
     * Toggle pause/resume
     */
    togglePause() {
        this.isTimerPaused = !this.isTimerPaused;
        const btn = document.getElementById('btnTimerPause');

        if (this.isTimerPaused) {
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Resume
            `;
            btn.classList.add('resuming');
        } else {
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Pause
            `;
            btn.classList.remove('resuming');
        }
    }

    /**
     * Stop the routine completely
     */
    stopRoutine() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.isTimerPaused = false;

        document.getElementById('routineTimerOverlay').classList.remove('active');

        // Remove highlighs
        if (this.currentTimerRoutine) {
            const container = document.getElementById(`${this.currentTimerRoutine}Steps`);
            if (container) {
                container.querySelectorAll('.routine-step').forEach(s => s.classList.remove('timer-active-step'));
            }
        }
    }

    /**
     * Show completion state
     */
    showCompletion() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        document.getElementById('timerActive').classList.add('hidden');
        document.getElementById('timerComplete').classList.remove('hidden');

        // Log completion
        this.logRoutineCompletion(this.currentTimerRoutine);

        // Remove highlighting
        const container = document.getElementById(`${this.currentTimerRoutine}Steps`);
        if (container) {
            container.querySelectorAll('.routine-step').forEach(s => s.classList.remove('timer-active-step'));
        }
    }

    /**
     * Log routine completion to stats and history
     */
    logRoutineCompletion(type) {
        // 1. Update Morning/Evening counts
        const stats = StorageManager.load('routineStats', { morning: 0, evening: 0 });
        if (type === 'morning') stats.morning++;
        else if (type === 'evening') stats.evening++;
        StorageManager.save('routineStats', stats);

        // 2. Update daily routine status (for dashboard trend)
        const today = getLocalDateString();
        const dailyRoutines = StorageManager.load(`routines_${today}`, { morning: false, evening: false });
        dailyRoutines[type] = true;
        StorageManager.save(`routines_${today}`, dailyRoutines);

        // 3. Update routineHistory for streaks (if not already logged today)
        const history = StorageManager.load('routineHistory', []);
        if (!history.includes(today)) {
            history.push(today);
            StorageManager.save('routineHistory', history);
        }

        // 3b. Update type-specific history for cloud sync
        const typeHistory = StorageManager.load(`${type}History`, []);
        if (!typeHistory.includes(today)) {
            typeHistory.push(today);
            StorageManager.save(`${type}History`, typeHistory);
        }

        // 4. Update dashboard if available
        if (window.app) {
            if (typeof window.app.loadRoutineStatus === 'function') window.app.loadRoutineStatus();
            if (typeof window.app.loadHealthScore === 'function') window.app.loadHealthScore();
            if (typeof window.app.loadStreakData === 'function') window.app.loadStreakData();
        }

        // 5. Sync to cloud
        this.saveRoutines();

        console.log(`✅ ${type} routine logged. Stats:`, stats);
    }

    /**
     * Migrate legacy routineHistory data to routineStats
     * This ensures old completions are tallied in the new morning/evening breakdown
     */
    migrateLegacyRoutineHistory() {
        const stats = StorageManager.load('routineStats', null);
        const history = StorageManager.load('routineHistory', []);

        // Only migrate if stats are missing but history exists
        if (!stats && history.length > 0) {
            console.log('🔄 Migrating legacy routine history to stats...');

            // We'll split the history 50/50 as a reasonable estimate
            // since we don't know which were morning vs evening
            const morningCount = Math.ceil(history.length / 2);
            const eveningCount = Math.floor(history.length / 2);

            const newStats = {
                morning: morningCount,
                evening: eveningCount
            };

            StorageManager.save('routineStats', newStats);
            console.log(`✅ Migrated ${history.length} old routines: ${morningCount} Morning, ${eveningCount} Evening`);
        } else if (!stats) {
            // First time user or empty history
            StorageManager.save('routineStats', { morning: 0, evening: 0 });
        }
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.RoutineManager = RoutineManager;
}
