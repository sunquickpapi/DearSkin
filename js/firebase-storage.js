// ========================================
// Firebase Firestore Storage Helper
// ========================================

class FirebaseStorageManager {
    constructor() {
        this.db = window.firebaseDb;
        this.auth = window.firebaseAuth;
    }

    /**
     * Get current user ID
     */
    getCurrentUserId() {
        const user = this.auth.currentUser;
        if (!user) {
            throw new Error('No user signed in');
        }
        return user.uid;
    }

    /**
     * Check if user is signed in
     */
    isUserSignedIn() {
        return this.auth.currentUser !== null;
    }

    // ========================================
    // Products
    // ========================================

    /**
     * Save product to Firestore
     */
    async saveProduct(product) {
        try {
            const userId = this.getCurrentUserId();
            const productsRef = this.db.collection('users').doc(userId).collection('products');

            if (product.id) {
                // Update existing product
                await productsRef.doc(product.id.toString()).set(product);
                console.log('Product updated in Firestore:', product.id);
                return product.id;
            } else {
                // Create new product
                const docRef = await productsRef.add(product);
                const newId = parseInt(Date.now()); // Use timestamp as ID
                await docRef.update({ id: newId });
                console.log('Product added to Firestore:', newId);
                return newId;
            }
        } catch (error) {
            console.error('Error saving product to Firestore:', error);
            throw error;
        }
    }

    /**
     * Get all products from Firestore
     */
    async getProducts() {
        try {
            const userId = this.getCurrentUserId();
            const snapshot = await this.db.collection('users')
                .doc(userId)
                .collection('products')
                .get();

            const products = [];
            snapshot.forEach(doc => {
                products.push(doc.data());
            });

            console.log('Products loaded from Firestore:', products.length);
            return products;
        } catch (error) {
            console.error('Error getting products from Firestore:', error);
            return [];
        }
    }

    /**
     * Delete product from Firestore
     */
    async deleteProduct(productId) {
        try {
            const userId = this.getCurrentUserId();
            const snapshot = await this.db.collection('users')
                .doc(userId)
                .collection('products')
                .where('id', '==', productId)
                .get();

            const batch = this.db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log('Product deleted from Firestore:', productId);
        } catch (error) {
            console.error('Error deleting product from Firestore:', error);
            throw error;
        }
    }

    // ========================================
    // Routines
    // ========================================

