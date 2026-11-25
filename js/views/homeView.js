/**
 * الشاشة الرئيسية للنظام (Dashboard)
 * أزرار ضخمة فائقة الوضوح للفنيين مع ملخصات سريعة
 */

import { reportService } from '../services/reportService.js';
import { customerService } from '../services/customerService.js';
import { invoiceService } from '../services/invoiceService.js';

export const homeView = {
  async render(container) {
    // جلب ملخص الإحصائيات السريعة
    const summary = await reportService.getDashboardSummary();
    const { todayRevenue, lowStockPartsCount, totalSupplierPayables, dueInvoicesCount } = summary;

    container.innerHTML = `
      <div class="home-screen">
        <!-- شريط البحث السريع عن العميل أو العربية -->
        <div class="search-bar-container">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              id="globalQuickSearchInput" 
              class="form-control search-control" 
              placeholder="ابحث بالاسم أو التليفون أو نمرة العربية..."
              autocomplete="off"
            >
          </div>
          <div id="quickSearchResults" style="display: none; margin-top: 12px;" class="card"></div>
        </div>

        <!-- الأزرار الرئيسية الضخمة جداً -->
        <div class="grid-2" style="margin-bottom: 28px;">
          <!-- زري الفاتورة السريعة والمعالج -->
          <div style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <button type="button" class="btn btn-success btn-huge" id="btnGoCashierView" style="background: linear-gradient(135deg, #059669, #047857); border: 3px solid #34D399; font-size: 26px; justify-content: center; gap: 14px;">
              <span style="font-size: 40px;">🧑‍💼</span>
              <span>واجهة الكاشير السريعة (POS)</span>
            </button>

            <button type="button" class="btn btn-primary btn-huge" id="btnGoNewInvoice" style="background: linear-gradient(135deg, #2563EB, #1D4ED8); border: 3px solid #60A5FA; font-size: 26px; justify-content: center; gap: 14px;">
              <span style="font-size: 40px;">📝</span>
              <span>معالج الصيانة التفصيلي (Wizard)</span>
            </button>
          </div>

          <!-- زر العملاء -->
          <button type="button" class="btn btn-secondary btn-huge" id="btnGoCustomers" style="font-size: 26px; justify-content: flex-start; padding: 24px 32px;">
            <span style="font-size: 40px; background: rgba(59, 130, 246, 0.2); padding: 12px; border-radius: 16px;">👥</span>
            <div style="text-align: right;">
              <div>العملاء والسيارات</div>
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 600;">سجل الزيارات والبيانات</div>
            </div>
          </button>

          <!-- زر المخزن -->
          <button type="button" class="btn btn-secondary btn-huge" id="btnGoInventory" style="font-size: 26px; justify-content: flex-start; padding: 24px 32px;">
            <span style="font-size: 40px; background: rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 16px;">📦</span>
            <div style="text-align: right;">
              <div>المخزن وقطع الغيار</div>
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 600;">
                ${lowStockPartsCount > 0 ? `<span style="color: #F87171;">⚠️ ${lowStockPartsCount} قطع قاربت على النفاد</span>` : 'الأرصدة والمبيعات'}
              </div>
            </div>
          </button>

          <!-- زر الموردين -->
          <button type="button" class="btn btn-secondary btn-huge" id="btnGoSuppliers" style="font-size: 26px; justify-content: flex-start; padding: 24px 32px;">
            <span style="font-size: 40px; background: rgba(245, 158, 11, 0.2); padding: 12px; border-radius: 16px;">🚚</span>
            <div style="text-align: right;">
              <div>الموردين وفواتير الشراء</div>
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 600;">
                ${dueInvoicesCount > 0 ? `<span style="color: #FBBF24;">مستحق ${totalSupplierPayables} ج.م</span>` : 'حسابات الموردين'}
              </div>
            </div>
          </button>

          <!-- زر التقارير -->
          <button type="button" class="btn btn-secondary btn-huge" id="btnGoReports" style="font-size: 26px; justify-content: flex-start; padding: 24px 32px;">
            <span style="font-size: 40px; background: rgba(139, 92, 246, 0.2); padding: 12px; border-radius: 16px;">📊</span>
            <div style="text-align: right;">
              <div>التقارير والإحصائيات</div>
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 600;">إيراد اليوم: ${todayRevenue.totalRevenue} ج.م</div>
            </div>
          </button>

          <!-- زر إدارة العمالة والصنايعية -->
          <button type="button" class="btn btn-secondary btn-huge" id="btnGoWorkers" style="font-size: 26px; justify-content: flex-start; padding: 24px 32px; border: 2px solid #38BDF8;">
            <span style="font-size: 40px; background: rgba(56, 189, 248, 0.2); padding: 12px; border-radius: 16px;">👷</span>
            <div style="text-align: right;">
              <div style="color: #38BDF8;">إدارة العمالة والصنايعية</div>
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 600;">حضور وانصراف، سُلف، ومرتبات أسبوعية</div>
            </div>
          </button>

          <!-- زر سجل الفواتير والمبيعات -->
          <button type="button" class="btn btn-secondary btn-huge" id="btnGoInvoicesHistory" style="font-size: 26px; justify-content: flex-start; padding: 24px 32px; border: 2px solid #3B82F6;">
            <span style="font-size: 40px; background: rgba(59, 130, 246, 0.2); padding: 12px; border-radius: 16px;">🧾</span>
            <div style="text-align: right;">
              <div style="color: #60A5FA;">سجل الفواتير والبحث</div>
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 600;">عرض، بحث، وطباعة كافة فواتير الصيانة</div>
            </div>
          </button>

          <!-- زر إعدادات وأسعار الخدمات (للمدير) -->
          <button type="button" class="btn btn-secondary btn-huge" id="btnGoServiceSettings" style="font-size: 26px; justify-content: flex-start; padding: 24px 32px; border: 2px solid #F59E0B;">
            <span style="font-size: 40px; background: rgba(245, 158, 11, 0.2); padding: 12px; border-radius: 16px;">⚙️</span>
            <div style="text-align: right;">
              <div style="color: #FBBF24;">أسعار الخدمات والإعدادات</div>
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 600;">تعديل أسعار الصيانة والزوايا والإضافات</div>
            </div>
          </button>
        </div>

        <!-- بطاقات الملخص اليومي السريع -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span>⚡</span>
              <span>ملخص إيرادات اليوم</span>
            </h2>
            <span class="badge badge-info" style="font-size: 18px;">${todayRevenue.invoicesCount} فواتير تم تنفيذها</span>
          </div>
          <div class="grid-4">
            <div style="background: var(--bg-input); padding: 18px; border-radius: var(--radius-md); border: 2px solid var(--border-color);">
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 700;">الإجمالي اليومي</div>
              <div style="font-size: 32px; font-weight: 900; color: #38BDF8; margin-top: 6px;">${todayRevenue.totalRevenue} <small style="font-size: 16px;">ج.م</small></div>
            </div>
            <div style="background: var(--bg-input); padding: 18px; border-radius: var(--radius-md); border: 2px solid var(--border-color);">
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 700;">💵 نقدي (كاش)</div>
              <div style="font-size: 32px; font-weight: 900; color: #34D399; margin-top: 6px;">${todayRevenue.cashTotal} <small style="font-size: 16px;">ج.م</small></div>
            </div>
            <div style="background: var(--bg-input); padding: 18px; border-radius: var(--radius-md); border: 2px solid var(--border-color);">
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 700;">📱 فودافون كاش</div>
              <div style="font-size: 32px; font-weight: 900; color: #EF4444; margin-top: 6px;">${todayRevenue.vodafoneTotal} <small style="font-size: 16px;">ج.م</small></div>
            </div>
            <div style="background: var(--bg-input); padding: 18px; border-radius: var(--radius-md); border: 2px solid var(--border-color);">
              <div style="font-size: 18px; color: var(--text-muted); font-weight: 700;">🏦 إنستا باي</div>
              <div style="font-size: 32px; font-weight: 900; color: #A78BFA; margin-top: 6px;">${todayRevenue.instaPayTotal} <small style="font-size: 16px;">ج.م</small></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container);
  },

  attachEvents(container) {
    // التنقل للأقسام
    container.querySelector('#btnGoCashierView')?.addEventListener('click', () => {
      window.app.navigate('cashier');
    });

    container.querySelector('#btnGoNewInvoice')?.addEventListener('click', () => {
      window.app.navigate('invoice');
    });

    container.querySelector('#btnGoCustomers').addEventListener('click', () => {
      window.app.navigate('customers');
    });

    container.querySelector('#btnGoInventory').addEventListener('click', () => {
      window.app.navigate('inventory');
    });

    container.querySelector('#btnGoSuppliers').addEventListener('click', () => {
      window.app.navigate('suppliers');
    });

    container.querySelector('#btnGoReports').addEventListener('click', () => {
      window.app.navigate('reports');
    });

    container.querySelector('#btnGoWorkers')?.addEventListener('click', () => {
      window.app.navigate('workers');
    });

    container.querySelector('#btnGoInvoicesHistory')?.addEventListener('click', () => {
      invoiceService.showInvoicesLogModal();
    });

    container.querySelector('#btnGoServiceSettings')?.addEventListener('click', () => {
      window.app.navigate('settings');
    });

    // البحث السريع
    const searchInput = container.querySelector('#globalQuickSearchInput');
    const resultsBox = container.querySelector('#quickSearchResults');

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      if (!query) {
        resultsBox.style.display = 'none';
        resultsBox.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(async () => {
        const results = await customerService.searchCustomers(query);
        if (results.length === 0) {
          resultsBox.style.display = 'block';
          resultsBox.innerHTML = `
            <div style="text-align: center; padding: 20px; font-size: 20px; color: var(--text-muted);">
              لا يوجد عميل أو سيارة مطابقة لـ "${query}".
              <br>
              <button type="button" class="btn btn-primary" id="btnQuickCreateCustomer" style="margin-top: 14px;">
                ➕ فتح فاتورة جديدة وتسجيل هذا العميل
              </button>
            </div>
          `;
          const quickBtn = resultsBox.querySelector('#btnQuickCreateCustomer');
          if (quickBtn) {
            quickBtn.addEventListener('click', () => {
              window.app.navigate('invoice', { prefillQuery: query });
            });
          }
        } else {
          resultsBox.style.display = 'block';
          resultsBox.innerHTML = `
            <div style="font-weight: 800; font-size: 20px; margin-bottom: 12px; color: #93C5FD;">نتائج البحث السريع:</div>
            <div class="grid-2">
              ${results.slice(0, 4).map(r => `
                <div style="background: var(--bg-input); padding: 16px; border-radius: var(--radius-md); border: 2px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 22px; font-weight: 800; color: #FFFFFF;">${r.customer.name}</div>
                    <div style="font-size: 18px; color: #38BDF8; font-weight: 700;">📞 ${r.customer.phone}</div>
                    ${r.cars.map(c => `<div style="font-size: 16px; color: var(--text-muted);">🚗 ${c.brand} ${c.model} (${c.plateFull})</div>`).join('')}
                  </div>
                  <button type="button" class="btn btn-primary btn-quick-invoice" data-cust-id="${r.customer.id}" style="padding: 10px 18px; min-height: 48px;">
                    عمل صيانة 🔧
                  </button>
                </div>
              `).join('')}
            </div>
          `;

          resultsBox.querySelectorAll('.btn-quick-invoice').forEach(btn => {
            btn.addEventListener('click', () => {
              const custId = btn.getAttribute('data-cust-id');
              window.app.navigate('invoice', { customerId: custId });
            });
          });
        }
      }, 300);
    });
  }
};
