/**
 * محرك المزامنة التلقائية مع Google Sheets
 * Offline-First Sync Engine مع إدارة طابور العمليات المعلقة
 */

import { db } from '../db/indexeddb.js';
import { supabaseService } from '../services/supabaseService.js';

class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.webhookUrl = '';
    this.listeners = new Set();
    this.pollInterval = null;

    this.init();
  }

  async init() {
    // تحميل رابط Webhook من الإعدادات
    const setting = await db.get('settings', 'googleSheetsWebhookUrl');
    if (setting && setting.value) {
      this.webhookUrl = setting.value;
    }

    // مراقبة الاتصال بالإنترنت
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyStatus();
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyStatus();
    });

    // استماع لتغييرات قاعدة البيانات للمزامنة اللحظية
    window.addEventListener('db:changed', (e) => {
      this.notifyStatus();
      if (this.isOnline && this.webhookUrl) {
        this.triggerSync();
      }
      // مزامنة فورية مع Supabase السحابية
      if (e.detail && e.detail.store && e.detail.item) {
        if (e.detail.action === 'add' || e.detail.action === 'put') {
          supabaseService.syncRecord(e.detail.store, e.detail.item);
        } else if (e.detail.action === 'delete') {
          supabaseService.deleteRecord(e.detail.store, e.detail.key);
        }
      }
    });

    // تهيئة عميل سوبابيز
    supabaseService.init().catch(err => console.warn('Supabase lazy init:', err));

    // دورية فحص دورية كل 30 ثانية للمزامنة عند توفر النت
    this.pollInterval = setInterval(() => {
      if (this.isOnline && this.webhookUrl && !this.isSyncing) {
        this.triggerSync();
      }
    }, 30000);

    this.notifyStatus();
  }

  setWebhookUrl(url) {
    this.webhookUrl = url;
    if (this.isOnline && this.webhookUrl) {
      this.triggerSync();
    }
  }

  // إضافة مستمع لحالة المزامنة
  onStatusChange(callback) {
    this.listeners.add(callback);
    this.getStatus().then(status => callback(status));
    return () => this.listeners.delete(callback);
  }

  async getPendingCount() {
    try {
      const queue = await db.getAll('syncQueue');
      return queue.filter(item => item.status === 'pending' || item.status === 'failed').length;
    } catch {
      return 0;
    }
  }

  async getStatus() {
    const pendingCount = await this.getPendingCount();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      hasWebhook: Boolean(this.webhookUrl)
    };
  }

  async notifyStatus() {
    const status = await this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // تشغيل عملية المزامنة
  async triggerSync() {
    if (this.isSyncing) return;
    if (!this.isOnline) return;
    if (!this.webhookUrl) return;

    const queue = await db.getAll('syncQueue');
    const pending = queue.filter(item => item.status === 'pending' || item.status === 'failed');
    if (pending.length === 0) return;

    this.isSyncing = true;
    this.notifyStatus();

    try {
      // إرسال العمليات في حزمة (Batch) لمنع إرهاق السيرفر
      const batch = pending.slice(0, 25);
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sync_batch',
          deviceId: db.deviceId,
          operations: batch
        })
      });

      if (!response.ok) {
        throw new Error(`خطأ في استجابة الخادم: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // حذف أو تحديث العمليات المكتملة من الطابور
        const tx = db.db.transaction(['syncQueue'], 'readwrite');
        const store = tx.objectStore('syncQueue');
        for (const item of batch) {
          store.delete(item.id);
        }
        await new Promise(resolve => { tx.oncomplete = resolve; });
        console.log(`✅ تم مزامنة ${batch.length} عملية مع Google Sheets بنجاح`);
      } else {
        throw new Error(result.message || 'فشلت المزامنة على Google Sheets');
      }
    } catch (error) {
      console.warn('⚠️ تعثرت المزامنة، سيتم إعادة المحاولة لاحقاً:', error.message);
      // تحديث حالة العمليات في الطابور
      const tx = db.db.transaction(['syncQueue'], 'readwrite');
      const store = tx.objectStore('syncQueue');
      for (const item of pending.slice(0, 25)) {
        item.status = 'failed';
        item.retries = (item.retries || 0) + 1;
        item.error = error.message;
        store.put(item);
      }
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }
  }

  // مزامنة فورية يدوية بطلب المستخدم
  async syncNow() {
    if (!this.webhookUrl) {
      throw new Error('يرجى ضبط رابط Google Apps Script Webhook في شاشة الإعدادات أولاً');
    }
    if (!navigator.onLine) {
      throw new Error('لا يوجد اتصال بالإنترنت حالياً، سيتم الحفظ محلياً والمزامنة لاحقاً');
    }
    await this.triggerSync();
    return await this.getStatus();
  }
}

export const syncEngine = new SyncEngine();
