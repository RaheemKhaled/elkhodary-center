/**
 * الحسابات المالية: التحصيل الفعلي، الآجل، المصروفات، والتقارير
 *
 * - الإيراد = الفلوس اللي اتحصلت فعلاً في الفترة (الآجل مش بيتحسب إيراد لحد ما يتسدد،
 *   ولما يتسدد بيدخل في إيراد يوم السداد).
 * - الآجل = المتبقي على العملاء من كل الفواتير لحد دلوقتي.
 * - المصروفات = أي فلوس طلعت من المركز (عمالة، قطع غيار، دليفري، أخرى) وبتتخصم من الصافي.
 */

import { db } from '../db/indexeddb.js';

export const PAYMENT_METHODS = {
  cash: { label: 'نقدي (كاش)', icon: '💵' },
  vodafone: { label: 'فودافون كاش', icon: '📱' },
  insta: { label: 'إنستا باي', icon: '🏦' }
};

export const EXPENSE_CATEGORIES = {
  labor: { label: 'مصروف عمالة', icon: '👷' },
  parts: { label: 'شراء قطع غيار', icon: '📦' },
  delivery: { label: 'دليفري', icon: '🛵' },
  other: { label: 'أخرى', icon: '🧾' }
};

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyOf = (iso) => dayKey(new Date(iso));
const num = (v) => Number(v) || 0;

