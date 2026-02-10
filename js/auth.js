// ========================================
// Authentication Page Logic
// ========================================

class AuthPage {
    constructor() {
        this.signinForm = document.getElementById('signinForm');
        this.signupForm = document.getElementById('signupForm');
        this.isSigningUp = false; // Flag to prevent redirect during signup
        this.isSigningIn = false; // Flag to prevent redirect during sign-in
        this.init();
    }

    /**
     * Initialize auth page
     */
    init() {
        this.setupTabSwitching();
        this.setupFormHandlers();
        this.setupGoogleAuth();
        this.checkExistingAuth();
    }

    /**
     * Setup tab switching
     */
    setupTabSwitching() {
        const tabs = document.querySelectorAll('.auth-tab, .switch-tab');
        const forms = document.querySelectorAll('.auth-form');

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = tab.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.auth-tab').forEach(t => {
                    t.classList.remove('active');
                });
                const activeTabBtn = document.querySelector(`.auth-tab[data-tab="${targetTab}"]`);
                if (activeTabBtn) {
                    activeTabBtn.classList.add('active');
                }

                // Update forms
                forms.forEach(form => {
                    form.classList.remove('active');
                });
                const activeForm = document.getElementById(`${targetTab}Form`);
                if (activeForm) {
                    activeForm.classList.add('active');
                }
            });
        });
    }

    /**
     * Setup form submission handlers
     */
    setupFormHandlers() {
        // Sign in form
        this.signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSignIn();
        });

        // Sign up form
        this.signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSignUp();
        });

        // Forgot password
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleForgotPassword();
            });
        }
    }

    /**
     * Setup Google authentication
     */
    setupGoogleAuth() {
        const googleSigninBtn = document.getElementById('googleSigninBtn');
        const googleSignupBtn = document.getElementById('googleSignupBtn');

        if (googleSigninBtn) {
            googleSigninBtn.addEventListener('click', async () => {
                await this.handleGoogleSignIn();
            });
        }

        if (googleSignupBtn) {
            googleSignupBtn.addEventListener('click', async () => {
                await this.handleGoogleSignIn();
            });
        }
    }

    /**
     * Check if user is already authenticated
     */
    checkExistingAuth() {
        let isInitialCheck = true; // Flag to detect if this is the initial page load

        firebase.auth().onAuthStateChanged((user) => {
            // Only redirect on initial page load if user is already signed in
            // Don't redirect during signup or active sign-in process
            if (user && isInitialCheck && !this.isSigningUp && !this.isSigningIn) {
                console.log('✅ User already signed in on page load:', user.email);
                this.handleExistingUserRedirect();
            }

            // After first check, set flag to false
            isInitialCheck = false;
        });
    }

    /**
     * Handle redirect for already-signed-in users
     */
    async handleExistingUserRedirect() {
        // Check onboarding status before redirecting
        const hasCompletedOnboarding = await this.checkOnboardingStatus();

        if (hasCompletedOnboarding) {
            this.redirectToApp();
        } else {
            this.redirectToOnboarding();
        }
    }

    /**
     * Handle sign in
     */
    async handleSignIn() {
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        const submitBtn = document.getElementById('signinBtn');
        const errorDiv = document.getElementById('signinError');

        // Clear previous errors
        this.hideError(errorDiv);

        // Validate inputs
        if (!email || !password) {
            this.showError(errorDiv, 'Please fill in all fields');
            return;
        }

        try {
            // Disable button
            this.setButtonLoading(submitBtn, true, 'Signing in...');

            // Set flag to prevent auth state listener from redirecting
            this.isSigningIn = true;

            // Sign in with Firebase
            await window.FirebaseAuthManager.signIn(email, password);

            // Check if user has completed onboarding
            const hasCompletedOnboarding = await this.checkOnboardingStatus();

            // Clear the flag
            this.isSigningIn = false;

            // Redirect based on onboarding status
            if (hasCompletedOnboarding) {
                console.log('✅ User has completed onboarding, redirecting to app');
                this.redirectToApp();
            } else {
                console.log('⚠️ User has NOT completed onboarding, redirecting to onboarding page');
                this.redirectToOnboarding();
            }
        } catch (error) {
            console.error('Sign in error:', error);
            this.isSigningIn = false; // Clear flag on error
            this.showError(errorDiv, this.getErrorMessage(error));
        } finally {
            this.setButtonLoading(submitBtn, false, 'Sign In');
        }
    }

    /**
     * Handle sign up
     */
    async handleSignUp() {
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const submitBtn = document.getElementById('signupBtn');
        const errorDiv = document.getElementById('signupError');

        // Clear previous errors
        this.hideError(errorDiv);

        // Validate inputs
        if (!name || !email || !password) {
            this.showError(errorDiv, 'Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            this.showError(errorDiv, 'Password must be at least 6 characters');
            return;
        }

        try {
            // Disable button
            this.setButtonLoading(submitBtn, true, 'Creating account...');

            // Set flag to prevent auth state listener from redirecting
            this.isSigningUp = true;

            // Sign up with Firebase
            await window.FirebaseAuthManager.signUp(email, password, name);

            // Immediately sign out the user before auth state listener can redirect
            await firebase.auth().signOut();

            // Clear the flag
            this.isSigningUp = false;

            // Success - show message and switch to sign-in tab
            showToast('Account created successfully! Please sign in.', 'success');

            // Switch to sign-in tab immediately (no delay)
            const signinTab = document.querySelector('.auth-tab[data-tab="signin"]');
            if (signinTab) {
                signinTab.click();
            }

            // Clear form
            this.signupForm.reset();

        } catch (error) {
            console.error('Sign up error:', error);
            this.isSigningUp = false; // Clear flag on error
            this.showError(errorDiv, this.getErrorMessage(error));
        } finally {
            this.setButtonLoading(submitBtn, false, 'Create Account');
        }
    }

    /**
     * Handle Google sign in
     */
    async handleGoogleSignIn() {
        try {
            // Set flag to prevent auth state listener from redirecting
            this.isSigningIn = true;

            await window.FirebaseAuthManager.signInWithGoogle();

            // Check if user has completed onboarding
            const hasCompletedOnboarding = await this.checkOnboardingStatus();

            // Clear the flag
            this.isSigningIn = false;

            if (hasCompletedOnboarding) {
                console.log('✅ User has completed onboarding, redirecting to app');
                this.redirectToApp();
            } else {
                console.log('⚠️ User has NOT completed onboarding, redirecting to onboarding page');
                this.redirectToOnboarding();
            }
        } catch (error) {
            console.error('Google sign in error:', error);
            this.isSigningIn = false; // Clear flag on error
            showToast('Google sign-in failed', 'error');
        }
    }

    /**
     * Handle forgot password
     */
    async handleForgotPassword() {
        const email = document.getElementById('signin-email').value.trim();

        if (!email) {
            showToast('Please enter your email address', 'warning');
            return;
        }

        try {
            await window.FirebaseAuthManager.sendPasswordReset(email);
            showToast('Password reset email sent! Check your inbox.', 'success');
        } catch (error) {
            console.error('Password reset error:', error);
            showToast('Failed to send reset email', 'error');
        }
    }

    /**
     * Show error message
     */
    showError(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
        }
    }

    /**
     * Hide error message
     */
    hideError(errorDiv) {
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
    }

    /**
     * Set button loading state
     */
    setButtonLoading(button, loading, text) {
        if (!button) return;

        button.disabled = loading;
        button.textContent = text;

        if (loading) {
            button.innerHTML = `
                <svg style="width: 18px; height: 18px; animation: spin 0.8s linear infinite;" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" fill="none"/>
                </svg>
                ${text}
            `;
        }
    }

    /**
     * Get user-friendly error message
     */
    getErrorMessage(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered',
            'auth/invalid-email': 'Invalid email address',
            'auth/weak-password': 'Password is too weak',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/too-many-requests': 'Too many failed attempts. Try again later',
            'auth/network-request-failed': 'Network error. Check your connection'
        };

        return errorMessages[error.code] || 'Authentication failed. Please try again.';
    }

    /**
     * Check if user has completed onboarding
     */
    async checkOnboardingStatus() {
        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                console.log('❌ No user signed in, cannot check onboarding status');
                return false;
            }

            console.log('🔍 Checking onboarding status for user:', user.email);

            const db = window.firebaseDb;
            const userDoc = await db.collection('users').doc(user.uid).get();

            if (userDoc.exists) {
                const data = userDoc.data();
                const hasCompleted = data.profile?.onboardingCompleted === true;

                console.log('📄 User document found. Onboarding completed:', hasCompleted);

                if (!hasCompleted) {
                    console.log('➡️ Redirecting to onboarding page...');
                } else {
                    console.log('➡️ Redirecting to main app...');
                }

                return hasCompleted;
            }

            console.log('❌ User document not found in Firestore');
            return false;
        } catch (error) {
            console.error('❌ Error checking onboarding status:', error);
            return false;
        }
    }

    /**
     * Redirect to onboarding
     */
    redirectToOnboarding() {
        console.log('🔄 Redirecting to onboarding page...');
        showToast('Redirecting to complete your profile...', 'info');
        setTimeout(() => {
            window.location.href = 'onboarding.html';
        }, 1000);
    }

    /**
     * Redirect to main app
     */
    redirectToApp() {
        console.log('🔄 Redirecting to main app...');
        showToast('Welcome back!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
}

// Initialize auth page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    setTimeout(() => {
        new AuthPage();
    }, 500);
});

// Add spin animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
