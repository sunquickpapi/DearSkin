// ========================================
// Storage Manager - Data Persistence Layer
// ========================================

const StorageManager = {

    /**
     * Initialize IndexedDB for storing photos and large data
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DearSkinDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                    photoStore.createIndex('date', 'date', { unique: false });
                    photoStore.createIndex('type', 'type', { unique: false });
                }

                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('category', 'category', { unique: false });
                }
            };
        });
    },

    /**
     * Save data to localStorage
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    },

    /**
     * Load data from localStorage
     */
    load(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized === null) {
                return defaultValue;
            }
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return defaultValue;
        }
    },

    /**
     * Remove data from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    },

    /**
     * Clear all localStorage data
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    },

    /**
     * Save photo to IndexedDB
     */
    async savePhoto(photoData) {
        try {
            const db = await this.initDB();
            const transaction = db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');

            const photo = {
                data: photoData.data,
                date: photoData.date || new Date().toISOString(),
                type: photoData.type || 'progress',
                notes: photoData.notes || '',
                symptoms: photoData.symptoms || []
            };

            return new Promise((resolve, reject) => {
                const request = store.add(photo);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error saving photo:', error);
            throw error;
        }
    },

    /**
     * Get all photos from IndexedDB
     */
    async getPhotos(type = null) {
        try {
            const db = await this.initDB();
            const transaction = db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');

            return new Promise((resolve, reject) => {
                const request = type
                    ? store.index('type').getAll(type)
                    : store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error getting photos:', error);
            return [];
        }
    },

    /**
     * Delete photo from IndexedDB
     */
    async deletePhoto(id) {
        try {
            const db = await this.initDB();
            const transaction = db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');

            return new Promise((resolve, reject) => {
                const request = store.delete(id);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error deleting photo:', error);
            return false;
        }
    },

    /**
     * Save product to IndexedDB
     */
    async saveProduct(productData) {
        try {
            const db = await this.initDB();
            const transaction = db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');

            return new Promise((resolve, reject) => {
                const request = productData.id
                    ? store.put(productData)
                    : store.add(productData);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error saving product:', error);
            throw error;
        }
    },

    /**
     * Get all products from IndexedDB
     */
    async getProducts() {
        try {
            const db = await this.initDB();
            const transaction = db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');

            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error getting products:', error);
            return [];
        }
    },

    /**
     * Delete product from IndexedDB
     */
    async deleteProduct(id) {
        try {
            const db = await this.initDB();
            const transaction = db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');

            return new Promise((resolve, reject) => {
                const request = store.delete(id);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error deleting product:', error);
            return false;
        }
    },

    /**
     * Export all data as JSON
     */
    async exportData() {
        try {
            const photos = await this.getPhotos();
            const products = await this.getProducts();

            const data = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                userProfile: this.load('userProfile'),
                routines: this.load('routines'),
                settings: this.load('settings'),
                skinLogs: this.load('skinLogs'),
                photos: photos,
                products: products
            };

            return data;
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    },

    /**
     * Import data from JSON
     */
    async importData(data) {
        try {
            // Validate data structure
            if (!data.version) {
                throw new Error('Invalid data format');
            }

            // Import localStorage data
            if (data.userProfile) this.save('userProfile', data.userProfile);
            if (data.routines) this.save('routines', data.routines);
            if (data.settings) this.save('settings', data.settings);
            if (data.skinLogs) this.save('skinLogs', data.skinLogs);

            // Import photos
            if (data.photos && data.photos.length > 0) {
                for (const photo of data.photos) {
                    await this.savePhoto(photo);
                }
            }

            // Import products
            if (data.products && data.products.length > 0) {
                for (const product of data.products) {
                    await this.saveProduct(product);
                }
            }

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    },

    /**
     * Clear all local data (IndexedDB and localStorage)
     * Used when switching users
     */
    async clearAllData() {
        try {
            // Clear localStorage
            localStorage.clear();
            console.log('✅ localStorage cleared');

            // Clear IndexedDB
            const db = await this.initDB();

            // Clear products
            const productTransaction = db.transaction(['products'], 'readwrite');
            const productStore = productTransaction.objectStore('products');
            await new Promise((resolve, reject) => {
                const request = productStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            console.log('✅ Products cleared from IndexedDB');

            // Clear photos
            const photoTransaction = db.transaction(['photos'], 'readwrite');
            const photoStore = photoTransaction.objectStore('photos');
            await new Promise((resolve, reject) => {
                const request = photoStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            console.log('✅ Photos cleared from IndexedDB');

            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    },

    /**
     * Get storage usage estimate
     */
    async getStorageEstimate() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentUsed: (estimate.usage / estimate.quota) * 100
            };
        }
        return null;
    },

    // ========================================
    // Progress Entries - Firebase Integration
    // ========================================

    /**
     * Upload progress image to Firebase Storage
     */
    async uploadProgressImage(imageData, userId) {
        try {
            if (!userId) {
                throw new Error('User ID required for uploading');
            }

            // Check Firebase availability
            if (!firebase || !firebase.storage || !window.firebaseAuth || !window.firebaseAuth.currentUser) {
                console.warn('Firebase not available, storing locally only');
                return null;
            }

            // Convert base64 to blob
            const response = await fetch(imageData);
            const blob = await response.blob();

            // Create unique filename
            const timestamp = Date.now();
            const filename = `progress/${userId}/${timestamp}.jpg`;

            // Upload to Firebase Storage
            const storageRef = firebase.storage().ref();
            const imageRef = storageRef.child(filename);
            const snapshot = await imageRef.put(blob);
            const downloadURL = await snapshot.ref.getDownloadURL();

            console.log('✅ Image uploaded to Firebase Storage:', downloadURL);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading progress image:', error);
            return null;
        }
    },

    /**
     * Get all progress entries from Firestore
     */
    async getProgressEntries() {
        try {
            const user = window.firebaseAuth?.currentUser;

            if (!user || !window.firebaseDb) {
                console.warn('Firebase not available, returning empty array');
                return [];
            }

            const db = window.firebaseDb;
            const progressRef = db.collection('users')
                .doc(user.uid)
                .collection('progress')
                .orderBy('timestamp', 'desc');

            const snapshot = await progressRef.get();
            const entries = [];

            snapshot.forEach(doc => {
                entries.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return entries;
        } catch (error) {
            console.error('Error getting progress entries:', error);
            return [];
        }
    },

    /**
     * Add progress entry to Firestore
     */
    async addProgressEntry(entry, imageData) {
        try {
            const user = window.firebaseAuth?.currentUser;

            if (!user || !window.firebaseDb) {
                console.warn('Firebase not available, entry not synced to cloud');
                return null;
            }

            console.log('📤 Saving progress entry to Firestore...');

            // Store base64 image directly in Firestore (avoids Storage CORS issues)
            // Note: Firestore has a 1MB document limit, so compress large images if needed
            const imageUrl = imageData; // Use base64 data URL directly

            // Prepare entry data (no userId needed in nested collection)
            const entryData = {
                timestamp: entry.timestamp || Date.now(),
                date: entry.date || new Date().toISOString().split('T')[0],
                imageUrl: imageUrl || '',
                analysis: entry.analysis || {}
            };

            // Add to Firestore under users/{userId}/progress
            const db = window.firebaseDb;
            const docRef = await db.collection('users')
                .doc(user.uid)
                .collection('progress')
                .add(entryData);

            console.log('✅ Progress entry saved to Firestore:', docRef.id);

            return {
                id: docRef.id,
                ...entryData
            };
        } catch (error) {
            console.error('Error adding progress entry:', error);
            return null;
        }
    },

    /**
     * Delete progress entry from Firestore
     */
    async deleteProgressEntry(entryId) {
        try {
            const user = window.firebaseAuth?.currentUser;

            if (!user || !window.firebaseDb) {
                console.warn('Firebase not available, deletion not synced');
                return false;
            }

            const db = window.firebaseDb;
            await db.collection('users')
                .doc(user.uid)
                .collection('progress')
                .doc(entryId)
                .delete();

            console.log('✅ Entry deleted from Firestore:', entryId);

            return true;
        } catch (error) {
            console.error('Error deleting progress entry:', error);
            return false;
        }
    },


    /**
     * Export all data as JSON
     */
    async exportData() {
        try {
            const photos = await this.getPhotos();
            const products = await this.getProducts();

            const data = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                userProfile: this.load('userProfile'),
                routines: this.load('routines'),
                settings: this.load('settings'),
                skinLogs: this.load('skinLogs'),
                photos: photos,
                products: products
            };

            return data;
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    },

    /**
     * Import data from JSON
     */
    async importData(data) {
        try {
            // Validate data structure
            if (!data.version) {
                throw new Error('Invalid data format');
            }

            // Import localStorage data
            if (data.userProfile) this.save('userProfile', data.userProfile);
            if (data.routines) this.save('routines', data.routines);
            if (data.settings) this.save('settings', data.settings);
            if (data.skinLogs) this.save('skinLogs', data.skinLogs);

            // Import photos
            if (data.photos && data.photos.length > 0) {
                for (const photo of data.photos) {
                    await this.savePhoto(photo);
                }
            }

            // Import products
            if (data.products && data.products.length > 0) {
                for (const product of data.products) {
                    await this.saveProduct(product);
                }
            }

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    },

    /**
     * Clear all local data (IndexedDB and localStorage)
     * Used when switching users
     */
    async clearAllData() {
        try {
            // Clear localStorage
            localStorage.clear();
            console.log('✅ localStorage cleared');

            // Clear IndexedDB
            const db = await this.initDB();

            // Clear products
            const productTransaction = db.transaction(['products'], 'readwrite');
            const productStore = productTransaction.objectStore('products');
            await new Promise((resolve, reject) => {
                const request = productStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            console.log('✅ Products cleared from IndexedDB');

            // Clear photos
            const photoTransaction = db.transaction(['photos'], 'readwrite');
            const photoStore = photoTransaction.objectStore('photos');
            await new Promise((resolve, reject) => {
                const request = photoStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            console.log('✅ Photos cleared from IndexedDB');

            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }
};

// Initialize database on load
StorageManager.initDB().catch(console.error);

