/**
 * خدمة التكامل مع قاعدة بيانات سوبابيز السحابية (Supabase Cloud Database Service)
 * - تخزين ومزامنة البيانات سحابياً على PostgreSQL
 * - العمل بالنظام الهجين: Offline-First محلياً في IndexedDB مع المزامنة التلقائية مع Supabase
 */

import { db } from '../db/indexeddb.js';

// خريطة أسماء جداول IndexedDB إلى جداول PostgreSQL في Supabase
export const STORE_TO_SUPABASE_TABLE = {
  customers: 'customers',
  cars: 'cars',
  maintenance: 'maintenance',
  services: 'services',
  workers: 'workers',
  workerAttendance: 'worker_attendance',
  workerExpenses: 'worker_expenses',
  parts: 'parts',
  sales: 'sales',
  suppliers: 'suppliers',
  supplierInvoices: 'supplier_invoices',
  purchases: 'purchases',
  supplierPayments: 'supplier_payments',
  users: 'users',
  settings: 'settings'
};

const SUPABASE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

class SupabaseService {
  constructor() {
    this.client = null;
    this.supabaseModule = null;
    this.url = '';
    this.key = '';
    this.isInitialized = false;
  }

  // تحميل الإعدادات وتجهيز العميل
  async init() {
    if (this.isInitialized && this.client) return this.client;

    try {
      const [urlSetting, keySetting] = await Promise.all([
        db.get('settings', 'supabaseUrl'),
        db.get('settings', 'supabaseKey')
      ]);

      this.url = urlSetting?.value ? String(urlSetting.value).trim() : '';
      this.key = keySetting?.value ? String(keySetting.value).trim() : '';

      if (this.url && this.key) {
        await this.createClient(this.url, this.key);
      }
      this.isInitialized = true;
      return this.client;
    } catch (err) {
      console.warn('Supabase init warning:', err);
      return null;
    }
  }

  // إنشاء عميل Supabase ديناميكياً
  async createClient(url, key) {
    if (!this.supabaseModule) {
      this.supabaseModule = await import(SUPABASE_CDN_URL);
    }
    const { createClient } = this.supabaseModule;
    this.client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    this.url = url;
    this.key = key;
    return this.client;
  }

  // فحص هل الخدمة مربوطة ومفعلة
  isConfigured() {
    return Boolean(this.url && this.key && this.client);
  }

  // حفظ بيانات الربط في جدول الإعدادات
  async saveConfig(url, key) {
    const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
    const cleanKey = String(key || '').trim();

    await Promise.all([
      db.add('settings', { key: 'supabaseUrl', value: cleanUrl }, false),
      db.add('settings', { key: 'supabaseKey', value: cleanKey }, false)
    ]);

    this.url = cleanUrl;
    this.key = cleanKey;

    if (cleanUrl && cleanKey) {
      await this.createClient(cleanUrl, cleanKey);
    } else {
      this.client = null;
    }
  }

  // اختبار الاتصال بقاعدة بيانات Supabase
  async testConnection() {
    if (!this.client) {
      await this.init();
    }
    if (!this.client) {
      throw new Error('يرجى إدخال رابط المشروع ومفتاح الوصول (Anon Key) أولاً');
    }

    try {
      // تجربة فحص جدول settings أو customers
      const { data, error } = await this.client
        .from('settings')
        .select('key')
        .limit(1);

      if (error) {
        // في حال لم يكن جدول settings موجوداً بعد، نوضح للمستخدم تشغيل السكريبت
        if (error.code === '42P01') {
          throw new Error('تم الاتصال بسوبابيز بنجاح ولكن الجداول غير موجودة بعد! يرجى تشغيل سكريبت supabase_schema.sql في SQL Editor.');
        }
        throw new Error(error.message || 'فشل الاتصال بقاعدة البيانات');
      }

      return { success: true, message: 'الاتصال بقاعدة بيانات Supabase سليم 100% ✅' };
    } catch (err) {
      throw err;
    }
  }

  // تنظيف وتجهيز السجل ليناسب أعمدة PostgreSQL
  sanitizeRecordForTable(table, record) {
    const copy = { ...record };

    // جدول الإعدادات له بنية خاصة key, value
    if (table === 'settings') {
      return {
        key: copy.key,
        value: typeof copy.value === 'object' ? copy.value : { val: copy.value },
        updatedAt: copy.updatedAt || new Date().toISOString()
      };
    }

    // التأكد من أن حقول المصفوفات والكائنات تتحول إلى JSON صالح
    for (const [k, v] of Object.entries(copy)) {
      if (v === undefined) {
        delete copy[k];
      }
    }

    return copy;
  }

