// ========================================
// Firebase Authentication Helper
// ========================================

class FirebaseAuthManager {
    constructor() {
        this.auth = window.firebaseAuth;
        this.currentUser = null;

        // Set up auth state observer
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.onAuthStateChange(user);
        });
    }

    /**
     * Handle auth state changes
     */
    async onAuthStateChange(user) {
        if (user) {
            console.log('✅ User signed in:', user.email);

            // Check if this is a different user than before
            const previousUserId = localStorage.getItem('currentUserId');

            if (previousUserId && previousUserId !== user.uid) {
                // Different user - clear all local data
                console.log('🔄 Different user detected, clearing local data...');
                await StorageManager.clearAllData();
            }

            // Store current user ID
            localStorage.setItem('currentUserId', user.uid);

            // Trigger data sync when user signs in
            if (window.FirebaseStorage) {
                // Load user data from Firestore
                await this.loadUserDataFromFirestore(user.uid);
            }
        } else {
            console.log('👤 User signed out');
            // Keep currentUserId in localStorage to detect user switches
        }
    }

    /**
     * Load user data from Firestore
     */
    async loadUserDataFromFirestore(userId) {
        try {
            console.log('📥 Loading user data from Firestore...');

            // Load products from Firestore and save to IndexedDB
            const products = await window.FirebaseStorage.getProducts();
            if (products.length > 0) {
                console.log(`✅ Loaded ${products.length} products from Firestore`);
                // Save to IndexedDB
                for (const product of products) {
                    await StorageManager.saveProduct(product);
                }
            }

            // Load routines
            const routines = await window.FirebaseStorage.getRoutines();
            if (routines.morning.length > 0 || routines.evening.length > 0) {
                StorageManager.save('routines', {
                    morning: routines.morning,
                    evening: routines.evening
                });

                // Save routine stats (counts)
                StorageManager.save('routineStats', {
                    morning: routines.morningCount || 0,
                    evening: routines.eveningCount || 0
                });

                console.log('✅ Loaded routines and stats from Firestore');
            }

            // Load user profile
            const userProfile = await window.FirebaseStorage.getUserProfile();
            if (userProfile) {
                StorageManager.save('userProfile', userProfile);
                console.log('✅ Loaded user profile from Firestore');
            }

            console.log('✅ All user data loaded from Firestore');
        } catch (error) {
            console.error('Error loading user data from Firestore:', error);
        }
    }

    /**
     * Sign up with email and password
     */
    async signUp(email, password, displayName) {
        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update profile with display name
            if (displayName) {
                await user.updateProfile({ displayName });
            }

            // Create user document in Firestore
            try {
                const db = window.firebaseDb;
                await db.collection('users').doc(user.uid).set({
                    profile: {
                        name: displayName || '',
                        email: email,
                        onboardingCompleted: false
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ User document created in Firestore:', user.uid);
            } catch (dbError) {
                console.error('Error creating user document:', dbError);
                // Don't throw - user is still created in Auth
            }

            showToast(`Welcome ${displayName || email}!`, 'success');
            return user;
        } catch (error) {
            console.error('Sign up error:', error);
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Sign in with email and password
     */
    async signIn(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            showToast(`Welcome back, ${user.displayName || user.email}!`, 'success');
            return user;
        } catch (error) {
            console.error('Sign in error:', error);
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await this.auth.signInWithPopup(provider);
            const user = result.user;

            // Check if this is a new user and create document if needed
            try {
                const db = window.firebaseDb;
                const userDoc = await db.collection('users').doc(user.uid).get();

                if (!userDoc.exists) {
                    // New user - create document
                    await db.collection('users').doc(user.uid).set({
                        profile: {
                            name: user.displayName || '',
                            email: user.email,
                            photoURL: user.photoURL || '',
                            onboardingCompleted: false
                        },
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('✅ User document created in Firestore:', user.uid);
                }
            } catch (dbError) {
                console.error('Error checking/creating user document:', dbError);
                // Don't throw - user can still sign in
            }

            showToast(`Welcome ${user.displayName}!`, 'success');
            return user;
        } catch (error) {
            console.error('Google sign in error:', error);
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            await this.auth.signOut();
            showToast('Signed out successfully', 'info');
        } catch (error) {
            console.error('Sign out error:', error);
            showToast('Error signing out', 'error');
            throw error;
        }
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(email) {
        try {
            await this.auth.sendPasswordResetEmail(email);
            showToast('Password reset email sent', 'success');
        } catch (error) {
            console.error('Password reset error:', error);
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user is signed in
     */
    isSignedIn() {
        return this.currentUser !== null;
    }

    /**
     * Handle authentication errors
     */
    handleAuthError(error) {
        let message = 'Authentication error';

        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'Email already in use';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address';
                break;
            case 'auth/operation-not-allowed':
                message = 'Operation not allowed';
                break;
            case 'auth/weak-password':
                message = 'Password is too weak';
                break;
            case 'auth/user-disabled':
                message = 'User account is disabled';
                break;
            case 'auth/user-not-found':
                message = 'User not found';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password';
                break;
            case 'auth/popup-closed-by-user':
                message = 'Sign-in popup closed';
                break;
            case 'auth/configuration-not-found':
                message = 'Email/Password authentication is not enabled. Please enable it in Firebase Console under Authentication > Sign-in method';
                break;
            default:
                message = error.message || 'Authentication error';
        }

        showToast(message, 'error');
    }
}

// Initialize and export
if (typeof window !== 'undefined') {
    // Wait for Firebase to be ready
    const initAuthManager = () => {
        if (window.firebaseAuth) {
            window.FirebaseAuthManager = new FirebaseAuthManager();
            console.log('✅ FirebaseAuthManager initialized');
        } else {
            console.warn('Waiting for Firebase to initialize...');
            setTimeout(initAuthManager, 100);
        }
    };
    initAuthManager();
}
