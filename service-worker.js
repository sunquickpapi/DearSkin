// ========================================
// Service Worker for PWA Offline Support
// ========================================

const CACHE_NAME = 'dearskin-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/onboarding.html',
    '/styles.css',
    '/app-styles.css',
    '/onboarding-styles.css',
    '/app.js',
    '/onboarding.js',
    '/js/utils.js',
    '/js/storage-manager.js',
    '/js/accessibility-manager.js',
    '/manifest.json',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for notifications (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-routine') {
        event.waitUntil(syncRoutineData());
    }
});

async function syncRoutineData() {
    // Placeholder for future sync functionality
    console.log('Syncing routine data...');
}

// Push notifications (future enhancement)
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Time for your skincare routine!',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'start',
                title: 'Start Routine',
                icon: '/assets/icons/icon-192.png'
            },
            {
                action: 'close',
                title: 'Dismiss'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('DearSkin Reminder', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'start') {
        event.waitUntil(
            clients.openWindow('/?action=start-routine')
        );
    }
});
