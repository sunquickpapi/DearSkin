// ========================================
// Firebase Configuration and Initialization
// ========================================

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBDnh1CPQK_cebvWK4JUYF6FB2UjJwm9hc",
    authDomain: "dearskin-14d70.firebaseapp.com",
    projectId: "dearskin-14d70",
    storageBucket: "dearskin-14d70.appspot.com",
    messagingSenderId: "74810739328",
    appId: "1:74810739328:web:cf6ba2a61bc4bf730fb465",
    measurementId: "G-KSHW6GFFC5"
};

// Initialize Firebase
const fApp = firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for Firestore
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open');
        } else if (err.code == 'unimplemented') {
            console.warn('Firestore persistence not supported in this browser');
        }
    });

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.firebaseApp = fApp;
    window.firebaseAuth = auth;
    window.firebaseDb = db;
}

console.log('✅ Firebase initialized successfully');
