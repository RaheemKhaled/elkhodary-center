/**
 * شاشة إدارة العملاء والسيارات وسجل الصيانات
 */

import { db } from '../db/indexeddb.js';
import { customerService } from '../services/customerService.js';
import { invoiceService } from '../services/invoiceService.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';

export const customersView = {
  async render(container) {
    const [customers, cars, maintenance] = await Promise.all([
      db.getAll('customers'),
      db.getAll('cars'),
      db.getAll('maintenance')
    ]);

    // حساب إحصائيات كل عميل
    const customersWithStats = customers.map(c => {
      const custCars = cars.filter(car => car.customerId === c.id);
      const custInvoices = maintenance.filter(inv => inv.customerId === c.id);
      const totalSpent = custInvoices.reduce((sum, inv) => sum + (Number(inv.netTotal) || 0), 0);
      const lastVisit = custInvoices.length > 0 ? custInvoices[custInvoices.length - 1].date : c.createdAt;

      return {
        ...c,
        cars: custCars,
        invoicesCount: custInvoices.length,
        totalSpent,
        lastVisit
      };
    }).sort((a, b) => new Date(b.lastVisit || 0) - new Date(a.lastVisit || 0));

    container.innerHTML = `
      <div class="customers-screen">
        <div class="card-header" style="border: none; padding: 0; margin-bottom: 24px;">
          <div>
            <h1 style="font-size: 34px; font-weight: 900; color: #FFFFFF;">👥 العملاء وسيارات المركز</h1>
            <p style="font-size: 20px; color: var(--text-muted);">إجمالي العملاء المسجلين: ${customers.length} عميل</p>
          </div>
          <button type="button" class="btn btn-primary" id="btnAddNewCustomer" style="font-size: 22px;">
            ➕ إضافة عميل جديد
          </button>
        </div>

        <!-- بحث في العملاء -->
        <div class="search-bar-container">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              id="searchCustomerListInput" 
              class="form-control search-control" 
              placeholder="ابحث بالاسم أو رقم التليفون أو نمرة السيارة..."
            >
          </div>
        </div>

        <!-- جدول العملاء -->
        <div class="table-container">
          <table class="data-table" id="customersTable">
            <thead>
              <tr>
                <th>كود العميل</th>
                <th>اسم العميل</th>
                <th>رقم التليفون</th>
                <th>السيارات المسجلة</th>
                <th>عدد الفواتير</th>
                <th>إجمالي المدفوعات</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody id="customersTableBody">
              <!-- يتم ملؤه بالجافاسكربت -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.renderCustomerRows(container, customersWithStats);
    this.attachEvents(container, customersWithStats);
  },

  renderCustomerRows(container, list) {
    const tbody = container.querySelector('#customersTableBody');
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 22px;">
            لا يوجد عملاء مسجلين حتى الآن.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(c => `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td>
          <div style="font-weight: 800; font-size: 22px; color: #FFFFFF;">${c.name}</div>
          ${c.notes ? `<div style="font-size: 16px; color: #94A3B8;">${c.notes}</div>` : ''}
        </td>
        <td>
          <a href="tel:${c.phone}" style="color: #38BDF8; font-weight: 800; text-decoration: none;">📞 ${c.phone}</a>
        </td>
        <td>
          ${c.cars.length > 0 ? c.cars.map(car => `
            <div style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px; margin-bottom: 4px; font-size: 18px;">
              🚗 ${car.brand} ${car.model || ''} <span style="color: #FBBF24; font-weight: 800;">[ ${car.plateFull} ]</span>
            </div>
          `).join('') : '<span style="color: var(--text-muted);">لا توجد سيارة مسجلة</span>'}
        </td>
        <td><span class="badge badge-info" style="font-size: 18px;">${c.invoicesCount} صيانة</span></td>
        <td><strong style="color: #34D399; font-size: 22px;">${c.totalSpent} ج.م</strong></td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-primary btn-action-invoice" data-cust-id="${c.id}" style="padding: 8px 14px; min-height: 48px; font-size: 18px;" title="عمل فاتورة">
              🔧 فاتورة جديدة
            </button>
            <button type="button" class="btn btn-secondary btn-action-view" data-cust-id="${c.id}" style="padding: 8px 12px; min-height: 48px;" title="الملف الكامل">
              👁️
            </button>
            <button type="button" class="btn btn-danger btn-action-delete" data-cust-id="${c.id}" style="padding: 8px 12px; min-height: 48px;" title="حذف">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  attachEvents(container, allCustomers) {
    // فلتر البحث
    const searchInput = container.querySelector('#searchCustomerListInput');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allCustomers.filter(c => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.cars.some(car => car.plateFull?.includes(q) || car.brand?.toLowerCase().includes(q))
        );
      });
      this.renderCustomerRows(container, filtered);
    });

    // أحداث أزرار الجدول
    container.addEventListener('click', async (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const custId = target.getAttribute('data-cust-id');
      if (target.classList.contains('btn-action-invoice')) {
        window.app.navigate('invoice', { customerId: custId });
      } else if (target.classList.contains('btn-action-view')) {
        this.showCustomerHistoryModal(custId);
      } else if (target.classList.contains('btn-action-delete')) {
        const confirmed = await modal.confirm({
          title: 'حذف العميل',
          message: 'هل أنت متأكد من حذف هذا العميل؟ لن يتم حذف فواتيره السابقة للحفاظ على السجلات المالية.',
          type: 'danger'
        });
        if (confirmed) {
          await db.delete('customers', custId);
          toast.success('تم حذف العميل بنجاح');
          this.render(container);
        }
      }
    });

    // إضافة عميل جديد
    container.querySelector('#btnAddNewCustomer').addEventListener('click', () => {
      this.showAddCustomerModal(container);
    });
  },

  // نافذة عرض سجل العميل الكامل وفواتيره السابقة
  async showCustomerHistoryModal(customerId) {
    const profile = await customerService.getCustomerFullProfile(customerId);
    if (!profile) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 900px;">
        <div class="card-header">
          <div>
            <h2 style="font-size: 28px; font-weight: 900; color: #FFFFFF;">👤 ${profile.name}</h2>
            <div style="font-size: 20px; color: #38BDF8;">📞 ${profile.phone}</div>
          </div>
          <button type="button" class="btn btn-secondary" id="btnCloseProfileModal" style="min-height: 44px; padding: 6px 14px;">✖</button>
        </div>

        <div class="grid-3" style="margin-bottom: 24px;">
          <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 16px; color: var(--text-muted);">إجمالي الزيارات</div>
            <div style="font-size: 28px; font-weight: 900; color: #60A5FA;">${profile.computed.visitsCount}</div>
          </div>
          <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 16px; color: var(--text-muted);">إجمالي المدفوعات</div>
            <div style="font-size: 28px; font-weight: 900; color: #34D399;">${profile.computed.totalSpent} ج.م</div>
          </div>
          <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 16px; color: var(--text-muted);">المتبقي عليه</div>
            <div style="font-size: 28px; font-weight: 900; color: ${profile.computed.totalRemaining > 0 ? '#F87171' : '#34D399'};">
              ${profile.computed.totalRemaining} ج.م
            </div>
          </div>
        </div>

        <h3 style="font-size: 22px; font-weight: 800; color: #93C5FD; margin-bottom: 12px;">سجل الفواتير السابقة:</h3>
        <div style="max-height: 350px; overflow-y: auto;">
          ${profile.maintenance.length > 0 ? profile.maintenance.map(inv => `
            <div style="background: var(--bg-input); border: 2px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 20px; font-weight: 800; color: #FFFFFF;">فاتورة: ${inv.id} - ${inv.carInfo} (${inv.plateFull})</span>
                <span style="font-size: 18px; color: #38BDF8;">${new Date(inv.date || inv.createdAt).toLocaleDateString('ar-EG')}</span>
              </div>
              <div style="font-size: 18px; color: var(--text-secondary); margin-bottom: 6px;">
                <strong>المشكلة:</strong> ${inv.problem || 'صيانة عامة'}
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700;">
                <span>المبلغ: ${inv.netTotal} ج.م</span>
                <span>المدفوع: ${inv.totalPaid} ج.م</span>
                ${inv.remainingBalance > 0 ? `<span style="color: #F87171;">متبقي: ${inv.remainingBalance} ج.م</span>` : '<span style="color: #34D399;">مدفوع بالكامل ✅</span>'}
              </div>
              <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary btn-print-past-inv" data-inv-id="${inv.id}" style="font-size: 14px; padding: 4px 14px; min-height: 36px; border-color: #38BDF8; color: #93C5FD;">
                  🖨️ طباعة الفاتورة PDF + إرسال واتساب
                </button>
              </div>
            </div>
          `).join('') : '<div style="color: var(--text-muted); font-size: 18px;">لا توجد فواتير سابقة.</div>'}
        </div>

        <div style="margin-top: 24px; text-align: left;">
          <button type="button" class="btn btn-primary" id="btnNewInvoiceFromModal">
            🔧 إنشاء فاتورة جديدة لهذا العميل
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('.btn-print-past-inv').forEach(btn => {
      btn.addEventListener('click', async () => {
        const invId = btn.dataset.invId;
        const targetInv = profile.maintenance.find(m => m.id === invId);
        if (targetInv) {
          toast.success('جاري تجهيز الفاتورة للطباعة... 🖨️');
          await invoiceService.printInvoice(targetInv, 'standard');
        }
      });
    });

    overlay.querySelector('#btnCloseProfileModal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnNewInvoiceFromModal').addEventListener('click', () => {
      overlay.remove();
      window.app.navigate('invoice', { customerId });
    });
  },

  // نافذة إضافة عميل سريع
  showAddCustomerModal(parentContainer) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <h2 class="modal-title">➕ إضافة عميل جديد</h2>
        <div class="form-group">
          <label class="form-label"><span class="required">*</span> اسم العميل:</label>
          <input type="text" id="newCustName" class="form-control" placeholder="الاسم ثلاثي...">
        </div>
        <div class="form-group">
          <label class="form-label"><span class="required">*</span> رقم التليفون (11 رقم يبدأ بـ 01):</label>
          <input type="tel" id="newCustPhone" class="form-control" placeholder="01xxxxxxxxx" maxlength="11">
        </div>
        <div class="form-group">
          <label class="form-label">ملاحظات:</label>
          <input type="text" id="newCustNotes" class="form-control" placeholder="ملاحظات...">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="btnCancelAddCust">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnSaveAddCust">حفظ العميل</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnCancelAddCust').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnSaveAddCust').addEventListener('click', async () => {
      const name = overlay.querySelector('#newCustName').value.trim();
      const phone = overlay.querySelector('#newCustPhone').value.trim();
      const notes = overlay.querySelector('#newCustNotes').value.trim();

      try {
        await customerService.saveCustomer({ name, phone, notes });
        toast.success('تمت إضافة العميل بنجاح');
        overlay.remove();
        this.render(parentContainer);
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
