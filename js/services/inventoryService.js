/**
 * خدمات إدارة المخزن وقطع الغيار والمبيعات
 */

import { db } from '../db/indexeddb.js';

export const inventoryService = {
  // حساب الرصيد الفعلي الحالي لقطعة غيار: (الرصيد الافتتاحي + المشتريات - المبيعات)
  async getPartStock(partId) {
    const part = await db.get('parts', partId);
    if (!part) return 0;

    const [purchases, sales] = await Promise.all([
      db.find('purchases', p => p.partId === partId),
      db.find('sales', s => s.partId === partId)
    ]);

    const totalPurchased = purchases.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const totalSold = sales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const initial = Number(part.initialStock) || 0;

    return initial + totalPurchased - totalSold;
  },

  // جلب كافة قطع الغيار مع رصيدها الفعلي وحالة المخزون
  async getAllPartsWithStock() {
    const [parts, purchases, sales, suppliers] = await Promise.all([
      db.getAll('parts'),
      db.getAll('purchases'),
      db.getAll('sales'),
      db.getAll('suppliers')
    ]);

    const suppliersMap = new Map(suppliers.map(s => [s.id, s.name]));

    // تجميع كميات المشتريات والمبيعات
    const purchasedMap = new Map();
    for (const p of purchases) {
      purchasedMap.set(p.partId, (purchasedMap.get(p.partId) || 0) + (Number(p.quantity) || 0));
    }

    const soldMap = new Map();
    for (const s of sales) {
      soldMap.set(s.partId, (soldMap.get(s.partId) || 0) + (Number(s.quantity) || 0));
    }

    return parts.map(part => {
      const initial = Number(part.initialStock) || 0;
      const purchased = purchasedMap.get(part.id) || 0;
      const sold = soldMap.get(part.id) || 0;
      const currentStock = initial + purchased - sold;
      const minStock = Number(part.minStockLevel) || 3;
      const isLowStock = currentStock <= minStock;
      const isOutOfStock = currentStock <= 0;

      return {
        ...part,
        supplierName: suppliersMap.get(part.supplierId) || 'غير محدد',
        totalPurchased: purchased,
        totalSold: sold,
        currentStock,
        isLowStock,
        isOutOfStock
      };
    });
  },

  // جلب القطع التي قل رصيدها عن الحد الأدنى لتنبيه الفنيين
  async getLowStockAlerts() {
    const all = await this.getAllPartsWithStock();
    return all.filter(p => p.isLowStock);
  },

  // إضافة أو تعديل قطعة غيار
  async savePart(partData) {
    if (!partData.name || !partData.name.trim()) {
      throw new Error('اسم قطعة الغيار مطلوب');
    }
    partData.costPrice = Number(partData.costPrice) || 0;
    partData.sellPrice = Number(partData.sellPrice) || 0;
    partData.minStockLevel = Number(partData.minStockLevel) || 3;
    partData.initialStock = Number(partData.initialStock) || 0;

    if (partData.id) {
      return await db.put('parts', partData);
    } else {
      partData.id = db.generateId('PART');
      return await db.add('parts', partData);
    }
  },

  // توريد وإضافة قطعة غيار جديدة أو توريد دفعة إضافية للمخزن
  async procurePart({ partId, name, carBrand = '', carModel = '', category = 'عفشة', supplierId = '', supplierName = '', purchaseDate = '', quantity = 1, costPrice = 0, sellPrice = 0, minStockLevel = 3 }) {
    const qty = Number(quantity) || 1;
    const cost = Number(costPrice) || 0;
    const sell = Number(sellPrice) || 0;
    const minStock = Number(minStockLevel) || 3;
    const date = purchaseDate || new Date().toISOString().split('T')[0];

    let targetPartId = partId;

    if (!targetPartId) {
      // التحقق مما إذا كان هناك صنف مسجل بنفس الاسم ونفس السيارة
      const existing = await db.find('parts', p => p.name === name.trim() && p.carBrand === carBrand.trim() && p.carModel === carModel.trim());
      if (existing.length > 0) {
        targetPartId = existing[0].id;
      }
    }

    if (targetPartId) {
      // القطعة موجودة بالفعل: تحديث أسعارها وإضافة كمية توريد في سجل المشتريات
      const part = await db.get('parts', targetPartId);
      if (part) {
        part.costPrice = cost > 0 ? cost : part.costPrice;
        part.sellPrice = sell > 0 ? sell : part.sellPrice;
        part.supplierId = supplierId || part.supplierId;
        part.supplierName = supplierName || part.supplierName;
        part.lastPurchaseDate = date;
        part.initialStock = (Number(part.initialStock) || 0) + qty;
        await db.put('parts', part);
      }
    } else {
      // قطعة جديدة بالكامل
      targetPartId = db.generateId('PART');
      const newPart = {
        id: targetPartId,
        name: name.trim(),
        carBrand: carBrand.trim() || 'عام',
        carModel: carModel.trim() || 'كافة الموديلات',
        category: category.trim() || 'عفشة',
        supplierId: supplierId || null,
        supplierName: supplierName || 'مورد عام',
        purchaseDate: date,
        lastPurchaseDate: date,
        costPrice: cost,
        sellPrice: sell,
        initialStock: qty,
        minStockLevel: minStock,
        createdAt: new Date().toISOString()
      };
      await db.add('parts', newPart);
    }

    // تسجيل فاتورة شراء / حركة توريد في purchases للمطابقة المالية
    const purchaseRecord = {
      id: db.generateId('PUR'),
      supplierInvoiceId: `SUPP-INV-${Date.now().toString().slice(-6)}`,
      partId: targetPartId,
      partName: name.trim(),
      quantity: qty,
      unitCost: cost,
      totalCost: qty * cost,
      supplierId: supplierId || null,
      supplierName: supplierName || 'مورد عام',
      date: new Date().toISOString()
    };
    await db.add('purchases', purchaseRecord);

    return targetPartId;
  },

  // حذف قطعة غيار
  async deletePart(partId) {
    // التحقق من عدم وجود حركات بيع أو شراء عليها
    const [sales, purchases] = await Promise.all([
      db.find('sales', s => s.partId === partId),
      db.find('purchases', p => p.partId === partId)
    ]);

    if (sales.length > 0 || purchases.length > 0) {
      throw new Error('لا يمكن حذف القطعة لوجود حركات بيع أو شراء مسجلة عليها');
    }
    return await db.delete('parts', partId);
  },

  // تسجيل بيع قطع غيار (مباشر أو ضمن صيانة)
  async recordPartSale({ partId, quantity, unitPrice, customerId, invoiceId, saleType = 'in_maintenance' }) {
    const qty = Number(quantity) || 1;
    const price = Number(unitPrice) || 0;
    const currentStock = await this.getPartStock(partId);

    if (currentStock < qty) {
      const part = await db.get('parts', partId);
      const name = part ? part.name : 'القطعة';
      console.warn(`تنبيه: الرصيد الحالي للقطعة (${name}) هو ${currentStock} فقط والمطلوب ${qty}`);
    }

    const part = await db.get('parts', partId);
    const saleRecord = {
      id: db.generateId('SALE'),
      partId,
      partName: part ? part.name : '',
      quantity: qty,
      unitPrice: price,
      totalPrice: qty * price,
      customerId: customerId || null,
      invoiceId: invoiceId || null,
      saleType,
      date: new Date().toISOString()
    };

    return await db.add('sales', saleRecord);
  }
};
