/**
 * محرك المزامنة التلقائية مع Google Sheets
 * Offline-First: كل عملية بتتحفظ الأول على الجهاز (IndexedDB) وبتدخل طابور المزامنة،
 * وأول ما النت يرجع بيترفع الطابور كله تلقائياً بالترتيب، ومفيش عملية بتتمسح من الطابور
 * إلا لما Google Sheets يأكد إنه استلمها.
 */

import { db } from '../db/indexeddb.js';
import { supabaseService } from '../services/supabaseService.js';
import { APP_CONFIG } from '../config.js';

// جداول محلية فقط لا تُرفع للشيت (كلمات المرور والإعدادات)
const LOCAL_ONLY_STORES = new Set(['settings', 'users', 'syncQueue']);
const BATCH_SIZE = 25;
const POLL_MS = 20000;
const PULL_MS = 60000;
const PULL_CURSOR_KEY = 'syncPullCursor';
// الجداول اللي بتتسحب من الأجهزة التانية
const PULLABLE_STORES = new Set([
  'customers', 'cars', 'maintenance', 'services', 'workers', 'workerAttendance', 'workerExpenses',
  'parts', 'sales', 'suppliers', 'supplierInvoices', 'purchases', 'supplierPayments'
]);

class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.webhookUrl = '';
    this.listeners = new Set();
    this.pollInterval = null;
    this.lastError = '';
    this.lastSyncAt = null;
    this.nextAllowedAt = 0;
    this.consecutiveFailures = 0;
    this.isPulling = false;
    this.pullUnsupported = false;
    this.lastPullAt = null;

    this.init();
  }

  async init() {
    const setting = await db.get('settings', 'googleSheetsWebhookUrl');
    this.webhookUrl = (setting && setting.value) ? String(setting.value).trim() : (APP_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL || '');

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.consecutiveFailures = 0;
      this.nextAllowedAt = 0;
      this.notifyStatus();
      this.triggerSync();
      this.pullChanges();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyStatus();
    });

    window.addEventListener('db:changed', (e) => {
      this.notifyStatus();
      if (e.detail && e.detail.store !== 'syncQueue' && !e.detail.remote) {
        // مهلة قصيرة لتجميع العمليات المتتالية (فاتورة + عميل + سيارة) في طلب واحد
        clearTimeout(this._debounce);
        this._debounce = setTimeout(() => this.triggerSync(), 1500);
      }
      if (e.detail && e.detail.store && e.detail.item) {
        if (e.detail.action === 'add' || e.detail.action === 'put') {
          supabaseService.syncRecord(e.detail.store, e.detail.item);
        } else if (e.detail.action === 'delete') {
          supabaseService.deleteRecord(e.detail.store, e.detail.key);
        }
      }
    });

    supabaseService.init().catch(err => console.warn('Supabase lazy init:', err));

    // فحص دوري: لو النت رجع من غير ما المتصفح يبعت حدث online، الطابور هيترفع برضه
    this.pollInterval = setInterval(() => this.triggerSync(), POLL_MS);

    // سحب التغييرات اللي اتعملت على أجهزة تانية (فواتير، عملاء، خدمات...) كل دقيقة
    this.pullInterval = setInterval(() => this.pullChanges(), PULL_MS);
    window.addEventListener('focus', () => this.pullChanges());

    this.notifyStatus();
    this.triggerSync();
    setTimeout(() => this.pullChanges(), 2000);
  }

  setWebhookUrl(url) {
    const next = String(url || '').trim() || APP_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL || '';
    if (next !== this.webhookUrl) db.put('settings', { key: PULL_CURSOR_KEY, value: 0 }, false); // شيت جديد = نسحب من الأول
    this.webhookUrl = next;
    this.consecutiveFailures = 0;
    this.nextAllowedAt = 0;
    this.notifyStatus();
    this.triggerSync();
  }

  onStatusChange(callback) {
    this.listeners.add(callback);
    this.getStatus().then(status => callback(status));
    return () => this.listeners.delete(callback);
  }

  async getPendingItems() {
    try {
      const queue = await db.getAll('syncQueue');
      return queue
        .filter(item => item.status === 'pending' || item.status === 'failed')
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    } catch {
      return [];
    }
  }

  async getPendingCount() {
    const items = await this.getPendingItems();
    return items.filter(i => !LOCAL_ONLY_STORES.has(i.entityType)).length;
  }

  async getStatus() {
    const pendingCount = await this.getPendingCount();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      hasWebhook: Boolean(this.webhookUrl),
      lastError: this.lastError,
      lastSyncAt: this.lastSyncAt,
      lastPullAt: this.lastPullAt,
      pullUnsupported: this.pullUnsupported
    };
  }

  async notifyStatus() {
    const status = await this.getStatus();
    for (const listener of this.listeners) {
      try { listener(status); } catch (e) { console.error(e); }
    }
  }

  removeFromQueue(ids) {
    if (!ids.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = db.db.transaction(['syncQueue'], 'readwrite');
      const store = tx.objectStore('syncQueue');
      ids.forEach(id => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  markFailed(items, message) {
    if (!items.length) return Promise.resolve();
    return new Promise((resolve) => {
      const tx = db.db.transaction(['syncQueue'], 'readwrite');
      const store = tx.objectStore('syncQueue');
      items.forEach(item => {
        store.put({ ...item, status: 'failed', retries: (item.retries || 0) + 1, error: message, lastTriedAt: new Date().toISOString() });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // رفع الطابور المعلق كله على دفعات
  async triggerSync() {
    if (this.isSyncing || !this.webhookUrl) return;
    if (Date.now() < this.nextAllowedAt) return;
    await db.init();

    let pending = await this.getPendingItems();

    // العمليات المحلية فقط (إعدادات/مستخدمين) تتشال من الطابور بدون رفع
    const localOnly = pending.filter(i => LOCAL_ONLY_STORES.has(i.entityType));
    if (localOnly.length) await this.removeFromQueue(localOnly.map(i => i.id));
    pending = pending.filter(i => !LOCAL_ONLY_STORES.has(i.entityType));
    if (pending.length === 0) { this.notifyStatus(); return; }

    this.isSyncing = true;
    this.notifyStatus();

    try {
      while (pending.length) {
        const batch = pending.slice(0, BATCH_SIZE);
        // text/plain يمنع طلب CORS preflight اللي Apps Script مش بيدعمه
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'sync_batch', deviceId: db.deviceId, operations: batch }),
          redirect: 'follow'
        });
        if (!response.ok) throw new Error(`خطأ في استجابة الخادم: ${response.status}`);

        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'فشلت المزامنة على Google Sheets');

        const okIds = new Set((result.results || []).filter(r => r.success).map(r => r.id));
        const done = batch.filter(i => okIds.has(i.id));
        const failed = batch.filter(i => !okIds.has(i.id));
        await this.removeFromQueue(done.map(i => i.id));
        if (failed.length) {
          const msg = (result.results || []).find(r => !r.success)?.message || 'لم يتم تأكيد الاستلام';
          await this.markFailed(failed, msg);
          throw new Error(msg);
        }

        console.log(`✅ تم رفع ${done.length} عملية إلى Google Sheets`);
        this.isOnline = true;
        pending = pending.slice(BATCH_SIZE);
        this.notifyStatus();
      }

      this.lastError = '';
      this.lastSyncAt = new Date().toISOString();
      setTimeout(() => this.pullChanges(), 500);
      this.consecutiveFailures = 0;
      this.nextAllowedAt = 0;
    } catch (error) {
      // انقطاع نت أو خطأ في الشيت: العمليات تفضل محفوظة في الطابور ويعاد رفعها تلقائياً
      console.warn('⚠️ تعذر الرفع حالياً، البيانات محفوظة على الجهاز وسيعاد المحاولة تلقائياً:', error.message);
      this.lastError = error.message;
      this.consecutiveFailures += 1;
      const backoff = Math.min(5 * 60000, 5000 * Math.pow(2, this.consecutiveFailures - 1));
      this.nextAllowedAt = Date.now() + backoff;
      if (error instanceof TypeError) this.isOnline = false; // فشل شبكة
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }
  }

  async syncNow() {
    if (!this.webhookUrl) {
      throw new Error('يرجى ضبط رابط Google Apps Script Webhook في شاشة الإعدادات أولاً');
    }
    this.nextAllowedAt = 0;
    this.consecutiveFailures = 0;
    await this.triggerSync();
    await this.pullChanges();
    const status = await this.getStatus();
    if (status.lastError) throw new Error(`لم تكتمل المزامنة: ${status.lastError} (البيانات محفوظة على الجهاز)`);
    return status;
  }

  // ===== السحب من Google Sheets: كل تغيير اتعمل على أي جهاز تاني بيوصل هنا =====
  async pullChanges() {
    if (this.isPulling || !this.webhookUrl || !navigator.onLine) return 0;
    this.isPulling = true;
    let applied = 0;
    try {
      await db.init();
      const cursorSetting = await db.get('settings', PULL_CURSOR_KEY);
      let cursor = Number(cursorSetting?.value) || 0;

      for (let page = 0; page < 50; page++) {
        const sep = this.webhookUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${this.webhookUrl}${sep}action=pull&after=${cursor}&limit=500`, { redirect: 'follow' });
        if (!res.ok) throw new Error(`pull HTTP ${res.status}`);
        const data = await res.json();

        // نسخة قديمة من الـ Apps Script مش بتدعم السحب
        if (!Array.isArray(data.rows)) {
          if (!this.pullUnsupported) console.warn('⚠️ كود Google Apps Script محتاج تحديث عشان المزامنة بين الأجهزة تشتغل');
          this.pullUnsupported = true;
          break;
        }
        this.pullUnsupported = false;

        if (data.rows.length) {
          applied += await this.applyRemoteRows(data.rows);
        }
        cursor = Number(data.next) || cursor;
        await db.put('settings', { key: PULL_CURSOR_KEY, value: cursor }, false);
        if (!data.rows.length || cursor >= (Number(data.total) || 0)) break;
      }

      this.lastPullAt = new Date().toISOString();
      if (applied > 0) {
        console.log(`⬇️ تم استلام ${applied} تحديث من الأجهزة التانية`);
        window.dispatchEvent(new CustomEvent('sync:pulled', { detail: { count: applied } }));
      }
    } catch (err) {
      console.warn('⚠️ تعذر سحب التحديثات من Google Sheets:', err.message);
    } finally {
      this.isPulling = false;
      this.notifyStatus();
    }
    return applied;
  }

  async applyRemoteRows(rows) {
    // أي سجل عليه تعديل محلي لسه مترفعش: النسخة المحلية تكسب
    const pendingIds = new Set((await this.getPendingItems()).map(q => `${q.entityType}|${q.recordId}`));
    let applied = 0;

    for (const row of rows) {
      if (!PULLABLE_STORES.has(row.e) || !row.id) continue;
      if (row.d && row.d === db.deviceId) continue; // تغيير عملناه إحنا
      if (pendingIds.has(`${row.e}|${row.id}`)) continue;

      if (row.a === 'delete') {
        if (await db.get(row.e, row.id)) {
          await db.delete(row.e, row.id, false);
          applied++;
        }
        continue;
      }

      const remote = row.p;
      if (!remote || !remote.id) continue;
      const local = await db.get(row.e, remote.id);
      if (!local || String(remote.updatedAt || '') > String(local.updatedAt || '')) {
        await db.putRemote(row.e, remote);
        applied++;
      }
    }
    return applied;
  }

  // جلب سجل عميل من Google Sheets (يفيد لو الفواتير اتعملت على جهاز تاني)
  async fetchRemoteCustomerHistory(phone) {
    if (!this.webhookUrl) return null;
    const url = `${this.webhookUrl}${this.webhookUrl.includes('?') ? '&' : '?'}action=customerHistory&phone=${encodeURIComponent(phone)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.success ? data : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const syncEngine = new SyncEngine();