  // مزامنة سجل واحد تلقائياً عند إضافته أو تعديله محلياً
  async syncRecord(storeName, record) {
    if (!this.isConfigured()) return;
    const tableName = STORE_TO_SUPABASE_TABLE[storeName];
    if (!tableName) return;

    try {
      const sanitized = this.sanitizeRecordForTable(tableName, record);
      const { error } = await this.client
        .from(tableName)
        .upsert(sanitized);

      if (error) {
        console.warn(`Supabase syncRecord failed for ${tableName}:`, error);
      } else {
        console.log(`☁️ تم حفظ السجل ${record.id || record.key} في Supabase بنجاح`);
      }
    } catch (err) {
      console.warn('Supabase syncRecord error:', err);
    }
  }

  // حذف سجل من Supabase
  async deleteRecord(storeName, key) {
    if (!this.isConfigured()) return;
    const tableName = STORE_TO_SUPABASE_TABLE[storeName];
    if (!tableName) return;

    try {
      const idCol = tableName === 'settings' ? 'key' : 'id';
      await this.client.from(tableName).delete().eq(idCol, key);
    } catch (err) {
      console.warn('Supabase deleteRecord error:', err);
    }
  }

  // رفع وحفظ كافة بيانات المركز من IndexedDB إلى Supabase سحابياً (Backup & Migration)
  async uploadAllToSupabase(onProgress = null) {
    await this.init();
    if (!this.client) {
      throw new Error('يرجى ضبط رابط ومفتاح Supabase أولاً');
    }

    const stores = Object.keys(STORE_TO_SUPABASE_TABLE);
    const summary = {};
    let totalRecords = 0;

    for (let i = 0; i < stores.length; i++) {
      const storeName = stores[i];
      const tableName = STORE_TO_SUPABASE_TABLE[storeName];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: stores.length,
          storeName,
          tableName,
          message: `جاري رفع جدول ${storeName} إلى Supabase...`
        });
      }

      try {
        const records = await db.getAll(storeName);
        if (records && records.length > 0) {
          const sanitizedRecords = records.map(r => this.sanitizeRecordForTable(tableName, r));

          // الرفع على دفعات بحجم 50 لتفادي حد الحجم
          const chunkSize = 50;
          for (let c = 0; c < sanitizedRecords.length; c += chunkSize) {
            const chunk = sanitizedRecords.slice(c, c + chunkSize);
            const { error } = await this.client
              .from(tableName)
              .upsert(chunk);

            if (error) {
              throw new Error(`خطأ أثناء رفع جدول ${tableName}: ${error.message}`);
            }
          }

          summary[storeName] = records.length;
          totalRecords += records.length;
        } else {
          summary[storeName] = 0;
        }
      } catch (err) {
        console.error(`Error uploading store ${storeName}:`, err);
        throw err;
      }
    }

    return { totalRecords, summary };
  }

  // استيراد وتنزيل البيانات كاملة من Supabase إلى IndexedDB (في حالة فتح النظام على جهاز جديد)
  async downloadAllFromSupabase(onProgress = null) {
    await this.init();
    if (!this.client) {
      throw new Error('يرجى ضبط رابط ومفتاح Supabase أولاً');
    }

    const stores = Object.keys(STORE_TO_SUPABASE_TABLE);
    const summary = {};
    let totalRecords = 0;

    for (let i = 0; i < stores.length; i++) {
      const storeName = stores[i];
      const tableName = STORE_TO_SUPABASE_TABLE[storeName];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: stores.length,
          storeName,
          tableName,
          message: `جاري تنزيل بيانات ${tableName} من سوبابيز...`
        });
      }

      try {
        const { data, error } = await this.client
          .from(tableName)
          .select('*');

        if (error) {
          throw new Error(`خطأ أثناء جلب جدول ${tableName}: ${error.message}`);
        }

        if (data && data.length > 0) {
          for (const item of data) {
            // حفظ في IndexedDB بدون إرسال إلى طابور المزامنة لمنع التكرار
            await db.add(storeName, item, false);
          }
          summary[storeName] = data.length;
          totalRecords += data.length;
        } else {
          summary[storeName] = 0;
        }
      } catch (err) {
        console.error(`Error downloading store ${storeName}:`, err);
        throw err;
      }
    }

    return { totalRecords, summary };
  }
}

export const supabaseService = new SupabaseService();
