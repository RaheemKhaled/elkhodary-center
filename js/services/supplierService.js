/**
 * خدمات إدارة الموردين وفواتير التوريد والمشتريات
 */

import { db } from '../db/indexeddb.js';

export const supplierService = {
  // جلب كافة الموردين مع الحسابات المحسوبة تلقائياً (إجمالي المشتريات، المدفوع، المتبقي، عدد الفواتير)
  async getAllSuppliersWithStats() {
    const [suppliers, invoices, payments] = await Promise.all([
      db.getAll('suppliers'),
      db.getAll('supplierInvoices'),
      db.getAll('supplierPayments')
    ]);

    return suppliers.map(supplier => {
      const suppInvoices = invoices.filter(inv => inv.supplierId === supplier.id);
      const suppPayments = payments.filter(pay => pay.supplierId === supplier.id);

      const totalPurchases = suppInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
      const totalPaid = suppPayments.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
      const totalRemaining = totalPurchases - totalPaid;
      const invoicesCount = suppInvoices.length;

      return {
        ...supplier,
        stats: {
          totalPurchases,
          totalPaid,
          totalRemaining: Math.max(0, totalRemaining),
          invoicesCount
        }
      };
    });
  },

  // حفظ أو تعديل مورد
  async saveSupplier(supplierData) {
    if (!supplierData.name || !supplierData.name.trim()) {
      throw new Error('اسم المورد مطلوب');
    }
    if (supplierData.id) {
      return await db.put('suppliers', supplierData);
    } else {
      supplierData.id = db.generateId('SUPP');
      return await db.add('suppliers', supplierData);
    }
  },

  // تسجيل فاتورة توريد جديدة مع بنود المشتريات (Composite PK)
  async createSupplierInvoice({ supplierId, invoiceNumber, invoiceDate, dueDate, items, notes = '' }) {
    if (!supplierId) throw new Error('يجب اختيار المورد');
    if (!items || items.length === 0) throw new Error('يجب إضافة بند واحد على الأقل في الفاتورة');

    const supplier = await db.get('suppliers', supplierId);
    if (!supplier) throw new Error('المورد غير موجود');

    const invoiceId = db.generateId('SUPPINV');
    let totalAmount = 0;

    // 1. معالجة بنود المشتريات بالـ Composite PK
    const purchaseRecords = [];
    for (const item of items) {
      const unitCost = Number(item.unitCost) || 0;
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) continue;

      const totalCost = unitCost * quantity;
      totalAmount += totalCost;

      // المفتاح المركب: كود عملية التوريد + كود الفاتورة + كود قطعة الغيار
      const compositeId = `${invoiceId}_${invoiceNumber || 'INV'}_${item.partId}`;

      purchaseRecords.push({
        id: compositeId,
        supplierInvoiceId: invoiceId,
        invoiceNumber: invoiceNumber || '',
        partId: item.partId,
        partName: item.partName || '',
        unitCost,
        quantity,
        totalCost,
        createdAt: new Date().toISOString()
      });
    }

    // 2. سجل فاتورة التوريد
    const invoiceRecord = {
      id: invoiceId,
      invoiceNumber: invoiceNumber || '',
      supplierId,
      supplierName: supplier.name,
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: dueDate || '',
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      status: 'unpaid',
      notes,
      createdAt: new Date().toISOString()
    };

    // حفظ الفاتورة وبنود الشراء
    await db.add('supplierInvoices', invoiceRecord);
    for (const p of purchaseRecords) {
      await db.add('purchases', p);
    }

    return invoiceRecord;
  },

  // تسجيل دفعة سداد لمورد
  async recordSupplierPayment({ supplierId, supplierInvoiceId, amount, paymentMethod = 'cash', notes = '' }) {
    const payAmount = Number(amount) || 0;
    if (payAmount <= 0) throw new Error('مبلغ الدفعة يجب أن يكون أكبر من صفر');

    const paymentRecord = {
      id: db.generateId('PAY'),
      supplierId,
      supplierInvoiceId: supplierInvoiceId || null,
      amount: payAmount,
      paymentMethod,
      notes,
      date: new Date().toISOString()
    };

    await db.add('supplierPayments', paymentRecord);

    // إذا تم تحديد فاتورة معينة، نحدث مدفوعاتها والمتبقي
    if (supplierInvoiceId) {
      const invoice = await db.get('supplierInvoices', supplierInvoiceId);
      if (invoice) {
        const newPaid = (Number(invoice.paidAmount) || 0) + payAmount;
        const total = Number(invoice.totalAmount) || 0;
        const newRemaining = Math.max(0, total - newPaid);
        const newStatus = newRemaining === 0 ? 'paid' : 'partial';

        await db.put('supplierInvoices', {
          ...invoice,
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      }
    }

    return paymentRecord;
  },

  // جلب الفواتير المستحقة والمتبقية مع تنبيهات بمواعيد الاستحقاق
  async getDueInvoices() {
    const invoices = await db.getAll('supplierInvoices');
    const today = new Date().toISOString().split('T')[0];

    return invoices
      .filter(inv => inv.remainingAmount > 0 && inv.dueDate)
      .map(inv => {
        const isOverdue = inv.dueDate < today;
        const daysLeft = Math.ceil((new Date(inv.dueDate) - new Date(today)) / (1000 * 60 * 60 * 24));
        return {
          ...inv,
          isOverdue,
          daysLeft
        };
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }
};
