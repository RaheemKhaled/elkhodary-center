/**
 * شاشة التقارير والإحصائيات المالية والتشغيلية
 */

import { reportService } from '../services/reportService.js';
import { inventoryService } from '../services/inventoryService.js';
import { supplierService } from '../services/supplierService.js';

export const reportsView = {
  async render(container, selectedPeriod = 'today') {
    const [revenue, topServices, topCustomers, workerStats, lowStockParts, suppliers] = await Promise.all([
      reportService.getRevenueReport(selectedPeriod),
      reportService.getTopServices(selectedPeriod),
      reportService.getTopCustomers(),
      reportService.getWorkerStats(selectedPeriod),
      inventoryService.getLowStockAlerts(),
      supplierService.getAllSuppliersWithStats()
    ]);

    const totalSuppRemaining = suppliers.reduce((sum, s) => sum + (s.stats.totalRemaining || 0), 0);

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
              تقرير: <strong style="color: #38BDF8;">${periodLabels[selectedPeriod]}</strong>
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn ${selectedPeriod === 'today' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="today">اليوم</button>
            <button type="button" class="btn ${selectedPeriod === 'week' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="week">الأسبوع</button>
            <button type="button" class="btn ${selectedPeriod === 'month' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="month">الشهر</button>
            <button type="button" class="btn ${selectedPeriod === 'all' ? 'btn-primary' : 'btn-secondary'} btn-period" data-period="all">الكل</button>
            <button type="button" class="btn btn-secondary" id="btnPrintReport" style="padding: 10px 16px;">🖨️ طباعة</button>
          </div>
        </div>

        <!-- بطاقات الإيرادات مقسمة -->
        <div class="grid-4" style="margin-bottom: 20px;">
          <div class="card" style="margin: 0; padding: 20px; border-color: #3B82F6;">
            <div style="font-size: 16px; color: var(--text-muted); font-weight: 700;">💰 إجمالي الإيرادات</div>
            <div style="font-size: 32px; font-weight: 800; color: #38BDF8; margin-top: 6px; font-family: monospace;">
              ${revenue.totalRevenue} <small style="font-size: 16px;">ج.م</small>
            </div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
              عدد الفواتير: ${revenue.invoicesCount} فاتورة
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
              <span>أكثر الخدمات طلباً (${periodLabels[selectedPeriod]})</span>
            </h2>
            <div class="table-container">
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
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>اسم الفني</th>
                    <th>عدد العمليات</th>
                    <th>قيمة الشغل التقريبية</th>
                  </tr>
                </thead>
                <tbody>
                  ${workerStats.map(w => `
                    <tr>
                      <td style="font-weight: 800; font-size: 20px; color: #FFFFFF;">${w.name}</td>
                      <td><span class="badge badge-success" style="font-size: 18px;">${w.jobCount} عربيات</span></td>
                      <td style="color: #FBBF24; font-weight: 800; font-size: 20px;">${w.approximateValue} ج.م</td>
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
            <div class="table-container">
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

    container.querySelector('#btnPrintReport').addEventListener('click', () => {
      window.print();
    });
  }
};
