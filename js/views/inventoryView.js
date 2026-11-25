/**
 * شاشة إدارة المخزن وقطع الغيار والمشتريات
 * مصممة على طراز واجهة الكاشير السريعة لإضافة وتوريد قطع الغيار فورياً
 * تنظيم بروفايل القطع باسمها فقط تحت نوع وماركة السيارة مع بيانات المورد وتاريخ وسعر الشراء
 */

import { inventoryService } from '../services/inventoryService.js';
import { db } from '../db/indexeddb.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';

export const inventoryView = {
  async render(container) {
    const [parts, suppliers] = await Promise.all([
      inventoryService.getAllPartsWithStock(),
      db.getAll('suppliers')
    ]);

    const lowStockParts = parts.filter(p => p.isLowStock);
    const todayDate = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="inventory-screen">
        <!-- شريط العنوان والملخص العلوي -->
        <div style="background: var(--bg-surface); border: 2px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 26px; font-weight: 900; color: #FFFFFF; margin: 0 0 4px 0;">
              📦 إدارة المخزن وقطع الغيار
            </h1>
            <div style="font-size: 15px; color: var(--text-muted);">
              إجمالي الأصناف بالمخزن: <strong>${parts.length} صنف</strong>
              ${lowStockParts.length > 0 ? ` | <span style="color: #F87171; font-weight: 800;">⚠️ ${lowStockParts.length} أصناف أوشكت على النفاد</span>` : ''}
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary" id="btnDirectSale" style="font-size: 16px; padding: 8px 16px; min-height: 44px;">
              🛍️ بيع قطع غيار مباشر للزبون
            </button>
            <button type="button" class="btn btn-primary" id="btnScrollToProcure" style="font-size: 16px; padding: 8px 16px; min-height: 44px; background: #059669; border-color: #10B981;">
              ➕ توريد / إضافة صنف جديد
            </button>
          </div>
        </div>

        <!-- =================== بطاقة التوريد والإضافة السريعة (مثل واجهة الكاشير) =================== -->
        <div class="card" id="procurePartCard" style="border: 2px solid #10B981; background: #13243B; padding: 16px; margin-bottom: 20px;">
          <h2 class="card-title" style="font-size: 20px; margin-bottom: 14px; color: #34D399;">
            <span>📥</span>
            <span>لوحة توريد وإضافة قطع الغيار الجديدة للمخزن</span>
          </h2>

          <form id="procurePartForm">
            <!-- الصف الأول: اسم القطعة فقط + ماركة وموديل العربية -->
            <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <div>
                <label class="form-label" for="posPartName" style="font-size: 14px;">
                  <span class="required">*</span> اسم قطعة الغيار فقط:
                </label>
                <input 
                  type="text" 
                  id="posPartName" 
                  class="form-control" 
                  placeholder="مثال: مساعد أمامي، تيل فرامل، طنبورة، مقص..." 
                  required
                  style="font-size: 16px; height: 44px; font-weight: 800;"
                >
              </div>

              <div>
                <label class="form-label" for="posCarBrand" style="font-size: 14px;">
                  ماركة السيارة:
                </label>
                <input 
                  type="text" 
                  id="posCarBrand" 
                  class="form-control" 
                  placeholder="هيونداي، تويوتا، كيا، نيسان..." 
                  value="هيونداي"
                  list="brandsDataList"
                  style="font-size: 15px; height: 44px;"
                >
                <datalist id="brandsDataList">
                  <option value="هيونداي">
                  <option value="تويوتا">
                  <option value="كيا">
                  <option value="نيسان">
                  <option value="شيفورليه">
                  <option value="ميتسوبيشي">
                  <option value="رينو">
                  <option value="عام لكافة السيارات">
                </datalist>
              </div>

              <div>
                <label class="form-label" for="posCarModel" style="font-size: 14px;">
                  موديل / فئة السيارة:
                </label>
                <input 
                  type="text" 
                  id="posCarModel" 
                  class="form-control" 
                  placeholder="النترا، كورولا، سيراتو، صني..." 
                  value="النترا"
                  style="font-size: 15px; height: 44px;"
                >
              </div>
            </div>

            <!-- الصف الثاني: المورد + تاريخ الشراء + الكمية -->
            <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <div>
                <label class="form-label" for="posSupplierSelect" style="font-size: 14px;">
                  اسم المورد:
                </label>
                <div style="display: flex; gap: 6px;">
                  <select id="posSupplierSelect" class="form-control" style="font-size: 15px; height: 44px; flex: 1;">
                    <option value="">-- اختر مورد مسجل أو اكتب بالأسفل --</option>
                    ${suppliers.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name} (${s.specialty || ''})</option>`).join('')}
                  </select>
                  <input type="text" id="posSupplierCustomName" class="form-control" placeholder="أو اكتب مورد جديد..." style="font-size: 14px; height: 44px; flex: 1;">
                </div>
              </div>

              <div>
                <label class="form-label" for="posPurchaseDate" style="font-size: 14px;">
                  تاريخ الشراء / التوريد:
                </label>
                <input 
                  type="date" 
                  id="posPurchaseDate" 
                  class="form-control" 
                  value="${todayDate}"
                  style="font-size: 15px; height: 44px;"
                >
              </div>

              <div>
                <label class="form-label" for="posQuantity" style="font-size: 14px;">
                  <span class="required">*</span> الكمية المشتراة (العدد):
                </label>
                <input 
                  type="number" 
                  id="posQuantity" 
                  class="form-control" 
                  value="5" 
                  min="1"
                  required
                  style="font-size: 18px; font-weight: 800; height: 44px; text-align: center;"
                >
              </div>
            </div>

            <!-- الصف الثالث: سعر الشراء + سعر البيع + حد التنبيه + زر الإضافة -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1.3fr; gap: 12px; align-items: end;">
              <div>
                <label class="form-label" for="posCostPrice" style="font-size: 14px;">
                  <span class="required">*</span> سعر الشراء (التكلفة):
                </label>
                <input 
                  type="number" 
                  id="posCostPrice" 
                  class="form-control" 
                  value="150" 
                  min="0"
                  required
                  style="font-size: 18px; font-weight: 800; height: 44px; text-align: center; color: #FCD34D;"
                >
              </div>

              <div>
                <label class="form-label" for="posSellPrice" style="font-size: 14px;">
                  <span class="required">*</span> سعر البيع للزبون:
                </label>
                <input 
                  type="number" 
                  id="posSellPrice" 
                  class="form-control" 
                  value="220" 
                  min="0"
                  required
                  style="font-size: 18px; font-weight: 800; height: 44px; text-align: center; color: #34D399;"
                >
              </div>

              <div>
                <label class="form-label" for="posMinStock" style="font-size: 14px;">
                  حد التنبيه للنواقص:
                </label>
                <input 
                  type="number" 
                  id="posMinStock" 
                  class="form-control" 
                  value="3" 
                  min="1"
                  style="font-size: 16px; font-weight: 800; height: 44px; text-align: center;"
                >
              </div>

              <div>
                <button type="submit" class="btn btn-success" id="btnSubmitProcure" style="width: 100%; height: 44px; font-size: 18px; font-weight: 900; justify-content: center; gap: 8px;">
                  <span>📥</span>
                  <span>تسجيل وتوريد للمخزن فوراً</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        <!-- =================== بروفايل قطع الغيار واستعراض المخزون =================== -->
        <div class="card" style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <h2 class="card-title" style="font-size: 20px; margin: 0;">
              <span>📋</span>
              <span>بروفايل قطع الغيار والأرصدة الحالية</span>
            </h2>

            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn btn-secondary filter-btn active" data-filter="all" style="font-size: 13px; padding: 4px 12px; min-height: 32px;">
                الكل (${parts.length})
              </button>
              <button type="button" class="btn btn-danger filter-btn" data-filter="lowStock" style="font-size: 13px; padding: 4px 12px; min-height: 32px;">
                ⚠️ النواقص (${lowStockParts.length})
              </button>
            </div>
          </div>

          <!-- شريط البحث السريع والفلترة -->
          <div class="search-bar-container" style="margin-bottom: 14px;">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input 
                type="text" 
                id="searchPartsInput" 
                class="form-control" 
                placeholder="ابحث باسم قطعة الغيار، أو ماركة السيارة، أو اسم المورد..."
                style="height: 48px; font-size: 16px; padding-right: 48px;"
              >
            </div>
          </div>

          <!-- جدول بروفايل قطع الغيار -->
          <div class="table-container">
            <table class="data-table" id="partsTable">
              <thead>
                <tr>
                  <th>كود القطعة</th>
                  <th>اسم قطعة الغيار</th>
                  <th>السيارة المتوافقة</th>
                  <th>سعر الشراء</th>
                  <th>سعر البيع</th>
                  <th>المورد المسجل</th>
                  <th>تاريخ الشراء</th>
                  <th>الرصيد المتاح</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody id="partsTableBody">
                <!-- يملأ بالجافاسكربت -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.renderPartsRows(container, parts);
    this.attachEvents(container, parts, suppliers);
  },

  renderPartsRows(container, list) {
    const tbody = container.querySelector('#partsTableBody');
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 18px;">
            لا توجد أصناف تطابق البحث أو الفلتر.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const isLow = p.currentStock <= (Number(p.minStockLevel) || 3);
      const isOut = p.currentStock <= 0;

      let badgeClass = 'badge-success';
      let badgeText = `${p.currentStock} قطعة`;

      if (isOut) {
        badgeClass = 'badge-danger';
        badgeText = 'نفد من المخزن (0)';
      } else if (isLow) {
        badgeClass = 'badge-warning';
        badgeText = `ناقص (${p.currentStock})`;
      }

      return `
        <tr data-part-id="${p.id}">
          <td style="font-family: monospace; font-size: 13px; font-weight: 700; color: #93C5FD;">${p.id}</td>
          <td>
            <strong style="font-size: 17px; color: #FFFFFF;">${p.name}</strong>
          </td>
          <td>
            <span style="font-size: 14px; color: #E2E8F0;">${p.carBrand || 'عام'} - ${p.carModel || 'كافة الموديلات'}</span>
          </td>
          <td style="color: #FCD34D; font-weight: 700;">${p.costPrice || 0} ج.م</td>
          <td style="color: #34D399; font-weight: 800;">${p.sellPrice || 0} ج.م</td>
          <td style="font-size: 13px; color: #CBD5E1;">${p.supplierName || 'مورد عام'}</td>
          <td style="font-size: 12px; color: #94A3B8;">${p.purchaseDate || p.createdAt?.split('T')[0] || '-'}</td>
          <td>
            <span class="badge ${badgeClass}" style="font-size: 13px; padding: 4px 8px;">${badgeText}</span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-icon-only btn-restock-part" data-id="${p.id}" data-name="${p.name}" title="توريد كمية إضافية للقطعة" style="width: 32px; height: 32px; font-size: 14px;">➕</button>
              <button type="button" class="btn btn-secondary btn-icon-only btn-edit-part" data-id="${p.id}" title="تعديل بيانات القطعة" style="width: 32px; height: 32px; font-size: 14px;">✏️</button>
              <button type="button" class="btn btn-danger btn-icon-only btn-delete-part" data-id="${p.id}" data-name="${p.name}" title="حذف القطعة" style="width: 32px; height: 32px; font-size: 14px;">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.attachRowEvents(container, list);
  },

  attachEvents(container, allParts, suppliers) {
    // 1. البحث السريع الفوري
    const searchInput = container.querySelector('#searchPartsInput');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allParts.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.carBrand && p.carBrand.toLowerCase().includes(q)) ||
        (p.carModel && p.carModel.toLowerCase().includes(q)) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q))
      );
      this.renderPartsRows(container, filtered);
    });

    // 2. أزرار الفلترة (الكل / النواقص)
    const filterBtns = container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filterType = btn.getAttribute('data-filter');

        if (filterType === 'lowStock') {
          const lows = allParts.filter(p => p.isLowStock);
          this.renderPartsRows(container, lows);
        } else {
          this.renderPartsRows(container, allParts);
        }
      });
    });

    // 3. زر التمرير السريع لنموذج التوريد
    const btnScroll = container.querySelector('#btnScrollToProcure');
    if (btnScroll) {
      btnScroll.addEventListener('click', () => {
        container.querySelector('#posPartName').focus();
        container.querySelector('#procurePartCard').scrollIntoView({ behavior: 'smooth' });
      });
    }

    // 4. زر بيع قطع غيار مباشر
    const btnDirectSale = container.querySelector('#btnDirectSale');
    if (btnDirectSale) {
      btnDirectSale.addEventListener('click', () => {
        this.showDirectSaleModal(allParts, container);
      });
    }

    // 5. نموذج توريد قطعة غيار جديدة
    const form = container.querySelector('#procurePartForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = container.querySelector('#posPartName').value.trim();
      const carBrand = container.querySelector('#posCarBrand').value.trim();
      const carModel = container.querySelector('#posCarModel').value.trim();
      
      const supplierSelect = container.querySelector('#posSupplierSelect');
      const supplierCustomInput = container.querySelector('#posSupplierCustomName');
      
      let supplierId = supplierSelect.value;
      let supplierName = '';
      if (supplierCustomInput.value.trim()) {
        supplierName = supplierCustomInput.value.trim();
        supplierId = null;
      } else if (supplierSelect.selectedOptions[0]) {
        supplierName = supplierSelect.selectedOptions[0].getAttribute('data-name') || '';
      }

      const purchaseDate = container.querySelector('#posPurchaseDate').value;
      const quantity = Number(container.querySelector('#posQuantity').value) || 1;
      const costPrice = Number(container.querySelector('#posCostPrice').value) || 0;
      const sellPrice = Number(container.querySelector('#posSellPrice').value) || 0;
      const minStockLevel = Number(container.querySelector('#posMinStock').value) || 3;

      if (!name) {
        toast.warning('يرجى كتابة اسم قطعة الغيار');
        return;
      }

      try {
        await inventoryService.procurePart({
          name,
          carBrand,
          carModel,
          supplierId,
          supplierName,
          purchaseDate,
          quantity,
          costPrice,
          sellPrice,
          minStockLevel
        });

        toast.success(`تم توريد ${quantity} من قطعة (${name}) إلى المخزن بنجاح ✅`);
        form.reset();
        container.querySelector('#posPurchaseDate').value = new Date().toISOString().split('T')[0];
        container.querySelector('#posQuantity').value = 5;
        container.querySelector('#posCarBrand').value = 'هيونداي';
        container.querySelector('#posCarModel').value = 'النترا';

        // إعادة تحميل الواجهة
        this.render(container);
      } catch (err) {
        toast.danger('حدث خطأ أثناء حفظ القطعة: ' + err.message);
      }
    });
  },

  attachRowEvents(container, currentList) {
    // توريد كمية إضافية سريعة لقطعة مسجلة
    container.querySelectorAll('.btn-restock-part').forEach(btn => {
      btn.addEventListener('click', async () => {
        const partId = btn.getAttribute('data-id');
        const partName = btn.getAttribute('data-name');
        const part = currentList.find(p => p.id === partId);

        const qtyStr = prompt(`كمية التوريد الإضافية لقطعة (${partName}):`, '5');
        if (!qtyStr) return;
        const qty = Number(qtyStr);
        if (isNaN(qty) || qty <= 0) {
          toast.warning('كمية غير صحيحة');
          return;
        }

        try {
          await inventoryService.procurePart({
            partId: part.id,
            name: part.name,
            carBrand: part.carBrand,
            carModel: part.carModel,
            supplierId: part.supplierId,
            supplierName: part.supplierName,
            quantity: qty,
            costPrice: part.costPrice,
            sellPrice: part.sellPrice
          });
          toast.success(`تم إضافة ${qty} قطعة إلى رصيد (${partName}) بنجاح ✅`);
          this.render(container);
        } catch (err) {
          toast.danger(err.message);
        }
      });
    });

    // تعديل بيانات القطعة
    container.querySelectorAll('.btn-edit-part').forEach(btn => {
      btn.addEventListener('click', () => {
        const partId = btn.getAttribute('data-id');
        const part = currentList.find(p => p.id === partId);
        if (part) {
          container.querySelector('#posPartName').value = part.name;
          container.querySelector('#posCarBrand').value = part.carBrand || '';
          container.querySelector('#posCarModel').value = part.carModel || '';
          container.querySelector('#posCostPrice').value = part.costPrice || 0;
          container.querySelector('#posSellPrice').value = part.sellPrice || 0;
          container.querySelector('#posMinStock').value = part.minStockLevel || 3;
          container.querySelector('#posPartName').focus();
          container.querySelector('#procurePartCard').scrollIntoView({ behavior: 'smooth' });
          toast.info(`تم تحميل بيانات (${part.name}) في نموذج التوريد للتعديل أو زيادة الرصيد`);
        }
      });
    });

    // حذف القطعة
    container.querySelectorAll('.btn-delete-part').forEach(btn => {
      btn.addEventListener('click', async () => {
        const partId = btn.getAttribute('data-id');
        const partName = btn.getAttribute('data-name');

        const confirmed = await modal.confirm({
          title: 'حذف قطعة غيار',
          message: `هل أنت متأكد من حذف (${partName}) نهائياً من المخزن؟ لا يمكن التراجع إذا كانت هناك حركات مسجلة.`,
          confirmText: 'نعم، احذف',
          type: 'danger'
        });

        if (confirmed) {
          try {
            await inventoryService.deletePart(partId);
            toast.success(`تم حذف القطعة (${partName}) بنجاح`);
            this.render(container);
          } catch (err) {
            toast.warning(err.message);
          }
        }
      });
    });
  },

  showDirectSaleModal(parts, parentContainer) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 500px; padding: 24px;">
        <h2 style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin-bottom: 14px;">🛍️ بيع قطع غيار مباشر للزبون</h2>

        <form id="directSaleForm">
          <div class="form-group">
            <label class="form-label">اختر قطعة الغيار:</label>
            <select id="directPartSelect" class="form-control" required style="height: 44px; font-size: 15px;">
              <option value="">-- اضغط لاختيار القطعة --</option>
              ${parts.filter(p => p.currentStock > 0).map(p => `
                <option value="${p.id}" data-price="${p.sellPrice}" data-stock="${p.currentStock}">
                  ${p.name} (${p.carBrand || ''}) - السعر: ${p.sellPrice} ج.م (المتاح: ${p.currentStock})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">الكمية المباعة:</label>
              <input type="number" id="directQty" class="form-control" value="1" min="1" required style="height: 44px; font-size: 18px; text-align: center;">
            </div>
            <div class="form-group">
              <label class="form-label">سعر بيع القطعة:</label>
              <input type="number" id="directPrice" class="form-control" value="0" min="0" required style="height: 44px; font-size: 18px; text-align: center; color: #34D399;">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">اسم المشتري (اختياري):</label>
            <input type="text" id="directBuyerName" class="form-control" placeholder="اسم الزبون..." style="height: 40px;">
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 16px; display: flex; justify-content: space-between;">
            <span>المبلغ الإجمالي المستحق:</span>
            <strong id="directTotalDisplay" style="color: #38BDF8; font-size: 20px;">0 ج.م</strong>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <button type="button" class="btn btn-secondary" id="btnCancelDirectSale">إلغاء</button>
            <button type="submit" class="btn btn-success" id="btnConfirmDirectSale">تأكيد البيع وخصم الرصيد</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const partSelect = overlay.querySelector('#directPartSelect');
    const qtyInput = overlay.querySelector('#directQty');
    const priceInput = overlay.querySelector('#directPrice');
    const totalDisplay = overlay.querySelector('#directTotalDisplay');

    const updateTotal = () => {
      const q = Number(qtyInput.value) || 1;
      const p = Number(priceInput.value) || 0;
      totalDisplay.textContent = `${q * p} ج.م`;
    };

    partSelect.addEventListener('change', () => {
      const opt = partSelect.selectedOptions[0];
      if (opt && opt.value) {
        priceInput.value = opt.getAttribute('data-price') || 0;
      }
      updateTotal();
    });

    qtyInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);

    overlay.querySelector('#btnCancelDirectSale').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('#directSaleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const partId = partSelect.value;
      const qty = Number(qtyInput.value) || 1;
      const price = Number(priceInput.value) || 0;
      const buyer = overlay.querySelector('#directBuyerName').value.trim();

      const opt = partSelect.selectedOptions[0];
      const maxStock = Number(opt.getAttribute('data-stock')) || 0;
      if (qty > maxStock) {
        toast.warning(`الكمية المطلوبة (${qty}) أكبر من المتاح بالمخزن (${maxStock})`);
        return;
      }

      try {
        await inventoryService.recordPartSale({
          partId,
          quantity: qty,
          unitPrice: price,
          saleType: 'direct_sale',
          customerId: null
        });

        toast.success(`تم تسجيل البيع المباشر بقيمة ${qty * price} ج.م بنجاح ✅`);
        overlay.remove();
        this.render(parentContainer);
      } catch (err) {
        toast.danger(err.message);
      }
    });
  }
};
