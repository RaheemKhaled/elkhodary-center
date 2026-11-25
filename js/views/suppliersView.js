/**
 * شاشة إدارة الموردين وفواتير التوريد والمشتريات
 */

import { supplierService } from '../services/supplierService.js';
import { db } from '../db/indexeddb.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';

export const suppliersView = {
  async render(container) {
    const [suppliers, dueInvoices, allParts, allInvoices] = await Promise.all([
      supplierService.getAllSuppliersWithStats(),
      supplierService.getDueInvoices(),
      db.getAll('parts'),
      db.getAll('supplierInvoices')
    ]);

    const totalRemainingAll = suppliers.reduce((sum, s) => sum + (s.stats.totalRemaining || 0), 0);

    container.innerHTML = `
      <div class="suppliers-screen">
        <div class="card-header" style="border: none; padding: 0; margin-bottom: 24px;">
          <div>
            <h1 style="font-size: 34px; font-weight: 900; color: #FFFFFF;">🚚 الموردين وفواتير الشراء</h1>
            <p style="font-size: 20px; color: var(--text-muted);">
              إجمالي الموردين: ${suppliers.length} مورد | إجمالي المستحقات للموردين: <strong style="color: #FBBF24;">${totalRemainingAll} ج.م</strong>
            </p>
          </div>
          <div style="display: flex; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnRecordSupplierPayment" style="font-size: 20px;">
              💸 تسجيل دفعة لمورد
            </button>
            <button type="button" class="btn btn-primary" id="btnNewSupplierInvoice" style="font-size: 20px;">
              📥 فاتورة توريد جديدة
            </button>
            <button type="button" class="btn btn-secondary" id="btnAddSupplier" style="font-size: 20px;">
              ➕ إضافة مورد
            </button>
          </div>
        </div>

        ${dueInvoices.length > 0 ? `
          <div class="card" style="background: rgba(245, 158, 11, 0.15); border-color: #F59E0B; margin-bottom: 24px;">
            <h3 style="color: #FDE68A; font-size: 22px; font-weight: 800; margin-bottom: 12px;">
              ⏰ تنبيه الفواتير المستحقة وقرب ميعاد السداد:
            </h3>
            <div class="grid-3">
              ${dueInvoices.map(inv => `
                <div style="background: var(--bg-surface); border: 2px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
                  <div style="font-weight: 800; font-size: 20px; color: #FFFFFF;">${inv.supplierName}</div>
                  <div style="font-size: 16px; color: var(--text-muted);">فاتورة: ${inv.invoiceNumber || inv.id}</div>
                  <div style="font-size: 18px; color: #F87171; font-weight: 800; margin-top: 6px;">متبقي: ${inv.remainingAmount} ج.م</div>
                  <div style="font-size: 16px; color: ${inv.isOverdue ? '#EF4444' : '#FBBF24'}; font-weight: 700; margin-top: 4px;">
                    ${inv.isOverdue ? `⚠️ فات ميعادها منذ ${Math.abs(inv.daysLeft)} يوم!` : `⏳ متبقي ${inv.daysLeft} يوم على ميعاد السداد`}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- جدول الموردين -->
        <div class="card" style="margin-bottom: 28px;">
          <h2 class="card-title">
            <span>🏢</span>
            <span>قائمة الموردين وحساباتهم</span>
          </h2>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>كود المورد</th>
                  <th>اسم المورد</th>
                  <th>التليفون</th>
                  <th>التخصص</th>
                  <th>عدد الفواتير</th>
                  <th>إجمالي المشتريات</th>
                  <th>إجمالي المدفوع</th>
                  <th>إجمالي المستحق</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${suppliers.map(s => `
                  <tr>
                    <td><strong>${s.id}</strong></td>
                    <td style="font-weight: 800; font-size: 22px; color: #FFFFFF;">${s.name}</td>
                    <td><a href="tel:${s.phone}" style="color: #38BDF8; font-weight: 700; text-decoration: none;">📞 ${s.phone || '-'}</a></td>
                    <td><span class="badge badge-info">${s.specialty || 'عام'}</span></td>
                    <td><span class="badge badge-info">${s.stats.invoicesCount}</span></td>
                    <td style="font-size: 20px;">${s.stats.totalPurchases} ج.م</td>
                    <td style="color: #34D399; font-size: 20px;">${s.stats.totalPaid} ج.م</td>
                    <td>
                      <strong style="color: ${s.stats.totalRemaining > 0 ? '#F87171' : '#34D399'}; font-size: 22px;">
                        ${s.stats.totalRemaining} ج.م
                      </strong>
                    </td>
                    <td>
                      <button type="button" class="btn btn-secondary btn-quick-pay" data-supp-id="${s.id}" data-supp-name="${s.name}" style="padding: 8px 14px; min-height: 44px; font-size: 18px;">
                        💸 دفع
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- سجل فواتير التوريد الأخيرة -->
        <div class="card">
          <h2 class="card-title">
            <span>📄</span>
            <span>سجل فواتير التوريد والمشتريات</span>
          </h2>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>كود التوريد</th>
                  <th>رقم الفاتورة الورقية</th>
                  <th>المورد</th>
                  <th>تاريخ الفاتورة</th>
                  <th>ميعاد الاستحقاق</th>
                  <th>مبلغ الفاتورة</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>حالة السداد</th>
                </tr>
              </thead>
              <tbody>
                ${allInvoices.map(inv => `
                  <tr>
                    <td><strong>${inv.id}</strong></td>
                    <td style="font-weight: 800;">${inv.invoiceNumber || '-'}</td>
                    <td style="font-weight: 700;">${inv.supplierName}</td>
                    <td>${inv.invoiceDate || '-'}</td>
                    <td>${inv.dueDate || '-'}</td>
                    <td style="font-size: 20px; font-weight: 800;">${inv.totalAmount} ج.م</td>
                    <td style="color: #34D399;">${inv.paidAmount || 0} ج.م</td>
                    <td style="color: ${inv.remainingAmount > 0 ? '#F87171' : '#34D399'}; font-weight: 800;">
                      ${inv.remainingAmount} ج.م
                    </td>
                    <td>
                      <span class="badge ${inv.status === 'paid' ? 'badge-success' : (inv.status === 'partial' ? 'badge-warning' : 'badge-danger')}">
                        ${inv.status === 'paid' ? 'مسددة بالكامل' : (inv.status === 'partial' ? 'سداد جزئي' : 'غير مسددة')}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container, suppliers, allParts, allInvoices);
  },

  attachEvents(container, suppliers, allParts, allInvoices) {
    // إضافة مورد
    container.querySelector('#btnAddSupplier').addEventListener('click', () => {
      this.showAddSupplierModal(container);
    });

    // فاتورة توريد جديدة
    container.querySelector('#btnNewSupplierInvoice').addEventListener('click', () => {
      this.showNewSupplierInvoiceModal(container, suppliers, allParts);
    });

    // سداد دفعة
    container.querySelector('#btnRecordSupplierPayment').addEventListener('click', () => {
      this.showPaymentModal(container, suppliers, allInvoices);
    });

    container.querySelectorAll('.btn-quick-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        const suppId = btn.getAttribute('data-supp-id');
        this.showPaymentModal(container, suppliers, allInvoices, suppId);
      });
    });
  },

  // نافذة إضافة مورد
  showAddSupplierModal(parentContainer) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <h2 class="modal-title">➕ إضافة مورد جديد</h2>
        <div class="form-group">
          <label class="form-label"><span class="required">*</span> اسم المورد أو الشركة:</label>
          <input type="text" id="suppNameInput" class="form-control" placeholder="مثال: أولاد حسني...">
        </div>
        <div class="form-group">
          <label class="form-label">رقم التليفون:</label>
          <input type="tel" id="suppPhoneInput" class="form-control" placeholder="01xxxxxxxxx">
        </div>
        <div class="form-group">
          <label class="form-label">تخصص المورد:</label>
          <input type="text" id="suppSpecialtyInput" class="form-control" placeholder="عفشة، مساعدين، ترصيص...">
        </div>
        <div class="form-group">
          <label class="form-label">العنوان والملاحظات:</label>
          <input type="text" id="suppAddressInput" class="form-control" placeholder="العنوان...">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="btnCancelAddSupp">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnSaveAddSupp">حفظ المورد</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnCancelAddSupp').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnSaveAddSupp').addEventListener('click', async () => {
      const name = overlay.querySelector('#suppNameInput').value.trim();
      const phone = overlay.querySelector('#suppPhoneInput').value.trim();
      const specialty = overlay.querySelector('#suppSpecialtyInput').value.trim();
      const address = overlay.querySelector('#suppAddressInput').value.trim();

      try {
        await supplierService.saveSupplier({ name, phone, specialty, address });
        toast.success('تمت إضافة المورد بنجاح');
        overlay.remove();
        this.render(parentContainer);
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  // نافذة فاتورة توريد جديدة مع بنود الشراء (Composite PK)
  showNewSupplierInvoiceModal(parentContainer, suppliers, allParts) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    let items = [{ partId: allParts[0]?.id || '', partName: allParts[0]?.name || '', unitCost: allParts[0]?.costPrice || 0, quantity: 5 }];

    const renderItemsTable = () => {
      const tbody = overlay.querySelector('#invoiceItemsBody');
      tbody.innerHTML = items.map((it, idx) => `
        <tr>
          <td>
            <select class="form-control item-part-select" data-idx="${idx}" style="min-height: 48px;">
              ${allParts.map(p => `
                <option value="${p.id}" data-name="${p.name}" data-cost="${p.costPrice}" ${it.partId === p.id ? 'selected' : ''}>
                  ${p.name}
                </option>
              `).join('')}
            </select>
          </td>
          <td>
            <input type="number" class="form-control item-cost-input" data-idx="${idx}" value="${it.unitCost}" min="0" style="min-height: 48px; width: 120px;">
          </td>
          <td>
            <input type="number" class="form-control item-qty-input" data-idx="${idx}" value="${it.quantity}" min="1" style="min-height: 48px; width: 100px;">
          </td>
          <td style="font-weight: 800; font-size: 20px; color: #38BDF8;">
            ${(it.unitCost * it.quantity).toFixed(2)} ج.م
          </td>
          <td>
            <button type="button" class="btn btn-danger btn-remove-item" data-idx="${idx}" style="padding: 6px 12px; min-height: 40px;">🗑️</button>
          </td>
        </tr>
      `).join('');

      const total = items.reduce((sum, it) => sum + (it.unitCost * it.quantity), 0);
      overlay.querySelector('#invoiceTotalDisplay').textContent = `${total.toFixed(2)} ج.م`;

      // أحداث التعديل
      tbody.querySelectorAll('.item-part-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const idx = Number(sel.getAttribute('data-idx'));
          const opt = sel.selectedOptions[0];
          items[idx].partId = opt.value;
          items[idx].partName = opt.getAttribute('data-name');
          items[idx].unitCost = Number(opt.getAttribute('data-cost')) || 0;
          renderItemsTable();
        });
      });

      tbody.querySelectorAll('.item-cost-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = Number(inp.getAttribute('data-idx'));
          items[idx].unitCost = Number(inp.value) || 0;
          renderItemsTable();
        });
      });

      tbody.querySelectorAll('.item-qty-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = Number(inp.getAttribute('data-idx'));
          items[idx].quantity = Number(inp.value) || 0;
          renderItemsTable();
        });
      });

      tbody.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-idx'));
          items.splice(idx, 1);
          renderItemsTable();
        });
      });
    };

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 850px;">
        <h2 class="modal-title">📥 تسجيل فاتورة توريد قطع غيار</h2>
        
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label"><span class="required">*</span> اختر المورد:</label>
            <select id="invSupplierSelect" class="form-control">
              ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">رقم الفاتورة الورقية (من المورد):</label>
            <input type="text" id="invNumberInput" class="form-control" placeholder="مثال: INV-9821...">
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">تاريخ الفاتورة:</label>
            <input type="date" id="invDateInput" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>

          <div class="form-group">
            <label class="form-label">ميعاد استحقاق السداد:</label>
            <input type="date" id="invDueDateInput" class="form-control" value="${new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]}">
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="font-size: 22px; font-weight: 800; color: #93C5FD;">بنود قطع الغيار المشتراة:</h3>
          <button type="button" class="btn btn-secondary" id="btnAddRowBtn" style="padding: 8px 16px; min-height: 44px;">➕ إضافة بند آخر</button>
        </div>

        <div class="table-container" style="margin-bottom: 20px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>قطعة الغيار</th>
                <th>سعر الشراء</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody id="invoiceItemsBody"></tbody>
          </table>
        </div>

        <div style="background: var(--bg-input); padding: 18px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <span style="font-size: 22px; font-weight: 800;">إجمالي مبلغ الفاتورة:</span>
          <span id="invoiceTotalDisplay" style="font-size: 32px; font-weight: 900; color: #34D399;">0 ج.م</span>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="btnCancelInvModal">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnSaveInvModal">💾 حفظ الفاتورة وتزويد المخزن</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    renderItemsTable();

    overlay.querySelector('#btnAddRowBtn').addEventListener('click', () => {
      items.push({ partId: allParts[0]?.id || '', partName: allParts[0]?.name || '', unitCost: allParts[0]?.costPrice || 0, quantity: 1 });
      renderItemsTable();
    });

    overlay.querySelector('#btnCancelInvModal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnSaveInvModal').addEventListener('click', async () => {
      const supplierId = overlay.querySelector('#invSupplierSelect').value;
      const invoiceNumber = overlay.querySelector('#invNumberInput').value.trim();
      const invoiceDate = overlay.querySelector('#invDateInput').value;
      const dueDate = overlay.querySelector('#invDueDateInput').value;

      try {
        await supplierService.createSupplierInvoice({
          supplierId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          items
        });
        toast.success('تم تسجيل فاتورة التوريد وتحديث أرصدة المخزن بنجاح');
        overlay.remove();
        this.render(parentContainer);
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  // نافذة تسجيل دفعة سداد لمورد
  showPaymentModal(parentContainer, suppliers, allInvoices, defaultSuppId = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <h2 class="modal-title">💸 تسجيل دفعة سداد لمورد</h2>

        <div class="form-group">
          <label class="form-label"><span class="required">*</span> اختر المورد:</label>
          <select id="paymentSuppSelect" class="form-control">
            ${suppliers.map(s => `<option value="${s.id}" ${defaultSuppId === s.id ? 'selected' : ''}>${s.name} (مستحق: ${s.stats.totalRemaining} ج.م)</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">ربط بفاتورة معينة (اختياري):</label>
          <select id="paymentInvoiceSelect" class="form-control">
            <option value="">بدون ربط بفاتورة محددة (سداد عام في الحساب)</option>
            ${allInvoices.filter(inv => inv.remainingAmount > 0).map(inv => `
              <option value="${inv.id}">فاتورة ${inv.invoiceNumber || inv.id} - متبقي ${inv.remainingAmount} ج.م</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label"><span class="required">*</span> مبلغ الدفعة المسدد:</label>
          <input type="number" id="paymentAmountInput" class="form-control" placeholder="المبلغ بالجنيه..." min="1" style="font-size: 26px; font-weight: 800; color: #34D399;">
        </div>

        <div class="form-group">
          <label class="form-label">طريقة السداد:</label>
          <select id="paymentMethodSelect" class="form-control">
            <option value="cash">نقدي (كاش)</option>
            <option value="vodafone">فودافون كاش</option>
            <option value="instapay">إنستا باي / تحويل بنكي</option>
          </select>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="btnCancelPayModal">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnConfirmPayModal">تأكيد سداد الدفعة</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnCancelPayModal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnConfirmPayModal').addEventListener('click', async () => {
      const supplierId = overlay.querySelector('#paymentSuppSelect').value;
      const supplierInvoiceId = overlay.querySelector('#paymentInvoiceSelect').value || null;
      const amount = Number(overlay.querySelector('#paymentAmountInput').value) || 0;
      const paymentMethod = overlay.querySelector('#paymentMethodSelect').value;

      try {
        await supplierService.recordSupplierPayment({
          supplierId,
          supplierInvoiceId,
          amount,
          paymentMethod
        });
        toast.success(`تم تسجيل سداد مبلغ ${amount} ج.م للمورد بنجاح`);
        overlay.remove();
        this.render(parentContainer);
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
