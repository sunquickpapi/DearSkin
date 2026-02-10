/**
 * Progress Manager
 * Handles skin progress tracking with photo uploads, face detection, and analysis
 */

class ProgressManager {
    constructor() {
        this.dbName = 'DearSkinProgressDB';
        this.dbVersion = 1;
        this.db = null;
        this.modelsLoaded = false;
        this.currentPhoto = null;

        // Comparison state
        this.compareMode = false;
        this.selectedEntries = []; // Array of entry IDs

        this.init();
    }

    /**
     * Initialize the progress manager
     */
    async init() {
        await this.initDB();
        await this.loadFaceDetectionModels();
        this.setupEventListeners();
        this.renderProgressContent();
    }

    /**
     * Initialize IndexedDB for storing progress photos
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store for progress entries
                if (!db.objectStoreNames.contains('progressEntries')) {
                    const store = db.createObjectStore('progressEntries', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }
            };
        });
    }

    /**
     * Load face-api.js models for face detection
     */
    async loadFaceDetectionModels() {
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

            this.modelsLoaded = true;
            console.log('Face detection models loaded successfully');
        } catch (error) {
            console.error('Error loading face detection models:', error);
            this.modelsLoaded = false;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Will be set up when content is rendered
    }

    /**
     * Render the progress content
     */
    renderProgressContent() {
        const container = document.getElementById('progressContent');
        if (!container) return;

        container.innerHTML = `
            <!-- Minimalist Upload Section -->
            <div class="progress-upload-section">
                <div class="upload-compact-container">
                    <button class="btn btn-primary btn-lg btn-pulse btn-log-progress" id="btnLogProgress">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        Log Your Skin Progress
                    </button>
                    <p class="text-secondary upload-minimal-hint">Upload a front-facing photo to start analysis</p>
                    
                    <div class="photo-upload-container mt-4">
                        <div class="photo-preview-container" id="progressPhotoPreview" style="display: none;">
                            <div class="photo-preview-wrapper">
                                <img id="progressPhotoPreviewImg" src="" alt="Progress photo preview">
                                <canvas id="faceDetectionCanvas" style="position: absolute; top: 0; left: 0;"></canvas>
                            </div>
                            <div class="detection-status" id="detectionStatus">
                                <div class="spinner"></div>
                                <span>Analyzing photo...</span>
                            </div>
                            <div class="photo-actions">
                                <button class="btn btn-secondary" id="removeProgressPhoto">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    Remove
                                </button>
                                <button class="btn btn-primary" id="saveProgressPhoto" disabled>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    Save Progress
                                </button>
                            </div>
                        </div>
                        
                        <input type="file" id="progressPhotoInput" accept="image/*" style="display: none;">
                    </div>
                    
                    <div class="analysis-results" id="analysisResults" style="display: none;">
                        <h4>Analysis Results</h4>
                        <div class="analysis-grid" id="analysisGrid"></div>
                    </div>
                </div>
            </div>

            <!-- Progress Timeline -->
            <div class="progress-timeline-section">
                <div class="timeline-header">
                    <div class="timeline-title-group">
                        <h3>Your Progress Journey</h3>
                        <p class="text-secondary" id="timelineFilterStatus">Showing all entries</p>
                    </div>
                    <div class="timeline-controls">
                        <div class="filter-group">
                            <select class="form-select select-sm" id="progressTimeFilter">
                                <option value="all">All Time</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="btnToggleCompare">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="12" y1="3" x2="12" y2="21"></line>
                            </svg>
                            Compare
                        </button>
                        <button class="btn btn-ghost btn-sm" id="timelineViewBtn" title="Toggle Grid View">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="progress-timeline" id="progressTimeline">
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <h4>No progress photos yet</h4>
                        <p>Upload your first photo to start tracking your skin journey</p>
                    </div>
                </div>

                <!-- Floating Comparison Action -->
                <div class="comparison-floating-action" id="compareActionContainer" style="display: none;">
                    <button class="btn btn-primary btn-lg shadow-lg" id="btnExecuteCompare">
                        Compare Selected (2)
                    </button>
                    <button class="btn btn-ghost" id="btnCancelCompare">Cancel</button>
                </div>
            </div>

            <!-- Comparison Modal -->
            <div id="comparisonModal" class="modal-overlay">
                <div class="modal-content comparison-modal-content">
                    <div class="modal-header">
                        <h3>Progress Comparison</h3>
                        <button class="close-modal" id="closeComparisonModal" aria-label="Close Comparison">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="comparison-timeframe-badge" id="comparisonTimeframe">0 days of progress</div>
                        
                        <!-- Slider Comparison -->
                        <div class="comparison-slider-container">
                            <div class="comparison-slider-wrapper" id="comparisonSliderWrapper">
                                <div class="comparison-image before">
                                    <img id="comparisonImgBefore" src="" alt="Before">
                                    <div class="image-label">Before</div>
                                </div>
                                <div class="comparison-image after" id="comparisonAfterWrapper">
                                    <img id="comparisonImgAfter" src="" alt="After">
                                    <div class="image-label right">After</div>
                                </div>
                                <div class="comparison-handle" id="comparisonHandle">
                                    <div class="handle-circles">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="15 18 9 12 15 6"></polyline>
                                            <polyline points="21 18 15 12 21 6"></polyline>
                                        </svg>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                            <polyline points="3 18 9 12 3 6"></polyline>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Stats Comparison -->
                        <div class="comparison-stats-section">
                            <div class="stats-header">
                                <h4>Metrics Breakdown</h4>
                            </div>
                            <div class="comparison-stats-grid" id="comparisonStatsGrid">
                                <!-- Dynamically populated -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="closeComparisonFooter">Close</button>
                    </div>
                </div>
            </div>
        `;

        this.setupProgressEventListeners();
        this.loadProgressTimeline();
    }

