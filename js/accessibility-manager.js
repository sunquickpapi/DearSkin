// ========================================
// Accessibility Manager
// ========================================

const AccessibilityManager = {

    // Voice synthesis
    synth: window.speechSynthesis,
    voiceEnabled: false,
    voiceRate: 1,
    currentUtterance: null,

    /**
     * Initialize accessibility features
     */
    init() {
        this.loadSettings();
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.initVoiceGuide();
    },

    /**
     * Load accessibility settings from storage
     */
    loadSettings() {
        const settings = StorageManager.load('accessibilitySettings', {
            theme: 'light',
            fontSize: 'normal',
            reducedMotion: false,
            voiceEnabled: false,
            voiceRate: 1
        });

        this.applyTheme(settings.theme);
        this.applyFontSize(settings.fontSize);
        this.applyReducedMotion(settings.reducedMotion);
        this.voiceEnabled = settings.voiceEnabled;
        this.voiceRate = settings.voiceRate;

        return settings;
    },

    /**
     * Save accessibility settings
     */
    saveSettings(settings) {
        StorageManager.save('accessibilitySettings', settings);
    },

    /**
     * Apply theme
     */
    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        announceToScreenReader(`Theme changed to ${theme}`);
    },

    /**
     * Apply font size
     */
    applyFontSize(size) {
        document.body.className = document.body.className.replace(/font-size-\w+/g, '');
        if (size !== 'normal') {
            document.body.classList.add(`font-size-${size}`);
        }
        announceToScreenReader(`Font size changed to ${size}`);
    },

    /**
     * Apply reduced motion preference
     */
    applyReducedMotion(enabled) {
        if (enabled) {
            document.body.style.setProperty('--transition-fast', '0.01ms');
            document.body.style.setProperty('--transition-base', '0.01ms');
            document.body.style.setProperty('--transition-slow', '0.01ms');
        } else {
            document.body.style.removeProperty('--transition-fast');
            document.body.style.removeProperty('--transition-base');
            document.body.style.removeProperty('--transition-slow');
        }
    },

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Escape key closes modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }

            // Tab key management for focus trapping in modals
            if (e.key === 'Tab') {
                const modal = document.querySelector('.modal-overlay.active');
                if (modal) {
                    this.trapFocus(modal, e);
                }
            }
        });
    },

    /**
     * Setup focus management
     */
    setupFocusManagement() {
        // Add visible focus indicators
        document.addEventListener('mousedown', () => {
            document.body.classList.add('using-mouse');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.remove('using-mouse');
            }
        });
    },

    /**
     * Trap focus within an element (for modals)
     */
    trapFocus(element, event) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus();
                event.preventDefault();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                firstFocusable.focus();
                event.preventDefault();
            }
        }
    },

    /**
     * Close all open modals
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal-overlay.active');
        modals.forEach(modal => {
            modal.classList.remove('active');
            announceToScreenReader('Modal closed');
        });
    },

    /**
     * Initialize voice guide
     */
    initVoiceGuide() {
        // Load available voices
        if (this.synth) {
            this.synth.addEventListener('voiceschanged', () => {
                this.voices = this.synth.getVoices();
            });
        }
    },

    /**
     * Speak text using voice synthesis
     */
    speak(text, options = {}) {
        if (!this.voiceEnabled || !this.synth) {
            return;
        }

        // Cancel any ongoing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.rate || this.voiceRate;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;

        // Use preferred voice if available
        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(voice => voice.lang === 'en-US');
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.currentUtterance = utterance;
        this.synth.speak(utterance);
    },

    /**
     * Stop speaking
     */
    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
        }
    },

    /**
     * Toggle voice guide
     */
    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;

        const settings = this.loadSettings();
        settings.voiceEnabled = this.voiceEnabled;
        this.saveSettings(settings);

        const message = this.voiceEnabled ? 'Voice guide enabled' : 'Voice guide disabled';
        announceToScreenReader(message);

        if (this.voiceEnabled) {
            this.speak(message);
        }

        return this.voiceEnabled;
    },

    /**
     * Set voice rate
     */
    setVoiceRate(rate) {
        this.voiceRate = clamp(rate, 0.5, 2);

        const settings = this.loadSettings();
        settings.voiceRate = this.voiceRate;
        this.saveSettings(settings);
    },

    /**
     * Announce routine step
     */
    announceRoutineStep(step, stepNumber, totalSteps) {
        const message = `Step ${stepNumber} of ${totalSteps}: ${step.name}. ${step.instructions || ''}`;
        this.speak(message);
        announceToScreenReader(message);
    },

    /**
     * Announce navigation
     */
    announceNavigation(pageName) {
        const message = `Navigated to ${pageName}`;
        announceToScreenReader(message);
        if (this.voiceEnabled) {
            this.speak(message, { rate: 1.2 });
        }
    },

    /**
     * Announce action completion
     */
    announceCompletion(action) {
        const message = `${action} completed`;
        announceToScreenReader(message);
        if (this.voiceEnabled) {
            this.speak(message);
        }
    },

    /**
     * Make element screen reader friendly
     */
    makeAccessible(element, label, role = null) {
        if (label) {
            element.setAttribute('aria-label', label);
        }
        if (role) {
            element.setAttribute('role', role);
        }
        return element;
    },

    /**
     * Create skip link for keyboard navigation
     */
    createSkipLink(targetId, text = 'Skip to main content') {
        const skipLink = createElement('a', {
            href: `#${targetId}`,
            className: 'skip-link sr-only',
            textContent: text
        });

        skipLink.addEventListener('focus', () => {
            skipLink.classList.remove('sr-only');
        });

        skipLink.addEventListener('blur', () => {
            skipLink.classList.add('sr-only');
        });

        return skipLink;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    AccessibilityManager.init();
});
