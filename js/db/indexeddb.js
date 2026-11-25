/**
 * نظام إدارة مركز صيانة سيارات
 * محرك التخزين المحلي IndexedDB مع دعم العمل بدون إنترنت (Offline-First)
 */

import { DB_NAME, DB_VERSION } from './schema.js';

class Database {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.deviceId = this.getOrCreateDeviceId();
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem('almarkaz_device_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      localStorage.setItem('almarkaz_device_id', id);
    }
    return id;
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('فشل في فتح قاعدة البيانات المحلية:', event.target.error);
        reject(event.target.error);
      };

      request.onblocked = (event) => {
        console.warn('⚠️ قاعدة البيانات بانتظار إغلاق التبويبات القديمة...', event);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.db.onversionchange = () => {
          console.log('🔄 إغلاق اتصال قاعدة البيانات القديم للسماح بالترقية في تبويب جديد...');
          this.db.close();
        };
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. العملاء
        if (!db.objectStoreNames.contains('customers')) {
          const store = db.createObjectStore('customers', { keyPath: 'id' });
          store.createIndex('phone', 'phone', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 2. السيارات
        if (!db.objectStoreNames.contains('cars')) {
          const store = db.createObjectStore('cars', { keyPath: 'id' });
          store.createIndex('customerId', 'customerId', { unique: false });
          store.createIndex('plateFull', 'plateFull', { unique: false });
          store.createIndex('plateLetters', 'plateLetters', { unique: false });
          store.createIndex('plateNumbers', 'plateNumbers', { unique: false });
        }

        // 3. الصيانة والفواتير
        if (!db.objectStoreNames.contains('maintenance')) {
          const store = db.createObjectStore('maintenance', { keyPath: 'id' });
          store.createIndex('customerId', 'customerId', { unique: false });
          store.createIndex('carId', 'carId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('paymentStatus', 'paymentStatus', { unique: false });
        }

        // 4. الخدمات
        if (!db.objectStoreNames.contains('services')) {
          const store = db.createObjectStore('services', { keyPath: 'id' });
          store.createIndex('isActive', 'isActive', { unique: false });
        }

        // 5. الفنيين والعمال
        if (!db.objectStoreNames.contains('workers')) {
          const store = db.createObjectStore('workers', { keyPath: 'id' });
          store.createIndex('isActive', 'isActive', { unique: false });
        }

        // 5b. حضور وانصراف العمالة يومياً
        if (!db.objectStoreNames.contains('workerAttendance')) {
          const store = db.createObjectStore('workerAttendance', { keyPath: 'id' });
          store.createIndex('workerId', 'workerId', { unique: false });
          store.createIndex('date', 'date', { unique: false });
        }

        // 5c. مصروفات يومية للعمالة
        if (!db.objectStoreNames.contains('workerExpenses')) {
          const store = db.createObjectStore('workerExpenses', { keyPath: 'id' });
          store.createIndex('workerId', 'workerId', { unique: false });
          store.createIndex('date', 'date', { unique: false });
        }

        // 6. قطع الغيار والمخزن
        if (!db.objectStoreNames.contains('parts')) {
          const store = db.createObjectStore('parts', { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('supplierId', 'supplierId', { unique: false });
        }

        // 7. المبيعات
        if (!db.objectStoreNames.contains('sales')) {
          const store = db.createObjectStore('sales', { keyPath: 'id' });
          store.createIndex('partId', 'partId', { unique: false });
          store.createIndex('invoiceId', 'invoiceId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 8. الموردين
        if (!db.objectStoreNames.contains('suppliers')) {
          const store = db.createObjectStore('suppliers', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('phone', 'phone', { unique: false });
        }

        // 9. فواتير التوريد
        if (!db.objectStoreNames.contains('supplierInvoices')) {
          const store = db.createObjectStore('supplierInvoices', { keyPath: 'id' });
          store.createIndex('supplierId', 'supplierId', { unique: false });
          store.createIndex('dueDate', 'dueDate', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // 10. المشتريات
        if (!db.objectStoreNames.contains('purchases')) {
          const store = db.createObjectStore('purchases', { keyPath: 'id' });
          store.createIndex('supplierInvoiceId', 'supplierInvoiceId', { unique: false });
          store.createIndex('partId', 'partId', { unique: false });
        }

        // 11. مدفوعات الموردين
        if (!db.objectStoreNames.contains('supplierPayments')) {
          const store = db.createObjectStore('supplierPayments', { keyPath: 'id' });
          store.createIndex('supplierId', 'supplierId', { unique: false });
          store.createIndex('supplierInvoiceId', 'supplierInvoiceId', { unique: false });
        }

        // 12. طابور المزامنة
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 13. الإعدادات
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 14. المستخدمين وصلاحيات الدخول
        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id' });
          store.createIndex('username', 'username', { unique: true });
          store.createIndex('role', 'role', { unique: false });
          store.createIndex('isActive', 'isActive', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // توليد كود فريد مع بادئة الجهاز لتفادي التعارض في المزامنة
  generateId(prefix) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${this.deviceId}-${timestamp}${rand}`;
  }

  // اسم بديل لـ generateId لتوافق الاستدعاءات القديمة
  async getNextId(prefix, _storeName) {
    return this.generateId(prefix);
  }

  // جلب عنصر بالمفتاح
  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // جلب جميع العناصر في جدول
  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // فلترة وبحث
  async find(storeName, filterFn) {
    const all = await this.getAll(storeName);
    return filterFn ? all.filter(filterFn) : all;
  }

  // إضافة عنصر مع تسجيله في طابور المزامنة (Idempotent)
  async add(storeName, item, pushToSync = true) {
    await this.init();
    if (!item.id && storeName !== 'settings') {
      item.id = this.generateId(storeName.substring(0, 4).toUpperCase());
    }
    if (!item.createdAt && storeName !== 'settings') {
      item.createdAt = new Date().toISOString();
    }
    item.updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const stores = pushToSync && storeName !== 'syncQueue' ? [storeName, 'syncQueue'] : [storeName];
      const tx = this.db.transaction(stores, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);

      if (pushToSync && storeName !== 'syncQueue') {
        const queueStore = tx.objectStore('syncQueue');
        const queueItem = {
          id: 'SYNC-' + this.generateId('OP'),
          entityType: storeName,
          action: 'upsert',
          recordId: item.id || item.key,
          payload: item,
          status: 'pending',
          retries: 0,
          createdAt: new Date().toISOString()
        };
        queueStore.put(queueItem);
      }

      tx.oncomplete = () => {
        window.dispatchEvent(new CustomEvent('db:changed', { detail: { store: storeName, action: 'add', item } }));
        resolve(item);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // تعديل أو إضافة (Put)
  async put(storeName, item, pushToSync = true) {
    return this.add(storeName, item, pushToSync);
  }

  // حذف عنصر
  async delete(storeName, key, pushToSync = true) {
    await this.init();
    return new Promise((resolve, reject) => {
      const stores = pushToSync && storeName !== 'syncQueue' ? [storeName, 'syncQueue'] : [storeName];
      const tx = this.db.transaction(stores, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);

      if (pushToSync && storeName !== 'syncQueue') {
        const queueStore = tx.objectStore('syncQueue');
        const queueItem = {
          id: 'SYNC-' + this.generateId('DEL'),
          entityType: storeName,
          action: 'delete',
          recordId: key,
          payload: { id: key },
          status: 'pending',
          retries: 0,
          createdAt: new Date().toISOString()
        };
        queueStore.put(queueItem);
      }

      tx.oncomplete = () => {
        window.dispatchEvent(new CustomEvent('db:changed', { detail: { store: storeName, action: 'delete', key } }));
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // مسح كامل لجدول
  async clear(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // تصدير كامل البيانات كملف JSON للنسخ الاحتياطي
  async exportFullBackup() {
    const stores = [
      'customers', 'cars', 'maintenance', 'services', 'workers',
      'workerAttendance', 'workerExpenses',
      'parts', 'sales', 'suppliers', 'supplierInvoices', 'purchases',
      'supplierPayments', 'users', 'settings'
    ];
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      deviceId: this.deviceId,
      data: {}
    };

    for (const store of stores) {
      backup.data[store] = await this.getAll(store);
    }
    return backup;
  }

  // استيراد نسخة احتياطية
  async importBackup(backupJson) {
    await this.init();
    if (!backupJson || !backupJson.data) throw new Error('ملف النسخة الاحتياطية غير صالح');

    for (const [storeName, items] of Object.entries(backupJson.data)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          await this.put(storeName, item, false); // بدون إرسال لطابور المزامنة
        }
      }
    }
    return true;
  }
}

export const db = new Database();
