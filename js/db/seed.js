/**
 * نظام إدارة مركز صيانة سيارات
 * التجهيز الأولي لقاعدة البيانات: حسابات الدخول والإعدادات الأساسية فقط.
 * البرنامج يبدأ فاضي تماماً (بدون عملاء أو فواتير أو خدمات تجريبية)،
 * والمدير بيدخل الخدمات والفنيين والمخزن بنفسه من الإعدادات.
 */

import { db } from './indexeddb.js';

// أكواد البيانات التجريبية اللي كانت بتتحط في النسخ القديمة (بتتمسح من أي جهاز كانت اتحطت عليه)
// الأكواد الحقيقية دايماً فيها كود الجهاز (مثل SRV-DEV-AB12-...) فمفيش أي تعارض معاها
const LEGACY_DEMO_IDS = {
  services: ['SRV-01', 'SRV-02', 'SRV-03', 'SRV-04', 'SRV-05', 'SRV-06', 'SRV-07', 'SRV-08'],
  workers: ['WRK-01', 'WRK-02', 'WRK-03', 'WRK-04'],
  suppliers: ['SUPP-01', 'SUPP-02', 'SUPP-03'],
  parts: ['PART-01', 'PART-02', 'PART-03', 'PART-04', 'PART-05', 'PART-06', 'PART-07'],
  customers: ['CUST-01', 'CUST-02', 'CUST-03'],
  cars: ['CAR-01', 'CAR-02', 'CAR-03'],
  maintenance: ['INV-1001'],
  supplierInvoices: ['SUPPINV-2001'],
  purchases: ['SUPPINV-2001_PART-01', 'SUPPINV-2001_PART-02']
};
const LEGACY_DEMO_SETTINGS = {
  centerName: 'مركز الأسطى لصيانة السيارات وضبط الزوايا',
  centerPhone: '01000000000',
  centerAddress: 'القاهرة - مصر'
};
const DEMO_CLEANUP_KEY = 'demoDataRemoved_v1';

