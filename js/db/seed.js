/**
 * نظام إدارة مركز صيانة سيارات
 * بيانات تجريبية واقعية وشاملة (Seed Data)
 */

import { db } from './indexeddb.js';

export const INITIAL_SERVICES = [
  {
    id: 'SRV-01',
    name: 'زوايا أمامي',
    defaultPrice: 100,
    hasAddons: true,
    availableAddons: [
      { id: 'ADD-01', name: 'برستا', defaultPrice: 50 },
      { id: 'ADD-02', name: 'شغل مساعد', defaultPrice: 60 },
      { id: 'ADD-03', name: 'شغل مقص', defaultPrice: 70 },
      { id: 'ADD-04', name: 'شغل زرجينة', defaultPrice: 120 }
    ],
    isActive: true,
    isCustom: false
  },
  {
    id: 'SRV-02',
    name: 'زوايا خلفي',
    defaultPrice: 80,
    hasAddons: false,
    availableAddons: [],
    isActive: true,
    isCustom: false
  },
  {
    id: 'SRV-03',
    name: 'عفشة كاملة',
    defaultPrice: 250,
    hasAddons: false,
    availableAddons: [],
    isActive: true,
    isCustom: false
  },
  {
    id: 'SRV-04',
    name: 'ترصيص عادي (للجنط)',
    defaultPrice: 30,
    hasAddons: false,
    availableAddons: [],
    isActive: true,
    isCustom: false
  },
  {
    id: 'SRV-05',
    name: 'ترصيص لزق (جنط سبور)',
    defaultPrice: 40,
    hasAddons: false,
    availableAddons: [],
    isActive: true,
    isCustom: false
  },
  {
    id: 'SRV-06',
    name: 'لحام كاوتش (تيوبلس/داخلي)',
    defaultPrice: 45,
    hasAddons: false,
    availableAddons: [],
    isActive: true,
    isCustom: false
  },
  {
    id: 'SRV-07',
    name: 'بيع قطع غيار',
    defaultPrice: 0,
    hasAddons: false,
    availableAddons: [],
    isActive: true,
    isCustom: false
  },
  {
    id: 'SRV-08',
    name: 'شغل مخرطة وتعديل',
    defaultPrice: 150,
    hasAddons: false,
    availableAddons: [],
    isActive: true,
    isCustom: true
  }
];

export const INITIAL_WORKERS = [
  { id: 'WRK-01', name: 'الأسطى حسن زوايا', phone: '01012345671', specialty: 'ضبط زوايا وزرجينة', isActive: true },
  { id: 'WRK-02', name: 'الفني أحمد عفشة', phone: '01123456782', specialty: 'عفشة ومساعدين', isActive: true },
  { id: 'WRK-03', name: 'الفني محمود كاوتش', phone: '01234567893', specialty: 'ترصيص ولحام كاوتش', isActive: true },
  { id: 'WRK-04', name: 'الأسطى إبراهيم مخرطة', phone: '01545678904', specialty: 'خراطة طنابير وتعديل', isActive: true }
];

export const INITIAL_SUPPLIERS = [
  {
    id: 'SUPP-01',
    name: 'أولاد حسني لقطع الغيار',
    phone: '01099887766',
    specialty: 'قطع غيار عفشة وتيل فرامل',
    address: 'شارع التوفيقية - وسط البلد - القاهرة',
    notes: 'مورد موثوق - توريد أسبوعي'
  },
  {
    id: 'SUPP-02',
    name: 'الأهرام لمهمات الكاوتش والترصيص',
    phone: '01155443322',
    specialty: 'أوزان ترصيص ورقع كاوتش وبلف',
    address: 'شارع جسر السويس - القاهرة',
    notes: 'أسعار جملة متميزة'
  },
  {
    id: 'SUPP-03',
    name: 'الشركة الهندسية للمساعدين',
    phone: '01222334455',
    specialty: 'مساعدين وبطاحات وسوست',
    address: 'الحرفيين - القاهرة',
    notes: 'ضمان سنة على المساعدين'
  }
];

