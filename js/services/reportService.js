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

  // إحصائيات الصنايعية: عدد العربيات في الفترة + مساهمته في شغل الأسبوع الحالي (من السبت)
  // المساهمة = نصيبه من مصنعيات كل فاتورة اشتغل فيها (المصنعية بتتقسم بالتساوي على اللي اشتغلوا فيها)
  async getWorkerStats(period = 'all') {
    const [workers, invoices] = await Promise.all([db.getAll('workers'), db.getAll('maintenance')]);
    const range = financeService.getRange(period);
    const week = financeService.getRange('week');
    const map = new Map(workers.filter(w => w.isActive !== false).map(w => [w.name, { name: w.name, jobCount: 0, weekJobs: 0, weekValue: 0 }]));
    let weekLabor = 0;
    for (const inv of invoices) {
      const date = inv.date || inv.createdAt;
      const names = Array.isArray(inv.workers) ? inv.workers : [];
      const labor = (inv.services || []).reduce((s, x) => s + (Number(x.price) || 0), 0);
      const inWeek = financeService.inRange(date, week);
      if (inWeek) weekLabor += labor;
      for (const n of names) {
        const e = map.get(n) || { name: n, jobCount: 0, weekJobs: 0, weekValue: 0 };
        if (financeService.inRange(date, range)) e.jobCount += 1;
        if (inWeek) { e.weekJobs += 1; e.weekValue += labor / names.length; }
        map.set(n, e);
      }
    }
    return [...map.values()].map(e => ({
      ...e,
      weekValue: Math.round(e.weekValue),
      weekShare: weekLabor > 0 ? Math.round((e.weekValue / weekLabor) * 100) : 0,
      approximateValue: Math.round(e.weekValue)
    })).sort((a, b) => b.weekValue - a.weekValue || b.jobCount - a.jobCount);
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
