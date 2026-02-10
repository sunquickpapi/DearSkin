// ========================================
console.log('🚀 DearSkin App script starting...');

class DearSkinApp {
    constructor() {
        this.currentTab = 'home';
        this.currentTrendType = 'health';
        this.userProfile = null;
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        // Check if user has completed onboarding from Firestore
        const hasCompletedOnboarding = await this.checkOnboardingStatus();

        if (!hasCompletedOnboarding) {
            // Redirect to onboarding
            window.location.href = 'onboarding.html';
            return;
        }

        // Load user profile from localStorage (for offline support)
        this.userProfile = StorageManager.load('userProfile');

        // Initialize product manager
        this.productManager = new ProductManager();
        await this.productManager.init();
        window.productManager = this.productManager;

        // Initialize routine manager
        this.routineManager = new RoutineManager();
        await this.routineManager.init();
        window.routineManager = this.routineManager;

        window.app = this; // Make app instance available globally

        // Setup event listeners
        this.setupNavigation();
        this.setupHeaderControls();
        this.setupQuickActions();
        this.setupSettingsModal();
        this.setupInventoryBreakdownModal();

        // Load home screen
        this.loadHomeScreen();

        // Start live clock
        this.startClock();

        // Request notification permission
        this.requestNotificationPermission();

        // Register service worker
        // TEMP: Disabled during development to avoid caching issues
        // this.registerServiceWorker();
    }