export const INITIAL_PARTS = [
  {
    id: 'PART-01',
    name: 'تيل فرامل أمامي كوري (هيونداي/كيا)',
    category: 'فرامل',
    supplierId: 'SUPP-01',
    costPrice: 280,
    sellPrice: 420,
    minStockLevel: 4,
    initialStock: 10
  },
  {
    id: 'PART-02',
    name: 'بارة دركسيون ياباني (تويوتا كورولا)',
    category: 'عفشة',
    supplierId: 'SUPP-01',
    costPrice: 220,
    sellPrice: 350,
    minStockLevel: 3,
    initialStock: 6
  },
  {
    id: 'PART-03',
    name: 'مساعد أمامي يمين KYB أصلي',
    category: 'عفشة',
    supplierId: 'SUPP-03',
    costPrice: 850,
    sellPrice: 1150,
    minStockLevel: 2,
    initialStock: 4
  },
  {
    id: 'PART-04',
    name: 'رقعة كاوتش تيوبلس ألماني (علبة 50 حبة)',
    category: 'كاوتش',
    supplierId: 'SUPP-02',
    costPrice: 120,
    sellPrice: 180,
    minStockLevel: 5,
    initialStock: 12
  },
  {
    id: 'PART-05',
    name: 'شريط رصاص ترصيص لزق (وزن 60 جرام)',
    category: 'ترصيص',
    supplierId: 'SUPP-02',
    costPrice: 8,
    sellPrice: 15,
    minStockLevel: 20,
    initialStock: 45
  },
  {
    id: 'PART-06',
    name: 'مسمار ضبط زوايا كامبر مقوى',
    category: 'زوايا',
    supplierId: 'SUPP-01',
    costPrice: 40,
    sellPrice: 75,
    minStockLevel: 6,
    initialStock: 2 // قليل في المخزن لتجربة التنبيه
  },
  {
    id: 'PART-07',
    name: 'بلية عجل أمامي أصلية',
    category: 'عفشة',
    supplierId: 'SUPP-01',
    costPrice: 310,
    sellPrice: 450,
    minStockLevel: 3,
    initialStock: 1 // قطعة واحدة لتجربة التنبيه الفوري
  }
];

export const INITIAL_CUSTOMERS = [
  {
    id: 'CUST-01',
    name: 'محمد عبد الرحمن محمود',
    phone: '01019876543',
    notes: 'عميل دائم - يفضل ضبط الزوايا بالكمبيوتر',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    id: 'CUST-02',
    name: 'المهندس طارق السعيد',
    phone: '01123456789',
    notes: 'متابع دوري للصيانة والعفشة',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
  },
  {
    id: 'CUST-03',
    name: 'الحاج إبراهيم الدسوقي',
    phone: '01298765432',
    notes: 'سيارة تجارية للعمل اليومي',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
  }
];

export const INITIAL_CARS = [
  {
    id: 'CAR-01',
    customerId: 'CUST-01',
    carType: 'سيدان',
    brand: 'هيونداي',
    model: 'النترا 2021',
    plateLetters: 'س ن د',
    plateNumbers: '1234',
    plateFull: 'س ن د 1234',
    color: 'فضي',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    id: 'CAR-02',
    customerId: 'CUST-02',
    carType: 'سيدان',
    brand: 'تويوتا',
    model: 'كورولا 2022',
    plateLetters: 'ق هـ ر',
    plateNumbers: '5678',
    plateFull: 'ق هـ ر 5678',
    color: 'أبيض لؤلؤي',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
  },
  {
    id: 'CAR-03',
    customerId: 'CUST-03',
    carType: 'SUV',
    brand: 'كيا',
    model: 'سبورتاج 2020',
    plateLetters: 'م ص ر',
    plateNumbers: '9012',
    plateFull: 'م ص ر 9012',
    color: 'أسود',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
  }
];

export const INITIAL_MAINTENANCE = [
  {
    id: 'INV-1001',
    customerId: 'CUST-01',
    customerName: 'محمد عبد الرحمن محمود',
    customerPhone: '01019876543',
    carId: 'CAR-01',
    carInfo: 'هيونداي النترا 2021',
    plateFull: 'س ن د 1234',
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
    problem: 'حدفة يمين على السرعات العالية ورعشة في الطارة فوق 100 كم',
    diagnosis: 'اختلاف زوايا الكامبر الأمامي مع تآكل بسيط في بلف العجل',
    futureNeeds: 'تغيير جلد مقصات في الصيانة القادمة بعد شهرين',
    followUp: 'تم تجربة العربية على الطريق وضبط الزوايا بدقة',
    workers: ['الأسطى حسن زوايا', 'الفني محمود كاوتش'],
    services: [
      { id: 'SRV-01', name: 'زوايا أمامي', price: 100, addons: [{ id: 'ADD-01', name: 'برستا', price: 50 }] },
      { id: 'SRV-04', name: 'ترصيص عادي (للجنط)', price: 60, quantity: 2 }
    ],
    parts: [
      { id: 'PART-05', name: 'شريط رصاص ترصيص لزق (وزن 60 جرام)', quantity: 2, unitPrice: 15, totalPrice: 30 }
    ],
    servicesTotal: 210,
    partsTotal: 30,
    subTotal: 240,
    discountType: 'fixed',
    discountValue: 20,
    discountAmount: 20,
    netTotal: 220,
    cashAmount: 120,
    vodafoneCashAmount: 100,
    instaPayAmount: 0,
    totalPaid: 220,
    remainingBalance: 0,
    paymentStatus: 'paid',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
  }
];