    /**
     * Save routine to Firestore
     */
    async saveRoutine(routineType, steps, routinesDone = 0, completionDates = []) {
        try {
            const userId = this.getCurrentUserId();
            await this.db.collection('users')
                .doc(userId)
                .collection('routines')
                .doc(routineType)
                .set({
                    steps,
                    routinesDone,
                    completionDates,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log(`${routineType} routine saved to Firestore with count: ${routinesDone} and ${completionDates.length} history entries`);
        } catch (error) {
            console.error('Error saving routine to Firestore:', error);
            throw error;
        }
    }

    /**
     * Get routine from Firestore
     */
    async getRoutine(routineType) {
        try {
            const userId = this.getCurrentUserId();
            const doc = await this.db.collection('users')
                .doc(userId)
                .collection('routines')
                .doc(routineType)
                .get();

            if (doc.exists) {
                const data = doc.data();
                return {
                    steps: data.steps || [],
                    routinesDone: data.routinesDone || 0,
                    completionDates: data.completionDates || []
                };
            }
            return { steps: [], routinesDone: 0, completionDates: [] };
        } catch (error) {
            console.error('Error getting routine from Firestore:', error);
            return { steps: [], routinesDone: 0 };
        }
    }

    /**
     * Get all routines from Firestore
     */
    async getRoutines() {
        try {
            const morning = await this.getRoutine('morning');
            const evening = await this.getRoutine('evening');
            return {
                morning: morning.steps,
                evening: evening.steps,
                morningCount: morning.routinesDone,
                eveningCount: evening.routinesDone,
                morningDates: morning.completionDates || [],
                eveningDates: evening.completionDates || []
            };
        } catch (error) {
            console.error('Error getting routines from Firestore:', error);
            return { morning: [], evening: [], morningCount: 0, eveningCount: 0 };
        }
    }

    // ========================================
    // Progress / Photos
    // ========================================

    /**
     * Save progress entry to Firestore
     */
    async saveProgress(entry) {
        try {
            const userId = this.getCurrentUserId();
            const progressRef = this.db.collection('users').doc(userId).collection('progress');

            if (entry.id) {
                await progressRef.doc(entry.id.toString()).set(entry);
                return entry.id;
            } else {
                const docRef = await progressRef.add(entry);
                const newId = Date.now();
                await docRef.update({ id: newId });
                return newId;
            }
        } catch (error) {
            console.error('Error saving progress to Firestore:', error);
            throw error;
        }
    }

    /**
     * Get all progress entries from Firestore
     */
    async getProgress() {
        try {
            const userId = this.getCurrentUserId();
            const snapshot = await this.db.collection('users')
                .doc(userId)
                .collection('progress')
                .orderBy('timestamp', 'desc')
                .get();

            const entries = [];
            snapshot.forEach(doc => {
                entries.push(doc.data());
            });

            return entries;
        } catch (error) {
            console.error('Error getting progress from Firestore:', error);
            return [];
        }
    }

    /**
     * Delete progress entry from Firestore
     */
    async deleteProgress(entryId) {
        try {
            const userId = this.getCurrentUserId();
            const snapshot = await this.db.collection('users')
                .doc(userId)
                .collection('progress')
                .where('id', '==', entryId)
                .get();

            const batch = this.db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log('Progress entry deleted from Firestore:', entryId);
        } catch (error) {
            console.error('Error deleting progress from Firestore:', error);
            throw error;
        }
    }

    // ========================================
    // Reminders
    // ========================================

    /**
     * Save reminder to Firestore
     */
    async saveReminder(reminder) {
        try {
            const userId = this.getCurrentUserId();
            console.log('☁️ Firestore Save Start - User ID:', userId);
            const remindersRef = this.db.collection('users').doc(userId).collection('reminders');

            if (reminder.id) {
                // Update existing
                await remindersRef.doc(reminder.id.toString()).set({
                    ...reminder,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return reminder.id;
            } else {
                // Create new
                const newId = Date.now();
                await remindersRef.doc(newId.toString()).set({
                    ...reminder,
                    id: newId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return newId;
            }
        } catch (error) {
            console.error('Error saving reminder to Firestore:', error);
            throw error;
        }
    }

    /**
     * Get all reminders from Firestore
     */
    async getReminders() {
        try {
            const userId = this.getCurrentUserId();
            const snapshot = await this.db.collection('users')
                .doc(userId)
                .collection('reminders')
                .orderBy('updatedAt', 'desc')
                .get();

            const reminders = [];
            snapshot.forEach(doc => {
                reminders.push(doc.data());
            });

            return reminders;
        } catch (error) {
            console.error('Error getting reminders from Firestore:', error);
            return [];
        }
    }

    /**
     * Delete reminder from Firestore
     */
    async deleteReminder(reminderId) {
        try {
            const userId = this.getCurrentUserId();
            await this.db.collection('users')
                .doc(userId)
                .collection('reminders')
                .doc(reminderId.toString())
                .delete();

            console.log('Reminder deleted from Firestore:', reminderId);
        } catch (error) {
            console.error('Error deleting reminder from Firestore:', error);
            throw error;
        }
    }

    // ========================================
    // User Profile
    // ========================================

    /**
     * Save user profile to Firestore
     */
    async saveUserProfile(profile) {
        try {
            const userId = this.getCurrentUserId();
            await this.db.collection('users').doc(userId).set({
                profile,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log('User profile saved to Firestore');
        } catch (error) {
            console.error('Error saving user profile to Firestore:', error);
            throw error;
        }
    }

    /**
     * Get user profile from Firestore
     */
    async getUserProfile() {
        try {
            const userId = this.getCurrentUserId();
            const doc = await this.db.collection('users').doc(userId).get();

            if (doc.exists) {
                return doc.data().profile;
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile from Firestore:', error);
            return null;
        }
    }

    // ========================================
    // Sync Operations
    // ========================================

    /**
     * Sync local data to cloud
     */
    async syncLocalToCloud(userId) {
        try {
            console.log('🔄 Syncing local data to cloud...');

            // Sync products
            const localProducts = StorageManager.load('skincare_products', []);
            if (localProducts.length > 0) {
                for (const product of localProducts) {
                    await this.saveProduct(product);
                }
                console.log(`✅ Synced ${localProducts.length} products to cloud`);
            }

            // Sync routines
            const localRoutines = StorageManager.load('routines', { morning: [], evening: [] });
            const localStats = StorageManager.load('routineStats', { morning: 0, evening: 0 });
            const morningHistory = StorageManager.load('morningHistory', []);
            const eveningHistory = StorageManager.load('eveningHistory', []);

            if (localRoutines.morning.length > 0 || morningHistory.length > 0) {
                await this.saveRoutine('morning', localRoutines.morning, localStats.morning, morningHistory);
            }
            if (localRoutines.evening.length > 0 || eveningHistory.length > 0) {
                await this.saveRoutine('evening', localRoutines.evening, localStats.evening, eveningHistory);
            }

            // Sync user profile
            const localProfile = StorageManager.load('userProfile');
            if (localProfile) {
                await this.saveUserProfile(localProfile);
            }

            console.log('✅ Local data synced to cloud');
            showToast('Data synced to cloud', 'success');
        } catch (error) {
            console.error('Error syncing local to cloud:', error);
            showToast('Sync error - data saved locally', 'warning');
        }
    }
}

// Initialize and export
if (typeof window !== 'undefined') {
    window.FirebaseStorage = new FirebaseStorageManager();
}
