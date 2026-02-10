// ========================================
// Onboarding Flow Controller
// ========================================

const onboarding = {
    currentStep: 1,
    totalSteps: 5,
    userData: {},

    /**
     * Initialize onboarding
     */
    async init() {
        console.log('🔄 Initializing onboarding page...');

        // Wait for Firebase auth to be ready
        return new Promise((resolve) => {
            const unsubscribe = firebase.auth().onAuthStateChanged(async (currentUser) => {
                // Unsubscribe immediately - we only need this once
                unsubscribe();

                console.log('🔍 Auth state ready. User:', currentUser ? currentUser.email : 'None');

                // Check if user is authenticated
                if (!currentUser) {
                    console.log('❌ No user logged in, redirecting to auth page');
                    window.location.href = 'auth.html';
                    return;
                }

                console.log('✅ User authenticated:', currentUser.email);

                // Check if user has already completed onboarding
                try {
                    const db = window.firebaseDb;
                    const userDoc = await db.collection('users').doc(currentUser.uid).get();

                    if (userDoc.exists) {
                        const data = userDoc.data();
                        if (data.profile?.onboardingCompleted === true) {
                            console.log('✅ User already completed onboarding, redirecting to app');
                            window.location.href = 'index.html';
                            return;
                        }
                    }

                    console.log('➡️ Starting onboarding flow');
                } catch (error) {
                    console.error('Error checking onboarding status:', error);
                }

                this.updateProgress();
                this.setupFormValidation();
                resolve();
            });
        });
    },

    /**
     * Go to next step
     */
    nextStep() {
        // Validate current step
        if (!this.validateCurrentStep()) {
            return;
        }

        // Save current step data
        this.saveCurrentStepData();

        if (this.currentStep < this.totalSteps) {
            // Hide current step
            document.getElementById(`step${this.currentStep}`).classList.remove('active');

            // Show next step
            this.currentStep++;
            document.getElementById(`step${this.currentStep}`).classList.add('active');

            // Update progress
            this.updateProgress();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * Go to previous step
     */
    prevStep() {
        if (this.currentStep > 1) {
            // Hide current step
            document.getElementById(`step${this.currentStep}`).classList.remove('active');

            // Show previous step
            this.currentStep--;
            document.getElementById(`step${this.currentStep}`).classList.add('active');

            // Update progress
            this.updateProgress();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * Update progress bar
     */
    updateProgress() {
        const progress = (this.currentStep / this.totalSteps) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `Step ${this.currentStep} of ${this.totalSteps}`;
    },

    /**
     * Validate current step
     */
    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                return true; // Welcome screen, no validation needed

            case 2:
                const form = document.getElementById('basicInfoForm');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                return true;

            case 3:
                const skinForm = document.getElementById('skinAssessmentForm');
                const skinType = document.querySelector('input[name="skinType"]:checked');
                if (!skinType) {
                    showToast('Please select your skin type', 'warning');
                    return false;
                }
                return true;

            case 4:
                return true; // All fields have defaults

            case 5:
                const goals = document.querySelectorAll('input[name="goals"]:checked');
                if (goals.length === 0) {
                    showToast('Please select at least one goal', 'warning');
                    return false;
                }
                if (goals.length > 3) {
                    showToast('Please select up to 3 goals', 'warning');
                    return false;
                }
                return true;

            default:
                return true;
        }
    },

    /**
     * Save current step data
     */
    saveCurrentStepData() {
        switch (this.currentStep) {
            case 2:
                this.userData.name = document.getElementById('userName').value;
                this.userData.ageRange = document.getElementById('userAge').value;
                this.userData.knowledge = document.querySelector('input[name="knowledge"]:checked')?.value;
                break;

            case 3:
                this.userData.skinType = document.querySelector('input[name="skinType"]:checked')?.value;
                this.userData.concerns = Array.from(document.querySelectorAll('input[name="concerns"]:checked'))
                    .map(cb => cb.value);
                break;

            case 4:
                this.userData.stressLevel = document.getElementById('stressLevel').value;
                this.userData.sleepHours = document.getElementById('sleepHours').value;
                this.userData.hydration = document.querySelector('input[name="hydration"]:checked')?.value;
                this.userData.climate = document.getElementById('climate').value;
                break;

            case 5:
                this.userData.goals = Array.from(document.querySelectorAll('input[name="goals"]:checked'))
                    .map(cb => cb.value);
                this.userData.routineTimes = Array.from(document.querySelectorAll('input[name="routineTime"]:checked'))
                    .map(cb => cb.value);
                this.userData.notificationsEnabled = document.getElementById('enableNotifications').checked;
                break;
        }
    },

    /**
     * Complete onboarding
     */
    async complete() {
        if (!this.validateCurrentStep()) {
            return;
        }

        // Save final step data
        this.saveCurrentStepData();

        // Get current Firebase user
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            showToast('Please sign in to continue', 'error');
            window.location.href = 'auth.html';
            return;
        }

        // Get email from Firebase Auth user
        this.userData.email = currentUser.email;

        // Add metadata
        this.userData.onboardingCompleted = true;
        this.userData.onboardingDate = new Date().toISOString();
        this.userData.version = '1.0';

        // Save to local storage
        StorageManager.save('userProfile', this.userData);

        // Initialize default settings
        const defaultSettings = {
            theme: 'light',
            fontSize: 'normal',
            reducedMotion: false,
            voiceEnabled: false,
            voiceRate: 1
        };
        StorageManager.save('accessibilitySettings', defaultSettings);

        // Initialize empty routine history
        StorageManager.save('routineHistory', []);

        // Save onboarding data to Firestore
        try {
            const db = window.firebaseDb;
            await db.collection('users').doc(currentUser.uid).update({
                'profile.onboardingCompleted': true,
                'profile.name': this.userData.name || currentUser.displayName || '',
                'profile.ageRange': this.userData.ageRange || '',
                'profile.knowledge': this.userData.knowledge || '',
                'profile.skinType': this.userData.skinType || '',
                'profile.concerns': this.userData.concerns || [],
                'profile.stressLevel': this.userData.stressLevel || '3',
                'profile.sleepHours': this.userData.sleepHours || '7-8',
                'profile.hydration': this.userData.hydration || 'moderate',
                'profile.climate': this.userData.climate || '',
                'profile.goals': this.userData.goals || [],
                'profile.routineTimes': this.userData.routineTimes || [],
                'profile.notificationsEnabled': this.userData.notificationsEnabled || false,
                'onboardingDate': firebase.firestore.FieldValue.serverTimestamp(),
                'updatedAt': firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Onboarding data saved to Firestore');
        } catch (error) {
            console.error('Error saving onboarding data to Firestore:', error);
            // Don't block the user if Firestore save fails
        }

        // Show completion message
        showToast('Welcome to DearSkin! 🎉', 'success', 2000);

        // Request notification permission if enabled
        if (this.userData.notificationsEnabled && 'Notification' in window) {
            await Notification.requestPermission();
        }

        // Redirect to main app after a short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    },

    /**
     * Setup form validation
     */
    setupFormValidation() {
        // Limit goal selection to 3
        const goalCheckboxes = document.querySelectorAll('input[name="goals"]');
        goalCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const checked = document.querySelectorAll('input[name="goals"]:checked');
                if (checked.length > 3) {
                    checkbox.checked = false;
                    showToast('You can select up to 3 goals', 'warning');
                }
            });
        });
    }
};

// Initialize when DOM and Firebase are ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    const initWhenReady = () => {
        if (window.firebase && window.firebaseDb && window.firebase.auth) {
            onboarding.init();
        } else {
            setTimeout(initWhenReady, 100);
        }
    };
    initWhenReady();
});
