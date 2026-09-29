const cacheVersion = "zudomart-dashboard-v1";
const staticCacheName = `${cacheVersion}-static`;
const pageCacheName = `${cacheVersion}-pages`;
const offlinePagePaths = ["/pos", "/pos/shift", "/offline"];
const isLocalDevelopmentHost = ["localhost", "127.0.0.1"].includes(self.location.hostname);

function isStaticAssetRequest(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/") || url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/__nextjs_font/");
}

function isOfflineCapablePageRequest(url) {
  return url.pathname === "/pos" || url.pathname.startsWith("/pos/") || url.pathname === "/offline";
}

async function cacheResponseIfUsable(cacheName, request, response) {
  if (response && response.ok && response.type === "basic" && !response.redirected) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function fetchNetworkFirstThenCache(request, cacheName) {
  try {
    const response = await fetch(request);
    return await cacheResponseIfUsable(cacheName, request, response);
  } catch (error) {
    const cachedResponse = await caches.match(request, { ignoreVary: true });
    if (cachedResponse) return cachedResponse;
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline");
      if (offlinePage) return offlinePage;
    }
    throw error;
  }
}

async function fetchCacheFirstThenNetwork(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  const response = await fetch(request);
  return cacheResponseIfUsable(staticCacheName, request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(pageCacheName).then(async (cache) => {
      for (const pagePath of offlinePagePaths) {
        try {
          const response = await fetch(pagePath, { credentials: "same-origin", redirect: "manual" });
          if (response.ok && response.type === "basic") await cache.put(pagePath, response);
        } catch {
          continue;
        }
      }
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.filter((cacheName) => !cacheName.startsWith(cacheVersion)).map((cacheName) => caches.delete(cacheName))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/bff/") || url.pathname === "/serviceWorker.js") return;
  if (isStaticAssetRequest(url)) {
    event.respondWith(isLocalDevelopmentHost ? fetchNetworkFirstThenCache(request, staticCacheName) : fetchCacheFirstThenNetwork(request));
    return;
  }
  if (isOfflineCapablePageRequest(url)) {
    event.respondWith(fetchNetworkFirstThenCache(request, pageCacheName));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline")) ?? Response.error()));
  }
});
