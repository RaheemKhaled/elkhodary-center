/**
 * شاشة التقارير والإحصائيات المالية والتشغيلية
 */

import { reportService } from '../services/reportService.js';
import { inventoryService } from '../services/inventoryService.js';
import { supplierService } from '../services/supplierService.js';
import { reportPdfService } from '../services/reportPdfService.js';
import { showExpenseModal, showCollectDebtModal, confirmDeleteExpense } from '../components/financeModals.js';
import { PAYMENT_METHODS, EXPENSE_CATEGORIES } from '../services/financeService.js';

export const reportsView = {
  async render(container, selectedPeriod = 'today') {
    // الراوتر بيبعت {} لما الشاشة تتفتح: نبدأ بالنهارده
    if (!selectedPeriod || (typeof selectedPeriod === 'object' && !selectedPeriod.from && !selectedPeriod.to)) selectedPeriod = 'today';
    if (typeof selectedPeriod === 'string' && selectedPeriod.includes('|')) {
      const [from, to] = selectedPeriod.split('|');
      selectedPeriod = { from, to };
    }
    this.period = selectedPeriod;
    const [revenue, topServices, topCustomers, workerStats, lowStockParts, suppliers] = await Promise.all([
      reportService.getRevenueReport(selectedPeriod),
      reportService.getTopServices(selectedPeriod),
      reportService.getTopCustomers(),
      reportService.getWorkerStats(selectedPeriod),
      inventoryService.getLowStockAlerts(),
      supplierService.getAllSuppliersWithStats()
    ]);

    const totalSuppRemaining = suppliers.reduce((sum, s) => sum + (s.stats.totalRemaining || 0), 0);

    const isCustom = typeof selectedPeriod === 'object';
    const sum = revenue.summary;
    this.lastSummary = sum;
    this.debtInvoices = new Map(sum.debtors.flatMap(x => x.invoices).map(i => [i.id, i]));
    const periodLabels = {
      today: 'اليوم',
      week: 'الأسبوع الحالي',
      month: 'الشهر الحالي',
      all: 'كافة الفترات'
    };

    container.innerHTML = `
      <div class="reports-screen">
        <div class="card-header" style="border: none; padding: 0; margin-bottom: 24px;">
          <div>
            <h1 style="font-size: 34px; font-weight: 900; color: #FFFFFF;">📊 التقارير والإحصائيات</h1>
            <p style="font-size: 20px; color: var(--text-muted);">
              تقرير: <strong style="color: #38BDF8;">${sum.range.label}</strong>
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn ${selectedPeriod === 'today' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="today">اليوم</button>
            <button type="button" class="btn ${selectedPeriod === 'week' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="week">الأسبوع</button>
            <button type="button" class="btn ${selectedPeriod === 'month' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="month">الشهر</button>
            <button type="button" class="btn ${selectedPeriod === 'all' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="all">الكل</button>
            <button type="button" class="btn btn-success" id="btnPrintReport" style="padding: 10px 16px; font-weight: 800;">📄 تقرير PDF</button>
          </div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: -10px 0 18px; font-weight: 700; color: var(--text-secondary);">
          📅 من تاريخ لتاريخ:
          <input type="date" id="repFrom" class="form-control" value="${isCustom ? sum.range.from : ''}" style="width: 170px; height: 42px; direction: ltr;">
          <span>إلى</span>
          <input type="date" id="repTo" class="form-control" value="${isCustom ? sum.range.to : ''}" style="width: 170px; height: 42px; direction: ltr;">
          <button type="button" class="btn ${isCustom ? 'btn-primary' : 'btn-secondary'}" id="btnRepCustom">عرض</button>
          <button type="button" class="btn btn-danger" id="btnRepExpense" style="margin-inline-start: auto; font-weight: 800;">💸 تسجيل مصروف</button>
        </div>
        <div style="display: none;">
        </div>

        <!-- بطاقات الإيرادات مقسمة -->
        <div class="grid-4" style="margin-bottom: 20px;">
          <div class="card" style="margin: 0; padding: 20px; border-color: #3B82F6;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">💰 المحصّل فعلاً (الإيراد)</div>
            <div style="font-size: 32px; font-weight: 800; color: #38BDF8; margin-top: 6px; font-family: monospace;">
              ${revenue.totalRevenue} <small style="font-size: 16px;">ج.م</small>
            </div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
              ${revenue.invoicesCount} فاتورة بقيمة ${revenue.salesTotal} ج.م${revenue.collectedOldDebt ? ` — منها ${revenue.collectedOldDebt} ج تحصيل آجل قديم` : ''}
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 20px; border-color: #10B981;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">💵 تحصيل نقدي (كاش)</div>
            <div style="font-size: 32px; font-weight: 800; color: #34D399; margin-top: 6px; font-family: monospace;">
              ${revenue.cashTotal} <small style="font-size: 16px;">ج.م</small>
            </div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
              نسبة: ${revenue.totalPaid > 0 ? Math.round((revenue.cashTotal / revenue.totalPaid) * 100) : 0}%
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 20px; border-color: #EF4444;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">📱 فودافون كاش</div>
            <div style="font-size: 32px; font-weight: 800; color: #F87171; margin-top: 6px; font-family: monospace;">
              ${revenue.vodafoneTotal} <small style="font-size: 16px;">ج.م</small>
            </div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
              نسبة: ${revenue.totalPaid > 0 ? Math.round((revenue.vodafoneTotal / revenue.totalPaid) * 100) : 0}%
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 20px; border-color: #8B5CF6;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">🏦 إنستا باي</div>
            <div style="font-size: 32px; font-weight: 800; color: #C4B5FD; margin-top: 6px; font-family: monospace;">
              ${revenue.instaPayTotal} <small style="font-size: 16px;">ج.م</small>
            </div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
              نسبة: ${revenue.totalPaid > 0 ? Math.round((revenue.instaPayTotal / revenue.totalPaid) * 100) : 0}%
            </div>
          </div>
        </div>

        <!-- المصروفات والصافي والآجل -->
        <div class="grid-4" style="margin-bottom: 20px;">
          <div class="card" style="margin: 0; padding: 20px; border-color: #EF4444;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">💸 المصروفات</div>
            <div style="font-size: 30px; font-weight: 800; color: #F87171; margin-top: 6px;">${revenue.expensesTotal} <small style="font-size: 16px;">ج.م</small></div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${Object.entries(sum.byCategory).map(([k, v]) => `${EXPENSE_CATEGORIES[k]?.label || k}: ${v}`).join(' | ') || 'مفيش مصروفات'}</div>
          </div>
          <div class="card" style="margin: 0; padding: 20px; border-color: #10B981;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">✅ الصافي</div>
            <div style="font-size: 30px; font-weight: 800; color: ${revenue.netTotal >= 0 ? '#34D399' : '#F87171'}; margin-top: 6px;">${revenue.netTotal} <small style="font-size: 16px;">ج.م</small></div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">كاش ${sum.net.cash} | فودافون ${sum.net.vodafone} | إنستا ${sum.net.insta}</div>
          </div>
          <div class="card" style="margin: 0; padding: 20px; border-color: #F59E0B;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">🧾 آجل جديد في الفترة</div>
            <div style="font-size: 30px; font-weight: 800; color: #FBBF24; margin-top: 6px;">${revenue.newCredit} <small style="font-size: 16px;">ج.م</small></div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">مش محسوب في الإيراد لحد ما يتسدد</div>
          </div>
          <div class="card" style="margin: 0; padding: 20px; border-color: #EF4444; background: rgba(239,68,68,0.06);">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">⏳ إجمالي الآجل على العملاء</div>
            <div style="font-size: 30px; font-weight: 800; color: #F87171; margin-top: 6px;">${revenue.outstandingCredit} <small style="font-size: 16px;">ج.م</small></div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${sum.debtors.length} عميل</div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom: 24px;">
          <div class="card" style="margin: 0;">
            <h2 class="card-title"><span>⏳</span><span>العملاء اللي عليهم آجل</span></h2>
            ${sum.debtors.length ? `<div class="table-container" style="max-height: 420px; overflow-y: auto;"><table class="data-table"><thead><tr><th>العميل</th><th>المتبقي</th><th></th></tr></thead><tbody>
              ${sum.debtors.map(dbt => dbt.invoices.map(inv => `<tr>
                <td style="font-weight: 800;">${dbt.name}<div style="font-size: 13px; color: var(--text-muted); direction: ltr; text-align: right;">${dbt.phone || ''} — ${inv.id}</div></td>
                <td style="color: #F87171; font-weight: 900; font-size: 18px;">${inv.remainingBalance} ج.م</td>
                <td><button type="button" class="btn btn-success btn-rep-collect" data-inv-id="${inv.id}" style="font-weight: 800;">💰 تحصيل</button></td>
              </tr>`).join('')).join('')}
            </tbody></table></div>` : '<div style="color: var(--text-muted); padding: 12px;">مفيش آجل على حد ✅</div>'}
          </div>
          <div class="card" style="margin: 0;">
            <h2 class="card-title"><span>💸</span><span>مصروفات الفترة (${sum.expenses.length})</span></h2>
            ${sum.expenses.length ? `<div class="table-container" style="max-height: 420px; overflow-y: auto;"><table class="data-table"><thead><tr><th>التاريخ</th><th>البند</th><th>الطريقة</th><th>المبلغ</th><th></th></tr></thead><tbody>
              ${sum.expenses.map(e => `<tr>
                <td>${new Date(e.date).toLocaleDateString('ar-EG')}</td>
                <td style="font-weight: 700;">${EXPENSE_CATEGORIES[e.category]?.label || e.category}${e.workerName ? ` (${e.workerName})` : ''}${e.description ? `<div style="font-size: 13px; color: var(--text-muted);">${e.description}</div>` : ''}</td>
                <td>${PAYMENT_METHODS[e.method]?.label || e.method}</td>
                <td style="color: #F87171; font-weight: 900;">${e.amount} ج.م</td>
                <td style="white-space: nowrap;">
                  <button type="button" class="btn btn-secondary btn-rep-exp-edit" data-id="${e.id}" style="min-height: 34px; padding: 2px 10px;" title="تعديل">✏️</button>
                  <button type="button" class="btn btn-danger btn-rep-exp-del" data-id="${e.id}" style="min-height: 34px; padding: 2px 10px;" title="مسح">🗑️</button>
                </td>
              </tr>`).join('')}
            </tbody></table></div>` : '<div style="color: var(--text-muted); padding: 12px;">مفيش مصروفات في الفترة دي.</div>'}
          </div>
        </div>

        <!-- تحليل مصادر الدخل (مصنعيات مقابل مبيعات قطع غيار) -->
        <div class="grid-2" style="margin-bottom: 24px;">
          <div class="card" style="margin: 0; padding: 16px; border: 1px solid var(--border-color); background: var(--bg-surface-elevated);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 16px; font-weight: 700; color: #60A5FA;">🔧 إيراد خدمات ومصنعيات الصيانة:</span>
              <strong style="font-size: 22px; font-family: monospace; color: #93C5FD;">${revenue.servicesRevenue || 0} ج.م</strong>
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
              يمثل ${revenue.totalRevenue > 0 ? Math.round(((revenue.servicesRevenue || 0) / revenue.totalRevenue) * 100) : 0}% من إجمالي دخل المركز
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 16px; border: 1px solid var(--border-color); background: var(--bg-surface-elevated);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 16px; font-weight: 700; color: #34D399;">📦 مبيعات قطع الغيار والمهمات:</span>
              <strong style="font-size: 22px; font-family: monospace; color: #6EE7B7;">${revenue.partsRevenue || 0} ج.م</strong>
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
              يمثل ${revenue.totalRevenue > 0 ? Math.round(((revenue.partsRevenue || 0) / revenue.totalRevenue) * 100) : 0}% من إجمالي دخل المركز
            </div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom: 28px;">
          <!-- أكثر الخدمات طلباً -->
          <div class="card" style="margin: 0;">
            <h2 class="card-title">
              <span>🔧</span>
              <span>أكثر الخدمات طلباً (${sum.range.label})</span>
            </h2>
            <div class="table-container" style="max-height: 420px; overflow-y: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>الخدمة</th>
                    <th>عدد المرات</th>
                    <th>إجمالي الدخل</th>
                  </tr>
                </thead>
                <tbody>
                  ${topServices.length > 0 ? topServices.map(s => `
                    <tr>
                      <td style="font-weight: 800; font-size: 20px; color: #FFFFFF;">${s.name}</td>
                      <td><span class="badge badge-info" style="font-size: 18px;">${s.count} مرات</span></td>
                      <td style="color: #34D399; font-weight: 800; font-size: 20px;">${s.revenue} ج.م</td>
                    </tr>
                  `).join('') : '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">لا توجد عمليات مسجلة في هذه الفترة</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- أداء وشغل الفنيين والعمالة -->
          <div class="card" style="margin: 0;">
            <h2 class="card-title">
              <span>👨‍🔧</span>
              <span>شغل وإنتاجية الفنيين والعمالة</span>
            </h2>
            <div class="table-container" style="max-height: 420px; overflow-y: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>اسم الفني</th>
                    <th>عدد العمليات</th>
                    <th>مساهمته في شغل الأسبوع ده</th>
                  </tr>
                </thead>
                <tbody>
                  ${workerStats.map(w => `
                    <tr>
                      <td style="font-weight: 800; font-size: 20px; color: #FFFFFF;">${w.name}</td>
                      <td><span class="badge badge-success" style="font-size: 18px;">${w.jobCount} عربيات</span></td>
                      <td style="color: #FBBF24; font-weight: 800; font-size: 20px;">${w.weekValue} ج.م <span style="font-size: 15px; color: var(--text-muted);">(${w.weekShare}% — ${w.weekJobs} عربية)</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <!-- العملاء الأكثر زيارة -->
          <div class="card" style="margin: 0;">
            <h2 class="card-title">
              <span>🏆</span>
              <span>العملاء الأكثر زيارة وإنفاقاً</span>
            </h2>
            <div class="table-container" style="max-height: 420px; overflow-y: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>اسم العميل</th>
                    <th>التليفون</th>
                    <th>مرات الزيارة</th>
                    <th>إجمالي ما دفعه</th>
                  </tr>
                </thead>
                <tbody>
                  ${topCustomers.slice(0, 5).map(c => `
                    <tr>
                      <td style="font-weight: 800; font-size: 20px; color: #FFFFFF;">${c.name}</td>
                      <td style="color: #38BDF8;">${c.phone}</td>
                      <td><span class="badge badge-info" style="font-size: 18px;">${c.visitsCount}</span></td>
                      <td style="color: #34D399; font-weight: 800;">${c.totalSpent} ج.م</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- ملخص النواقص والمستحقات للموردين -->
          <div class="card" style="margin: 0;">
            <h2 class="card-title">
              <span>⚠️</span>
              <span>نواقص المخزن ومستحقات الموردين</span>
            </h2>
            
            <div style="background: var(--bg-input); padding: 16px; border-radius: var(--radius-md); margin-bottom: 16px;">
              <div style="font-size: 18px; color: var(--text-muted);">إجمالي المستحق للموردين:</div>
              <div style="font-size: 28px; font-weight: 900; color: #F87171; margin-top: 4px;">${totalSuppRemaining} ج.م</div>
            </div>

            <div style="font-weight: 800; font-size: 20px; margin-bottom: 8px; color: #FCA5A5;">
              أصناف المخزن التي قاربت على النفاد (${lowStockParts.length}):
            </div>
            <div style="max-height: 200px; overflow-y: auto;">
              ${lowStockParts.length > 0 ? lowStockParts.map(p => `
                <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-color);">
                  <span style="font-weight: 800;">${p.name}</span>
                  <span style="color: #F87171; font-weight: 900;">متبقي: ${p.currentStock} قطعة</span>
                </div>
              `).join('') : '<div style="color: #34D399; padding: 10px;">المخزون في حالة ممتازة، لا توجد نواقص ✅</div>'}
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container);
  },

  attachEvents(container) {
    container.querySelectorAll('.btn-period').forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.getAttribute('data-period');
        this.render(container, period);
      });
    });

    container.querySelector('#btnPrintReport').addEventListener('click', () => reportPdfService.open(this.period));
    container.querySelector('#btnRepCustom')?.addEventListener('click', () => {
      const from = container.querySelector('#repFrom').value, to = container.querySelector('#repTo').value;
      if (!from || !to) { alert('اختار التاريخين'); return; }
      this.render(container, from <= to ? `${from}|${to}` : `${to}|${from}`);
    });
    container.querySelector('#btnRepExpense')?.addEventListener('click', () => showExpenseModal(() => this.render(container, this.period)));
    const periodExpenses = new Map((this.lastSummary?.expenses || []).map(e => [e.id, e]));
    container.querySelectorAll('.btn-rep-exp-edit').forEach(b => b.addEventListener('click', () => {
      const e = periodExpenses.get(b.dataset.id);
      if (e) showExpenseModal(() => this.render(container, this.period), e);
    }));
    container.querySelectorAll('.btn-rep-exp-del').forEach(b => b.addEventListener('click', () => {
      const e = periodExpenses.get(b.dataset.id);
      if (e) confirmDeleteExpense(e, () => this.render(container, this.period));
    }));
    container.querySelectorAll('.btn-rep-collect').forEach(btn => btn.addEventListener('click', async () => {
      const inv = this.debtInvoices?.get(btn.dataset.invId);
      if (inv) showCollectDebtModal(inv, () => this.render(container, this.period));
    }));
  }
};
