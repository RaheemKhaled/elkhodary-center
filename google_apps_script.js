/**
 * كود Google Apps Script الجاهز للربط مع نظام إدارة مركز الصيانة
 * 
 * طريقة التركيب خطوة بخطوة:
 * 1. افتح ملف Google Sheets جديد وسمّه "قاعدة بيانات مركز الصيانة".
 * 2. من القائمة العلوية اضغط على: ملحقات (Extensions) > Apps Script.
 * 3. امسح أي كود موجود في المحرر والصق هذا الكود بالكامل.
 * 4. اضغط على زر "حفظ" 💾.
 * 5. اضغط على زر "نشر" (Deploy) في الأعلى يميناً > "نشر جديد" (New deployment).
 * 6. اختر النوع: "تطبيق ويب" (Web app).
 * 7. في خيار "من لديه حق الوصول" (Who has access)، اختر: "أي مستخدم" (Anyone).
 * 8. اضغط "نشر" (Deploy) وانسخ رابط تطبيق الويب (Web App URL).
 * 9. الصق الرابط في شاشة "الإعدادات" داخل البرنامج!
 */

// معالجة طلبات POST الواردة من برنامج مركز الصيانة
function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === 'sync_batch') {
      var operations = data.operations || [];
      var results = [];

      for (var i = 0; i < operations.length; i++) {
        var op = operations[i];
        var sheetName = getSheetNameForEntity(op.entityType);
        if (sheetName) {
          var sheet = getOrCreateSheet(ss, sheetName);
          upsertRecord(sheet, op.entityType, op.payload);
          results.push({ id: op.id, success: true });
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        processed: results.length,
        results: results
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'إجراء غير معروف'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// اختبار الاتصال بطلب GET
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'AlMarkaz Auto Service Center API',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// مطابقة اسم الجدول في الـ Sheets
function getSheetNameForEntity(entityType) {
  var map = {
    'customers': 'Customers',
    'cars': 'Cars',
    'maintenance': 'Maintenance',
    'services': 'Services',
    'workers': 'Workers',
    'parts': 'Parts',
    'sales': 'Sales',
    'suppliers': 'Suppliers',
    'supplierInvoices': 'Supplier_Invoices',
    'purchases': 'Purchases',
    'supplierPayments': 'Supplier_Payments'
  };
  return map[entityType] || null;
}

// إنشاء الشيت والأعمدة التلقائية إن لم تكن موجودة
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = getHeadersForSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.setRightToLeft(true); // واجهة عربي RTL
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
    }
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
      return ['كود الفاتورة', 'كود العميل', 'اسم العميل', 'رقم التليفون', 'السيارة', 'نمرة اللوحة', 'التاريخ', 'المشكلة', 'التشخيص', 'إجمالي الفاتورة', 'نقدي', 'فودافون', 'إنستا باي', 'المدفوع', 'المتبقي', 'حالة الدفع', 'العمالة'];
    case 'Services':
      return ['كود الخدمة', 'اسم الخدمة', 'السعر الافتراضي', 'نشطة؟', 'خدمة مخصصة؟'];
    case 'Workers':
      return ['كود العامل', 'اسم العامل', 'رقم التليفون', 'التخصص', 'نشط؟'];
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
    case 'Supplier_Payments':
      return ['كود الدفعة', 'كود المورد', 'كود الفاتورة', 'المبلغ', 'طريقة الدفع', 'ملاحظات', 'التاريخ'];
    default:
      return ['id', 'data', 'timestamp'];
  }
}

// تحويل الكائن إلى صف حسب ترتيب الأعمدة
function objectToRow(entityType, obj) {
  switch (entityType) {
    case 'customers':
      return [obj.id, obj.name, obj.phone, obj.notes || '', obj.createdAt || '', obj.updatedAt || ''];
    case 'cars':
      return [obj.id, obj.customerId, obj.carType || '', obj.brand || '', obj.model || '', obj.plateLetters || '', obj.plateNumbers || '', obj.plateFull || '', obj.color || '', obj.createdAt || ''];
    case 'maintenance':
      return [obj.id, obj.customerId, obj.customerName, obj.customerPhone, obj.carInfo, obj.plateFull, obj.date, obj.problem || '', obj.diagnosis || '', obj.netTotal || 0, obj.cashAmount || 0, obj.vodafoneCashAmount || 0, obj.instaPayAmount || 0, obj.totalPaid || 0, obj.remainingBalance || 0, obj.paymentStatus || '', Array.isArray(obj.workers) ? obj.workers.join(', ') : ''];
    case 'services':
      return [obj.id, obj.name, obj.defaultPrice, obj.isActive ? 'نعم' : 'لا', obj.isCustom ? 'نعم' : 'لا'];
    case 'workers':
      return [obj.id, obj.name, obj.phone || '', obj.specialty || '', obj.isActive ? 'نعم' : 'لا'];
    case 'parts':
      return [obj.id, obj.name, obj.category || '', obj.supplierId || '', obj.costPrice || 0, obj.sellPrice || 0, obj.minStockLevel || 3, obj.initialStock || 0];
    case 'sales':
      return [obj.id, obj.partId, obj.partName || '', obj.quantity || 1, obj.unitPrice || 0, obj.totalPrice || 0, obj.customerId || '', obj.invoiceId || '', obj.saleType || '', obj.date || ''];
    case 'suppliers':
      return [obj.id, obj.name, obj.phone || '', obj.specialty || '', obj.address || '', obj.notes || ''];
    case 'supplierInvoices':
      return [obj.id, obj.invoiceNumber || '', obj.supplierId, obj.supplierName || '', obj.invoiceDate || '', obj.dueDate || '', obj.totalAmount || 0, obj.paidAmount || 0, obj.remainingAmount || 0, obj.status || ''];
    case 'purchases':
      return [obj.id, obj.supplierInvoiceId, obj.invoiceNumber || '', obj.partId, obj.partName || '', obj.unitCost || 0, obj.quantity || 0, obj.totalCost || 0, obj.createdAt || ''];
    case 'supplierPayments':
      return [obj.id, obj.supplierId, obj.supplierInvoiceId || '', obj.amount || 0, obj.paymentMethod || '', obj.notes || '', obj.date || ''];
    default:
      return [obj.id, JSON.stringify(obj), new Date().toISOString()];
  }
}

// إضافة أو تحديث الصف (Idempotent Upsert لمنع التكرار)
function upsertRecord(sheet, entityType, obj) {
  var id = obj.id || obj.key;
  if (!id) return;

  var lastRow = sheet.getLastRow();
  var rowData = objectToRow(entityType, obj);

  if (lastRow <= 1) {
    sheet.appendRow(rowData);
    return;
  }

  // البحث في العمود الأول (ID)
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var r = 0; r < ids.length; r++) {
    if (ids[r][0] == id) {
      // تحديث الصف القائم
      sheet.getRange(r + 2, 1, 1, rowData.length).setValues([rowData]);
      return;
    }
  }

  // إذا لم يتم العثور عليه، إضافة صف جديد
  sheet.appendRow(rowData);
}
