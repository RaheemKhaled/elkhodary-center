/**
 * نظام إدارة مركز صيانة سيارات
 * توثيق ومخطط البيانات الشامل (Schema Definitions)
 * متطابق مع جداول Google Sheets والتخزين المحلي في IndexedDB
 */

export const DB_NAME = 'AlMarkazAutoDB';
export const DB_VERSION = 3;

export const SCHEMA_DOCS = {
  // 1. العملاء (Customers)
  customers: {
    sheetName: 'Customers',
    primaryKey: 'id', // كود العميل CUST-xxxx
    indexes: ['phone', 'name', 'createdAt'],
    fields: [
      { name: 'id', label: 'كود العميل', type: 'string', pk: true },
      { name: 'name', label: 'اسم العميل', type: 'string', required: true },
      { name: 'phone', label: 'رقم التليفون', type: 'string', required: true, format: '01xxxxxxxxx' },
      { name: 'notes', label: 'ملاحظات', type: 'string' },
      { name: 'createdAt', label: 'تاريخ التسجيل', type: 'datetime' },
      { name: 'updatedAt', label: 'آخر تحديث', type: 'datetime' },
      // حقول محسوبة: visitsCount, invoicesCount, totalSpent
    ]
  },

  // 2. السيارات (Cars)
  cars: {
    sheetName: 'Cars',
    primaryKey: 'id', // كود السيارة CAR-xxxx
    indexes: ['customerId', 'plateLetters', 'plateNumbers', 'plateFull'],
    fields: [
      { name: 'id', label: 'كود السيارة', type: 'string', pk: true },
      { name: 'customerId', label: 'كود العميل', type: 'string', fk: 'customers.id', required: true },
      { name: 'carType', label: 'نوع السيارة', type: 'string' }, // سيدان، SUV، نقل، فان
      { name: 'brand', label: 'الماركة', type: 'string', required: true }, // هيونداي، تويوتا، كيا، شيفروليه...
      { name: 'model', label: 'الموديل / سنة الصنع', type: 'string' }, // 2018، 2022...
      { name: 'plateLetters', label: 'حروف اللوحة', type: 'string', required: true }, // 3 حروف عربية مثلاً "س ن د"
      { name: 'plateNumbers', label: 'أرقام اللوحة', type: 'string', required: true }, // 4 أرقام مثلاً "1234"
      { name: 'plateFull', label: 'رقم العربية الكامل', type: 'string' }, // "س ن د 1234"
      { name: 'color', label: 'اللون', type: 'string' },
      { name: 'chassisNumber', label: 'رقم الشاسيه (اختياري)', type: 'string' },
      { name: 'createdAt', label: 'تاريخ الإضافة', type: 'datetime' }
    ]
  },

  // 3. عمليات الصيانة والفواتير (Maintenance)
  maintenance: {
    sheetName: 'Maintenance',
    primaryKey: 'id', // كود الصيانة / الفاتورة INV-xxxx
    indexes: ['customerId', 'carId', 'createdAt', 'paymentStatus'],
    fields: [
      { name: 'id', label: 'كود الفاتورة', type: 'string', pk: true },
      { name: 'customerId', label: 'كود العميل', type: 'string', fk: 'customers.id', required: true },
      { name: 'customerName', label: 'اسم العميل', type: 'string' },
      { name: 'customerPhone', label: 'رقم التليفون', type: 'string' },
      { name: 'carId', label: 'كود السيارة', type: 'string', fk: 'cars.id', required: true },
      { name: 'carInfo', label: 'بيانات السيارة', type: 'string' },
      { name: 'plateFull', label: 'نمرة العربية', type: 'string' },
      { name: 'date', label: 'التاريخ والوقت', type: 'datetime' },
      { name: 'problem', label: 'المشكلة والشكوى', type: 'string' },
      { name: 'diagnosis', label: 'تشخيص المشكلة', type: 'string' },
      { name: 'futureNeeds', label: 'احتياجات مستقبلية', type: 'string' },
      { name: 'followUp', label: 'متابعة الصيانة', type: 'string' },
      { name: 'workers', label: 'العمالة المشاركة', type: 'array' }, // أسماء أو أكواد العمال
      
      // تفاصيل الحسابات المالية
      { name: 'servicesTotal', label: 'إجمالي الخدمات', type: 'number' },
      { name: 'partsTotal', label: 'إجمالي قطع الغيار', type: 'number' },
      { name: 'subTotal', label: 'المجموع قبل الخصم', type: 'number' },
      { name: 'discountType', label: 'نوع الخصم', type: 'string' }, // 'fixed' | 'percentage' | 'none'
      { name: 'discountValue', label: 'قيمة الخصم', type: 'number' },
      { name: 'discountAmount', label: 'مبلغ الخصم المحسوب', type: 'number' },
      { name: 'netTotal', label: 'الإجمالي النهائي', type: 'number' },
      
      // طرق الدفع
      { name: 'cashAmount', label: 'مدفوع نقدي', type: 'number' },
      { name: 'vodafoneCashAmount', label: 'مدفوع فودافون كاش', type: 'number' },
      { name: 'instaPayAmount', label: 'مدفوع إنستا باي', type: 'number' },
      { name: 'totalPaid', label: 'إجمالي المدفوع', type: 'number' },
      { name: 'remainingBalance', label: 'المتبقي', type: 'number' },
      { name: 'paymentStatus', label: 'حالة الدفع', type: 'string' }, // 'paid' | 'partial' | 'unpaid'
      
      // قائمة الخدمات والقطع
      { name: 'services', label: 'الخدمات المنفذة', type: 'json' },
      { name: 'parts', label: 'قطع الغيار المباعة/المستخدمة', type: 'json' },
      { name: 'createdAt', label: 'تاريخ الإنشاء', type: 'datetime' }
    ]
  },

  // 4. الخدمات والإعدادات (Services)
  services: {
    sheetName: 'Services',
    primaryKey: 'id', // كود الخدمة SRV-xxxx
    indexes: ['isActive', 'name'],
    fields: [
      { name: 'id', label: 'كود الخدمة', type: 'string', pk: true },
      { name: 'name', label: 'اسم الخدمة', type: 'string', required: true },
      { name: 'defaultPrice', label: 'السعر الافتراضي', type: 'number', required: true },
      { name: 'hasAddons', label: 'هل لها إضافات؟', type: 'boolean' },
      { name: 'availableAddons', label: 'قائمة الإضافات المتاحة', type: 'array' }, // [{ id, name, defaultPrice }]
      { name: 'isActive', label: 'نشطة؟', type: 'boolean' },
      { name: 'isCustom', label: 'خدمة مخصصة (مخرطة وغيرها)', type: 'boolean' }
    ]
  },

  // 5. الفنيين والعمالة (Workers)
  workers: {
    sheetName: 'Workers',
    primaryKey: 'id', // WRK-xxxx
    indexes: ['isActive', 'name'],
    fields: [
      { name: 'id', label: 'كود العامل', type: 'string', pk: true },
      { name: 'name', label: 'اسم الفني / العامل', type: 'string', required: true },
      { name: 'phone', label: 'رقم التليفون', type: 'string' },
      { name: 'specialty', label: 'التخصص', type: 'string' }, // زوايا، عفشة، كاوتش، مخرطة
      { name: 'weeklySalary', label: 'المرتب الأسبوعي', type: 'number', default: 0 },
      { name: 'isActive', label: 'نشط في العمل؟', type: 'boolean' },
      { name: 'createdAt', label: 'تاريخ التسجيل', type: 'datetime' }
    ]
  },

  // 5b. حضور وانصراف العمالة يومياً (WorkerAttendance)
  workerAttendance: {
    sheetName: 'Worker_Attendance',
    primaryKey: 'id', // ATT-xxxx
    indexes: ['workerId', 'date'],
    fields: [
      { name: 'id', label: 'كود سجل الحضور', type: 'string', pk: true },
      { name: 'workerId', label: 'كود العامل', type: 'string', fk: 'workers.id', required: true },
      { name: 'workerName', label: 'اسم العامل', type: 'string' },
      { name: 'date', label: 'التاريخ (YYYY-MM-DD)', type: 'string', required: true },
      { name: 'status', label: 'حالة اليوم', type: 'string' }, // 'present' | 'absent' | 'late'
      { name: 'clockIn', label: 'وقت الحضور', type: 'string' }, // HH:MM
      { name: 'clockOut', label: 'وقت الانصراف', type: 'string' }, // HH:MM
      { name: 'notes', label: 'ملاحظات', type: 'string' },
      { name: 'createdAt', label: 'تاريخ التسجيل', type: 'datetime' }
    ]
  },

  // 5c. مصروفات يومية للعمالة (WorkerExpenses)
  workerExpenses: {
    sheetName: 'Worker_Expenses',
    primaryKey: 'id', // WEXP-xxxx
    indexes: ['workerId', 'date'],
    fields: [
      { name: 'id', label: 'كود المصروف', type: 'string', pk: true },
      { name: 'workerId', label: 'كود العامل', type: 'string', fk: 'workers.id', required: true },
      { name: 'workerName', label: 'اسم العامل', type: 'string' },
      { name: 'date', label: 'التاريخ (YYYY-MM-DD)', type: 'string', required: true },
      { name: 'amount', label: 'المبلغ', type: 'number', required: true },
      { name: 'reason', label: 'سبب الصرف', type: 'string' }, // 'مصروف يومي', 'سلفة', 'مكافأة'
      { name: 'notes', label: 'ملاحظات', type: 'string' },
      { name: 'createdAt', label: 'تاريخ التسجيل', type: 'datetime' }
    ]
  },

  // 6. قطع الغيار والمخزن (Parts)
  parts: {
    sheetName: 'Parts',
    primaryKey: 'id', // PART-xxxx
    indexes: ['name', 'category', 'supplierId'],
    fields: [
      { name: 'id', label: 'كود القطعة', type: 'string', pk: true },
      { name: 'name', label: 'اسم قطعة الغيار', type: 'string', required: true },
      { name: 'category', label: 'نوع القطعة / التصنيف', type: 'string' }, // عفشة، فرامل، كاوتش، زيوت...
      { name: 'supplierId', label: 'كود المورد المعتاد', type: 'string', fk: 'suppliers.id' },
      { name: 'costPrice', label: 'سعر الشراء (التكلفة)', type: 'number' },
      { name: 'sellPrice', label: 'سعر البيع الافتراضي', type: 'number', required: true },
      { name: 'minStockLevel', label: 'الحد الأدنى للتنبيه', type: 'number', default: 3 },
      { name: 'initialStock', label: 'الرصيد الافتتاحي', type: 'number', default: 0 },
      // الرصيد الحالي يحسب ديناميكياً = الرصيد الافتتاحي + إجمالي المشتريات - إجمالي المبيعات
      { name: 'createdAt', label: 'تاريخ الإضافة', type: 'datetime' }
    ]
  },

  // 7. المبيعات (Sales)
  sales: {
    sheetName: 'Sales',
    primaryKey: 'id', // SALE-xxxx
    indexes: ['partId', 'customerId', 'invoiceId', 'createdAt'],
    fields: [
      { name: 'id', label: 'كود حركة البيع', type: 'string', pk: true },
      { name: 'customerId', label: 'كود العميل', type: 'string', fk: 'customers.id' },
      { name: 'partId', label: 'كود القطعة', type: 'string', fk: 'parts.id', required: true },
      { name: 'partName', label: 'اسم القطعة', type: 'string' },
      { name: 'quantity', label: 'الكمية المباعة', type: 'number', required: true },
      { name: 'unitPrice', label: 'سعر بيع الوحدة', type: 'number', required: true },
      { name: 'totalPrice', label: 'إجمالي السعر', type: 'number', required: true },
      { name: 'invoiceId', label: 'كود الصيانة (لو مباعة في صيانة)', type: 'string', fk: 'maintenance.id' },
      { name: 'saleType', label: 'نوع البيع', type: 'string' }, // 'in_maintenance' | 'direct_sale'
      { name: 'date', label: 'التاريخ', type: 'datetime' }
    ]
  },

  // 8. الموردين (Suppliers)
  suppliers: {
    sheetName: 'Suppliers',
    primaryKey: 'id', // SUPP-xxxx
    indexes: ['name', 'phone'],
    fields: [
      { name: 'id', label: 'كود المورد', type: 'string', pk: true },
      { name: 'name', label: 'اسم المورد / الشركة', type: 'string', required: true },
      { name: 'phone', label: 'رقم التليفون', type: 'string' },
      { name: 'specialty', label: 'تخصص المورد', type: 'string' },
      { name: 'address', label: 'العنوان', type: 'string' },
      { name: 'notes', label: 'ملاحظات', type: 'string' },
      { name: 'createdAt', label: 'تاريخ التسجيل', type: 'datetime' }
      // الحسابات: totalPurchases, invoicesCount, totalRemaining
    ]
  },

  // 9. فواتير التوريد (Supplier_Invoices)
  supplierInvoices: {
    sheetName: 'Supplier_Invoices',
    primaryKey: 'id', // SUPPINV-xxxx
    indexes: ['supplierId', 'invoiceDate', 'dueDate', 'status'],
    fields: [
      { name: 'id', label: 'كود عملية التوريد', type: 'string', pk: true },
      { name: 'invoiceNumber', label: 'رقم فاتورة المورد الورقية', type: 'string' },
      { name: 'supplierId', label: 'كود المورد', type: 'string', fk: 'suppliers.id', required: true },
      { name: 'supplierName', label: 'اسم المورد', type: 'string' },
      { name: 'invoiceDate', label: 'تاريخ الفاتورة', type: 'date' },
      { name: 'dueDate', label: 'ميعاد استحقاق السداد', type: 'date' },
      { name: 'totalAmount', label: 'مبلغ الفاتورة الإجمالي', type: 'number', required: true },
      { name: 'paidAmount', label: 'المبلغ المدفوع حتى الآن', type: 'number', default: 0 },
      { name: 'remainingAmount', label: 'المتبقي من الفاتورة', type: 'number' },
      { name: 'status', label: 'حالة السداد', type: 'string' }, // 'paid' | 'partial' | 'unpaid'
      { name: 'notes', label: 'ملاحظات وتفاصيل', type: 'string' },
      { name: 'createdAt', label: 'تاريخ التسجيل', type: 'datetime' }
    ]
  },

  // 10. المشتريات (Purchases)
  purchases: {
    sheetName: 'Purchases',
    primaryKey: 'id', // composite PK: SUPPINV-xxxx + PART-xxxx
    indexes: ['supplierInvoiceId', 'partId', 'createdAt'],
    fields: [
      { name: 'id', label: 'كود الشراء', type: 'string', pk: true }, // [supplierInvoiceId]_[partId]
      { name: 'supplierInvoiceId', label: 'كود عملية التوريد', type: 'string', fk: 'supplierInvoices.id', required: true },
      { name: 'invoiceNumber', label: 'كود الفاتورة', type: 'string' },
      { name: 'partId', label: 'كود قطعة الغيار', type: 'string', fk: 'parts.id', required: true },
      { name: 'partName', label: 'اسم قطعة الغيار', type: 'string' },
      { name: 'unitCost', label: 'سعر شراء القطعة', type: 'number', required: true },
      { name: 'quantity', label: 'عدد القطع', type: 'number', required: true },
      { name: 'totalCost', label: 'الإجمالي', type: 'number' },
      { name: 'createdAt', label: 'تاريخ الشراء', type: 'datetime' }
    ]
  },

  // 11. مدفوعات الموردين (Supplier_Payments)
  supplierPayments: {
    sheetName: 'Supplier_Payments',
    primaryKey: 'id', // PAY-xxxx
    indexes: ['supplierId', 'supplierInvoiceId', 'date'],
    fields: [
      { name: 'id', label: 'كود الدفعة', type: 'string', pk: true },
      { name: 'supplierId', label: 'كود المورد', type: 'string', fk: 'suppliers.id', required: true },
      { name: 'supplierInvoiceId', label: 'كود الفاتورة المورد', type: 'string', fk: 'supplierInvoices.id' },
      { name: 'amount', label: 'مبلغ الدفعة', type: 'number', required: true },
      { name: 'paymentMethod', label: 'طريقة الدفع', type: 'string' }, // 'cash' | 'vodafone' | 'instapay' | 'bank'
      { name: 'notes', label: 'ملاحظات', type: 'string' },
      { name: 'date', label: 'تاريخ السداد', type: 'datetime' }
    ]
  },

  // 12. طابور المزامنة (SyncQueue) - محلي فقط
  syncQueue: {
    sheetName: '_SyncQueue',
    primaryKey: 'id',
    indexes: ['status', 'createdAt', 'entityType'],
    fields: [
      { name: 'id', label: 'معرف العملية', type: 'string', pk: true },
      { name: 'entityType', label: 'النوع', type: 'string' }, // 'customers', 'maintenance', 'parts', etc.
      { name: 'action', label: 'نوع العملية', type: 'string' }, // 'insert' | 'update' | 'delete'
      { name: 'payload', label: 'البيانات', type: 'json' },
      { name: 'status', label: 'الحالة', type: 'string' }, // 'pending' | 'syncing' | 'failed'
      { name: 'retries', label: 'محاولات', type: 'number' },
      { name: 'error', label: 'رسالة الخطأ', type: 'string' },
      { name: 'createdAt', label: 'تاريخ العملية', type: 'datetime' }
    ]
  },

  // 13. إعدادات النظام (Settings)
  settings: {
    sheetName: 'Settings',
    primaryKey: 'key',
    fields: [
      { name: 'key', label: 'المفتاح', type: 'string', pk: true },
      { name: 'value', label: 'القيمة', type: 'any' }
    ]
  },

  // 14. المستخدمين وصلاحيات الدخول (Users & Permissions)
  users: {
    sheetName: 'Users',
    primaryKey: 'id',
    indexes: ['username', 'role', 'isActive'],
    fields: [
      { name: 'id', label: 'كود المستخدم', type: 'string', pk: true },
      { name: 'name', label: 'اسم الموظف', type: 'string', required: true },
      { name: 'username', label: 'اسم المستخدم', type: 'string', required: true, unique: true },
      { name: 'password', label: 'كلمة المرور', type: 'string', required: true },
      { name: 'role', label: 'الدور', type: 'string', required: true }, // 'manager' | 'cashier'
      { name: 'permissions', label: 'الصلاحيات المخصصة', type: 'array' }, // ['all'] أو ['cashier']
      { name: 'isActive', label: 'الحساب نشط', type: 'boolean', default: true },
      { name: 'createdAt', label: 'تاريخ الإنشاء', type: 'datetime' }
    ]
  }
};
