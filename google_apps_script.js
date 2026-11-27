/**
 * كود Google Apps Script لربط برنامج "المركز" بقاعدة بيانات Google Sheets
 *
 * الشيت المربوط: قاعدة بيانات مركز الصيانة
 * https://docs.google.com/spreadsheets/d/1yWk_nSVMuj1e2FwvJkKAo-pb1UiTkg5HEdveq12myZc/edit
 *
 * طريقة التركيب (مرة واحدة فقط):
 * 1. افتح الشيت من الرابط اللي فوق.
 * 2. من القائمة: ملحقات (Extensions) > Apps Script.
 * 3. امسح أي كود موجود والصق الكود ده بالكامل، واضغط حفظ 💾.
 * 4. اضغط "نشر" (Deploy) > "نشر جديد" (New deployment).
 * 5. النوع: "تطبيق ويب" (Web app).
 *    - تنفيذ باسم (Execute as): أنا (Me)
 *    - من لديه حق الوصول (Who has access): أي شخص (Anyone)
 * 6. اضغط "نشر" ووافق على الصلاحيات، وانسخ رابط تطبيق الويب (ينتهي بـ /exec).
 * 7. الصق الرابط في البرنامج: الإعدادات > ربط Google Sheets > حفظ.
 *
 * ملاحظة: لو عدّلت الكود بعد كده، اعمل Deploy > Manage deployments > تعديل > Version: New
 * عشان الرابط نفسه يفضل شغال بالكود الجديد.
 */