export const financeService = {
  // فترة التقرير: today / week (من السبت) / month / all أو {from, to} بصيغة YYYY-MM-DD
  getRange(period = 'today') {
    const now = new Date();
    if (period && typeof period === 'object') {
      const from = period.from || '', to = period.to || dayKey(now);
      return { from, to, label: from ? `من ${from} إلى ${to}` : `حتى ${to}`, key: 'custom' };
    }
    const today = dayKey(now);
    if (period === 'today') return { from: today, to: today, label: `النهارده ${today}`, key: 'today' };
    if (period === 'week') {
      const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 1) % 7));
      return { from: dayKey(s), to: today, label: `الأسبوع من ${dayKey(s)} إلى ${today}`, key: 'week' };
    }
    if (period === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: dayKey(s), to: today, label: `الشهر من ${dayKey(s)} إلى ${today}`, key: 'month' };
    }
    return { from: '', to: '', label: 'كل الفترات', key: 'all' };
  },

  inRange(iso, range) {
    if (!iso) return false;
    const k = keyOf(iso);
    return (!range.from || k >= range.from) && (!range.to || k <= range.to);
  },

  // دفعات الفاتورة: الفواتير القديمة اللي من غير سجل دفعات بتعتبر اتدفعت يوم الفاتورة
  paymentsOf(inv) {
    if (Array.isArray(inv.payments) && inv.payments.length) return inv.payments;
    const p = { date: inv.date || inv.createdAt, cash: num(inv.cashAmount), vodafone: num(inv.vodafoneCashAmount), insta: num(inv.instaPayAmount) };
    return (p.cash + p.vodafone + p.insta) > 0 ? [p] : [];
  },

  // دفعة الفاتورة الأولى وقت الإنشاء
  initialPayments(dateIso, cash, vodafone, insta) {
    const total = num(cash) + num(vodafone) + num(insta);
    return total > 0 ? [{ date: dateIso, cash: num(cash), vodafone: num(vodafone), insta: num(insta), note: 'دفعة الفاتورة' }] : [];
  },

  // تحصيل آجل (كله أو جزء منه)
  async collectDebt(invoiceId, amount, method = 'cash', note = '') {
    const inv = await db.get('maintenance', invoiceId);
    if (!inv) throw new Error('الفاتورة مش موجودة على الجهاز');
    const remaining = num(inv.remainingBalance);
    const value = Math.min(num(amount), remaining);
    if (value <= 0) throw new Error('المبلغ لازم يكون أكبر من صفر ومش أكبر من المتبقي');

    const payments = [...this.paymentsOf(inv)];
    payments.push({
      date: new Date().toISOString(),
      cash: method === 'cash' ? value : 0,
      vodafone: method === 'vodafone' ? value : 0,
      insta: method === 'insta' ? value : 0,
      note: note || 'تحصيل آجل'
    });
    const updated = {
      ...inv,
      payments,
      cashAmount: num(inv.cashAmount) + (method === 'cash' ? value : 0),
      vodafoneCashAmount: num(inv.vodafoneCashAmount) + (method === 'vodafone' ? value : 0),
      instaPayAmount: num(inv.instaPayAmount) + (method === 'insta' ? value : 0),
      totalPaid: num(inv.totalPaid) + value,
      remainingBalance: Math.max(0, remaining - value)
    };
    updated.paymentStatus = updated.remainingBalance > 0 ? 'partial' : 'paid';
    await db.put('maintenance', updated);
    return updated;
  },

  // ===== المصروفات =====
  async addExpense({ amount, method = 'cash', category = 'other', workerId = '', workerName = '', description = '', date = null, createdBy = '' }) {
    const value = num(amount);
    if (value <= 0) throw new Error('اكتب مبلغ المصروف');
    if (!PAYMENT_METHODS[method]) throw new Error('اختار طريقة الدفع');
    if (!EXPENSE_CATEGORIES[category]) throw new Error('اختار بند المصروف');
    if (category === 'labor' && !workerId && !workerName) throw new Error('اختار الصنايعي اللي اتصرفله');
    return db.add('expenses', {
      id: db.generateId('EXP'),
      date: date || new Date().toISOString(),
      amount: value, method, category, workerId, workerName,
      description: String(description || '').trim(),
      createdBy
    });
  },

  async deleteExpense(id) {
    return db.delete('expenses', id);
  },

  async getExpenses(range) {
    const all = await db.getAll('expenses');
    return all.filter(e => this.inRange(e.date, range)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },

  // ===== الملخص المالي لأي فترة =====
  async getSummary(period = 'today') {
    const range = this.getRange(period);
    const [invoices, expenses, workers] = await Promise.all([
      db.getAll('maintenance'),
      this.getExpenses(range),
      db.getAll('workers')
    ]);

    const periodInvoices = invoices.filter(i => this.inRange(i.date || i.createdAt, range))
      .sort((a, b) => String(a.date || a.createdAt).localeCompare(String(b.date || b.createdAt)));

    // التحصيل الفعلي في الفترة (دفعات الفواتير + تحصيل آجل قديم)
    const collected = { cash: 0, vodafone: 0, insta: 0 };
    let collectedOldDebt = 0;
    const debtCollections = [];
    for (const inv of invoices) {
      const invKey = keyOf(inv.date || inv.createdAt);
      for (const p of this.paymentsOf(inv)) {
        if (!this.inRange(p.date, range)) continue;
        collected.cash += num(p.cash); collected.vodafone += num(p.vodafone); collected.insta += num(p.insta);
        const sum = num(p.cash) + num(p.vodafone) + num(p.insta);
        if (keyOf(p.date) !== invKey) {
          collectedOldDebt += sum;
          debtCollections.push({ invoiceId: inv.id, customerName: inv.customerName, date: p.date, amount: sum });
        }
      }
    }
    const collectedTotal = collected.cash + collected.vodafone + collected.insta;

    // المصروفات حسب طريقة الدفع والبند
    const spent = { cash: 0, vodafone: 0, insta: 0 };
    const byCategory = {};
    for (const e of expenses) {
      spent[e.method] = num(spent[e.method]) + num(e.amount);
      byCategory[e.category] = num(byCategory[e.category]) + num(e.amount);
    }
    const expensesTotal = spent.cash + spent.vodafone + spent.insta;

    // مبيعات الفترة (قيمة الفواتير) والآجل الجديد منها
    const salesTotal = periodInvoices.reduce((s, i) => s + num(i.netTotal), 0);
    const discounts = periodInvoices.reduce((s, i) => s + num(i.discountAmount), 0);
    const newCredit = periodInvoices.reduce((s, i) => s + num(i.remainingBalance), 0);

    // الآجل المستحق على العملاء لحد دلوقتي (كل الفواتير)
    const debtors = new Map();
    for (const inv of invoices) {
      if (num(inv.remainingBalance) <= 0) continue;
      const key = inv.customerPhone || inv.customerId || inv.customerName;
      const d = debtors.get(key) || { name: inv.customerName, phone: inv.customerPhone, amount: 0, invoices: [] };
      d.amount += num(inv.remainingBalance);
      d.invoices.push(inv);
      debtors.set(key, d);
    }
    const debtorsList = [...debtors.values()].sort((a, b) => b.amount - a.amount);
    const outstandingCredit = debtorsList.reduce((s, d) => s + d.amount, 0);

    // تفاصيل الشغل: الخدمات (بالعدد) والقطع
    const svc = new Map();
    let servicesRevenue = 0, partsRevenue = 0;
    for (const inv of periodInvoices) {
      for (const s of inv.services || []) {
        const name = String(s.name || 'خدمة').replace(/\s*\(\d+\s*(فرد|فردة)\)\s*$/, '');
        const qty = num(s.quantity) || 1;
        const e = svc.get(name) || { name, count: 0, revenue: 0 };
        e.count += qty; e.revenue += num(s.price);
        svc.set(name, e);
        servicesRevenue += num(s.price);
      }
      for (const p of inv.parts || []) {
        const qty = num(p.quantity) || 1;
        const total = num(p.unitPrice) * qty || num(p.totalPrice);
        const name = `قطعة: ${p.name}`;
        const e = svc.get(name) || { name, count: 0, revenue: 0 };
        e.count += qty; e.revenue += total;
        svc.set(name, e);
        partsRevenue += total;
      }
    }

    // الصنايعية: عدد الشغلانات ومصروفاتهم في الفترة
    const workerMap = new Map(workers.map(w => [w.name, { name: w.name, jobs: 0, paid: 0 }]));
    for (const inv of periodInvoices) {
      for (const wName of (Array.isArray(inv.workers) ? inv.workers : [])) {
        const e = workerMap.get(wName) || { name: wName, jobs: 0, paid: 0 };
        e.jobs += 1; workerMap.set(wName, e);
      }
    }
    for (const e of expenses.filter(x => x.category === 'labor')) {
      const name = e.workerName || workers.find(w => w.id === e.workerId)?.name || 'غير محدد';
      const w = workerMap.get(name) || { name, jobs: 0, paid: 0 };
      w.paid += num(e.amount); workerMap.set(name, w);
    }

    return {
      range,
      invoicesCount: periodInvoices.length,
      invoices: periodInvoices,
      salesTotal, discounts, newCredit,
      collected, collectedTotal, collectedOldDebt, debtCollections,
      expenses, spent, byCategory, expensesTotal,
      net: {
        cash: collected.cash - spent.cash,
        vodafone: collected.vodafone - spent.vodafone,
        insta: collected.insta - spent.insta,
        total: collectedTotal - expensesTotal
      },
      outstandingCredit, debtors: debtorsList,
      services: [...svc.values()].sort((a, b) => b.revenue - a.revenue),
      servicesRevenue, partsRevenue,
      workers: [...workerMap.values()].filter(w => w.jobs || w.paid).sort((a, b) => b.jobs - a.jobs)
    };
  }
};
