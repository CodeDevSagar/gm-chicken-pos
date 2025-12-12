const CACHE_NAME = "gm-pos-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/static/js/bundle.js", 
  "/manifest.json",
  "/logo192.png",
  "/logo512.png"
];

// 1. Install Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. Fetch Requests (Offline Logic)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Agar cache me file mile to wahi dedo, nahi to internet se lo
      if (response) {
        return response;
      }
      return fetch(event.request).catch(() => {
          // Agar internet nahi hai aur file cache me nahi hai
          // Toh aap yahan ek custom offline page bhi dikha sakte hain
          // Filhal hum kuch return nahi kar rahe
      });
    })
  );
});

// 3. Update Service Worker
self.addEventListener("activate", (event) => {
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