    /**
     * Setup event listeners for progress section
     */
    setupProgressEventListeners() {
        const logBtn = document.getElementById('btnLogProgress');
        const fileInput = document.getElementById('progressPhotoInput');
        const removeBtn = document.getElementById('removeProgressPhoto');
        const saveBtn = document.getElementById('saveProgressPhoto');
        const timeFilter = document.getElementById('progressTimeFilter');

        // Click to upload
        logBtn?.addEventListener('click', () => fileInput?.click());

        // File input change
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handlePhotoUpload(e.target.files[0]);
            }
        });

        // Time Filter change
        timeFilter?.addEventListener('change', (e) => {
            if (this.compareMode) this.toggleCompareMode();
            this.loadProgressTimeline(e.target.value);
        });

        // Toggle Compare Mode
        document.getElementById('btnToggleCompare')?.addEventListener('click', () => {
            this.toggleCompareMode();
        });

        // Cancel Compare
        document.getElementById('btnCancelCompare')?.addEventListener('click', () => {
            this.toggleCompareMode();
        });

        // Execute Compare
        document.getElementById('btnExecuteCompare')?.addEventListener('click', () => {
            this.executeComparison();
        });

        // Modal Close listeners
        document.getElementById('closeComparisonModal')?.addEventListener('click', () => this.hideComparisonModal());
        document.getElementById('closeComparisonFooter')?.addEventListener('click', () => this.hideComparisonModal());

        // Remove photo
        removeBtn?.addEventListener('click', () => this.removeCurrentPhoto());

        // Save photo
        saveBtn?.addEventListener('click', () => this.saveProgressEntry());
    }

    /**
     * Programmatically trigger the photo upload dialog
     */
    triggerUpload() {
        const fileInput = document.getElementById('progressPhotoInput');
        if (fileInput) {
            fileInput.click();
        } else {
            // If not rendered yet for some reason, try to render first
            this.renderProgressContent();
            document.getElementById('progressPhotoInput')?.click();
        }
    }

    /**
     * Handle photo upload
     */
    async handlePhotoUpload(file) {
        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showToast('Please upload an image file', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showToast('File size must be less than 10MB', 'error');
            return;
        }

        // Read file
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target.result;
            await this.processPhoto(imageData);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Process uploaded photo
     */
    async processPhoto(imageData) {
        const previewContainer = document.getElementById('progressPhotoPreview');
        const logBtn = document.getElementById('btnLogProgress');
        const previewImg = document.getElementById('progressPhotoPreviewImg');
        const detectionStatus = document.getElementById('detectionStatus');
        const saveBtn = document.getElementById('saveProgressPhoto');

        // Show preview
        previewImg.src = imageData;
        if (logBtn) logBtn.style.display = 'none';
        previewContainer.style.display = 'block';
        detectionStatus.innerHTML = '<div class="spinner"></div><span>Analyzing photo...</span>';
        detectionStatus.className = 'detection-status analyzing';
        saveBtn.disabled = true;

        // Wait for image to load
        await new Promise(resolve => {
            previewImg.onload = resolve;
        });

        // Detect face
        const faceDetected = await this.detectFace(previewImg);

        if (faceDetected) {
            detectionStatus.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Face detected! Ready to save</span>
            `;
            detectionStatus.className = 'detection-status success';
            saveBtn.disabled = false;

            // Perform skin analysis
            const analysis = await this.analyzeSkin(previewImg);
            this.displayAnalysis(analysis);

            // Store current photo data
            this.currentPhoto = {
                imageData,
                faceDetected: true,
                analysis
            };
        } else {
            detectionStatus.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span>No face detected. Please upload a clear face photo</span>
            `;
            detectionStatus.className = 'detection-status error';
            saveBtn.disabled = true;
            this.currentPhoto = null;
        }
    }

    /**
     * Detect face in image using face-api.js
     */
    async detectFace(imgElement) {
        if (!this.modelsLoaded) {
            console.warn('Face detection models not loaded');
            return false;
        }

        try {
            const detections = await faceapi
                .detectAllFaces(imgElement, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();

            // Draw detections on canvas
            const canvas = document.getElementById('faceDetectionCanvas');
            const displaySize = {
                width: imgElement.width,
                height: imgElement.height
            };

            faceapi.matchDimensions(canvas, displaySize);
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

            return detections.length > 0;
        } catch (error) {
            console.error('Face detection error:', error);
            return false;
        }
    }

    /**
     * Analyze skin (simulated analysis for demo purposes)
     */
    async analyzeSkin(imgElement) {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create simulated analysis based on image properties
        // In production, this would call a real AI/ML API
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgElement.width;
        canvas.height = imgElement.height;
        ctx.drawImage(imgElement, 0, 0);

        // Get average color data (simplified analysis)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let totalR = 0, totalG = 0, totalB = 0;
        for (let i = 0; i < data.length; i += 4) {
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
        }

        const pixelCount = data.length / 4;
        const avgR = totalR / pixelCount;
        const avgG = totalG / pixelCount;
        const avgB = totalB / pixelCount;

        // Generate simulated scores based on color analysis
        return {
            acne: {
                score: Math.min(95, 40 + Math.random() * 30),
                severity: this.getSeverity(Math.random()),
                description: 'Minor breakouts detected in T-zone area'
            },
            pores: {
                score: Math.min(95, 50 + Math.random() * 25),
                severity: this.getSeverity(Math.random()),
                description: 'Visible pores, particularly on nose and cheeks'
            },
            texture: {
                score: Math.min(95, 60 + Math.random() * 20),
                severity: this.getSeverity(Math.random()),
                description: 'Generally smooth with some rough patches'
            },
            redness: {
                score: Math.min(95, avgR > 150 ? 30 + Math.random() * 40 : 60 + Math.random() * 20),
                severity: avgR > 150 ? 'moderate' : 'minimal',
                description: avgR > 150 ? 'Some redness detected' : 'Minimal redness'
            },
            darkSpots: {
                score: Math.min(95, 55 + Math.random() * 25),
                severity: this.getSeverity(Math.random()),
                description: 'Few dark spots present'
            }
        };
    }

    /**
     * Get severity level
     */
    getSeverity(random) {
        if (random < 0.33) return 'minimal';
        if (random < 0.66) return 'moderate';
        return 'significant';
    }

    /**
     * Display analysis results
     */
    displayAnalysis(analysis) {
        const resultsContainer = document.getElementById('analysisResults');
        const grid = document.getElementById('analysisGrid');

        const concerns = [
            { key: 'acne', label: 'Acne', icon: '🔴' },
            { key: 'pores', label: 'Pores', icon: '⚪' },
            { key: 'texture', label: 'Texture', icon: '✨' },
            { key: 'redness', label: 'Redness', icon: '🌡️' },
            { key: 'darkSpots', label: 'Dark Spots', icon: '⚫' }
        ];

        grid.innerHTML = concerns.map(concern => {
            const data = analysis[concern.key];
            const scoreClass = data.score >= 70 ? 'good' : data.score >= 40 ? 'moderate' : 'poor';

            return `
                <div class="analysis-card">
                    <div class="analysis-icon">${concern.icon}</div>
                    <div class="analysis-info">
                        <div class="analysis-label">${concern.label}</div>
                        <div class="analysis-score ${scoreClass}">${Math.round(data.score)}%</div>
                        <div class="analysis-severity">${data.severity}</div>
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.style.display = 'block';
    }

    /**
     * Remove current photo
     */
    removeCurrentPhoto() {
        const previewContainer = document.getElementById('progressPhotoPreview');
        const logBtn = document.getElementById('btnLogProgress');
        const resultsContainer = document.getElementById('analysisResults');
        const fileInput = document.getElementById('progressPhotoInput');

        previewContainer.style.display = 'none';
        if (logBtn) logBtn.style.display = 'inline-flex';
        resultsContainer.style.display = 'none';
        fileInput.value = '';
        this.currentPhoto = null;
    }

    /**
     * Save progress entry to database (both IndexedDB and Firestore)
     */
    async saveProgressEntry() {
        if (!this.currentPhoto) return;

        const entry = {
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            analysis: this.currentPhoto.analysis
        };

        try {
            // Save to IndexedDB first (for offline support)
            await this.addProgressEntry(entry);

            // Sync to Firebase if available
            try {
                const firestoreEntry = await StorageManager.addProgressEntry(entry, this.currentPhoto.imageData);
                if (firestoreEntry) {
                    console.log('✅ Progress synced to Firebase:', firestoreEntry.id);
                }
            } catch (firebaseError) {
                console.warn('Could not sync to Firebase:', firebaseError);
            }

            this.showToast('Progress saved successfully! 🎉', 'success');
            this.removeCurrentPhoto();
            this.loadProgressTimeline();
        } catch (error) {
            console.error('Error saving progress:', error);
            this.showToast('Failed to save progress', 'error');
        }
    }

    /**
     * Add progress entry to IndexedDB
     */
    async addProgressEntry(entry) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['progressEntries'], 'readwrite');
            const store = transaction.objectStore('progressEntries');
            const request = store.add(entry);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all progress entries (from Firestore with IndexedDB fallback)
     */
    async getAllProgressEntries() {
        try {
            // Try to get from Firestore first
            const firestoreEntries = await StorageManager.getProgressEntries();
            if (firestoreEntries && firestoreEntries.length > 0) {
                console.log(`📊 Loaded ${firestoreEntries.length} entries from Firestore`);
                return firestoreEntries;
            }
        } catch (error) {
            console.warn('Could not fetch from Firestore, using local data:', error);
        }

        // Fallback to IndexedDB
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['progressEntries'], 'readonly');
            const store = transaction.objectStore('progressEntries');
            const request = store.getAll();

            request.onsuccess = () => {
                console.log(`📊 Loaded ${request.result.length} entries from IndexedDB`);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load and display progress timeline
     */
    async loadProgressTimeline(filter = 'all') {
        const timeline = document.getElementById('progressTimeline');
        const filterStatus = document.getElementById('timelineFilterStatus');
        if (!timeline) return;

        try {
            let entries = await this.getAllProgressEntries();

            if (entries.length === 0) {
                timeline.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <h4>No progress photos yet</h4>
                        <p>Upload your first photo to start tracking your skin journey</p>
                    </div>
                `;
                if (filterStatus) filterStatus.textContent = 'No entries to show';
                return;
            }

            // Apply filter
            const now = new Date();
            if (filter === 'week') {
                const oneWeekAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
                entries = entries.filter(e => e.timestamp >= oneWeekAgo);
                if (filterStatus) filterStatus.textContent = `Showing entries from this week (${entries.length})`;
            } else if (filter === 'month') {
                const oneMonthAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
                entries = entries.filter(e => e.timestamp >= oneMonthAgo);
                if (filterStatus) filterStatus.textContent = `Showing entries from this month (${entries.length})`;
            } else {
                if (filterStatus) filterStatus.textContent = `Showing all entries (${entries.length})`;
            }

            if (entries.length === 0) {
                timeline.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <h4>No entries found</h4>
                        <p>No progress photos match the selected filter</p>
                    </div>
                `;
                return;
            }

            // Sort by timestamp (newest first)
            entries.sort((a, b) => b.timestamp - a.timestamp);

            timeline.innerHTML = entries.map((entry, index) => {
                const date = new Date(entry.timestamp);
                const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                const formattedTime = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                });

                const isSelected = this.selectedEntries.includes(entry.id.toString());
                const selectionClass = this.compareMode ? 'selection-active' : '';
                const activeClass = isSelected ? 'selected' : '';

                return `
                    <div class="timeline-entry ${selectionClass} ${activeClass}" data-entry-id="${entry.id}">
                        <div class="selection-overlay">
                            <div class="selection-indicator"></div>
                        </div>
                        <div class="timeline-header">
                            <div class="timeline-date">${formattedDate} • ${formattedTime}</div>
                            <button class="btn-delete" data-entry-id="${entry.id}" title="Delete entry" aria-label="Delete entry" ${this.compareMode ? 'disabled' : ''}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="timeline-photo">
                            <img src="${entry.imageUrl || entry.imageData || ''}" alt="Progress photo from ${formattedDate}">
                        </div>
                        <div class="timeline-summary">
                            ${this.getEntrySummary(entry.analysis)}
                        </div>
                    </div>
                `;
            }).join('');

            // Add event delegation for delete buttons
            this.setupTimelineEventListeners();

        } catch (error) {
            console.error('Error loading timeline:', error);
            timeline.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h4>Error loading progress</h4>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    }

    /**
     * Setup event listeners for timeline (using event delegation)
     */
    setupTimelineEventListeners() {
        const timeline = document.getElementById('progressTimeline');
        if (!timeline) return;

        // Remove old listener if exists
        if (this.handleTimelineClick) {
            timeline.removeEventListener('click', this.handleTimelineClick);
        }

        // Add event listener using event delegation
        this.handleTimelineClick = (e) => {
            const entry = e.target.closest('.timeline-entry');
            const deleteBtn = e.target.closest('.btn-delete');

            if (this.compareMode && entry && !deleteBtn) {
                const entryId = entry.dataset.entryId;
                this.handleEntrySelection(entryId);
                return;
            }

            if (deleteBtn) {
                const entryId = deleteBtn.dataset.entryId;
                if (entryId) {
                    this.deleteProgressEntry(entryId);
                }
            }
        };

        timeline.addEventListener('click', this.handleTimelineClick);
    }

    /**
     * Toggle comparison mode
     */
    toggleCompareMode() {
        this.compareMode = !this.compareMode;
        this.selectedEntries = [];

        const btn = document.getElementById('btnToggleCompare');
        const actionContainer = document.getElementById('compareActionContainer');

        if (this.compareMode) {
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-secondary');
            btn.textContent = 'Cancel Compare';
        } else {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
            btn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="12" y1="3" x2="12" y2="21"></line>
                </svg>
                Compare
            `;
            if (actionContainer) actionContainer.style.display = 'none';
        }

        this.loadProgressTimeline(document.getElementById('progressTimeFilter')?.value || 'all');
    }

    /**
     * Handle entry selection for comparison
     */
    handleEntrySelection(entryId) {
        const index = this.selectedEntries.indexOf(entryId);

        if (index > -1) {
            this.selectedEntries.splice(index, 1);
        } else {
            if (this.selectedEntries.length >= 2) {
                // Remove the first selected item if we already have two
                this.selectedEntries.shift();
            }
            this.selectedEntries.push(entryId);
        }

        // Update UI
        const entries = document.querySelectorAll('.timeline-entry');
        entries.forEach(item => {
            if (this.selectedEntries.includes(item.dataset.entryId)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Show/hide floating action
        const actionContainer = document.getElementById('compareActionContainer');
        const executeBtn = document.getElementById('btnExecuteCompare');

        if (this.selectedEntries.length === 2) {
            actionContainer.style.display = 'flex';
            executeBtn.textContent = 'Compare Selected (2)';
        } else {
            actionContainer.style.display = 'none';
        }
    }

    /**
     * Execute comparison between selected entries
     */
    async executeComparison() {
        if (this.selectedEntries.length !== 2) return;

        try {
            const allEntries = await this.getAllProgressEntries();
            const entry1 = allEntries.find(e => e.id.toString() === this.selectedEntries[0]);
            const entry2 = allEntries.find(e => e.id.toString() === this.selectedEntries[1]);

            if (entry1 && entry2) {
                // Sort by timestamp so entry1 is "Before" and entry2 is "After"
                const [before, after] = [entry1, entry2].sort((a, b) => a.timestamp - b.timestamp);
                this.showComparisonModal(before, after);
            }
        } catch (error) {
            console.error('Error executing comparison:', error);
            this.showToast('Could not load entries for comparison', 'error');
        }
    }

    /**
     * Show comparison modal with data
     */
    showComparisonModal(before, after) {
        const modal = document.getElementById('comparisonModal');
        const beforeImg = document.getElementById('comparisonImgBefore');
        const afterImg = document.getElementById('comparisonImgAfter');
        const timeframe = document.getElementById('comparisonTimeframe');
        const statsGrid = document.getElementById('comparisonStatsGrid');

        // Set images
        beforeImg.src = before.imageUrl || before.imageData || '';
        afterImg.src = after.imageUrl || after.imageData || '';

        // Calculate timeframe
        const diffTime = Math.abs(after.timestamp - before.timestamp);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        timeframe.textContent = `${diffDays} days of progress`;

        // Calculate and render stats
        statsGrid.innerHTML = this.calculateComparisonStats(before.analysis, after.analysis);

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Setup slider interaction
        this.setupComparisonSlider();
    }

    /**
     * Calculate stats differences
     */
    calculateComparisonStats(before, after) {
        const concerns = [
            { key: 'acne', label: 'Acne', icon: '🔴' },
            { key: 'pores', label: 'Pores', icon: '⚪' },
            { key: 'texture', label: 'Texture', icon: '✨' },
            { key: 'redness', label: 'Redness', icon: '🌡️' },
            { key: 'darkSpots', label: 'Dark Spots', icon: '⚫' }
        ];

        return concerns.map(concern => {
            const scoreBefore = before[concern.key].score;
            const scoreAfter = after[concern.key].score;
            const diff = scoreAfter - scoreBefore;
            const isImprovement = diff >= 0;

            // For skincare scores, higher is usually better (healthier skin)
            const trendClass = isImprovement ? 'trend-positive' : 'trend-negative';
            const trendSymbol = isImprovement ? '↓' : '↑'; // Improvement means lower visual concern, but in our data health score goes UP

            // Wait, if scores are health scores (100% is perfect), then higher is better.
            // If scores are concern levels (100% is high acne), then lower is better.
            // Looking at analyzeSkin, scores seem to be health scores where higher is better.

            const diffText = diff === 0 ? 'No change' : `${Math.abs(Math.round(diff))}% ${isImprovement ? 'improvement' : 'regression'}`;

            return `
                <div class="comparison-stat-card ${trendClass}">
                    <div class="stat-icon">${concern.icon}</div>
                    <div class="stat-name">${concern.label}</div>
                    <div class="stat-values">
                        <span class="value-before">${Math.round(scoreBefore)}%</span>
                        <span class="value-arrow">→</span>
                        <span class="value-after">${Math.round(scoreAfter)}%</span>
                    </div>
                    <div class="stat-trend">
                        ${isImprovement ? '✨' : '⚠️'} ${diffText}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Setup the interactive comparison slider
     */
    setupComparisonSlider() {
        const wrapper = document.getElementById('comparisonSliderWrapper');
        const afterImg = document.getElementById('comparisonAfterWrapper');
        const handle = document.getElementById('comparisonHandle');

        if (!wrapper || !afterImg || !handle) return;

        let isDragging = false;

        const moveSlider = (e) => {
            if (!isDragging) return;

            const rect = wrapper.getBoundingClientRect();
            let x = (e.pageX || e.touches[0].pageX) - rect.left;

            // Constrain
            if (x < 0) x = 0;
            if (x > rect.width) x = rect.width;

            const percentage = (x / rect.width) * 100;

            afterImg.style.clipPath = `inset(0 0 0 ${percentage}%)`;
            handle.style.left = `${percentage}%`;
        };

        const startDragging = () => { isDragging = true; };
        const stopDragging = () => { isDragging = false; };

        // Mouse Events
        handle.addEventListener('mousedown', startDragging);
        window.addEventListener('mouseup', stopDragging);
        window.addEventListener('mousemove', moveSlider);

        // Touch Events
        handle.addEventListener('touchstart', startDragging);
        window.addEventListener('touchend', stopDragging);
        window.addEventListener('touchmove', moveSlider);

        // Initialize to 50%
        afterImg.style.clipPath = `inset(0 0 0 50%)`;
        handle.style.left = `50%`;
    }

    /**
     * Hide comparison modal
     */
    hideComparisonModal() {
        const modal = document.getElementById('comparisonModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';

        // Return to normal mode
        if (this.compareMode) this.toggleCompareMode();
    }

    /**
     * Get summary of entry analysis
     */
    getEntrySummary(analysis) {
        const concernLabels = {
            acne: { label: 'Acne', icon: '🔴' },
            pores: { label: 'Pores', icon: '⚪' },
            texture: { label: 'Texture', icon: '✨' },
            redness: { label: 'Redness', icon: '🌡️' },
            darkSpots: { label: 'Dark Spots', icon: '⚫' }
        };

        // Sort by score (lowest first = worst concern)
        const sortedConcerns = Object.entries(analysis)
            .sort((a, b) => a[1].score - b[1].score);

        return `
            <div class="analysis-summary">
                ${sortedConcerns.map(([key, data]) => {
            const concern = concernLabels[key];
            const scoreClass = data.score >= 70 ? 'good' : data.score >= 40 ? 'moderate' : 'poor';

            return `
                        <div class="summary-concern">
                            <div class="summary-concern-header">
                                <span class="summary-icon">${concern.icon}</span>
                                <span class="summary-label">${concern.label}</span>
                            </div>
                            <div class="summary-metrics">
                                <span class="summary-score ${scoreClass}">${Math.round(data.score)}%</span>
                                <span class="summary-severity">${data.severity}</span>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    /**
     * Delete a progress entry (from both IndexedDB and Firestore)
     */
    async deleteProgressEntry(entryId) {
        if (!confirm('Are you sure you want to delete this progress entry? This action cannot be undone.')) {
            return;
        }

        try {
            // Delete from IndexedDB
            await this.removeProgressEntry(entryId);

            // Sync deletion to Firebase
            try {
                const deleted = await StorageManager.deleteProgressEntry(entryId);
                if (deleted) {
                    console.log('✅ Entry deleted from Firebase');
                }
            } catch (firebaseError) {
                console.warn('Could not delete from Firebase:', firebaseError);
            }

            this.showToast('Progress entry deleted', 'success');
            this.loadProgressTimeline();
        } catch (error) {
            console.error('Error deleting entry:', error);
            this.showToast('Failed to delete entry', 'error');
        }
    }

    /**
     * Remove progress entry from IndexedDB
     */
    async removeProgressEntry(entryId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['progressEntries'], 'readwrite');
            const store = transaction.objectStore('progressEntries');
            const request = store.delete(entryId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

// Initialize progress manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.progressManager = new ProgressManager();
    });
} else {
    window.progressManager = new ProgressManager();
}
