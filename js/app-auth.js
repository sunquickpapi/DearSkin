/**
 * App Authentication Integration
 * Bridges Firebase authentication with the main DearSkin app UI
 */

class AppAuthManager {
    constructor() {
        this.currentUser = null;
        this.authInitialized = false;
    }

    /**
     * Initialize authentication UI and state observer
     */
    async init() {
        // Wait for FirebaseAuthManager to be ready
        if (!window.FirebaseAuthManager) {
            console.warn('FirebaseAuthManager not ready, waiting...');
            setTimeout(() => this.init(), 100);
            return;
        }

        // Set up auth state observer
        window.firebaseAuth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateAuthUI(user);

            if (user && !this.authInitialized) {
                // User signed in - trigger data sync
                this.syncDataOnAuth();
                this.authInitialized = true;
            } else if (!user) {
                this.authInitialized = false;
            }
        });

        // Set up event listeners for auth buttons
        this.setupEventListeners();

        console.log('✅ AppAuthManager initialized');
    }

    /**
     * Set up event listeners for auth UI elements
     */
    setupEventListeners() {
        // Sign in button
        const signInBtn = document.getElementById('sign-in-button');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => this.handleSignIn());
        }

        // Sign out button
        const signOutBtn = document.getElementById('sign-out-button');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.handleSignOut());
        }
    }

    /**
     * Update UI based on authentication state
     * @param {Object} user - Firebase user object or null
     */
    updateAuthUI(user) {
        const signInButton = document.getElementById('sign-in-button');
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('userName');
        const userNameElement = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');
        const syncIndicator = document.getElementById('sync-indicator');

        if (user) {
            // User is signed in
            if (signInButton) signInButton.style.display = 'none';
            if (userProfile) userProfile.style.display = 'flex';

            // Update user name
            const displayName = user.displayName || user.email.split('@')[0];
            if (userName) userName.textContent = displayName;
            if (userNameElement) userNameElement.textContent = displayName;

            // Update user avatar
            if (userAvatar) {
                if (user.photoURL) {
                    userAvatar.src = user.photoURL;
                } else {
                    // Generate a colored circle with initial
                    const initial = displayName.charAt(0).toUpperCase();
                    userAvatar.src = this.generateAvatar(initial);
                }
            }

            // Show sync indicator
            if (syncIndicator) {
                syncIndicator.style.display = 'flex';
                syncIndicator.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    <span>Synced</span>
                `;
            }

            console.log(`✅ User signed in: ${user.email}`);
        } else {
            // User is signed out
            if (signInButton) signInButton.style.display = 'flex';
            if (userProfile) userProfile.style.display = 'none';
            if (userName) userName.textContent = 'Friend';

            // Hide sync indicator
            if (syncIndicator) {
                syncIndicator.style.display = 'none';
            }

            console.log('User signed out');
        }
    }

    /**
     * Generate a simple avatar with initials
     * @param {string} initial - Letter to display
     * @returns {string} Data URL for avatar image
     */
    generateAvatar(initial) {
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');

        // Draw gradient circle
        const gradient = ctx.createLinearGradient(0, 0, 40, 40);
        gradient.addColorStop(0, 'hsl(340, 75%, 65%)');
        gradient.addColorStop(1, 'hsl(200, 70%, 60%)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(20, 20, 20, 0, Math.PI * 2);
        ctx.fill();

        // Draw initial
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, 20, 20);

        return canvas.toDataURL();
    }

    /**
     * Handle sign-in button click
     */
    handleSignIn() {
        // Redirect to auth page
        window.location.href = 'auth.html';
    }

    /**
     * Handle sign-out button click
     */
    async handleSignOut() {
        try {
            if (window.FirebaseAuthManager) {
                await window.FirebaseAuthManager.signOut();
            }
        } catch (error) {
            console.error('Error signing out:', error);
            window.showToast('Error signing out', 'error');
        }
    }

    /**
     * Sync local data to cloud when user signs in
     */
    async syncDataOnAuth() {
        if (!window.FirebaseStorage) {
            console.warn('FirebaseStorage not available for sync');
            return;
        }

        try {
            // Show syncing indicator
            const syncIndicator = document.getElementById('sync-indicator');
            if (syncIndicator) {
                syncIndicator.innerHTML = `
                    <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    <span>Syncing...</span>
                `;
            }

            // Trigger sync from local storage to cloud
            await window.FirebaseStorage.syncLocalToCloud();

            // Update sync indicator
            if (syncIndicator) {
                syncIndicator.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Synced</span>
                `;
            }

            // Reload data from Firebase to ensure we have the latest
            if (window.app && window.app.productManager) {
                await window.app.productManager.loadProducts();
            }

        } catch (error) {
            console.error('Error syncing data:', error);

            const syncIndicator = document.getElementById('sync-indicator');
            if (syncIndicator) {
                syncIndicator.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>Sync failed</span>
                `;
            }
        }
    }

    /**
     * Check if user is currently signed in
     * @returns {boolean}
     */
    isSignedIn() {
        return this.currentUser !== null;
    }

    /**
     * Get current user
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.currentUser;
    }
}

// Initialize on page load
const initAppAuth = () => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.AppAuthManager = new AppAuthManager();
            window.AppAuthManager.init();
        });
    } else {
        window.AppAuthManager = new AppAuthManager();
        window.AppAuthManager.init();
    }
};

initAppAuth();