var API_VERSION = 3; // 2 = المصروفات، 3 = اقتراحات الكتابة
var SPREADSHEET_ID = '1yWk_nSVMuj1e2FwvJkKAo-pb1UiTkg5HEdveq12myZc';

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ====== استقبال العمليات من البرنامج (POST) ======
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet();

    if (data.action === 'sync_batch') {
      var operations = data.operations || [];
      var results = [];
      var logRows = [];
      var logSheet = getSyncLogSheet(ss);
      var serverTs = new Date().toISOString();

      for (var i = 0; i < operations.length; i++) {
        var op = operations[i];
        try {
          var sheetName = getSheetNameForEntity(op.entityType);
          if (!sheetName) {
            // جداول غير مطلوب رفعها (مثل الإعدادات وكلمات المرور) يتم تجاهلها بأمان
            results.push({ id: op.id, success: true, skipped: true });
            continue;
          }
          var sheet = getOrCreateSheet(ss, sheetName);
          var recId = op.recordId || (op.payload && op.payload.id);
          if (op.action === 'delete') {
            deleteRecord(sheet, recId);
            logRows.push([serverTs, op.entityType, String(recId), 'delete', '', data.deviceId || '']);
          } else {
            upsertRecord(sheet, op.entityType, op.payload || {});
            logRows.push([serverTs, op.entityType, String(recId), 'upsert', JSON.stringify(op.payload || {}), data.deviceId || '']);
          }
          results.push({ id: op.id, success: true });
        } catch (opErr) {
          results.push({ id: op.id, success: false, message: String(opErr) });
        }
      }

      appendLogRows(logSheet, logRows);
      return jsonOut({ success: true, processed: results.length, results: results });
    }

    return jsonOut({ success: false, message: 'إجراء غير معروف' });
  } catch (error) {
    return jsonOut({ success: false, message: String(error) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ====== الاستعلام من البرنامج (GET) ======
// ?action=ping                      -> اختبار الاتصال
// ?action=customerHistory&phone=01x -> كل فواتير العميل برقم التليفون
// ?action=pull&after=N&limit=500    -> التغييرات اللي حصلت من أي جهاز بعد السطر رقم N (للمزامنة بين الأجهزة)
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || 'ping';

  try {
    if (action === 'customerHistory') {
      return jsonOut(getCustomerHistory(params.phone || ''));
    }
    if (action === 'pull') {
      return jsonOut(pullChanges(Number(params.after) || 0, Math.min(Number(params.limit) || 500, 1000)));
    }
    return jsonOut({
      status: 'online',
      apiVersion: API_VERSION,
      system: 'AlMarkaz Auto Service Center API',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return jsonOut({ success: false, message: String(error) });
  }
}

function normalizePhone(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
  if (digits.indexOf('20') === 0 && digits.length === 12) digits = '0' + digits.substring(2);
  return digits;
}

function getCustomerHistory(phone) {
  var target = normalizePhone(phone);
  if (!target) return { success: false, message: 'رقم التليفون مطلوب' };

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Maintenance');
  var invoices = [];

  if (sheet && sheet.getLastRow() > 1) {
    var headers = getHeadersForSheet('Maintenance');
    var phoneCol = headers.indexOf('رقم التليفون');
    var jsonCol = headers.indexOf('بيانات الفاتورة (JSON)');
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

    for (var r = 0; r < rows.length; r++) {
      if (normalizePhone(rows[r][phoneCol]) !== target) continue;
      var inv = null;
      try { inv = JSON.parse(rows[r][jsonCol]); } catch (e) { inv = null; }
      if (!inv) {
        inv = {
          id: rows[r][0], customerId: rows[r][1], customerName: rows[r][2], customerPhone: target,
          carInfo: rows[r][4], plateFull: rows[r][5], date: rows[r][6], problem: rows[r][7],
          netTotal: Number(rows[r][9]) || 0, totalPaid: Number(rows[r][13]) || 0,
          remainingBalance: Number(rows[r][14]) || 0, paymentStatus: rows[r][15]
        };
      }
      invoices.push(inv);
    }
  }

  invoices.sort(function (a, b) {
    return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
  });

  return { success: true, phone: target, count: invoices.length, invoices: invoices };
}

// مطابقة اسم الجدول في الـ Sheets
function getSheetNameForEntity(entityType) {
  var map = {
    'customers': 'Customers',
    'cars': 'Cars',
    'maintenance': 'Maintenance',
    'services': 'Services',
    'workers': 'Workers',
    'workerAttendance': 'Worker_Attendance',
    'workerExpenses': 'Worker_Expenses',
    'parts': 'Parts',
    'sales': 'Sales',
    'suppliers': 'Suppliers',
    'supplierInvoices': 'Supplier_Invoices',
    'purchases': 'Purchases',
    'supplierPayments': 'Supplier_Payments',
    'expenses': 'Expenses',
    'suggestions': 'Suggestions'
  };
  return map[entityType] || null;
}

// إنشاء الشيت والأعمدة التلقائية إن لم تكن موجودة
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var headers = getHeadersForSheet(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setRightToLeft(true);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
    // كل الأعمدة نص عادي حتى لا يضيع الصفر في أول رقم التليفون
    sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setNumberFormat('@');
  }
  return sheet;
}

// رؤوس الأعمدة لكل جدول
function getHeadersForSheet(sheetName) {
  switch (sheetName) {
    case 'Customers':
      return ['كود العميل', 'اسم العميل', 'رقم التليفون', 'ملاحظات', 'تاريخ التسجيل', 'آخر تحديث'];
    case 'Cars':
      return ['كود السيارة', 'كود العميل', 'نوع السيارة', 'الماركة', 'الموديل', 'حروف اللوحة', 'أرقام اللوحة', 'اللوحة كاملة', 'اللون', 'تاريخ الإضافة'];
    case 'Maintenance':
      return ['كود الفاتورة', 'كود العميل', 'اسم العميل', 'رقم التليفون', 'السيارة', 'نمرة اللوحة', 'التاريخ', 'المشكلة', 'التشخيص', 'إجمالي الفاتورة', 'نقدي', 'فودافون', 'إنستا باي', 'المدفوع', 'المتبقي', 'حالة الدفع', 'العمالة', 'الخدمات', 'قطع الغيار', 'الخصم', 'بيانات الفاتورة (JSON)'];
    case 'Services':
      return ['كود الخدمة', 'اسم الخدمة', 'السعر الافتراضي', 'نشطة؟', 'خدمة مخصصة؟'];
    case 'Workers':
      return ['كود العامل', 'اسم العامل', 'رقم التليفون', 'التخصص', 'نشط؟'];
    case 'Worker_Attendance':
      return ['كود السجل', 'كود العامل', 'التاريخ', 'الحالة', 'ملاحظات', 'آخر تحديث'];
    case 'Worker_Expenses':
      return ['كود المصروف', 'كود العامل', 'التاريخ', 'المبلغ', 'البيان', 'آخر تحديث'];
    case 'Parts':
      return ['كود القطعة', 'اسم القطعة', 'التصنيف', 'كود المورد', 'سعر التكلفة', 'سعر البيع', 'حد التنبيه', 'الرصيد الافتتاحي'];
    case 'Sales':
      return ['كود البيع', 'كود القطعة', 'اسم القطعة', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'كود العميل', 'كود الفاتورة', 'النوع', 'التاريخ'];
    case 'Suppliers':
      return ['كود المورد', 'اسم المورد', 'التليفون', 'التخصص', 'العنوان', 'ملاحظات'];
    case 'Supplier_Invoices':
      return ['كود التوريد', 'رقم الفاتورة الورقية', 'كود المورد', 'اسم المورد', 'تاريخ الفاتورة', 'تاريخ الاستحقاق', 'مبلغ الفاتورة', 'المدفوع', 'المتبقي', 'الحالة'];
    case 'Purchases':
      return ['كود الشراء المركب', 'كود التوريد', 'رقم الفاتورة', 'كود القطعة', 'اسم القطعة', 'سعر الشراء', 'الكمية', 'الإجمالي', 'التاريخ'];
    case 'Suggestions':
      return ['الكود', 'النوع', 'النص', 'عدد مرات الاستخدام', 'ممسوح؟', 'آخر تحديث'];
    case 'Expenses':
      return ['كود المصروف', 'التاريخ', 'المبلغ', 'طريقة الدفع', 'البند', 'الصنايعي', 'البيان', 'سجله'];
    case 'Supplier_Payments':
      return ['كود الدفعة', 'كود المورد', 'كود الفاتورة', 'المبلغ', 'طريقة الدفع', 'ملاحظات', 'التاريخ'];
    default:
      return ['id', 'data', 'timestamp'];
  }
}

function listText(arr, fn) {
  if (!Array.isArray(arr)) return '';
  return arr.map(fn).join(' | ');
}

// تحويل الكائن إلى صف حسب ترتيب الأعمدة
function objectToRow(entityType, obj) {
  switch (entityType) {
    case 'customers':
      return [obj.id, obj.name, normalizePhone(obj.phone), obj.notes || '', obj.createdAt || '', obj.updatedAt || ''];
    case 'cars':
      return [obj.id, obj.customerId, obj.carType || '', obj.brand || '', obj.model || '', obj.plateLetters || '', obj.plateNumbers || '', obj.plateFull || '', obj.color || '', obj.createdAt || ''];
    case 'maintenance':
      return [
        obj.id, obj.customerId, obj.customerName, normalizePhone(obj.customerPhone), obj.carInfo, obj.plateFull, obj.date,
        obj.problem || '', obj.diagnosis || '', obj.netTotal || 0, obj.cashAmount || 0, obj.vodafoneCashAmount || 0,
        obj.instaPayAmount || 0, obj.totalPaid || 0, obj.remainingBalance || 0, obj.paymentStatus || '',
        Array.isArray(obj.workers) ? obj.workers.join(', ') : (obj.workers || ''),
        listText(obj.services, function (s) { return s.name + ' (' + (s.price || 0) + ')'; }),
        listText(obj.parts, function (p) { return p.name + ' ×' + (p.quantity || 1) + ' (' + (p.totalPrice || 0) + ')'; }),
        obj.discountAmount || 0,
        JSON.stringify(obj)
      ];
    case 'services':
      return [obj.id, obj.name, obj.defaultPrice, obj.isActive ? 'نعم' : 'لا', obj.isCustom ? 'نعم' : 'لا'];
    case 'workers':
      return [obj.id, obj.name, obj.phone || '', obj.specialty || '', obj.isActive ? 'نعم' : 'لا'];
    case 'workerAttendance':
      return [obj.id, obj.workerId, obj.date || '', obj.status || '', obj.notes || '', obj.updatedAt || ''];
    case 'workerExpenses':
      return [obj.id, obj.workerId, obj.date || '', obj.amount || 0, obj.description || obj.notes || '', obj.updatedAt || ''];
    case 'parts':
      return [obj.id, obj.name, obj.category || '', obj.supplierId || '', obj.costPrice || 0, obj.sellPrice || 0, obj.minStockLevel || 3, obj.initialStock || 0];
    case 'sales':
      return [obj.id, obj.partId, obj.partName || '', obj.quantity || 1, obj.unitPrice || 0, obj.totalPrice || 0, obj.customerId || '', obj.invoiceId || '', obj.saleType || '', obj.date || obj.createdAt || ''];
    case 'suppliers':
      return [obj.id, obj.name, obj.phone || '', obj.specialty || '', obj.address || '', obj.notes || ''];
    case 'supplierInvoices':
      return [obj.id, obj.invoiceNumber || '', obj.supplierId, obj.supplierName || '', obj.invoiceDate || '', obj.dueDate || '', obj.totalAmount || 0, obj.paidAmount || 0, obj.remainingAmount || 0, obj.status || ''];
    case 'purchases':
      return [obj.id, obj.supplierInvoiceId, obj.invoiceNumber || '', obj.partId, obj.partName || '', obj.unitCost || 0, obj.quantity || 0, obj.totalCost || 0, obj.createdAt || ''];
    case 'suggestions':
      var kinds = { problem: 'شكوى عميل', suspension: 'أعمال عفشة', nextService: 'صيانة قادمة' };
      return [obj.id, kinds[obj.kind] || obj.kind || '', obj.text || '', obj.useCount || 0, obj.isDeleted ? 'نعم' : 'لا', obj.updatedAt || ''];
    case 'expenses':
      var methods = { cash: 'نقدي', vodafone: 'فودافون كاش', insta: 'إنستا باي' };
      var cats = { labor: 'مصروف عمالة', parts: 'شراء قطع غيار', delivery: 'دليفري', other: 'أخرى' };
      return [obj.id, obj.date || '', obj.amount || 0, methods[obj.method] || obj.method || '', cats[obj.category] || obj.category || '', obj.workerName || '', obj.description || '', obj.createdBy || ''];
    case 'supplierPayments':
      return [obj.id, obj.supplierId, obj.supplierInvoiceId || '', obj.amount || 0, obj.paymentMethod || '', obj.notes || '', obj.date || ''];
    default:
      return [obj.id, JSON.stringify(obj), new Date().toISOString()];
  }
}

function findRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var r = 0; r < ids.length; r++) {
    if (String(ids[r][0]) === String(id)) return r + 2;
  }
  return -1;
}

// إضافة أو تحديث الصف (Idempotent Upsert لمنع التكرار)
function upsertRecord(sheet, entityType, obj) {
  var id = obj.id || obj.key;
  if (!id) return;
  var rowData = objectToRow(entityType, obj).map(function (v) {
    return v === null || v === undefined ? '' : String(v);
  });
  var row = findRowById(sheet, id);
  if (row > 0) {
    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
  } else {
    var target = sheet.getLastRow() + 1;
    var range = sheet.getRange(target, 1, 1, rowData.length);
    range.setNumberFormat('@');
    range.setValues([rowData]);
  }
}

function deleteRecord(sheet, id) {
  if (!id) return;
  var row = findRowById(sheet, id);
  if (row > 0) sheet.deleteRow(row);
}

// ===================================================================
// سجل التغييرات (للمزامنة بين أكتر من جهاز)
// كل عملية بتترفع من أي جهاز بتتسجل في شيت مخفي "_sync_log" بالترتيب،
// وكل جهاز بيسحب السطور الجديدة بعد آخر سطر قراه. متعدّلش في الشيت ده بإيدك.
// ===================================================================
var SYNC_LOG_NAME = '_sync_log';
var SYNC_LOG_HEADERS = ['وقت الاستلام', 'الجدول', 'الكود', 'العملية', 'البيانات (JSON)', 'الجهاز'];

function getSyncLogSheet(ss) {
  var sheet = ss.getSheetByName(SYNC_LOG_NAME);
  if (sheet) return sheet;
  sheet = ss.insertSheet(SYNC_LOG_NAME);
  sheet.appendRow(SYNC_LOG_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, sheet.getMaxRows(), SYNC_LOG_HEADERS.length).setNumberFormat('@');
  sheet.hideSheet();
  backfillSyncLog(ss, sheet);
  return sheet;
}

function appendLogRows(sheet, rows) {
  if (!rows.length) return;
  var start = sheet.getLastRow() + 1;
  var range = sheet.getRange(start, 1, rows.length, SYNC_LOG_HEADERS.length);
  range.setNumberFormat('@');
  range.setValues(rows);
}

function pullChanges(after, limit) {
  var ss = getSpreadsheet();
  var sheet = getSyncLogSheet(ss);
  var lastDataRow = sheet.getLastRow(); // السطر 1 = العناوين
  var total = Math.max(0, lastDataRow - 1);
  if (after >= total) return { success: true, rows: [], next: total, total: total, apiVersion: API_VERSION };
  var count = Math.min(limit, total - after);
  var values = sheet.getRange(after + 2, 1, count, SYNC_LOG_HEADERS.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    var payload = null;
    if (v[3] !== 'delete' && v[4]) {
      try { payload = JSON.parse(v[4]); } catch (err) { payload = null; }
    }
    rows.push({ t: String(v[0]), e: String(v[1]), id: String(v[2]), a: String(v[3]), p: payload, d: String(v[5]) });
  }
  return { success: true, rows: rows, next: after + count, total: total, apiVersion: API_VERSION };
}

// أول مرة بس: نسجل البيانات اللي كانت موجودة قبل سجل التغييرات عشان الأجهزة تسحبها
function backfillSyncLog(ss, logSheet) {
  var ts = new Date().toISOString();
  var rows = [];
  var yes = function (v) { return String(v) === 'نعم'; };
  var readSheet = function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  };
  var push = function (entity, obj) {
    if (!obj || !obj.id) return;
    rows.push([ts, entity, String(obj.id), 'upsert', JSON.stringify(obj), 'backfill']);
  };

  var mHeaders = getHeadersForSheet('Maintenance');
  var jsonCol = mHeaders.indexOf('بيانات الفاتورة (JSON)');
  readSheet('Maintenance').forEach(function (r) {
    var obj = null;
    try { obj = JSON.parse(r[jsonCol]); } catch (e) { obj = null; }
    push('maintenance', obj);
  });
  readSheet('Customers').forEach(function (r) {
    push('customers', { id: r[0], name: r[1], phone: normalizePhone(r[2]), notes: r[3], createdAt: r[4], updatedAt: '' });
  });
  readSheet('Cars').forEach(function (r) {
    push('cars', { id: r[0], customerId: r[1], carType: r[2], brand: r[3], model: r[4], plateLetters: r[5], plateNumbers: r[6], plateFull: r[7], color: r[8], createdAt: r[9], updatedAt: '' });
  });
  readSheet('Services').forEach(function (r) {
    push('services', { id: r[0], name: r[1], defaultPrice: Number(r[2]) || 0, isActive: yes(r[3]), isCustom: yes(r[4]), hasAddons: false, availableAddons: [], updatedAt: '' });
  });
  readSheet('Workers').forEach(function (r) {
    push('workers', { id: r[0], name: r[1], phone: r[2], specialty: r[3], isActive: yes(r[4]), updatedAt: '' });
  });
  readSheet('Sales').forEach(function (r) {
    push('sales', { id: r[0], partId: r[1], partName: r[2], quantity: Number(r[3]) || 0, unitPrice: Number(r[4]) || 0, totalPrice: Number(r[5]) || 0, customerId: r[6], invoiceId: r[7], saleType: r[8], date: r[9], createdAt: r[9], updatedAt: '' });
  });

  appendLogRows(logSheet, rows);
}