export const INITIAL_USERS = [
  {
    id: 'USR-RAHEEM',
    name: 'رحيم (المدير)',
    username: 'raheem',
    password: '1212',
    role: 'manager',
    permissions: ['all'],
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'USR-ABDO',
    name: 'عبده (الكاشير)',
    username: 'abdo',
    password: '1232',
    role: 'cashier',
    permissions: ['cashier'],
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

// الحسابات الافتراضية القديمة التي يجب حذفها من أي جهاز مثبت عليه نسخة سابقة
const LEGACY_DEFAULT_USER_IDS = ['USR-ADMIN', 'USR-CASHIER'];
const USERS_MIGRATION_KEY = 'usersMigration_v2';

/**
 * ترحيل الحسابات: حذف حسابات admin/cashier الافتراضية القديمة وإضافة حسابات raheem و abdo
 * يعمل مرة واحدة فقط على كل جهاز
 */
async function migrateDefaultUsers() {
  const done = await db.get('settings', USERS_MIGRATION_KEY);
  if (done && done.value) return;

  for (const legacyId of LEGACY_DEFAULT_USER_IDS) {
    const legacy = await db.get('users', legacyId);
    if (legacy) await db.delete('users', legacyId, false);
  }

  const existing = await db.getAll('users');
  for (const u of INITIAL_USERS) {
    const clash = existing.find(x => (x.username || '').toLowerCase() === u.username && x.id !== u.id);
    if (clash) await db.delete('users', clash.id, false);
    await db.put('users', { ...u }, false);
  }

  await db.put('settings', { key: USERS_MIGRATION_KEY, value: true }, false);
}

/**
 * دالة تحميل البيانات التجريبية الأولية
 */

// الخدمات السريعة اللي في شاشة الكاشير: أسعارها بتتعدل من الإعدادات > قائمة الخدمات
// (بتتحط بتاريخ قديم عشان أي تعديل من أي جهاز يكسبها في المزامنة)
export const QUICK_SERVICES = [
  { id: 'QS-ALIGN-FRONT', name: 'ضبط زوايا أمامي', defaultPrice: 120, quickGroup: 'alignment', quickKey: 'front' },
  { id: 'QS-ALIGN-REAR', name: 'ضبط زوايا خلفي', defaultPrice: 100, quickGroup: 'alignment', quickKey: 'rear' },
  { id: 'QS-ALIGN-FULL', name: 'ضبط زوايا كامل (أمامي وخلفي)', defaultPrice: 200, quickGroup: 'alignment', quickKey: 'full' },
  { id: 'QS-BAL-NORMAL', name: 'ترصيص عادي', defaultPrice: 35, quickGroup: 'balancing', perUnit: true, quickOrder: 1 },
  { id: 'QS-BAL-STICK', name: 'ترصيص لاصق سبور', defaultPrice: 50, quickGroup: 'balancing', perUnit: true, quickOrder: 2 },
  { id: 'QS-BAL-MOTO', name: 'ترصيص موتوسيكل', defaultPrice: 25, quickGroup: 'balancing', perUnit: true, quickOrder: 3 },
  { id: 'QS-TIRE-MOUNT', name: 'تركيب كاوتش', defaultPrice: 25, quickGroup: 'tire', quickKey: 'mount', perUnit: true },
  { id: 'QS-TIRE-PATCH', name: 'لحام كاوتش', defaultPrice: 45, quickGroup: 'tire', quickKey: 'patch', perUnit: true }
];

async function ensureQuickServices() {
  for (const q of QUICK_SERVICES) {
    if (await db.get('services', q.id)) continue;
    await db.putRemote('services', {
      ...q, isActive: true, isCustom: false, hasAddons: false, availableAddons: [],
      createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z'
    });
  }
}

/**
 * مسح البيانات التجريبية القديمة (مرة واحدة على كل جهاز)
 */
async function removeLegacyDemoData() {
  const done = await db.get('settings', DEMO_CLEANUP_KEY);
  if (done && done.value) return;

  const ids = (store) => new Set(LEGACY_DEMO_IDS[store] || []);
  for (const [store, list] of Object.entries(LEGACY_DEMO_IDS)) {
    for (const id of list) {
      if (await db.get(store, id)) await db.delete(store, id, false);
    }
  }

  // سجلات مرتبطة بالبيانات التجريبية
  const demoParts = ids('parts'), demoInvoices = ids('maintenance'), demoCustomers = ids('customers');
  const demoWorkers = ids('workers'), demoSuppliers = ids('suppliers'), demoSupplierInvoices = ids('supplierInvoices');
  const linked = [
    ['sales', (r) => demoParts.has(r.partId) || demoInvoices.has(r.invoiceId) || demoCustomers.has(r.customerId)],
    ['workerAttendance', (r) => demoWorkers.has(r.workerId)],
    ['workerExpenses', (r) => demoWorkers.has(r.workerId)],
    ['supplierPayments', (r) => demoSuppliers.has(r.supplierId) || demoSupplierInvoices.has(r.supplierInvoiceId)]
  ];
  for (const [store, isDemo] of linked) {
    for (const rec of await db.getAll(store)) {
      if (isDemo(rec)) await db.delete(store, rec.id, false);
    }
  }

  // بيانات المركز الوهمية تتمسح عشان المدير يدخل بياناته الحقيقية
  for (const [key, demoValue] of Object.entries(LEGACY_DEMO_SETTINGS)) {
    const current = await db.get('settings', key);
    if (current && current.value === demoValue) await db.put('settings', { key, value: '' }, false);
  }

  await db.put('settings', { key: DEMO_CLEANUP_KEY, value: true }, false);
}

/**
 * تجهيز قاعدة البيانات عند كل تشغيل
 */
export async function seedDatabaseIfEmpty() {
  await db.init();

  // حسابات الدخول (المدير raheem والكاشير abdo)
  await migrateDefaultUsers();

  // حساب المدير الأساسي لازم يفضل موجود ونشط ومدير دايماً
  const primary = await db.get('users', 'USR-RAHEEM');
  if (!primary) {
    await db.put('users', { ...INITIAL_USERS[0] }, false);
  } else if (primary.isActive === false || primary.role !== 'manager') {
    await db.put('users', { ...primary, isActive: true, role: 'manager', permissions: ['all'] }, false);
  }

  // مسح أي بيانات تجريبية من النسخ القديمة
  await removeLegacyDemoData();

  // الخدمات السريعة (زوايا/ترصيص/كاوتش) بأسعار قابلة للتعديل
  await ensureQuickServices();

  // إعدادات أساسية فاضية لو مش موجودة
  const defaults = {
    centerName: '',
    centerPhone: '',
    centerAddress: '',
    thermalReceiptPrinter: true,
    lowStockThreshold: 3
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (!(await db.get('settings', key))) await db.put('settings', { key, value }, false);
  }
}
