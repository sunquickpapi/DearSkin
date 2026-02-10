// ========================================
// Product Manager - Product CRUD Operations
// ========================================

class ProductManager {
    constructor() {
        this.currentProduct = null;
        this.products = [];
        this.selectedPhoto = null;
        this.listenersInitialized = false; // Track if global listeners are set
        this.selectedProductForRoutine = null; // Track product for routine assignment
        // init() removed from constructor to prevent race conditions during app load
    }

    /**
     * Initialize product manager
     */
    async init() {
        await this.loadProducts();
        this.setupEventListeners();
    }

    /**
     * Load all products from storage
     */
    async loadProducts() {
        try {
            // Check if user is authenticated
            const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;

            if (user && window.FirebaseStorage) {
                // User is signed in - load from Firestore (source of truth)
                console.log('📥 Loading products from Firestore for user:', user.email);
                this.products = await window.FirebaseStorage.getProducts();
                console.log(`✅ Loaded ${this.products.length} products from Firestore`);

                // Save to IndexedDB for offline use
                if (this.products.length > 0) {
                    for (const product of this.products) {
                        await StorageManager.saveProduct(product);
                    }
                }
            } else {
                // User not signed in or Firebase not ready - load from IndexedDB
                console.log('📥 Loading products from IndexedDB (offline mode)');
                this.products = await StorageManager.getProducts();
                console.log(`✅ Loaded ${this.products.length} products from IndexedDB`);
            }

            return this.products;
        } catch (error) {
            console.error('Error loading products:', error);
            showToast('Failed to load products', 'error');
            return [];
        }
    }

