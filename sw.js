const CACHE_NAME = 'duy-go-v1';
const RUNTIME_IMG_CACHE = 'duy-go-img-v1';
const ASSETS = [
  './',
  './index.html',
  './logic.js',
  './image-engine.js',
  './mockData.js',
  './languages.json',
  './logo.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(ASSETS);
      } catch (e) {
        // Không fail install chỉ vì 1 asset (ví dụ user xoá logo.svg)
        await Promise.all(
          ASSETS.map((u) => cache.add(u).catch(() => {}))
        );
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Image caching: cache-first để ảnh lên nhanh khi cuộn
  const isImage =
    req.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname) ||
    url.hostname.includes('loremflickr.com') ||
    url.hostname.includes('source.unsplash.com') ||
    url.hostname.includes('images.unsplash.com') ||
    url.hostname.includes('placehold.co');

  if (isImage) {
    event.respondWith(
      caches.open(RUNTIME_IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Smart Cache: Ưu tiên mạng, nếu lỗi thì dùng cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
