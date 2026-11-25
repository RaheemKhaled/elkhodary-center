/**
 * Service Worker لنظام إدارة مركز صيانة السيارات (المركز)
 * استراتيجية Network-First مع دعم أوفلاين 100% (Offline Fallback)
 * تضمن تحميل أحدث التعديلات فوراً وتعمل بكفاءة تامة عند انقطاع الاتصال
 */

const CACHE_NAME = 'almarkaz-cache-v21';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/components.css',
  './css/wizard.css',
  './css/print.css',
  './js/app.js',
  './js/db/schema.js',
  './js/db/indexeddb.js',
  './js/db/seed.js',
  './js/services/authService.js',
  './js/services/customerService.js',
  './js/services/inventoryService.js',
  './js/services/supplierService.js',
  './js/services/invoiceService.js',
  './js/services/reportService.js',
  './js/services/workerService.js',
  './js/sync/syncEngine.js',
  './js/components/platePicker.js',
  './js/components/toast.js',
  './js/components/modal.js',
  './js/views/loginView.js',
  './js/views/cashierView.js',
  './js/views/homeView.js',
  './js/views/invoiceView.js',
  './js/views/customersView.js',
  './js/views/inventoryView.js',
  './js/views/suppliersView.js',
  './js/views/workersView.js',
  './js/views/reportsView.js',
  './js/views/settingsView.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 جاري حفظ أحدث ملفات النظام في الكاش للعمل بدون إنترنت...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 حذف الكاش القديم:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // تجاهل طلبات Google Sheets API الخارجية أو غير طلبات GET
  if (event.request.url.includes('script.google.com') || event.request.method !== 'GET') {
    return;
  }

  // استراتيجية Network-First: جلب أحدث نسخة من السيرفر، مع التخزين في الكاش، والرجوع للكاش عند انقطاع الاتصال
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // في حالة عدم الاتصال (Offline) نرجع النسخة المحفوظة في الكاش
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
