/* Service Worker for 配達マップ */

const CACHE_NAME = 'delivery-map-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - URLインターセプト機能
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // GoogleマップのURLパターンをチェック
  const googleMapsHosts = [
    'maps.google.com',
    'www.google.com',
    'goo.gl',
    'maps.app.goo.gl'
  ];

  // GoogleマップのURLをインターセプト
  if (googleMapsHosts.includes(url.hostname) &&
      (url.pathname.includes('/maps') || url.pathname.includes('/place'))) {

    // URLから座標や場所情報を抽出してリダイレクト
    event.respondWith(
      Response.redirect('/?intercepted=' + encodeURIComponent(event.request.url), 302)
    );
    return;
  }

  // 通常のキャッシュ処理
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// メッセージ受信（外部URLの処理）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'HANDLE_EXTERNAL_URL') {
    const url = event.data.url;

    // クライアントに通知
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'EXTERNAL_URL_RECEIVED',
          url: url
        });
      });
    });
  }
});

// Share Target API対応
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/' && url.searchParams.has('url')) {
    // Share TargetからのURL受信
    const sharedUrl = url.searchParams.get('url');

    event.respondWith(
      Response.redirect('/?shared=' + encodeURIComponent(sharedUrl), 302)
    );
  }
});