    /**
     * Setup tab navigation
     */
    setupNavigation() {
        const tabs = document.querySelectorAll('.tab[data-tab]');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Close any open modals when switching tabs
        const activeIngredientsModal = document.getElementById('activeIngredientsModal');
        if (activeIngredientsModal) {
            activeIngredientsModal.classList.remove('active');
        }

        // Update active tab button
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });

        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
        }

        // Update active panel
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        const activePanel = document.getElementById(`${tabName}-panel`);
        if (activePanel) {
            activePanel.classList.add('active');
        }

        this.currentTab = tabName;

        // Announce navigation
        AccessibilityManager.announceNavigation(tabName);

        // Load tab content
        this.loadTabContent(tabName);
    }

    /**
     * Show inventory routine breakdown modal
     */
    showInventoryRoutineBreakdown() {
        const modal = document.getElementById('routineBreakdownModal');
        if (modal) {
            // Refresh stats first to ensure latest data is shown
            this.loadInventoryStats();

            modal.classList.add('active');
            AccessibilityManager.announceNavigation('Routine Breakdown');
        }
    }

    /**
     * Load content for specific tab
     */
    loadTabContent(tabName) {
        switch (tabName) {
            case 'home':
                this.loadHomeScreen();
                break;
            case 'routine':
                this.loadRoutineBuilder();
                if (this.routineManager) {
                    this.routineManager.updateTabStatus();
                }
                break;
            case 'products':
                this.loadDigitalShelf();
                break;
            case 'progress':
                this.loadProgressTracker();
                break;
            case 'profile':
                this.loadProfileSettings();
                break;
        }
    }

    /**
     * Setup header controls
     */
    setupHeaderControls() {
        // Voice toggle
        const voiceToggle = document.getElementById('voiceToggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                const enabled = AccessibilityManager.toggleVoice();
                voiceToggle.classList.toggle('active', enabled);
                showToast(
                    enabled ? 'Voice guide enabled' : 'Voice guide disabled',
                    'success'
                );
            });
        }

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.cycleTheme();
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettingsModal();
            });
        }
    }

    /**
     * Cycle through themes
     */
    cycleTheme() {
        const themes = ['light', 'dark', 'high-contrast'];
        const currentTheme = document.body.getAttribute('data-theme');
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];

        AccessibilityManager.applyTheme(nextTheme);

        const settings = AccessibilityManager.loadSettings();
        settings.theme = nextTheme;
        AccessibilityManager.saveSettings(settings);

        showToast(`Theme: ${nextTheme}`, 'info');
    }

    /**
     * Setup quick action buttons
     */
    setupQuickActions() {
        const actionElements = document.querySelectorAll('[data-action]');

        actionElements.forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const action = el.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    /**
     * Handle quick action clicks
     */
    handleQuickAction(action) {
        switch (action) {
            case 'start-routine':
                this.switchTab('routine');
                // TODO: Start routine flow
                break;
            case 'log-skin':
                this.switchTab('progress');
                // Programmatically trigger upload dialog after tab switch
                setTimeout(() => {
                    if (window.progressManager) {
                        window.progressManager.triggerUpload();
                    }
                }, 100);
                break;
            case 'add-product':
                this.switchTab('products');
                // TODO: Open add product modal
                break;
            case 'view-tips':
                this.showDailyTips();
                break;
        }
    }

    /**
     * Start a minimalist digital LCD clock
     */
    startClock() {
        const hEl = document.getElementById('lcdHours');
        const mEl = document.getElementById('lcdMinutes');
        const sEl = document.getElementById('lcdSeconds');
        const ampmEl = document.getElementById('lcdAMPM');

        const updateClock = () => {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const ampm = hours >= 12 ? 'PM' : 'AM';

            hours = hours % 12;
            hours = hours ? hours : 12; // 0 becomes 12

            if (hEl) hEl.textContent = hours.toString().padStart(2, '0');
            if (mEl) mEl.textContent = minutes.toString().padStart(2, '0');
            if (sEl) sEl.textContent = seconds.toString().padStart(2, '0');
            if (ampmEl) ampmEl.textContent = ampm;
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    /**
     * Load home screen
     */
    async loadHomeScreen() {
        // Update user name
        const userNameEl = document.getElementById('userName');
        if (userNameEl && this.userProfile) {
            userNameEl.textContent = this.userProfile.name || 'Friend';
        }

        // Update current date
        const currentDateEl = document.getElementById('currentDate');
        if (currentDateEl) {
            currentDateEl.textContent = formatDate(new Date(), 'elegant');
        }

        // Load all dashboard widgets
        await Promise.all([
            this.loadRoutineStatus(),
            this.loadHealthScore(),
            this.loadStreakData(),
            this.loadInventoryStats(),
            this.loadEnvironmentalData(),
            this.loadReminders(),
            this.loadDailyInsights(),
            this.loadProgressStats()
        ]);

        // Setup refresh weather button if not already setup
        const refreshWeatherBtn = document.getElementById('refreshWeatherBtn');
        if (refreshWeatherBtn && !refreshWeatherBtn.dataset.listener) {
            refreshWeatherBtn.addEventListener('click', () => this.loadEnvironmentalData());
            refreshWeatherBtn.dataset.listener = 'true';
        }

        // Setup set location button
        const setLocBtn = document.getElementById('setLocationBtn');
        if (setLocBtn && !setLocBtn.dataset.listener) {
            setLocBtn.addEventListener('click', () => this.toggleLocationSearch());
            setLocBtn.dataset.listener = 'true';
        }

        // Setup location search confirm button
        const confirmLocBtn = document.getElementById('confirmLocationBtn');
        if (confirmLocBtn && !confirmLocBtn.dataset.listener) {
            confirmLocBtn.addEventListener('click', () => this.searchLocation());
            confirmLocBtn.dataset.listener = 'true';
        }

        // Setup Enter key for search input
        const locSearchInput = document.getElementById('locationSearchInput');
        if (locSearchInput && !locSearchInput.dataset.listener) {
            locSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchLocation();
            });
            locSearchInput.dataset.listener = 'true';
        }

        // Setup Manage Reminders button
        const manageRemindersBtn = document.getElementById('manageRemindersBtn');
        if (manageRemindersBtn && !manageRemindersBtn.dataset.listener) {
            manageRemindersBtn.addEventListener('click', () => this.openReminderModal());
            manageRemindersBtn.dataset.listener = 'true';
        }

        // Setup Reminder Form
        const reminderForm = document.getElementById('reminderForm');
        if (reminderForm && !reminderForm.dataset.listener) {
            reminderForm.addEventListener('submit', (e) => this.saveReminder(e));
            reminderForm.dataset.listener = 'true';
        }

        // Setup Modal Close button
        const reminderModal = document.getElementById('reminderModal');
        if (reminderModal) {
            const closeBtn = reminderModal.querySelector('.close-modal');
            if (closeBtn && !closeBtn.dataset.listener) {
                closeBtn.addEventListener('click', () => {
                    document.getElementById('reminderModalOverlay').classList.remove('active');
                });
                closeBtn.dataset.listener = 'true';
            }

            // Close on outside click
            window.addEventListener('click', (event) => {
                const overlay = document.getElementById('reminderModalOverlay');
                if (event.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        }
    }

    /**
     * Load routine status
     */
    loadRoutineStatus() {
        const today = getLocalDateString();
        const todayRoutines = StorageManager.load(`routines_${today}`, { morning: false, evening: false });

        const now = new Date();
        const currentHour = now.getHours();
        const isMorningTime = currentHour < 16; // Before 4 PM

        // Helper to handle nudge feedback
        const setupNudge = (btn, statusEl) => {
            btn.onclick = () => {
                statusEl.classList.remove('status-highlight');
                void statusEl.offsetWidth; // Trigger reflow
                statusEl.classList.add('status-highlight');
                // Remove class after animation finishes
                setTimeout(() => statusEl.classList.remove('status-highlight'), 800);
            };
        };

        // Update morning status
        const morningBtn = document.getElementById('startMorningBtn');
        const morningStatus = document.getElementById('morningStatus');
        if (morningBtn) {
            // Reset state
            morningBtn.classList.remove('btn-disabled-timing');
            morningBtn.disabled = false;

            if (todayRoutines.morning) {
                morningBtn.textContent = 'Done';
                morningBtn.disabled = true;
                if (morningStatus) morningStatus.textContent = 'Completed for today';
            } else if (!isMorningTime) {
                morningBtn.textContent = 'Start';
                morningBtn.classList.add('btn-disabled-timing');
                if (morningStatus) {
                    morningStatus.textContent = 'Available tomorrow';
                    setupNudge(morningBtn, morningStatus);
                }
            } else {
                morningBtn.textContent = 'Start';
                morningBtn.onclick = () => this.startRoutine('morning');
                if (morningStatus) morningStatus.textContent = 'Ready to start';
            }
        }

        // Update evening status
        const eveningBtn = document.getElementById('startEveningBtn');
        const eveningStatus = document.getElementById('eveningStatus');
        if (eveningBtn) {
            // Reset state
            eveningBtn.classList.remove('btn-disabled-timing');
            eveningBtn.disabled = false;

            if (todayRoutines.evening) {
                eveningBtn.textContent = 'Done';
                eveningBtn.disabled = true;
                if (eveningStatus) eveningStatus.textContent = 'Completed for today';
            } else if (isMorningTime) {
                eveningBtn.textContent = 'Start';
                eveningBtn.classList.add('btn-disabled-timing');
                if (eveningStatus) {
                    eveningStatus.textContent = 'Available after 4 PM';
                    setupNudge(eveningBtn, eveningStatus);
                }
            } else {
                eveningBtn.textContent = 'Start';
                eveningBtn.onclick = () => this.startRoutine('evening');
                if (eveningStatus) eveningStatus.textContent = 'Ready to start';
            }
        }
    }

    /**
     * Start a routine
     */
    startRoutine(type) {
        this.switchTab('routine');
        if (window.routineManager) {
            window.routineManager.switchRoutine(type);
        }
    }

    async loadHealthScore() {
        const scoreNumber = document.getElementById('healthScore');
        const scoreCircle = document.getElementById('scoreCircle');
        const scoreDetails = document.getElementById('scoreDetails');

        if (!scoreNumber || !scoreCircle || !scoreDetails) return;

        // Calculate scores for the last 7 days to show a trend
        const dailyScores = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const score = await this.calculateDailyScore(date);
            dailyScores.push(score);
        }

        const avgScore = Math.round(dailyScores.reduce((a, b) => a + b, 0) / dailyScores.length);
        const todayScore = dailyScores[6];

        // Animate score - show today's score for immediate feedback
        scoreNumber.textContent = todayScore || 0;
        const circumference = 283;
        const offset = circumference - ((todayScore || 0) / 100) * circumference;
        scoreCircle.style.strokeDashoffset = offset;

        // Update details based on today's performance vs average
        let feedback = '';
        if (todayScore >= 80) {
            feedback = '<p style="color: var(--color-success);">✨ Your skin habits are excellent today! Keep it up.</p>';
        } else if (todayScore >= 50) {
            feedback = '<p style="color: var(--color-warning);">💧 Good progress today. Complete your routines to boost your score!</p>';
        } else {
            feedback = '<p style="color: var(--color-text-secondary);">🌱 Consistency is key. Start your morning or evening routine to see progress.</p>';
        }
        scoreDetails.innerHTML = feedback;

        // Initialize trend filters
        this.setupTrendFilters();
        this.updateTrendChart(this.currentTrendType);

        // Setup update button
        const updateBtn = document.getElementById('updateScoreBtn');
        if (updateBtn) {
            updateBtn.onclick = () => this.switchTab('progress');
        }
    }

    /**
     * Setup event listeners for trend chart toggles
     */
    setupTrendFilters() {
        const filters = document.querySelectorAll('.trend-filter');
        filters.forEach(filter => {
            filter.addEventListener('click', () => {
                filters.forEach(f => f.classList.remove('active'));
                filter.classList.add('active');
                this.currentTrendType = filter.dataset.type;
                this.updateTrendChart(this.currentTrendType);
            });
            filter.dataset.listener = 'true';
        });
    }

    /**
     * Update the trend chart based on selected type
     */
    async updateTrendChart(type = 'health') {
        const dailyData = [];
        const history = StorageManager.load('routineHistory', []);

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setHours(12, 0, 0, 0); // Avoid edge cases around midnight
            date.setDate(date.getDate() - i);
            const dateStr = getLocalDateString(date);

            if (type === 'health') {
                const score = await this.calculateDailyScore(date);
                dailyData.push(score);
            } else {
                // Return 100 for completed, 0 for not (Binary representation for bars)
                const routines = StorageManager.load(`routines_${dateStr}`, { morning: false, evening: false });
                let value = routines[type] ? 100 : 0;

                // Fallback to general history only if we have NO granular data for this day (Legacy data)
                const hasAnyGranularStatus = routines.morning || routines.evening;
                if (value === 0 && !hasAnyGranularStatus && history.includes(dateStr)) {
                    value = 100;
                }

                dailyData.push(value);
            }
        }
        this.renderScoreTrend(dailyData, type);
    }

    /**
     * Calculate a single day's score based on routines and logs
     */
    async calculateDailyScore(date) {
        const dateStr = getLocalDateString(date);

        // 1. Routine Consistency (50 points max)
        const routineStats = StorageManager.load(`routines_${dateStr}`, { morning: false, evening: false });
        let routineScore = 0;
        if (routineStats.morning) routineScore += 25;
        if (routineStats.evening) routineScore += 25;

        // Fallback: Check global routine history ONLY if we have no granular breakdown at all (Legacy data)
        const hasAnyGranularStatus = routineStats.morning || routineStats.evening;
        if (routineScore === 0 && !hasAnyGranularStatus) {
            const history = StorageManager.load('routineHistory', []);
            if (history.includes(dateStr)) {
                routineScore = 40; // Award "General Consistency" points
            }
        }

        // 2. Skin Log Activity (50 points max)
        const skinLogs = StorageManager.load('skinLogs', []);
        const logForDay = skinLogs.find(l => l.date === dateStr);

        let logScore = 0;
        if (logForDay) {
            logScore += 20; // Points for just logging
            if (logForDay.hydration >= 4) logScore += 10;
            if (logForDay.symptoms && logForDay.symptoms.length === 0) logScore += 10;
            if (logForDay.mood === 'good') logScore += 10;
        }

        return Math.min(100, routineScore + logScore);
    }

    /**
     * Load inventory stats
     */
    async loadInventoryStats() {
        const products = await StorageManager.getProducts();

        const totalEl = document.getElementById('totalProducts');
        const expiringEl = document.getElementById('expiringProducts');
        const activeEl = document.getElementById('activeProducts');

        if (totalEl) totalEl.textContent = products.length;

        // Count expiring products (within 30 days)
        const expiringCount = products.filter(p => {
            if (p.expiryDate) {
                const daysUntil = daysBetween(new Date(), new Date(p.expiryDate));
                return daysUntil <= 30 && daysUntil > 0;
            }
            return false;
        }).length;

        if (expiringEl) expiringEl.textContent = expiringCount;

        // Count active products by looking at the actual routines
        const routines = StorageManager.load('routines', { morning: [], evening: [] });
        console.log('📊 Calculating routine stats from routines:', routines);

        // Use Sets with fallback to name for older data that might lack productId
        const morningProdIds = new Set(routines.morning.map(s => s.productId || s.name).filter(Boolean));
        const eveningProdIds = new Set(routines.evening.map(s => s.productId || s.name).filter(Boolean));

        const morningCount = morningProdIds.size;
        const eveningCount = eveningProdIds.size;

        // Total unique products across all routines
        const allActiveIds = new Set([...morningProdIds, ...eveningProdIds]);
        const uniqueActive = allActiveIds.size;

        console.log(`📈 Stats calculated: Morning=${morningCount}, Evening=${eveningCount}, Unique Total=${uniqueActive}`);

        if (activeEl) activeEl.textContent = uniqueActive;

        // Update breakdown modal if elements exist
        const bkMorning = document.getElementById('breakdownMorningCount');
        const bkEvening = document.getElementById('breakdownEveningCount');
        const bkTotal = document.getElementById('breakdownTotalCount');

        if (bkMorning) bkMorning.textContent = morningCount;
        if (bkEvening) bkEvening.textContent = eveningCount;
        if (bkTotal) bkTotal.textContent = uniqueActive;
    }

    /**
     * Load environmental data
     */
    /**
     * Load environmental data using Geolocation and real-time APIs
     */
    async loadEnvironmentalData() {
        const uvEl = document.getElementById('uvIndex');
        const humidityEl = document.getElementById('humidity');
        const tempEl = document.getElementById('temperature');
        const aqEl = document.getElementById('airQuality');
        const weatherBadge = document.getElementById('weatherBadge');
        const recommendation = document.getElementById('envRecommendation');
        const locDisplay = document.getElementById('locationDisplay');
        const locName = document.getElementById('locationName');

        if (!uvEl || !humidityEl || !tempEl || !aqEl) return;

        try {
            // Show loading state
            if (weatherBadge) weatherBadge.textContent = 'Updating...';

            let latitude, longitude, name;

            // Check for saved location in user profile (Firestore priority)
            let savedLoc = null;
            if (this.userProfile && this.userProfile.location) {
                savedLoc = this.userProfile.location;
            } else {
                savedLoc = StorageManager.load('manualLocation');
            }

            if (savedLoc) {
                latitude = savedLoc.latitude;
                longitude = savedLoc.longitude;
                name = savedLoc.name;
            } else {
                // Get user's location automatically
                const position = await this.getCurrentLocation();
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
                name = 'Current Location';
            }

            // Update location display
            if (locDisplay && locName) {
                locDisplay.style.display = 'flex';
                locName.textContent = name;
            }

            // Fetch Weather and UV Index (Open-Meteo)
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&daily=uv_index_max&timezone=auto&forecast_days=1`;
            const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi`;

            const [weatherRes, aqRes] = await Promise.all([
                fetch(weatherUrl),
                fetch(aqUrl)
            ]);

            const weatherData = await weatherRes.json();
            const aqData = await aqRes.json();

            const currentData = {
                uv: weatherData.daily.uv_index_max[0],
                humidity: weatherData.current.relative_humidity_2m,
                temp: Math.round(weatherData.current.temperature_2m),
                aqi: aqData.current.european_aqi
            };

            // Update UI
            uvEl.textContent = currentData.uv;
            humidityEl.textContent = `${currentData.humidity}%`;
            tempEl.textContent = `${currentData.temp}°C`;
            aqEl.textContent = currentData.aqi;

            // Update weather badge
            if (weatherBadge) {
                if (currentData.uv >= 6) {
                    weatherBadge.textContent = 'High UV';
                    weatherBadge.className = 'badge badge-danger';
                } else if (currentData.uv >= 3) {
                    weatherBadge.textContent = 'Moderate UV';
                    weatherBadge.className = 'badge badge-warning';
                } else {
                    weatherBadge.textContent = 'Low UV';
                    weatherBadge.className = 'badge badge-success';
                }
            }

            this.environmentalData = currentData;

            // Generate localized recommendation
            if (recommendation) {
                let rec = '';
                if (currentData.uv >= 6) {
                    rec = '☀️ High UV today! Make sure to apply SPF 50+ and reapply every 2 hours.';
                } else if (currentData.uv >= 3) {
                    rec = '🧴 Moderate UV. Don\'t forget your daily sunscreen!';
                } else if (currentData.humidity < 40) {
                    rec = '💧 Low humidity detected. Use a richer moisturizer to prevent dryness.';
                } else if (currentData.aqi > 50) {
                    rec = '🌫️ Poor air quality. Consider double cleansing tonight to remove pollutants.';
                } else {
                    rec = '✨ Great conditions for your skin today! Stick to your regular routine.';
                }
                recommendation.innerHTML = `<p>${rec}</p>`;
            }

        } catch (error) {
            console.error('Error loading environmental data:', error);
            if (weatherBadge) {
                weatherBadge.textContent = 'Offline/Error';
                weatherBadge.className = 'badge badge-secondary';
            }
        }
    }

    /**
     * Show/hide in-app location search box
     */
    toggleLocationSearch() {
        const container = document.getElementById('locationSearchContainer');
        if (!container) return;

        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            const input = document.getElementById('locationSearchInput');
            if (input) input.focus();
        }
    }

    /**
     * Search for a location using Open-Meteo Geocoding API
     */
    async searchLocation() {
        const input = document.getElementById('locationSearchInput');
        const query = input ? input.value : '';

        if (!query || query.trim().length < 2) {
            showToast('Please enter a city name', 'warning');
            return;
        }

        try {
            showToast('Searching...', 'info');
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                const newLoc = {
                    name: `${result.name}, ${result.country}`,
                    latitude: result.latitude,
                    longitude: result.longitude
                };

                // Save locally
                StorageManager.save('manualLocation', newLoc);

                // Save to user profile in Firestore
                if (window.FirebaseStorage && window.FirebaseStorage.isUserSignedIn()) {
                    const profile = StorageManager.load('userProfile') || {};
                    profile.location = newLoc;
                    await window.FirebaseStorage.saveUserProfile(profile);
                    this.userProfile = profile; // Update local state
                }

                showToast(`Location set to ${newLoc.name}`, 'success');

                // Reset UI
                if (input) input.value = '';
                this.toggleLocationSearch();
                this.loadEnvironmentalData();
            } else {
                showToast('Location not found', 'warning');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            showToast('Failed to search location', 'error');
        }
    }

    /**
     * Helper to get current location using Promise wrapper
     */
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
                enableHighAccuracy: false
            });
        });
    }

    /**
     * Set placeholder data if API fails or location denied
     */
    setPlaceholderEnvironmentalData() {
        const uvEl = document.getElementById('uvIndex');
        const humidityEl = document.getElementById('humidity');
        const tempEl = document.getElementById('temperature');
        const aqEl = document.getElementById('airQuality');
        const recommendation = document.getElementById('envRecommendation');

        if (uvEl) uvEl.textContent = '--';
        if (humidityEl) humidityEl.textContent = '--%';
        if (tempEl) tempEl.textContent = '--°C';
        if (aqEl) aqEl.textContent = '--';
        if (recommendation) {
            recommendation.innerHTML = '<p class="text-secondary text-sm">Allow location access to see real-time skin factors.</p>';
        }
    }

    /**
     * Load reminders from Firestore or Storage
     */
    async loadReminders() {
        const reminderList = document.getElementById('reminderList');
        if (!reminderList) return;

        try {
            let reminders = [];

            // Check if Firebase is available and user is signed in
            const isFirebaseAvailable = window.FirebaseStorage &&
                typeof window.FirebaseStorage.isUserSignedIn === 'function';

            if (isFirebaseAvailable && window.FirebaseStorage.isUserSignedIn()) {
                console.log('☁️ Loading reminders from Firestore');
                reminders = await window.FirebaseStorage.getReminders();
            } else {
                console.log('💾 Loading reminders from localStorage');
                reminders = StorageManager.load('userReminders', []);
            }

            if (reminders.length === 0) {
                reminderList.innerHTML = '<div class="reminder-empty" style="padding: var(--space-md); text-align: center; color: var(--color-text-secondary); font-style: italic;">No upcoming reminders</div>';
            } else {
                reminderList.innerHTML = reminders.map(r => `
                    <div class="reminder-item" data-id="${r.id}">
                        <div class="reminder-content">
                            <span class="reminder-time">${this.formatTime(r.time)}</span>
                            <span class="reminder-text">${r.text}</span>
                        </div>
                        <div class="reminder-actions">
                            <button class="reminder-btn edit" onclick="app.openReminderModal(${r.id})" title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="reminder-btn delete" onclick="app.deleteReminder(${r.id})" title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `).join('');
            }

            this.reminders = reminders;

            // Start reminder check if not already running
            if (!this.reminderCheckInterval) {
                this.startReminderCheck();
            }

        } catch (error) {
            console.error('Error loading reminders:', error);
            reminderList.innerHTML = '<div class="reminder-error">Failed to load reminders</div>';
        }
    }

    /**
     * Start interval to check reminders every minute
     */
    startReminderCheck() {
        this.reminderCheckInterval = setInterval(() => this.checkReminders(), 60000);
        this.checkReminders(); // Initial check
    }

    /**
     * Check if any reminders match the current time
     */
    checkReminders() {
        if (!this.reminders || this.reminders.length === 0) return;

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        this.reminders.forEach(reminder => {
            if (reminder.time === currentTime) {
                // Show notification
                showToast(`🔔 Reminder: ${reminder.text}`, 'info');
                console.log(`Reminder triggered: ${reminder.text}`);

                // If frequency is 'once', delete it
                if (reminder.frequency === 'once') {
                    this.deleteReminder(reminder.id, true);
                }
            }
        });
    }

    /**
     * Open reminder modal for add or edit
     */
    async openReminderModal(id = null) {
        const modal = document.getElementById('reminderModal');
        const form = document.getElementById('reminderForm');
        const title = document.getElementById('reminderModalTitle');

        if (!modal || !form) return;

        if (id) {
            const reminder = this.reminders.find(r => r.id === id);
            if (reminder) {
                title.textContent = 'Edit Reminder';
                document.getElementById('reminderId').value = reminder.id;
                document.getElementById('reminderTime').value = reminder.time;
                document.getElementById('reminderText').value = reminder.text;
                document.getElementById('reminderFrequency').value = reminder.frequency || 'daily';
            }
        } else {
            title.textContent = 'Add Reminder';
            form.reset();
            document.getElementById('reminderId').value = '';
        }

        const overlay = document.getElementById('reminderModalOverlay');
        if (overlay) overlay.classList.add('active');
    }

    /**
     * Save reminder from modal form
     */
    async saveReminder(e) {
        if (e) e.preventDefault();

        const id = document.getElementById('reminderId').value;
        const time = document.getElementById('reminderTime').value;
        const text = document.getElementById('reminderText').value;
        const frequency = document.getElementById('reminderFrequency').value;

        const reminderData = {
            id: id ? parseInt(id) : null,
            time,
            text,
            frequency,
            updatedAt: Date.now()
        };

        try {
            showToast('Saving reminder...', 'info');

            if (window.FirebaseStorage && window.FirebaseStorage.isUserSignedIn()) {
                console.log('🧪 Saving reminder to Firestore...');
                await window.FirebaseStorage.saveReminder(reminderData);
            } else {
                console.log('💾 Saving reminder to LocalStorage (User not signed in)');
                const localReminders = StorageManager.load('userReminders', []);
                if (id) {
                    const idx = localReminders.findIndex(r => r.id === parseInt(id));
                    if (idx !== -1) localReminders[idx] = reminderData;
                } else {
                    reminderData.id = Date.now();
                    localReminders.push(reminderData);
                }
                StorageManager.save('userReminders', localReminders);
            }

            showToast('Reminder saved successfully', 'success');
            document.getElementById('reminderModalOverlay').classList.remove('active');
            this.loadReminders();
        } catch (error) {
            console.error('Error saving reminder:', error);
            showToast('Failed to save reminder', 'error');
        }
    }

    /**
     * Delete a reminder
     */
    async deleteReminder(id, silent = false) {
        if (!id) return;
        if (!silent && !confirm('Are you sure you want to delete this reminder?')) return;

        try {
            if (window.FirebaseStorage && window.FirebaseStorage.isUserSignedIn()) {
                await window.FirebaseStorage.deleteReminder(id);
            } else {
                const localReminders = StorageManager.load('userReminders', []);
                const filtered = localReminders.filter(r => r.id !== id);
                StorageManager.save('userReminders', filtered);
            }

            if (!silent) showToast('Reminder deleted', 'success');
            this.loadReminders();
        } catch (error) {
            console.error('Error deleting reminder:', error);
            showToast('Failed to delete reminder', 'error');
        }
    }

    /**
     * Helper to format time for display (24h to 12h)
     */
    formatTime(timeStr) {
        if (!timeStr || !timeStr.includes(':')) return timeStr;
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    }

    /**
     * Load progress stats
     */
    async loadProgressStats() {
        // Get progress entries from Firestore (or IndexedDB fallback)
        const photos = await StorageManager.getProgressEntries();
        const skinLogs = StorageManager.load('skinLogs', []);

        const photoCountEl = document.getElementById('photoCount');
        const daysTrackedEl = document.getElementById('daysTracked');
        const improvementEl = document.getElementById('improvement');

        // photoCount is correct from length
        if (photoCountEl) photoCountEl.textContent = photos.length;

        // Calculate unique days tracked from photo dates
        if (daysTrackedEl) {
            const uniqueDays = new Set(photos.map(p => p.date));
            daysTrackedEl.textContent = uniqueDays.size;
        }

        // Calculate improvement comparing two latest photo sessions
        if (improvementEl) {
            if (photos.length >= 2) {
                // Sort by timestamp (newest first)
                const sorted = [...photos].sort((a, b) => b.timestamp - a.timestamp);
                const latest = sorted[0];
                const previous = sorted[1];

                // Helper to get average score from analysis
                const getSessionScore = (entry) => {
                    if (!entry.analysis) return 70;
                    const scores = Object.values(entry.analysis).map(a => a.score);
                    if (scores.length === 0) return 70;
                    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
                };

                const latestScore = getSessionScore(latest);
                const previousScore = getSessionScore(previous);

                // Calculate percentage change
                const improvement = Math.round(((latestScore - previousScore) / previousScore) * 100);

                if (improvement > 0) {
                    improvementEl.textContent = `+${improvement}%`;
                    improvementEl.className = 'progress-stat-value improvement'; // Use standard color class
                    improvementEl.style.color = 'var(--color-success)';
                } else if (improvement < 0) {
                    improvementEl.textContent = `${improvement}%`;
                    improvementEl.style.color = 'var(--color-danger)';
                } else {
                    improvementEl.textContent = '0%';
                    improvementEl.style.color = 'var(--color-text-secondary)';
                }
            } else {
                improvementEl.textContent = '--';
                improvementEl.style.color = 'var(--color-text-tertiary)';
            }
        }
    }

    /**
     * Load daily insights based on weather and user data
     */
    async loadDailyInsights() {
        const insightsContainer = document.getElementById('dailyInsights');
        if (!insightsContainer) return;

        // Simulate loading
        await sleep(500);

        const insights = [];

        // Weather-based insight using live data
        if (this.environmentalData) {
            if (this.environmentalData.uv >= 3) {
                insights.push({
                    icon: '☀️',
                    title: 'UV Protection Needed',
                    description: `UV index is ${this.environmentalData.uv} today. Don't forget your SPF!`
                });
            }
            if (this.environmentalData.aqi > 50) {
                insights.push({
                    icon: '🌫️',
                    title: 'Air Quality Notice',
                    description: 'Air pollution is slightly elevated. Double cleanse is recommended.'
                });
            }
        }

        // Routine reminder
        const lastRoutine = StorageManager.load('lastRoutineDate');
        if (!lastRoutine || !isToday(lastRoutine)) {
            insights.push({
                icon: '✨',
                title: 'Morning Routine',
                description: 'Ready to start your skincare routine?'
            });
        }

        // Product expiration check
        const products = await StorageManager.getProducts();
        const expiringProducts = products.filter(p => {
            if (p.expiryDate) {
                const daysUntilExpiry = daysBetween(new Date(), new Date(p.expiryDate));
                return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
            }
            return false;
        });

        if (expiringProducts.length > 0) {
            insights.push({
                icon: '⚠️',
                title: 'Products Expiring Soon',
                description: `${expiringProducts.length} product(s) will expire within 30 days`
            });
        }

        // Render insights
        insightsContainer.innerHTML = insights.map(insight => `
      <div class="insight-item">
        <div class="insight-icon">${insight.icon}</div>
        <div class="insight-content">
          <h4>${insight.title}</h4>
          <p>${insight.description}</p>
        </div>
      </div>
    `).join('');
    }

    /**
     * Load streak data
     */
    loadStreakData() {
        const streakCountEl = document.getElementById('streakCount');
        const streakCalendarEl = document.getElementById('streakCalendar');

        if (!streakCountEl || !streakCalendarEl) return;

        const routineHistory = StorageManager.load('routineHistory', []);

        // Calculate current streak
        let streak = 0;
        const today = new Date();

        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = getLocalDateString(checkDate);

            if (routineHistory.includes(dateStr)) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }

        streakCountEl.textContent = streak;

        // Render last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = getLocalDateString(date);
            const completed = routineHistory.includes(dateStr);
            const isCurrentDay = i === 0;

            last7Days.push({
                day: date.toLocaleDateString('en-US', { weekday: 'short' })[0],
                completed,
                isToday: isCurrentDay
            });
        }

        streakCalendarEl.innerHTML = last7Days.map(day => `
      <div class="streak-day ${day.completed ? 'completed' : ''} ${day.isToday ? 'today' : ''}">
        ${day.day}
      </div>
    `).join('');
    }

    /**
     * Show daily tips
     */
    showDailyTips() {
        const tips = [
            'Hydration is key! Drink at least 8 glasses of water today.',
            'Always apply sunscreen as the last step of your morning routine.',
            'Give new products at least 4-6 weeks to show results.',
            'Less is more - don\'t overload your skin with too many actives.',
            'Clean your pillowcase regularly to prevent breakouts.'
        ];

        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        showToast(randomTip, 'info', 5000);

        if (AccessibilityManager.voiceEnabled) {
            AccessibilityManager.speak(`Daily tip: ${randomTip}`);
        }
    }

    /**
     * Load routine builder
     */
    loadRoutineBuilder() {
        // Routine builder is self-contained in routine-manager.js
        // The manager is initialized on page load via the script's DOMContentLoaded listener
    }

    /**
     * Load digital shelf (placeholder)
     */
    async loadDigitalShelf() {
        const container = document.getElementById('productsContent');
        if (!container) return;

        // Product manager is already initialized in init()
        // Just render the grid
        if (this.productManager) {
            await this.productManager.loadProducts();
            this.productManager.renderProductGrid();
        }
    }

    /**
     * Load progress tracker (placeholder)
     */
    loadProgressTracker() {
        const container = document.getElementById('progressContent');
        if (!container) return;

        // Check if progress manager is available
        if (window.progressManager && typeof window.progressManager.renderProgressContent === 'function') {
            // Progress manager will handle rendering
            window.progressManager.renderProgressContent();
        } else {
            // Show loading state while progress manager initializes
            container.innerHTML = `
                <div class="empty-state">
                    <div class="spinner" style="width: 48px; height: 48px; border: 3px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                    <p style="margin-top: var(--space-md);">Loading progress tracker...</p>
                </div>
            `;
        }
    }

    /**
     * Load profile settings - comprehensive profile page
     */
    async loadProfileSettings() {
        const container = document.getElementById('profileContent');
        if (!container) return;

        // Get user data
        const userProfile = this.userProfile || StorageManager.load('userProfile');
        const savedAvatar = StorageManager.load('userAvatar');
        const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;

        // Calculate stats
        const products = await StorageManager.getProducts();
        const photos = await StorageManager.getProgressEntries(); // Changed from getPhotos to getProgressEntries
        const skinLogs = StorageManager.load('skinLogs', []);
        const routineHistory = StorageManager.load('routineHistory', []);

        // Calculate days active
        const createdDate = userProfile?.createdAt || userProfile?.onboardingDate || new Date().toISOString();
        const daysActive = Math.max(1, Math.floor((Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24)));

        // Get current settings
        const settings = AccessibilityManager.loadSettings();

        // Calculate active products for dashboard consistency
        const routines = StorageManager.load('routines', { morning: [], evening: [] });
        const morningProdIds = new Set(routines.morning.map(s => s.productId || s.name).filter(Boolean));
        const eveningProdIds = new Set(routines.evening.map(s => s.productId || s.name).filter(Boolean));
        const uniqueActive = new Set([...morningProdIds, ...eveningProdIds]).size;

        // Calculate routine session totals
        const routineStats = StorageManager.load('routineStats', { morning: 0, evening: 0 });
        const totalSessions = (routineStats.morning || 0) + (routineStats.evening || 0);

        container.innerHTML = `
            <!-- Profile Header -->
            <div class="profile-header">
                <div class="profile-avatar-section">
                    <div class="profile-avatar-container">
                        ${savedAvatar
                ? `<img src="${savedAvatar}" alt="Profile" class="profile-avatar" id="profileAvatarImg">`
                : `<div class="profile-avatar-placeholder" id="profileAvatarPlaceholder">
                                <span>${(userProfile?.name || 'U').charAt(0).toUpperCase()}</span>
                               </div>`
            }
                        <div class="profile-avatar-overlay">
                            <label for="avatarUpload" class="avatar-upload-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                            </label>
                            <input type="file" id="avatarUpload" accept="image/*" style="display: none;">
                            ${savedAvatar ? `<button class="avatar-remove-btn" id="removeAvatarBtn" title="Remove avatar">×</button>` : ''}
                        </div>
                    </div>
                    <div class="profile-info">
                        <h2>${sanitizeHTML(userProfile?.name || 'User')}</h2>
                        <p class="profile-email">${user ? user.email : 'Not signed in'}</p>
                        <p class="profile-member-since">Member since ${formatDate(createdDate, 'short')}</p>
                    </div>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="profile-stats">
                <div class="stat-card">
                    <div class="stat-icon">📅</div>
                    <div class="stat-value">${daysActive}</div>
                    <div class="stat-label">Days Active</div>
                </div>
                <div class="stat-card" id="sessionsStatCard" style="cursor: pointer;">
                    <div class="stat-icon">✨</div>
                    <div class="stat-value" id="sessionsStatValue">${totalSessions}</div>
                    <div class="stat-label">Routines Done</div>
                </div>
                <div class="stat-card" id="routinesStatCard" style="cursor: pointer;">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value" id="routinesStatValue">${uniqueActive}</div>
                    <div class="stat-label">In Routine</div>
                </div>
                <div class="stat-card" id="productsStatCard" style="cursor: pointer;">
                    <div class="stat-icon">📦</div>
                    <div class="stat-value">${products.length}</div>
                    <div class="stat-label">Products Tracked</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📸</div>
                    <div class="stat-value">${photos.length}</div>
                    <div class="stat-label">Photos Logged</div>
                </div>
            </div>

            <!-- Skin Profile Card -->
            <div class="card profile-card">
                <div class="settings-section active">
                    <div class="settings-section-header">
                        <div style="display: flex; align-items: center; gap: var(--space-md);">
                            <h3 class="settings-section-title">👤 Skin Profile</h3>
                            <button class="btn btn-icon-small" id="editSkinProfileBtn" title="Edit Skin Profile" style="padding: 4px; background: var(--color-surface-elevated); border-radius: var(--radius-sm); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                        </div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron-icon">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div class="settings-section-content">
                        <div class="profile-detail-grid">
                            <div class="profile-detail">
                                <span class="detail-label">Skin Type</span>
                                <span class="detail-value">${sanitizeHTML(userProfile?.skinType || 'Not set')}</span>
                            </div>
                            <div class="profile-detail">
                                <span class="detail-label">Primary Concerns</span>
                                <span class="detail-value">${userProfile?.concerns?.join(', ') || 'Not set'}</span>
                            </div>
                            <div class="profile-detail">
                                <span class="detail-label">Goals</span>
                                <span class="detail-value">${userProfile?.goals?.join(', ') || 'Not set'}</span>
                            </div>
                            <div class="profile-detail">
                                <span class="detail-label">Sensitivity</span>
                                <span class="detail-value">${sanitizeHTML(userProfile?.sensitivity || 'Not set')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Settings Section -->
            <div class="card profile-card">
                <div class="card-header">
                    <h3>⚙️ Settings</h3>
                </div>
                <div class="card-body">
                    
                    <!-- Appearance Settings -->
                    <div class="settings-section active">
                        <div class="settings-section-header">
                            <h4 class="settings-section-title">🎨 Appearance</h4>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron-icon">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                        <div class="settings-section-content">
                            <div class="setting-item">
                                <div class="setting-info">
                                    <label for="profileThemeSelect">Theme</label>
                                    <p class="setting-description">Choose your preferred color theme</p>
                                </div>
                                <select id="profileThemeSelect" class="setting-select">
                                    <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
                                    <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                    <option value="high-contrast" ${settings.theme === 'high-contrast' ? 'selected' : ''}>High Contrast</option>
                                </select>
                            </div>

                            <div class="setting-item">
                                <div class="setting-info">
                                    <label for="profileReducedMotion">Reduced Motion</label>
                                    <p class="setting-description">Minimize animations</p>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="profileReducedMotion" ${settings.reducedMotion ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Accessibility Settings -->
                    <div class="settings-section">
                        <div class="settings-section-header">
                            <h4 class="settings-section-title">♿ Accessibility</h4>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron-icon">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                        <div class="settings-section-content">
                            <div class="setting-item">
                                <div class="setting-info">
                                    <label for="profileVoiceGuide">Voice Guide</label>
                                    <p class="setting-description">Enable text-to-speech assistance</p>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="profileVoiceGuide" ${settings.voiceEnabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                            <div class="setting-item">
                                <div class="setting-info">
                                    <label for="profileVoiceRate">Voice Speed</label>
                                    <p class="setting-description">Adjust voice guide speed</p>
                                </div>
                                <select id="profileVoiceRate" class="setting-select" ${!settings.voiceEnabled ? 'disabled' : ''}>
                                    <option value="0.75" ${settings.voiceRate === 0.75 ? 'selected' : ''}>Slow</option>
                                    <option value="1" ${settings.voiceRate === 1 ? 'selected' : ''}>Normal</option>
                                    <option value="1.25" ${settings.voiceRate === 1.25 ? 'selected' : ''}>Fast</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Account Settings -->
                    <div class="settings-section">
                        <div class="settings-section-header">
                            <h4 class="settings-section-title">👤 Account</h4>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron-icon">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                        <div class="settings-section-content">
                            ${user ? `
                                <div class="setting-item">
                                    <div class="setting-info">
                                        <label>Sign Out</label>
                                        <p class="setting-description">Sign out of your account</p>
                                    </div>
                                    <button class="btn btn-secondary" id="signOutBtn">Sign Out</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                </div>
            </div>
        `;

        // Setup event listeners
        this.setupProfileEventListeners();
    }

    /**
     * Setup profile page event listeners
     */
    setupProfileEventListeners() {
        // Avatar upload
        const avatarUpload = document.getElementById('avatarUpload');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => this.handleAvatarUpload(e));
        }

        // Edit Skin Profile
        const editSkinProfileBtn = document.getElementById('editSkinProfileBtn');
        if (editSkinProfileBtn) {
            editSkinProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent accordion from toggling when clicking edit
                this.showSkinProfileEditModal();
            });
        }

        // Avatar remove
        const removeAvatarBtn = document.getElementById('removeAvatarBtn');
        if (removeAvatarBtn) {
            console.log('✅ Avatar remove button found, attaching listener');
            removeAvatarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗑️ Remove button clicked');
                this.handleAvatarRemove();
            });
        } else {
            console.log('ℹ️ No avatar to remove (button not found)');
        }

        // Theme change with page reload
        const themeSelect = document.getElementById('profileThemeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                AccessibilityManager.applyTheme(e.target.value);
                const settings = AccessibilityManager.loadSettings();
                settings.theme = e.target.value;
                AccessibilityManager.saveSettings(settings);
                showToast(`Theme changed to ${e.target.value}. Reloading...`, 'success');

                // Reload page after short delay to apply theme
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            });
        }

        // Reduced motion toggle
        const reducedMotion = document.getElementById('profileReducedMotion');
        if (reducedMotion) {
            reducedMotion.addEventListener('change', (e) => {
                AccessibilityManager.applyReducedMotion(e.target.checked);
                const settings = AccessibilityManager.loadSettings();
                settings.reducedMotion = e.target.checked;
                AccessibilityManager.saveSettings(settings);
                showToast(`Reduced motion ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
            });
        }

        // Voice guide toggle
        const voiceGuide = document.getElementById('profileVoiceGuide');
        const voiceRate = document.getElementById('profileVoiceRate');
        if (voiceGuide) {
            voiceGuide.addEventListener('change', (e) => {
                AccessibilityManager.voiceEnabled = e.target.checked;
                const settings = AccessibilityManager.loadSettings();
                settings.voiceEnabled = e.target.checked;
                AccessibilityManager.saveSettings(settings);
                showToast(`Voice guide ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');

                // Enable/disable voice rate
                if (voiceRate) {
                    voiceRate.disabled = !e.target.checked;
                }
            });
        }

        // Voice rate change
        if (voiceRate) {
            voiceRate.addEventListener('change', (e) => {
                AccessibilityManager.voiceRate = parseFloat(e.target.value);
                const settings = AccessibilityManager.loadSettings();
                settings.voiceRate = parseFloat(e.target.value);
                AccessibilityManager.saveSettings(settings);
                showToast(`Voice speed updated`, 'success');
            });
        }

        // Routines Done Breakdown (Sessions)
        const sessionsStatCard = document.getElementById('sessionsStatCard');
        if (sessionsStatCard) {
            sessionsStatCard.addEventListener('click', () => {
                this.showRoutineSessionBreakdown();
            });
        }

        // In Routine Breakdown (Products)
        const routinesStatCard = document.getElementById('routinesStatCard');
        if (routinesStatCard) {
            routinesStatCard.addEventListener('click', () => {
                this.showInventoryRoutineBreakdown();
            });
        }

        // Products Tracked Breakdown
        const productsStatCard = document.getElementById('productsStatCard');
        if (productsStatCard) {
            productsStatCard.addEventListener('click', () => {
                this.showProductBreakdown();
            });
        }

        // Sign out
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.handleSignOut());
        }

        // Collapsible settings sections
        const sectionHeaders = document.querySelectorAll('.settings-section-header');
        sectionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                const wasActive = section.classList.contains('active');

                // Optional: Collapse other sections (comment out if multiple can be open)
                // document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

                if (!wasActive) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    }

    /**
     * Show skin profile edit modal and populate with current data
     */
    showSkinProfileEditModal() {
        const userProfile = StorageManager.load('userProfile', {});

        // Modal elements
        const modal = document.getElementById('skinProfileModal');
        const form = document.getElementById('skinProfileForm');

        if (!modal || !form) {
            console.error('❌ Skin profile modal or form not found');
            return;
        }

        // Populate Skin Type
        const typeSelect = document.getElementById('editSkinType');
        if (typeSelect) typeSelect.value = userProfile.skinType || 'dry';

        // Populate Sensitivity
        const sensitivitySelect = document.getElementById('editSensitivity');
        if (sensitivitySelect) sensitivitySelect.value = userProfile.sensitivity || 'None';

        // Populate Concerns (checkboxes)
        const concernChecks = form.querySelectorAll('input[name="editConcerns"]');
        const currentConcerns = userProfile.concerns || [];
        concernChecks.forEach(check => {
            check.checked = currentConcerns.includes(check.value);
        });

        // Populate Goals (checkboxes)
        const goalChecks = form.querySelectorAll('input[name="editGoals"]');
        const currentGoals = userProfile.goals || [];
        goalChecks.forEach(check => {
            check.checked = currentGoals.includes(check.value);
        });

        // Show modal
        modal.classList.add('active');

        // Setup modal local listeners (Close/Cancel/Save)
        const closeBtn = document.getElementById('closeSkinProfileModal');
        const cancelBtn = document.getElementById('cancelSkinProfileModal');
        const saveBtn = document.getElementById('saveSkinProfileBtn');

        const closeModal = () => {
            modal.classList.remove('active');
        };

        if (closeBtn) closeBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;

        if (saveBtn) {
            saveBtn.onclick = async () => {
                await this.saveSkinProfile();
                closeModal();
            };
        }
    }

    /**
     * Save skin profile updates
     */
    async saveSkinProfile() {
        const form = document.getElementById('skinProfileForm');
        if (!form) return;

        // Collect data
        const skinType = document.getElementById('editSkinType').value;
        const sensitivity = document.getElementById('editSensitivity').value;

        const concerns = Array.from(form.querySelectorAll('input[name="editConcerns"]:checked'))
            .map(cb => cb.value);

        const goals = Array.from(form.querySelectorAll('input[name="editGoals"]:checked'))
            .map(cb => cb.value);

        const updatedProfile = {
            skinType,
            concerns,
            goals,
            sensitivity,
            lastUpdated: new Date().toISOString()
        };

        // Save to StorageManager
        StorageManager.save('userProfile', updatedProfile);
        this.userProfile = updatedProfile;

        // Save to Firestore if logged in
        const user = firebase.auth().currentUser;
        if (user) {
            try {
                // Ensure firebase-auth logic is respected
                await firebase.firestore().collection('users').doc(user.uid).set({
                    skinProfile: updatedProfile
                }, { merge: true });
                console.log('✅ Skin profile synced to Firestore');
            } catch (error) {
                console.error('❌ Firestore sync failed:', error);
            }
        }

        // Refresh UI
        this.loadProfileSettings();
        if (typeof showToast === 'function') {
            showToast('Skin profile updated successfully!', 'success');
        }
    }

    /**
     * Handle avatar upload
     */
    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please select a valid image file', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Compress image
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const maxSize = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const compressedData = canvas.toDataURL('image/jpeg', 0.8);

                // Save to storage
                StorageManager.save('userAvatar', compressedData);

                // Save to Firestore if user is authenticated
                const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;
                if (user && window.FirebaseStorage) {
                    window.FirebaseStorage.saveUserProfile({
                        ...this.userProfile,
                        avatar: compressedData
                    });
                }

                showToast('Avatar updated successfully', 'success');
                this.loadProfileSettings(); // Reload profile
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Handle avatar removal
     */
    handleAvatarRemove() {
        console.log('🗑️ handleAvatarRemove called');
        console.log('🔄 Removing avatar...');

        // Remove from localStorage
        StorageManager.remove('userAvatar');
        console.log('✅ Removed from localStorage');

        // Verify removal
        const check = StorageManager.load('userAvatar');
        console.log('🔍 Verification - Avatar in storage:', check);

        // Remove from Firestore if user is authenticated
        const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;
        if (user && window.FirebaseStorage) {
            console.log('🔄 Removing from Firestore...');
            window.FirebaseStorage.saveUserProfile({
                ...this.userProfile,
                avatar: null
            });
            console.log('✅ Removed from Firestore');
        }

        showToast('Avatar removed', 'success');
        console.log('🔄 Reloading profile page...');

        // Reload profile
        this.loadProfileSettings();
    }

    /**
     * Handle data export
     */
    async handleExportData() {
        try {
            const data = await StorageManager.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dearskin-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Failed to export data', 'error');
        }
    }

    /**
     * Handle clear data
     */
    async handleClearData() {
        if (confirm('⚠️ This will delete ALL your local data. This action cannot be undone. Are you sure?')) {
            try {
                await StorageManager.clearAllData();
                showToast('All data cleared', 'success');
                setTimeout(() => {
                    window.location.href = 'onboarding.html';
                }, 1500);
            } catch (error) {
                console.error('Clear data error:', error);
                showToast('Failed to clear data', 'error');
            }
        }
    }

    /**
     * Handle sign out
     */
    async handleSignOut() {
        if (confirm('Are you sure you want to sign out?')) {
            try {
                if (window.FirebaseAuthManager) {
                    await window.FirebaseAuthManager.signOut();
                }
                showToast('Signed out successfully', 'success');
                setTimeout(() => {
                    window.location.href = 'auth.html';
                }, 1000);
            } catch (error) {
                console.error('Sign out error:', error);
                showToast('Failed to sign out', 'error');
            }
        }
    }

    /**
     * Setup settings modal
     */
    setupSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const closeBtn = document.getElementById('closeSettings');
        const cancelBtn = document.getElementById('cancelSettings');
        const saveBtn = document.getElementById('saveSettings');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveAccessibilitySettings();
                modal.classList.remove('active');
            });
        }

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    /**
     * Setup Inventory Breakdown Modal
     */
    setupInventoryBreakdownModal() {
        const modal = document.getElementById('routineBreakdownModal');
        const closeBtn = document.getElementById('closeRoutineBreakdownModal');
        const footerClose = document.getElementById('closeBreakdownFooter');

        const closeModal = () => {
            if (modal) modal.classList.remove('active');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (footerClose) footerClose.addEventListener('click', closeModal);

        // Close on overlay click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
    }

    /**
     * Open settings modal
     */
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const settings = AccessibilityManager.loadSettings();

        // Populate current settings
        document.getElementById('themeSelect').value = settings.theme;
        document.getElementById('fontSizeSelect').value = settings.fontSize;
        document.getElementById('reducedMotion').checked = settings.reducedMotion;
        document.getElementById('voiceGuideEnabled').checked = settings.voiceEnabled;
        document.getElementById('voiceRate').value = settings.voiceRate;

        modal.classList.add('active');

        // Focus first input
        setTimeout(() => {
            document.getElementById('themeSelect').focus();
        }, 100);
    }

    /**
     * Save accessibility settings
     */
    saveAccessibilitySettings() {
        const settings = {
            theme: document.getElementById('themeSelect').value,
            fontSize: document.getElementById('fontSizeSelect').value,
            reducedMotion: document.getElementById('reducedMotion').checked,
            voiceEnabled: document.getElementById('voiceGuideEnabled').checked,
            voiceRate: parseFloat(document.getElementById('voiceRate').value)
        };

        AccessibilityManager.applyTheme(settings.theme);
        AccessibilityManager.applyFontSize(settings.fontSize);
        AccessibilityManager.applyReducedMotion(settings.reducedMotion);
        AccessibilityManager.voiceEnabled = settings.voiceEnabled;
        AccessibilityManager.voiceRate = settings.voiceRate;

        AccessibilityManager.saveSettings(settings);

        showToast('Settings saved successfully', 'success');
    }

    /**
     * Check if user has completed onboarding
     */
    async checkOnboardingStatus() {
        try {
            // Wait for Firebase auth to be ready
            if (!window.firebaseAuth || !window.firebaseDb) {
                console.warn('Firebase not ready, checking localStorage');
                return !!StorageManager.load('userProfile');
            }

            // Wait for auth state to be determined
            const user = await new Promise((resolve) => {
                const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
                    unsubscribe();
                    resolve(user);
                });
            });

            if (!user) {
                console.log('❌ No user signed in');
                return false;
            }

            console.log('🔍 Checking onboarding status for user:', user.email);

            const db = window.firebaseDb;
            const userDoc = await db.collection('users').doc(user.uid).get();

            if (userDoc.exists) {
                const data = userDoc.data();
                const hasCompleted = data.profile?.onboardingCompleted === true;

                console.log('📄 User document found. Onboarding completed:', hasCompleted);
                return hasCompleted;
            }

            console.log('❌ User document not found in Firestore');
            return false;
        } catch (error) {
            console.error('❌ Error checking onboarding status:', error);
            // Fallback to localStorage
            return !!StorageManager.load('userProfile');
        }
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            // Don't ask immediately, wait for user engagement
            setTimeout(async () => {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    showToast('Notifications enabled! You\'ll receive routine reminders.', 'success');
                }
            }, 5000);
        }
    }

    /**
     * Register service worker for PWA
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }


    /**
     * Show product breakdown modal
     */
    showProductBreakdown() {
        const products = this.productManager?.products || [];

        const modalHTML = `
            <div class="modal-overlay active" id="productBreakdownModal">
                <div class="modal stats-breakdown-modal" role="dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">Tracked Products</h3>
                        <button class="btn btn-icon" id="closeProductBreakdown" aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="product-breakdown-list">
                            ${products.length === 0 ? `
                                <div class="empty-state">
                                    <p>No products added yet.</p>
                                </div>
                            ` : products.map(product => `
                                <div class="product-breakdown-item">
                                    <div class="product-mini-photo">
                                        ${product.photo
                ? `<img src="${product.photo}" alt="${product.name}">`
                : `<div class="product-mini-photo-placeholder">📦</div>`
            }
                                    </div>
                                    <div class="product-breakdown-info">
                                        <div class="product-breakdown-name">${sanitizeHTML(product.name)}</div>
                                        <div class="product-breakdown-meta">
                                            ${product.brand ? `<span>${sanitizeHTML(product.brand)}</span> • ` : ''}
                                            <span class="product-breakdown-category">${sanitizeHTML(product.category || 'Other')}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Inject modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Close logic
        const modal = document.getElementById('productBreakdownModal');
        const closeBtn = document.getElementById('closeProductBreakdown');

        const closeHandler = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        closeBtn.addEventListener('click', closeHandler);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeHandler();
        });
    }
    /**
     * Render the score trend sparkline
     */
    renderScoreTrend(scores, type = 'health') {
        const chartContainer = document.getElementById('scoreTrendChart');
        if (!chartContainer) return;

        const hasData = scores.some(s => s > 0);

        if (!hasData) {
            chartContainer.innerHTML = `
                <div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--color-text-tertiary); text-align: center; padding: 0 20px;">
                    Log a routine or check-in to see your weekly progress here
                </div>
            `;
            return;
        }

        // Get labels for the last 7 days
        const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const labels = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push({
                label: days[date.getDay()],
                isToday: i === 0
            });
        }

        const barWidth = 100 / scores.length;

        const chartHTML = `
            <div class="bar-chart-container">
                ${scores.map((score, i) => `
                    <div class="bar-column" style="width: ${barWidth}%">
                        <div class="bar-wrapper">
                            <div class="bar-fill ${labels[i].isToday ? 'today' : ''} ${score === 0 ? 'empty' : ''}" 
                                 style="height: ${Math.max(score, score > 0 ? 10 : 0)}%">
                                 ${score > 0 && score < 100 && score > 30 ? `<span class="bar-value">${score}</span>` : ''}
                            </div>
                        </div>
                        <span class="bar-label ${labels[i].isToday ? 'today' : ''}">${labels[i].label}</span>
                    </div>
                `).join('')}
            </div>
        `;

        chartContainer.innerHTML = chartHTML;
    }

    /**
     * Show routine sessions breakdown modal (Morning vs Evening counts)
     */
    showRoutineSessionBreakdown() {
        const stats = StorageManager.load('routineStats', { morning: 0, evening: 0 });
        const morningCount = stats.morning || 0;
        const eveningCount = stats.evening || 0;
        const total = morningCount + eveningCount;

        // Calculate percentages for progress bars
        const morningPercent = total > 0 ? (morningCount / total) * 100 : 0;
        const eveningPercent = total > 0 ? (eveningCount / total) * 100 : 0;

        const modalHTML = `
            <div class="modal-overlay active" id="sessionsBreakdownModal">
                <div class="modal stats-breakdown-modal" role="dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">Routine Activity</h3>
                        <button class="btn btn-icon" id="closeSessionsBreakdown" aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="routine-breakdown-container">
                            <!-- Morning Section -->
                            <div class="routine-breakdown-section morning">
                                <div class="breakdown-icon">☀️</div>
                                <div class="breakdown-info">
                                    <h4>Morning Sessions</h4>
                                    <div class="breakdown-count">${morningCount} <span>done</span></div>
                                    <div class="progress-bar-container">
                                        <div class="progress-bar-fill" style="width: ${morningPercent}%"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Evening Section -->
                            <div class="routine-breakdown-section evening">
                                <div class="breakdown-icon">🌙</div>
                                <div class="breakdown-info">
                                    <h4>Evening Sessions</h4>
                                    <div class="breakdown-count">${eveningCount} <span>done</span></div>
                                    <div class="progress-bar-container">
                                        <div class="progress-bar-fill" style="width: ${eveningPercent}%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="stats-summary-footer">
                            You have completed a total of <strong>${total}</strong> skincare sessions!
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Inject modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Close logic
        const modal = document.getElementById('sessionsBreakdownModal');
        const closeBtn = document.getElementById('closeSessionsBreakdown');

        const closeHandler = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        closeBtn.addEventListener('click', closeHandler);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeHandler();
        });

        AccessibilityManager.announceNavigation('Routine Sessions Breakdown');
    }
}

// Initialize app safely
const initApp = () => {
    console.log('📅 Initializing DearSkinApp...');
    window.app = new DearSkinApp();
    console.log('✅ DearSkinApp instance assigned to window.app');
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

console.log('🏁 DearSkin App script reached end.');
