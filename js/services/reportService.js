/**
 * خدمات التقارير المالية والإحصائيات
 */

import { db } from '../db/indexeddb.js';
import { inventoryService } from './inventoryService.js';
import { supplierService } from './supplierService.js';
import { financeService } from './financeService.js';

export const reportService = {
  // تصفية الفواتير حسب الفترة الزمنية (اليوم، الأسبوع، الشهر، الكل)
  filterInvoicesByPeriod(invoices, period = 'today') {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 86400000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return invoices.filter(inv => {
      const invTime = new Date(inv.date || inv.createdAt).getTime();
      if (period === 'today') return invTime >= todayStart;
      if (period === 'week') return invTime >= weekStart;
      if (period === 'month') return invTime >= monthStart;
      return true; // 'all'
    });
  },

  // تقرير الإيرادات: الإيراد = المحصّل فعلاً، والآجل والمصروفات لوحدهم
  async getRevenueReport(period = 'today') {
    const sum = await financeService.getSummary(period);
    return {
      period,
      summary: sum,
      invoicesCount: sum.invoicesCount,
      salesTotal: sum.salesTotal,
      totalRevenue: sum.collectedTotal,
      cashTotal: sum.collected.cash,
      vodafoneTotal: sum.collected.vodafone,
      instaPayTotal: sum.collected.insta,
      totalPaid: sum.collectedTotal,
      totalDiscount: sum.discounts,
      newCredit: sum.newCredit,
      remainingTotal: sum.outstandingCredit,
      outstandingCredit: sum.outstandingCredit,
      collectedOldDebt: sum.collectedOldDebt,
      expensesTotal: sum.expensesTotal,
      netTotal: sum.net.total,
      servicesRevenue: sum.servicesRevenue,
      partsRevenue: sum.partsRevenue
    };
  },

  // أكثر الخدمات طلباً (العدد = عدد الفرد/المرات، الدخل = إجمالي السطر)
  async getTopServices(period = 'all') {
    const sum = await financeService.getSummary(period);
    return sum.services.filter(x => !x.name.startsWith('قطعة: ')).sort((a, b) => b.count - a.count);
  },

  // العملاء الأكثر زيارة وإنفاقاً
  async getTopCustomers() {
    const [customers, invoices] = await Promise.all([
      db.getAll('customers'),
      db.getAll('maintenance')
    ]);

    const statsMap = new Map();

    for (const inv of invoices) {
      const cId = inv.customerId;
      if (!cId) continue;
      const current = statsMap.get(cId) || { visits: 0, spent: 0 };
      current.visits += 1;
      current.spent += (Number(inv.netTotal) || 0);
      statsMap.set(cId, current);
    }

    return customers
      .map(c => {
        const stats = statsMap.get(c.id) || { visits: 0, spent: 0 };
        return {
          ...c,
          visitsCount: stats.visits,
          totalSpent: stats.spent
        };
      })
      .sort((a, b) => b.visitsCount - a.visitsCount);
  },

  // إحصائيات شغل العمالة والفنيين
  async getWorkerStats(period = 'all') {
    const [workers, invoices] = await Promise.all([
      db.getAll('workers'),
      db.getAll('maintenance')
    ]);

    const filtered = this.filterInvoicesByPeriod(invoices, period);
    const workerMap = new Map();

    for (const w of workers) {
      workerMap.set(w.name, { count: 0, totalWorkValue: 0 });
    }

    for (const inv of filtered) {
      if (Array.isArray(inv.workers)) {
        for (const wName of inv.workers) {
          const entry = workerMap.get(wName) || { count: 0, totalWorkValue: 0 };
          entry.count += 1;
          const sTotal = Array.isArray(inv.services)
            ? inv.services.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
            : (Number(inv.servicesTotal) || Number(inv.subTotal) || 0);
          entry.totalWorkValue += sTotal / Math.max(1, inv.workers.length);
          workerMap.set(wName, entry);
        }
      }
    }

    return Array.from(workerMap.entries()).map(([name, stat]) => ({
      name,
      jobCount: stat.count,
      approximateValue: Math.round(stat.totalWorkValue)
    })).sort((a, b) => b.jobCount - a.jobCount);
  },

  // ملخص شامل للوحة التحكم الرئيسية
  async getDashboardSummary() {
    const [todayRevenue, lowStockParts, suppliersStats, dueInvoices] = await Promise.all([
      this.getRevenueReport('today'),
      inventoryService.getLowStockAlerts(),
      supplierService.getAllSuppliersWithStats(),
      supplierService.getDueInvoices()
    ]);

    const totalSupplierPayables = suppliersStats.reduce((sum, s) => sum + (s.stats.totalRemaining || 0), 0);

    return {
      todayRevenue,
      lowStockPartsCount: lowStockParts.length,
      lowStockParts,
      totalSupplierPayables,
      dueInvoicesCount: dueInvoices.length,
      dueInvoices
    };
  }
};