    /**
     * Setup event listeners (only once for modal elements)
     */
    setupEventListeners() {
        // Only set up global listeners once
        if (this.listenersInitialized) {
            return;
        }

        // Modal close buttons
        const closeModalBtn = document.getElementById('closeProductModal');
        const cancelModalBtn = document.getElementById('cancelProductModal');

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.closeProductModal());
        }
        if (cancelModalBtn) {
            cancelModalBtn.addEventListener('click', () => this.closeProductModal());
        }

        // Save product button
        const saveProductBtn = document.getElementById('saveProductBtn');
        if (saveProductBtn) {
            saveProductBtn.addEventListener('click', () => this.saveProduct());
        }

        // Photo upload
        const photoInput = document.getElementById('productPhoto');
        if (photoInput) {
            photoInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        }

        // Photo upload area click
        const photoUploadArea = document.getElementById('photoUploadArea');
        if (photoUploadArea) {
            photoUploadArea.addEventListener('click', () => {
                document.getElementById('productPhoto').click();
            });
        }

        // Drag and drop
        if (photoUploadArea) {
            photoUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                photoUploadArea.classList.add('dragover');
            });

            photoUploadArea.addEventListener('dragleave', () => {
                photoUploadArea.classList.remove('dragover');
            });

            photoUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                photoUploadArea.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    this.processImageFile(file);
                }
            });
        }

        // Close modal on overlay click
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeProductModal();
                }
            });
        }

        // Add to Routine Modal
        const closeAddToRoutineBtn = document.getElementById('closeAddToRoutineModal');
        if (closeAddToRoutineBtn) {
            closeAddToRoutineBtn.addEventListener('click', () => this.closeAddToRoutineModal());
        }

        const addToRoutineModal = document.getElementById('addToRoutineModal');
        if (addToRoutineModal) {
            addToRoutineModal.addEventListener('click', (e) => {
                if (e.target === addToRoutineModal) {
                    this.closeAddToRoutineModal();
                }
            });
        }

        // Routine selection buttons
        document.querySelectorAll('.routine-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const routineType = btn.dataset.routine;
                this.addProductToRoutine(routineType);
            });
        });

        this.listenersInitialized = true;
    }

    /**
     * Open modal for adding new product
     */
    openAddProductModal() {
        this.currentProduct = null;
        this.selectedPhoto = null;

        const modal = document.getElementById('productModal');
        const modalTitle = document.getElementById('productModalTitle');
        const form = document.getElementById('productForm');

        if (modalTitle) modalTitle.textContent = 'Add Product';
        if (form) form.reset();

        // Clear photo preview
        const photoPreview = document.getElementById('photoPreview');
        const photoUploadArea = document.getElementById('photoUploadArea');
        if (photoPreview) photoPreview.style.display = 'none';
        if (photoUploadArea) photoUploadArea.style.display = 'flex';

        if (modal) modal.classList.add('active');

        // Announce to screen readers
        AccessibilityManager.announceNavigation('Add Product');
    }

    /**
     * Open modal for editing existing product
     */
    async openEditProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            showToast('Product not found', 'error');
            return;
        }

        this.currentProduct = product;
        this.selectedPhoto = product.photo || null;

        const modal = document.getElementById('productModal');
        const modalTitle = document.getElementById('productModalTitle');

        if (modalTitle) modalTitle.textContent = 'Edit Product';

        // Populate form
        document.getElementById('productName').value = product.name || '';
        document.getElementById('productBrand').value = product.brand || '';
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('productPurchaseDate').value = product.purchaseDate || '';
        document.getElementById('productExpiryDate').value = product.expiryDate || '';
        document.getElementById('productNotes').value = product.notes || '';

        // Show photo preview if exists
        if (product.photo) {
            const photoPreview = document.getElementById('photoPreview');
            const photoPreviewImg = document.getElementById('photoPreviewImg');
            const photoUploadArea = document.getElementById('photoUploadArea');

            if (photoPreviewImg) photoPreviewImg.src = product.photo;
            if (photoPreview) photoPreview.style.display = 'block';
            if (photoUploadArea) photoUploadArea.style.display = 'none';
        }

        if (modal) modal.classList.add('active');
    }

    /**
     * Close product modal
     */
    closeProductModal() {
        const modal = document.getElementById('productModal');
        if (modal) modal.classList.remove('active');

        this.currentProduct = null;
        this.selectedPhoto = null;

        const form = document.getElementById('productForm');
        if (form) form.reset();
    }

    /**
     * Handle photo file upload
     */
    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.processImageFile(file);
        } else {
            showToast('Please select a valid image file', 'warning');
        }
    }

    /**
     * Process and compress image file
     */
    processImageFile(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const compressed = this.compressImage(img);
                this.selectedPhoto = compressed;
                this.showPhotoPreview(compressed);
            };
            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    /**
     * Compress image to reduce storage size
     */
    compressImage(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set max dimensions
        const maxWidth = 800;
        const maxHeight = 800;

        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Return base64 string with compression
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Show photo preview
     */
    showPhotoPreview(photoData) {
        const photoPreview = document.getElementById('photoPreview');
        const photoPreviewImg = document.getElementById('photoPreviewImg');
        const photoUploadArea = document.getElementById('photoUploadArea');

        if (photoPreviewImg) photoPreviewImg.src = photoData;
        if (photoPreview) photoPreview.style.display = 'block';
        if (photoUploadArea) photoUploadArea.style.display = 'none';
    }

    /**
     * Remove photo
     */
    removePhoto() {
        this.selectedPhoto = null;

        const photoPreview = document.getElementById('photoPreview');
        const photoUploadArea = document.getElementById('photoUploadArea');
        const photoInput = document.getElementById('productPhoto');

        if (photoPreview) photoPreview.style.display = 'none';
        if (photoUploadArea) photoUploadArea.style.display = 'flex';
        if (photoInput) photoInput.value = '';
    }

    /**
     * Validate product form
     */
    validateForm() {
        const name = document.getElementById('productName').value.trim();

        if (!name) {
            showToast('Product name is required', 'warning');
            return false;
        }

        return true;
    }

    /**
     * Save product (create or update)
     */
    async saveProduct() {
        if (!this.validateForm()) {
            return;
        }

        const productData = {
            name: document.getElementById('productName').value.trim(),
            brand: document.getElementById('productBrand').value.trim(),
            category: document.getElementById('productCategory').value,
            purchaseDate: document.getElementById('productPurchaseDate').value,
            expiryDate: document.getElementById('productExpiryDate').value,
            notes: document.getElementById('productNotes').value.trim(),
            photo: this.selectedPhoto,
            routines: this.currentProduct?.routines || { morning: false, evening: false },
            createdAt: this.currentProduct?.createdAt || new Date().toISOString()
        };

        // If editing, preserve the ID
        if (this.currentProduct) {
            productData.id = this.currentProduct.id;
        }

        try {
            // Save to IndexedDB first (for immediate UI update)
            const productId = await StorageManager.saveProduct(productData);
            productData.id = productId; // Ensure ID is set

            // If user is authenticated, also save to Firestore
            const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;
            if (user && window.FirebaseStorage) {
                try {
                    await window.FirebaseStorage.saveProduct(productData);
                    console.log('✅ Product saved to Firestore');
                } catch (firestoreError) {
                    console.error('Error saving to Firestore:', firestoreError);
                    showToast('Saved locally, but failed to sync to cloud', 'warning');
                }
            }

            showToast(
                this.currentProduct ? 'Product updated successfully' : 'Product added successfully',
                'success'
            );

            this.closeProductModal();
            await this.loadProducts();
            this.renderProductGrid();

            // Update dashboard stats if on home tab
            if (window.app) {
                window.app.loadInventoryStats();
            }
        } catch (error) {
            console.error('Error saving product:', error);
            showToast('Failed to save product', 'error');
        }
    }

    /**
     * Delete product with confirmation
     */
    async deleteProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const confirmed = confirm(`Are you sure you want to delete "${product.name}"?`);
        if (!confirmed) return;

        try {
            // Delete from IndexedDB
            await StorageManager.deleteProduct(productId);

            // If user is authenticated, also delete from Firestore
            const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;
            if (user && window.FirebaseStorage) {
                try {
                    await window.FirebaseStorage.deleteProduct(productId);
                    console.log('✅ Product deleted from Firestore');
                } catch (firestoreError) {
                    console.error('Error deleting from Firestore:', firestoreError);
                    showToast('Deleted locally, but failed to sync to cloud', 'warning');
                }
            }

            showToast('Product deleted successfully', 'success');

            await this.loadProducts();
            this.renderProductGrid();

            // Update dashboard stats
            if (window.app) {
                window.app.loadInventoryStats();
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('Failed to delete product', 'error');
        }
    }

    /**
     * Render product grid
     */
    renderProductGrid() {
        const container = document.getElementById('productsContent');
        if (!container) return;

        if (this.products.length === 0) {
            container.innerHTML = this.renderEmptyState();
            // Attach listener to the "Add First Product" button
            const addBtn = document.getElementById('addProductBtn');
            if (addBtn) {
                addBtn.addEventListener('click', () => this.openAddProductModal());
            }
            return;
        }

        const gridHTML = `
            <div class="products-header">
                <div class="products-stats">
                    <span>${this.products.length} product${this.products.length !== 1 ? 's' : ''}</span>
                </div>
                <button class="btn btn-primary" id="addProductBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Product
                </button>
            </div>
            <div class="product-grid">
                ${this.products.map(product => this.renderProductCard(product)).join('')}
            </div>
        `;

        container.innerHTML = gridHTML;

        // Attach listener to the "Add Product" button in header
        const addBtn = document.getElementById('addProductBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddProductModal());
        }

        // Attach event listeners to product cards
        this.attachProductCardListeners();
    }

    /**
     * Render individual product card
     */
    renderProductCard(product) {
        const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
        const isExpiringSoon = expiryDate && daysBetween(new Date(), expiryDate) <= 30 && daysBetween(new Date(), expiryDate) > 0;
        const isExpired = expiryDate && expiryDate < new Date();

        return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-photo">
                    ${product.photo
                ? `<img src="${product.photo}" alt="${product.name}">`
                : `<div class="product-photo-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <path d="M16 10a4 4 0 0 1-8 0"></path>
                            </svg>
                           </div>`
            }
                    ${isExpiringSoon ? '<span class="product-badge badge-warning">Expiring Soon</span>' : ''}
                    ${isExpired ? '<span class="product-badge badge-danger">Expired</span>' : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${sanitizeHTML(product.name)}</h3>
                    ${product.brand ? `<p class="product-brand">${sanitizeHTML(product.brand)}</p>` : ''}
                    ${product.category ? `<span class="product-category">${sanitizeHTML(product.category)}</span>` : ''}
                    ${product.expiryDate ? `<p class="product-expiry">Expires: ${formatDate(product.expiryDate, 'short')}</p>` : ''}
                </div>
                <div class="product-actions">
                    <button class="btn btn-icon btn-add-routine" data-action="add-routine" data-product-id="${product.id}" title="Add to routine">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="btn btn-icon btn-edit" data-action="edit" data-product-id="${product.id}" title="Edit product">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-icon btn-delete" data-action="delete" data-product-id="${product.id}" title="Delete product">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                </div>
                <h3>Your Digital Shelf</h3>
                <p>Add your skincare products to track ingredients, expiration dates, and build your routines</p>
                <button class="btn btn-primary" id="addProductBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Your First Product
                </button>
            </div>
        `;
    }

    /**
     * Attach event listeners to product cards
     */
    attachProductCardListeners() {
        const addToRoutineButtons = document.querySelectorAll('[data-action="add-routine"]');
        const editButtons = document.querySelectorAll('[data-action="edit"]');
        const deleteButtons = document.querySelectorAll('[data-action="delete"]');

        addToRoutineButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = parseInt(btn.dataset.productId);
                this.showAddToRoutineModal(productId);
            });
        });

        editButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = parseInt(btn.dataset.productId);
                this.openEditProductModal(productId);
            });
        });

        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = parseInt(btn.dataset.productId);
                this.deleteProduct(productId);
            });
        });

        // Remove photo button
        const removePhotoBtn = document.getElementById('removePhotoBtn');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => this.removePhoto());
        }
    }

    /**
     * Show add to routine modal
     */
    showAddToRoutineModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            showToast('Product not found', 'error');
            return;
        }

        this.selectedProductForRoutine = product;

        const modal = document.getElementById('addToRoutineModal');
        const productNameEl = document.getElementById('routineProductName');

        if (productNameEl) {
            productNameEl.textContent = `Add "${product.name}" to which routine?`;
        }

        if (modal) {
            modal.classList.add('active');
        }

        AccessibilityManager.announceNavigation('Add to Routine');
    }

    /**
     * Add product to selected routine
     */
    async addProductToRoutine(routineType) {
        if (!this.selectedProductForRoutine) {
            showToast('No product selected', 'error');
            return;
        }

        const product = this.selectedProductForRoutine;

        // Check if product is already in this routine
        if (product.routines && product.routines[routineType]) {
            showToast(`${product.name} is already in your ${routineType} routine`, 'warning');
            this.closeAddToRoutineModal();
            return;
        }

        try {
            // Update product's routine status
            product.routines = product.routines || { morning: false, evening: false };
            product.routines[routineType] = true;

            // Save updated product
            await StorageManager.saveProduct(product);

            // Update local products array
            const index = this.products.findIndex(p => p.id === product.id);
            if (index !== -1) {
                this.products[index] = product;
            }

            // Add to routine manager if it exists
            if (window.routineManager) {
                window.routineManager.addProductToRoutine(routineType, product);
            }

            showToast(`${product.name} added to ${routineType} routine`, 'success');
            this.closeAddToRoutineModal();

            // Refresh product grid to update UI
            this.renderProductGrid();
        } catch (error) {
            console.error('Error adding product to routine:', error);
            showToast('Failed to add product to routine', 'error');
        }
    }

    /**
     * Close add to routine modal
     */
    closeAddToRoutineModal() {
        const modal = document.getElementById('addToRoutineModal');
        if (modal) {
            modal.classList.remove('active');
        }

        this.selectedProductForRoutine = null;
    }
}

// Initialize product manager when DOM is ready
if (typeof window !== 'undefined') {
    window.ProductManager = ProductManager;
}