export const INITIAL_SUPPLIER_INVOICES = [
  {
    id: 'SUPPINV-2001',
    invoiceNumber: 'INV-9821',
    supplierId: 'SUPP-01',
    supplierName: 'أولاد حسني لقطع الغيار',
    invoiceDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    totalAmount: 5200,
    paidAmount: 3000,
    remainingAmount: 2200,
    status: 'partial',
    notes: 'فاتورة تيل فرامل ومساعدين، تم سداد 3000 نقدي والمتبقي خلال أسبوع',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  }
];

export const INITIAL_PURCHASES = [
  {
    id: 'SUPPINV-2001_PART-01',
    supplierInvoiceId: 'SUPPINV-2001',
    invoiceNumber: 'INV-9821',
    partId: 'PART-01',
    partName: 'تيل فرامل أمامي كوري (هيونداي/كيا)',
    unitCost: 280,
    quantity: 10,
    totalCost: 2800,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    id: 'SUPPINV-2001_PART-02',
    supplierInvoiceId: 'SUPPINV-2001',
    invoiceNumber: 'INV-9821',
    partId: 'PART-02',
    partName: 'بارة دركسيون ياباني (تويوتا كورولا)',
    unitCost: 220,
    quantity: 6,
    totalCost: 1320,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  }
];

export const INITIAL_USERS = [
  {
    id: 'USR-ADMIN',
    name: 'المدير العام',
    username: 'admin',
    password: 'admin',
    role: 'manager',
    permissions: ['all'],
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'USR-CASHIER',
    name: 'كاشير المركز',
    username: 'cashier',
    password: '1234',
    role: 'cashier',
    permissions: ['cashier'],
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

/**
 * دالة تحميل البيانات التجريبية الأولية
 */
export async function seedDatabaseIfEmpty() {
  await db.init();

  // فحص وتلقيم المستخدمين الافتراضيين دائماً
  const existingUsers = await db.getAll('users');
  if (!existingUsers || existingUsers.length === 0) {
    for (const u of INITIAL_USERS) {
      await db.add('users', u, false);
    }
  }

  const existingServices = await db.getAll('services');

  if (existingServices.length === 0) {
    console.log('🔄 جاري حقن البيانات التجريبية الأولية للنظام...');

    // 1. الخدمات
    for (const item of INITIAL_SERVICES) {
      await db.add('services', item, false);
    }
    // 2. الفنيين
    for (const item of INITIAL_WORKERS) {
      await db.add('workers', item, false);
    }
    // 3. الموردين
    for (const item of INITIAL_SUPPLIERS) {
      await db.add('suppliers', item, false);
    }
    // 4. قطع الغيار
    for (const item of INITIAL_PARTS) {
      await db.add('parts', item, false);
    }
    // 5. العملاء
    for (const item of INITIAL_CUSTOMERS) {
      await db.add('customers', item, false);
    }
    // 6. السيارات
    for (const item of INITIAL_CARS) {
      await db.add('cars', item, false);
    }
    // 7. الفواتير التجريبية
    for (const item of INITIAL_MAINTENANCE) {
      await db.add('maintenance', item, false);
    }
    // 8. فواتير التوريد والمشتريات
    for (const item of INITIAL_SUPPLIER_INVOICES) {
      await db.add('supplierInvoices', item, false);
    }
    for (const item of INITIAL_PURCHASES) {
      await db.add('purchases', item, false);
    }

    // 9. إعدادات افتراضية
    await db.put('settings', { key: 'centerName', value: 'مركز الأسطى لصيانة السيارات وضبط الزوايا' }, false);
    await db.put('settings', { key: 'centerPhone', value: '01000000000' }, false);
    await db.put('settings', { key: 'centerAddress', value: 'القاهرة - مصر' }, false);
    await db.put('settings', { key: 'googleSheetsWebhookUrl', value: '' }, false);
    await db.put('settings', { key: 'thermalReceiptPrinter', value: true }, false);
    await db.put('settings', { key: 'lowStockThreshold', value: 3 }, false);

    console.log('✅ تم تجهيز قاعدة البيانات بالبيانات التجريبية بنجاح.');
  }
}
