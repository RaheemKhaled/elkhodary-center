/**
 * واجهة الكاشير المخصصة (Cashier POS Interface)
 * مخصصة لمحاسبة الزبائن وإدخال البيانات وإصدار الفواتير بسرعة فائقة وبدون تعقيد.
 * تصميم مبسط: عمودين فقط - اليمين للبيانات، اليسار للحساب.
 */

import { db } from '../db/indexeddb.js';
import { customerService } from '../services/customerService.js';
import { inventoryService } from '../services/inventoryService.js';
import { invoiceService } from '../services/invoiceService.js';
import { financeService } from '../services/financeService.js';
import { showExpenseModal } from '../components/financeModals.js';
import { authService } from '../services/authService.js';
import { EgyptianPlatePicker } from '../components/platePicker.js?v=21';
import { toast } from '../components/toast.js';


export const cashierView = {
  async render(container, params = {}) {
    const [servicesList, partsList, workersList] = await Promise.all([
      db.find('services', s => s.isActive !== false),
      inventoryService.getAllPartsWithStock(),
      db.find('workers', w => w.isActive !== false)
    ]);

    // اقتراحات الكتابة: الماركات والموديلات والشكاوي وأعمال العفشة اللي اتسجلت قبل كده (بتتعلم لوحدها)
    this.suggest = await this.buildSuggestions();

    // أسعار الخدمات السريعة من الإعدادات (قائمة الخدمات)
    const byId = Object.fromEntries(servicesList.map(x => [x.id, x]));
    const price = (id, def) => Number(byId[id]?.defaultPrice ?? def) || def;
    this.quick = {
      front: { name: byId['QS-ALIGN-FRONT']?.name || 'ضبط زوايا أمامي', price: price('QS-ALIGN-FRONT', 120) },
      rear: { name: byId['QS-ALIGN-REAR']?.name || 'ضبط زوايا خلفي', price: price('QS-ALIGN-REAR', 100) },
      full: { name: byId['QS-ALIGN-FULL']?.name || 'ضبط زوايا كامل (أمامي وخلفي)', price: price('QS-ALIGN-FULL', 200) },
      mount: { name: byId['QS-TIRE-MOUNT']?.name || 'تركيب كاوتش', price: price('QS-TIRE-MOUNT', 25) },
      patch: { name: byId['QS-TIRE-PATCH']?.name || 'لحام كاوتش', price: price('QS-TIRE-PATCH', 45) },
      balancing: servicesList.filter(x => x.quickGroup === 'balancing').sort((a, b) => (a.quickOrder || 9) - (b.quickOrder || 9))
    };
    if (!this.quick.balancing.length) {
      this.quick.balancing = [{ id: 'QS-BAL-NORMAL', name: 'ترصيص عادي', defaultPrice: 35 }];
    }
    // باقي الخدمات المسجلة في الإعدادات بتظهر كأزرار في الكاشير
    this.catalogServices = servicesList.filter(x => !x.quickGroup);

    this.currentData = {
      invoiceDate: this.todayLocal(),
      customer: { id: null, name: '', phone: '' },
      car: { id: null, brand: '', model: '', plateLetters: '', plateNumbers: '', plateFull: '', plateType: 'private' },
      carProblem: '',
      nextService: '',
      suspensionNote: '',
      services: [],
      parts: [],
      workers: [],
      discountValue: 0,
      cashAmount: 0,
      vodafoneCashAmount: 0,
      instaPayAmount: 0
    };

    container.innerHTML = `
      <div class="cashier-screen" style="display:flex;flex-direction:column;height:100%;gap:0;">

        <!-- شريط أدوات الكاشير العلوي -->
        <div style="background:var(--bg-surface);border-bottom:1px solid var(--border-color);padding:10px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#60A5FA;">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span style="font-size:18px;font-weight:700;color:var(--text-primary);">نقطة البيع والتسجيل</span>
            </div>
            <!-- زر سجل وبحث الفواتير السابقة -->
            <button type="button" class="btn btn-primary" id="btnOpenInvoicesLog" style="font-size:13.5px;font-weight:800;padding:6px 14px;min-height:36px;background:linear-gradient(135deg, #2563EB, #1D4ED8);display:flex;align-items:center;gap:6px;border:1px solid #60A5FA;">
              <span>📋</span>
              <span>سجل الفواتير (F3)</span>
              <span id="cashierInvoicesCountBadge" class="badge" style="background:#0F172A;color:#93C5FD;padding:2px 7px;font-size:12px;border-radius:10px;">0</span>
            </button>
            <!-- تسجيل مصروف -->
            <button type="button" class="btn btn-danger" id="btnOpenExpense" style="font-size:13.5px;font-weight:800;padding:6px 14px;min-height:36px;display:flex;align-items:center;gap:6px;">
              <span>💸</span><span>تسجيل مصروف</span>
            </button>
            <!-- زر سجل العميل برقم التليفون -->
            <button type="button" class="btn btn-primary" id="btnOpenCustomerHistory" style="font-size:13.5px;font-weight:800;padding:6px 14px;min-height:36px;background:linear-gradient(135deg, #059669, #047857);display:flex;align-items:center;gap:6px;border:1px solid #34D399;">
              <span>🔎</span>
              <span>سجل عميل بالتليفون (F4)</span>
            </button>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary" id="btnResetCashierForm" style="font-size:14px;padding:6px 14px;min-height:36px;">
              ➕ تذكرة جديدة
            </button>
            <button type="button" class="btn btn-secondary" id="btnSwitchToManager" style="font-size:14px;padding:6px 14px;min-height:36px;">
              ${authService.isManager() ? '👑 لوحة المدير' : '🚪 تسجيل الخروج'}
            </button>
          </div>
        </div>

        <!-- شريط تنبيه آخر فاتورة تم حفظها (يظهر تلقائياً ويثبت الفاتورة فوراً للوصول السريع) -->
        <div id="cashierLastSavedBar" style="display:none;background:#064E3B;border:1.5px solid #10B981;padding:8px 16px;margin:8px 16px 0;border-radius:8px;justify-content:space-between;align-items:center;flex-shrink:0;">
          <div id="cashierLastSavedText" style="flex:1;min-width:0;color:#D1FAE5;font-weight:800;font-size:14px;"></div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button type="button" class="btn btn-primary" id="btnOpenLastInvoicePdf" style="font-size:13px;font-weight:800;padding:4px 14px;min-height:32px;background:#10B981;border:none;white-space:nowrap;">
              📄 فتح الفاتورة PDF
            </button>
            <button type="button" class="btn btn-secondary" id="btnPrintLastInvoicePrint" style="font-size:13px;padding:4px 12px;min-height:32px;white-space:nowrap;">
              🖨️ طباعة
            </button>
            <button type="button" class="btn btn-secondary" id="btnThermalLastInvoice" style="font-size:13px;padding:4px 12px;min-height:32px;white-space:nowrap;">
              🧾 بون حراري
            </button>
            <button type="button" class="btn btn-secondary" id="btnWhatsAppLastInvoice" style="font-size:13px;padding:4px 12px;min-height:32px;white-space:nowrap;">
              📱 واتساب
            </button>
          </div>
        </div>

        <!-- الشبكة الرئيسية: إدخال البيانات الموحد -->
        <div style="display:flex;flex-direction:column;gap:12px;padding:12px 16px;flex:1;overflow-y:auto;min-height:0;max-width:1100px;margin:0 auto;width:100%;">

          <!-- 1. بيانات العميل والسيارة -->
          <div class="card" style="padding:14px;flex-shrink:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <h2 class="card-title" style="font-size:15px;margin:0;display:flex;align-items:center;gap:6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#60A5FA;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>بيانات العميل والسيارة</span>
              </h2>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div id="cashierFoundCustomerBadge" class="badge badge-success" style="display:none;font-size:12px;padding:3px 8px;"></div>
                <label for="cashierInvoiceDate" style="display:flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:700;color:var(--text-secondary);">
                  📅 تاريخ الفاتورة:
                  <input type="date" id="cashierInvoiceDate" class="form-control" value="${this.currentData.invoiceDate}" max="${this.currentData.invoiceDate}"
                    title="بيتحط تاريخ النهارده تلقائياً، غيّره لو بتدخل فاتورة قديمة"
                    style="height:34px;min-height:34px;width:150px;font-size:14px;font-weight:700;padding:0 8px;direction:ltr;">
                </label>
                <span id="cashierBackdateBadge" class="badge" style="display:none;font-size:12px;padding:3px 8px;background:rgba(245,158,11,0.18);color:#FCD34D;border:1px solid #F59E0B;">⚠️ فاتورة بتاريخ قديم</span>
              </div>
            </div>

            <div id="cashierCarChooser" style="display:none;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;"></div>
            <div style="display:grid;grid-template-columns:1.2fr 1.2fr 1fr 1fr;gap:10px;margin-bottom:10px;">
              <div style="position:relative;">
                <label class="form-label" for="cashierPhoneInput" style="font-size:13px;margin-bottom:3px;"><span class="required">*</span> رقم التليفون:</label>
                <input type="tel" id="cashierPhoneInput" class="form-control" placeholder="01xxxxxxxxx" maxlength="11" autocomplete="off" style="font-size:18px;font-weight:700;min-height:40px;direction:ltr;text-align:right;">
                <div id="customerSuggestionsDropdown" style="display:none;position:absolute;top:100%;right:0;left:0;background:var(--bg-surface-elevated);border:2px solid #3B82F6;border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:500;max-height:220px;overflow-y:auto;margin-top:3px;"></div>
              </div>
              <div>
                <label class="form-label" for="cashierNameInput" style="font-size:13px;margin-bottom:3px;"><span class="required">*</span> اسم العميل:</label>
                <input type="text" id="cashierNameInput" class="form-control" placeholder="اسم العميل..." autocomplete="off" style="font-size:15px;min-height:40px;">
              </div>
              <div>
                <label class="form-label" for="cashierCarBrand" style="font-size:13px;margin-bottom:3px;">ماركة العربية:</label>
                <input type="text" id="cashierCarBrand" class="form-control" list="dlCarBrands" autocomplete="off" placeholder="اكتب أو اختار الماركة..." style="min-height:40px;font-size:14px;">
              </div>
              <div>
                <label class="form-label" for="cashierCarModel" style="font-size:13px;margin-bottom:3px;">الموديل:</label>
                <input type="text" id="cashierCarModel" class="form-control" list="dlCarModels" autocomplete="off" placeholder="اكتب أو اختار الموديل..." style="min-height:40px;font-size:14px;">
              </div>
            </div>

            <!-- مشكلة + الصيانة القادمة -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
              <div>
                <label class="form-label" for="cashierCarProblem" style="font-size:13px;margin-bottom:3px;color:var(--text-secondary);">شكوى العميل / المشكلة:</label>
                <input type="text" id="cashierCarProblem" class="form-control" list="dlProblems" autocomplete="off" placeholder="رعشة في الطارة، صوت في العفشة..." style="min-height:38px;font-size:13px;">
                ${this.suggest.topProblems.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">${this.suggest.topProblems.map(t => `<button type="button" class="btn btn-secondary quick-problem" data-text="${t.replace(/"/g, '&quot;')}" style="font-size:11.5px;min-height:26px;height:26px;padding:0 8px;border-radius:13px;">${t}</button>`).join('')}</div>` : ''}
              </div>
              <div>
                <label class="form-label" for="cashierNextService" style="font-size:13px;margin-bottom:3px;color:var(--text-secondary);">توصية الصيانة القادمة:</label>
                <input type="text" id="cashierNextService" class="form-control" list="dlNextService" autocomplete="off" placeholder="تغيير تيل بعد 5000 كم..." style="min-height:38px;font-size:13px;">
              </div>
            </div>

            <!-- منتقي اللوحة المصرية -->
            <div>
              <label class="form-label" style="font-size:13px;margin-bottom:4px;color:var(--text-secondary);">رقم اللوحة المرورية:</label>
              <div id="cashierPlateMount"></div>
            </div>
          </div>

          <!-- 2. الخدمات وقطع الغيار المدمجة -->
          <div class="pos-services-compact-grid">
            
            <!-- الصف العلوي (3 بطاقات: ضبط الزوايا - الترصيص - الكاوتش) -->
            <div class="pos-services-row-top">
              
              <!-- بطاقة 1: ضبط الزوايا -->
              <div class="pos-card pos-card-alignment">
                <div class="pos-card-header">
                  <div class="pos-title-group">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                    <span>ضبط الزوايا</span>
                  </div>
                </div>
                <div class="pos-tile-group">
                  <div class="pos-tile-btn" id="tileAlignFront" data-type="front" title="اضغط للتحديد">
                    <span class="tile-label">أمامي</span>
                    <span class="tile-price">${this.quick.front.price} ج</span>
                  </div>
                  <div class="pos-tile-btn" id="tileAlignRear" data-type="rear" title="اضغط للتحديد">
                    <span class="tile-label">خلفي</span>
                    <span class="tile-price">${this.quick.rear.price} ج</span>
                  </div>
                  <div class="pos-tile-btn" id="tileAlignFull" data-type="full" title="اضغط للتحديد">
                    <span class="tile-label">كامل</span>
                    <span class="tile-price">${this.quick.full.price} ج</span>
                  </div>
                </div>
              </div>

              <!-- بطاقة 2: الترصيص -->
              <div class="pos-card pos-card-balancing">
                <div class="pos-card-header">
                  <div class="pos-title-group">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>الترصيص</span>
                  </div>
                </div>
                <div style="display:flex;gap:4px;align-items:center;">
                  <select id="cashierBalancingType" class="form-control" style="flex:1;height:38px;font-size:12.5px;padding:2px 4px;min-width:0;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                    ${this.quick.balancing.map(b => `<option value="${b.defaultPrice}" data-name="${b.name}">${String(b.name).replace(/^ترصيص\s*/, '') || b.name} (${b.defaultPrice} ج/فردة)</option>`).join('')}
                  </select>
                  <select id="cashierBalancingQty" class="form-control" style="width:70px;height:38px;font-size:12.5px;padding:2px 2px;text-align:center;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                    <option value="4" selected>4 فرد</option>
                    <option value="1">1 فردة</option>
                    <option value="2">2 فردة</option>
                    <option value="3">3 فردة</option>
                    <option value="5">5 فرد</option>
                    <option value="6">6 فرد</option>
                  </select>
                  <button type="button" class="btn btn-secondary" id="btnPosAddBalancing"
                    style="font-size:13px;font-weight:600;height:38px;padding:0 12px;border-radius:6px;white-space:nowrap;">
                    إدراج
                  </button>
                </div>
              </div>

              <!-- بطاقة 3: الكاوتش -->
              <div class="pos-card pos-card-tires">
                <div class="pos-card-header">
                  <div class="pos-title-group">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                    <span>الكاوتش (تركيب ${this.quick.mount.price} / لحام ${this.quick.patch.price} ج للفردة)</span>
                  </div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                  <div style="display:flex;gap:3px;align-items:center;flex:1;">
                    <button type="button" class="btn btn-secondary" id="btnPosAddTireMount"
                      style="font-size:13px;font-weight:600;height:38px;padding:0 8px;border-radius:6px;flex:1;white-space:nowrap;">
                      تركيب
                    </button>
                    <select id="cashierTireMountQty" class="form-control" style="width:44px;height:38px;font-size:13px;padding:0;text-align:center;font-weight:600;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                      <option value="4" selected>4</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </div>
                  <div style="display:flex;gap:3px;align-items:center;flex:1;">
                    <button type="button" class="btn btn-secondary" id="btnPosAddTirePatch"
                      style="font-size:13px;font-weight:600;height:38px;padding:0 8px;border-radius:6px;flex:1;white-space:nowrap;">
                      لحام
                    </button>
                    <select id="cashierTirePatchQty" class="form-control" style="width:44px;height:38px;font-size:13px;padding:0;text-align:center;font-weight:600;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                      <option value="1" selected>1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            ${this.catalogServices.length ? `
            <!-- خدمات تانية من قائمة الإعدادات -->
            <div class="pos-card" style="padding:8px 10px;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:12.5px;font-weight:800;color:var(--text-secondary);">🔧 خدمات تانية:</span>
                ${this.catalogServices.map(c => `
                  <button type="button" class="btn btn-secondary btn-catalog-service" data-srv-id="${c.id}"
                    style="font-size:12.5px;font-weight:700;height:34px;padding:0 10px;border-radius:6px;white-space:nowrap;">
                    ${c.name} <span style="color:#34D399;margin-inline-start:4px;">${c.defaultPrice} ج</span>
                  </button>`).join('')}
              </div>
            </div>` : ''}

            <!-- الصف السفلي (بطاقتان: أعمال العفشة - قطع الغيار) -->
            <div class="pos-services-row-bottom">
              
              <!-- بطاقة 4: أعمال العفشة (تقديري) -->
              <div class="pos-card pos-card-suspension">
                <div class="pos-card-header">
                  <div class="pos-title-group">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    <span>أعمال العفشة (تقديري)</span>
                  </div>
                </div>
                <div style="display:flex;gap:5px;align-items:center;">
                  <input type="text" id="cashierSuspensionDesc" list="dlSuspension" autocomplete="off" class="form-control"
                    placeholder="بيان الشغل (مثال: تغيير مساعدين أمامي وجلب مقصات)"
                    style="flex:1;height:38px;font-size:12.5px;padding:0 8px;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                  <input type="number" id="cashierSuspensionLabor" class="form-control"
                    placeholder="المصنعية (ج)" min="0"
                    style="width:95px;height:38px;font-size:13px;font-weight:700;text-align:center;padding:0 4px;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                  <button type="button" class="btn btn-secondary" id="btnPosAddSuspension"
                    style="font-size:12.5px;font-weight:600;height:38px;padding:0 10px;border-radius:6px;white-space:nowrap;">
                    + إضافة للعفشة
                  </button>
                </div>
              </div>

              <!-- بطاقة 5: قطع غيار (بحث فوري بالاسم) -->
              <div class="pos-card pos-card-parts" style="position:relative;">
                <div class="pos-card-header">
                  <div class="pos-title-group">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    <span>قطع الغيار المستهلكة</span>
                  </div>
                  <button type="button" id="btnPosToggleManualPart"
                    style="background:none;border:none;color:var(--text-secondary);font-size:11px;cursor:pointer;padding:0;text-decoration:underline;">
                    صنف خارجي يدوي
                  </button>
                </div>
                <div style="display:flex;gap:4px;align-items:flex-end;">
                  <div style="position:relative;flex:1;">
                    <input type="text" id="cashierPartSearchInput" class="form-control"
                      placeholder="ابحث عن قطعة (تيل، بارات، مسمار...)" autocomplete="off"
                      style="width:100%;height:38px;font-size:12.5px;padding:0 8px;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                    <div id="cashierPartAutocompleteDropdown"
                      style="display:none;position:absolute;bottom:100%;right:0;left:0;background:var(--bg-surface-elevated);border:1px solid var(--border-color);border-radius:8px;box-shadow:var(--shadow-lg);z-index:600;max-height:200px;overflow-y:auto;margin-bottom:4px;">
                    </div>
                  </div>
                  <label style="display:flex;flex-direction:column;align-items:center;gap:1px;margin:0;">
                    <span style="font-size:10.5px;font-weight:700;color:var(--text-secondary);white-space:nowrap;">سعر القطعة (ج)</span>
                    <input type="number" id="cashierPartPriceInput" class="form-control"
                      placeholder="السعر" min="0" value="0" title="سعر القطعة الواحدة بالجنيه"
                      style="width:78px;height:38px;font-size:13px;font-weight:700;text-align:center;padding:0 2px;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                  </label>
                  <label style="display:flex;flex-direction:column;align-items:center;gap:1px;margin:0;">
                    <span style="font-size:10.5px;font-weight:700;color:var(--text-secondary);white-space:nowrap;">العدد</span>
                    <input type="number" id="cashierPartQtyInput" class="form-control"
                      placeholder="عدد" min="1" value="1" title="عدد القطع"
                      style="width:52px;height:38px;font-size:13px;font-weight:700;text-align:center;padding:0 2px;background:var(--bg-surface-elevated);border-color:var(--border-color);">
                  </label>
                  <button type="button" class="btn btn-primary" id="btnPosAddPart"
                    style="font-size:12.5px;font-weight:600;height:38px;padding:0 10px;border-radius:6px;white-space:nowrap;">
                    + إضافة
                  </button>
                </div>
              </div>

            </div>

            <!-- حاوية الخدمات وقطع الغيار المضافة للفاتورة -->
            <div class="pos-added-items-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;color:#F8FAFC;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span>الخدمات والقطع المضافة</span>
                  <span id="cashierItemsCountBadge" class="badge badge-primary" style="font-size:11px;padding:2px 6px;">0</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <button type="button" id="btnToggleCustomOtherService"
                    style="background:none;border:none;color:#94A3B8;font-size:11.5px;cursor:pointer;padding:0;text-decoration:underline;">
                    + مخرطة / خدمة أخرى
                  </button>
                  <button type="button" id="btnClearAllItems"
                    style="display:none;background:none;border:none;color:#F87171;font-size:11.5px;cursor:pointer;padding:0;text-decoration:underline;">
                    مسح الكل
                  </button>
                </div>
              </div>

              <!-- شريط إضافة خدمة مخرطة أو خدمة أخرى (ظاهر دائمًا بتنسيق كحلي واضح ومميز) -->
              <div id="customOtherServiceRow" style="display:flex;padding:8px 10px;background:#0F172A;border:1px solid #1E293B;border-radius:8px;margin-bottom:8px;gap:8px;align-items:center;">
                <input type="text" id="cashierCustomServiceName" class="form-control"
                  placeholder="بيان الخدمة (مثال: خراطة طنابير، تعديل مخرطة...)"
                  style="flex:1;height:38px;font-size:13px;padding:0 12px;background:#1E293B;border-color:#334155;color:#FFFFFF;">
                <input type="number" id="cashierCustomServicePrice" class="form-control"
                  placeholder="السعر" min="0" value="100"
                  style="width:95px;height:38px;font-size:14px;font-weight:900;text-align:center;background:#1E293B;border-color:#334155;color:#FBBF24;">
                <button type="button" class="btn btn-primary" id="btnAddCustomServiceBtn"
                  style="height:38px;font-size:13px;font-weight:900;padding:0 14px;background:#2563EB;border-color:#3B82F6;white-space:nowrap;">
                  ➕ إضافة
                </button>
              </div>

              <!-- قائمة العناصر المضافة -->
              <div id="cashierAddedItemsList" style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;">
                <div style="text-align:center;padding:12px 6px;color:var(--text-muted);font-size:12.5px;border:1px dashed var(--border-color);border-radius:6px;">
                  اختر ضبط الزوايا أو أضف الترصيص والكاوتش والعفشة والقطع من الأعلى للإدراج الفوري
                </div>
              </div>
            </div>

          </div>

          <!-- 3. الصنايعية المنفذين للصيانة -->
          <div class="card" style="padding:12px;flex-shrink:0;" id="cashierWorkersCard">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h2 class="card-title" style="font-size:15px;margin:0;">الصنايعية المنفذين للصيانة</h2>
              <span style="font-size:12px;color:var(--text-muted);">اضغط لاختيار من اشتغل في السيارة</span>
            </div>
            <div id="cashierWorkersBody">
              <div id="cashierWorkersList" style="display:flex;flex-wrap:wrap;gap:8px;">
                ${workersList.length ? workersList.map(w => `
                  <div class="choice-chip cashier-worker-chip" data-worker-id="${w.id}" data-worker-name="${w.name}"
                    style="min-height:36px;padding:4px 12px;font-size:14px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;">
                    <span class="worker-check-icon">⬜</span>
                    <strong>${w.name}</strong>
                    <small style="opacity:0.75;font-size:12px;">(${w.specialty || 'عام'})</small>
                  </div>
                `).join('') : '<div style="font-size:13px;color:var(--text-muted);">لا يوجد صنايعية مسجلين حالياً (يمكن للمدير إضافتهم من شاشة إدارة العمالة)</div>'}
              </div>
            </div>
          </div>

          <!-- 4. شريط الإجراءات السفلي (زر فتح نافذة ملخص الحساب والطباعة) -->
          <div class="card" style="padding:14px;display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);border-color:var(--border-color);position:sticky;bottom:0;z-index:20;box-shadow:var(--shadow-md);">
            <div style="display:flex;align-items:center;gap:16px;">
              <div>
                <span style="font-size:13px;color:var(--text-secondary);">إجمالي التذكرة الحالي:</span>
                <div id="cashierLiveTotalDisplay" style="font-size:24px;font-weight:800;color:#60A5FA;font-family:monospace;">0 ج.م</div>
              </div>
              <div style="font-size:13px;color:var(--text-muted);border-inline-start:1px solid var(--border-color);padding-inline-start:16px;">
                عدد الأصناف المضافة: <strong id="cashierFooterItemCount" style="color:var(--text-primary);">0</strong>
              </div>
            </div>

            <div style="display:flex;gap:10px;">
              <button type="button" class="btn btn-success" id="btnOpenCheckoutModal" style="font-size:17px;font-weight:800;padding:8px 30px;min-height:50px;gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <span>💵 تحصيل وطباعة الفاتورة (F2)</span>
              </button>
            </div>
          </div>

        </div>

        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', `
      <datalist id="dlCarBrands">${this.suggest.brands.map(b => `<option value="${b}"></option>`).join('')}</datalist>
      <datalist id="dlCarModels"></datalist>
      <datalist id="dlProblems">${this.suggest.problems.map(b => `<option value="${b}"></option>`).join('')}</datalist>
      <datalist id="dlNextService">${this.suggest.nextServices.map(b => `<option value="${b}"></option>`).join('')}</datalist>
      <datalist id="dlSuspension">${this.suggest.suspension.map(b => `<option value="${b}"></option>`).join('')}</datalist>`);

    this.initCashierComponents(container, servicesList, partsList, workersList);

    if (params && params.customerId) {
      const profile = await customerService.getCustomerFullProfile(params.customerId);
      if (profile) this.applyReturningCustomer(container, profile);
    } else if (params && params.prefillQuery) {
      const ph = container.querySelector('#cashierPhoneInput');
      ph.value = params.prefillQuery;
      ph.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },

  // الاقتراحات بتتجمع من كل العربيات والفواتير (من كل الأجهزة بعد المزامنة)
  async buildSuggestions() {
    const COMMON_BRANDS = ['هيونداي', 'كيا', 'تويوتا', 'نيسان', 'شيفروليه', 'رينو', 'بيجو', 'سكودا', 'فولكس فاجن', 'ميتسوبيشي',
      'سوزوكي', 'هوندا', 'مازدا', 'فيات', 'أوبل', 'شيري', 'إم جي', 'بي واي دي', 'جيلي', 'بروتون', 'سيات', 'مرسيدس', 'بي إم دبليو', 'جيب', 'لادا', 'دايو', 'سوبارو', 'فورد'];
    const [cars, invoices] = await Promise.all([db.getAll('cars'), db.getAll('maintenance')]);
    const byFreq = (values) => {
      const m = new Map();
      values.map(v => String(v || '').trim()).filter(v => v.length > 1).forEach(v => m.set(v, (m.get(v) || 0) + 1));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    };
    const usedBrands = byFreq(cars.map(c => c.brand));
    const models = {};
    for (const c of cars) {
      const b = String(c.brand || '').trim(), mdl = String(c.model || '').trim();
      if (!b || !mdl) continue;
      (models[b] = models[b] || new Set()).add(mdl);
    }
    const problems = byFreq(invoices.map(i => i.problem).filter(p => p && p !== 'صيانة وضبط دوري'));
    return {
      brands: [...new Set([...usedBrands, ...COMMON_BRANDS])],
      models: Object.fromEntries(Object.entries(models).map(([k, v]) => [k, [...v]])),
      problems,
      topProblems: problems.slice(0, 6),
      nextServices: byFreq(invoices.map(i => i.futureNeeds)),
      suspension: byFreq(invoices.flatMap(i => (i.services || []).filter(x => x.category === 'suspension').map(x => x.customNote || String(x.name || '').replace(/^صيانة عفشة:\s*/, ''))))
    };
  },

  refreshModelSuggestions(container) {
    const brand = container.querySelector('#cashierCarBrand')?.value.trim() || '';
    const list = container.querySelector('#dlCarModels');
    if (!list || !this.suggest) return;
    const exact = this.suggest.models[brand] || [];
    const all = exact.length ? exact : [...new Set(Object.values(this.suggest.models).flat())];
    list.innerHTML = all.map(m => `<option value="${m}"></option>`).join('');
  },

  initCashierComponents(container, servicesList, partsList, workersList) {
    // 1. منتقي اللوحة المصرية
    this.platePicker = new EgyptianPlatePicker({
      containerId: 'cashierPlateMount',
      initialLetters: '',
      initialNumbers: '',
      initialType: 'private',
      onChange: (val) => {
        this.currentData.car.plateLetters = val.letters;
        this.currentData.car.plateNumbers = val.numbers;
        this.currentData.car.plateFull = val.plateFull;
        this.currentData.car.plateType = val.plateType;
      }
    });

    // 2. البحث التلقائي للعملاء
    const phoneInput = container.querySelector('#cashierPhoneInput');
    const nameInput = container.querySelector('#cashierNameInput');
    const dropdown = container.querySelector('#customerSuggestionsDropdown');
    const badge = container.querySelector('#cashierFoundCustomerBadge');

    let debounceTimer;
    phoneInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      this.currentData.customer.phone = query;
      // الرقم اتغير: نفك ربط العميل القديم
      if (this.currentData.customer.id && invoiceService.normalizePhone(query) !== invoiceService.normalizePhone(this.lockedPhone || '')) {
        this.unlockCustomer(container);
      }
      if (query.length < 2) { dropdown.style.display = 'none'; badge.style.display = 'none'; return; }
      debounceTimer = setTimeout(async () => {
        const digits = invoiceService.normalizePhone(query);
        if (digits.length === 11) {
          const profile = await customerService.findByPhone(digits);
          if (profile) {
            this.applyReturningCustomer(container, profile);
            dropdown.style.display = 'none';
            return;
          }
        }
        const suggestions = await customerService.getAutocompleteSuggestions(query);
        if (!suggestions.length) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = suggestions.map(sg => `
          <div class="cust-suggestion-item" data-id="${sg.customer.id}">
            <div style="font-size:15px;font-weight:800;color:#fff;">${sg.customer.name} — 📱 ${sg.customer.phone}</div>
            <div style="font-size:12px;color:#93C5FD;">${sg.cars?.length ? `🚗 ${sg.cars.map(c => `${c.brand || ''} (${c.plateFull || `${c.plateLetters || ''} ${c.plateNumbers || ''}`})`).join(' | ')}` : 'عميل مسجل'}</div>
          </div>
        `).join('');
        dropdown.style.display = 'block';
        dropdown.querySelectorAll('.cust-suggestion-item').forEach(item => {
          item.addEventListener('click', async () => {
            const profile = await customerService.getCustomerFullProfile(item.dataset.id);
            if (profile) this.applyReturningCustomer(container, profile);
            dropdown.style.display = 'none';
          });
        });
      }, 150);
    });

    nameInput.addEventListener('input', e => this.currentData.customer.name = e.target.value);

    // 3. حقول المشكلة والصيانة القادمة
    container.querySelector('#cashierCarProblem')?.addEventListener('input', e => { this.currentData.carProblem = e.target.value.trim(); });
    container.querySelector('#cashierNextService')?.addEventListener('input', e => { this.currentData.nextService = e.target.value.trim(); });

    // 4. الماركة والموديل
    container.querySelector('#cashierCarBrand').addEventListener('input', e => { this.currentData.car.brand = e.target.value; this.refreshModelSuggestions(container); });
    this.refreshModelSuggestions(container);
    container.querySelectorAll('.quick-problem').forEach(btn => btn.addEventListener('click', () => {
      const inp = container.querySelector('#cashierCarProblem');
      const t = btn.dataset.text;
      inp.value = inp.value.trim() ? (inp.value.includes(t) ? inp.value : `${inp.value.trim()}، ${t}`) : t;
      this.currentData.carProblem = inp.value.trim();
    }));
    container.querySelector('#cashierCarModel').addEventListener('input', e => { this.currentData.car.model = e.target.value; });

    // 5. ضبط الزوايا (أمامي وخلفي وكامل)
    const tileFront = container.querySelector('#tileAlignFront');
    const tileRear = container.querySelector('#tileAlignRear');
    const tileFull = container.querySelector('#tileAlignFull');

    const updateAlignmentUI = () => {
      const hasFront = this.currentData.services.some(s => s.id === 'SRV-ALIGN-FRONT');
      const hasRear = this.currentData.services.some(s => s.id === 'SRV-ALIGN-REAR');
      const hasFull = this.currentData.services.some(s => s.id === 'SRV-ALIGN-FULL');
      tileFront?.classList.toggle('active', hasFront);
      tileRear?.classList.toggle('active', hasRear);
      tileFull?.classList.toggle('active', hasFull);
    };

    tileFull?.addEventListener('click', () => {
      const fullIdx = this.currentData.services.findIndex(s => s.id === 'SRV-ALIGN-FULL');
      if (fullIdx >= 0) {
        this.currentData.services.splice(fullIdx, 1);
      } else {
        this.currentData.services = this.currentData.services.filter(s => s.id !== 'SRV-ALIGN-FRONT' && s.id !== 'SRV-ALIGN-REAR');
        this.currentData.services.push({
          id: 'SRV-ALIGN-FULL',
          name: this.quick.full.name,
          price: this.quick.full.price,
          category: 'alignment'
        });
      }
      updateAlignmentUI();
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
    });

    tileFront?.addEventListener('click', () => {
      this.currentData.services = this.currentData.services.filter(s => s.id !== 'SRV-ALIGN-FULL');
      const frontIdx = this.currentData.services.findIndex(s => s.id === 'SRV-ALIGN-FRONT');
      if (frontIdx >= 0) {
        this.currentData.services.splice(frontIdx, 1);
      } else {
        this.currentData.services.push({
          id: 'SRV-ALIGN-FRONT',
          name: this.quick.front.name,
          price: this.quick.front.price,
          category: 'alignment'
        });
      }
      updateAlignmentUI();
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
    });

    tileRear?.addEventListener('click', () => {
      this.currentData.services = this.currentData.services.filter(s => s.id !== 'SRV-ALIGN-FULL');
      const rearIdx = this.currentData.services.findIndex(s => s.id === 'SRV-ALIGN-REAR');
      if (rearIdx >= 0) {
        this.currentData.services.splice(rearIdx, 1);
      } else {
        this.currentData.services.push({
          id: 'SRV-ALIGN-REAR',
          name: this.quick.rear.name,
          price: this.quick.rear.price,
          category: 'alignment'
        });
      }
      updateAlignmentUI();
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
    });

    // 6. الترصيص
    container.querySelector('#btnPosAddBalancing')?.addEventListener('click', () => {
      const typeSelect = container.querySelector('#cashierBalancingType');
      const qtySelect = container.querySelector('#cashierBalancingQty');
      const unitPrice = Number(typeSelect.value) || 35;
      const typeName = typeSelect.selectedOptions[0]?.dataset.name || 'ترصيص عادي';
      const qty = Number(qtySelect.value) || 4;
      const total = unitPrice * qty;

      this.currentData.services.push({
        id: 'SRV-BAL-' + Date.now(),
        name: typeName,
        price: total,
        unitPrice,
        quantity: qty,
        category: 'balancing'
      });
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
      toast.success(`تمت إضافة ${typeName} (${qty} فرد) ✅`);
    });

    // 7. الكاوتش (تركيب ولحام)
    container.querySelector('#btnPosAddTireMount')?.addEventListener('click', () => {
      const qty = Number(container.querySelector('#cashierTireMountQty')?.value) || 4;
      const price = qty * this.quick.mount.price;
      this.currentData.services.push({
        id: 'SRV-TIRE-M-' + Date.now(),
        name: this.quick.mount.name,
        price,
        unitPrice: this.quick.mount.price,
        quantity: qty,
        category: 'tire'
      });
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
      toast.success(`تمت إضافة تركيب كاوتش (${qty} فرد) ✅`);
    });

    container.querySelector('#btnPosAddTirePatch')?.addEventListener('click', () => {
      const qty = Number(container.querySelector('#cashierTirePatchQty')?.value) || 1;
      const price = qty * this.quick.patch.price;
      this.currentData.services.push({
        id: 'SRV-TIRE-P-' + Date.now(),
        name: this.quick.patch.name,
        price,
        unitPrice: this.quick.patch.price,
        quantity: qty,
        category: 'tire'
      });
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
      toast.success(`تمت إضافة لحام كاوتش (${qty} فردة) ✅`);
    });

    // 7b. خدمات من قائمة الإعدادات
    container.querySelectorAll('.btn-catalog-service').forEach(btn => {
      btn.addEventListener('click', () => {
        const srv = this.catalogServices.find(c => c.id === btn.dataset.srvId);
        if (!srv) return;
        this.currentData.services.push({
          id: 'SRV-CAT-' + Date.now(),
          serviceId: srv.id,
          name: srv.name,
          price: Number(srv.defaultPrice) || 0,
          category: 'custom'
        });
        this.renderCashierAddedItemsList(container);
        this.recalculateCashierTotals(container);
        toast.success(`تمت إضافة ${srv.name} ✅ (السعر يتعدل من القائمة تحت)`);
      });
    });

    // 8. أعمال العفشة
    container.querySelector('#btnPosAddSuspension')?.addEventListener('click', () => {
      const descInput = container.querySelector('#cashierSuspensionDesc');
      const laborInput = container.querySelector('#cashierSuspensionLabor');
      const desc = descInput.value.trim();
      const labor = Number(laborInput.value) || 0;

      if (!desc && labor <= 0) {
        toast.warning('يرجى إدخال بيان الشغل أو المصنعية للعفشة');
        descInput.focus();
        return;
      }

      const itemDesc = desc || 'صيانة عفشة تقديرية';
      this.currentData.services.push({
        id: 'SRV-SUSP-' + Date.now(),
        name: `صيانة عفشة: ${itemDesc}`,
        price: labor,
        category: 'suspension',
        customNote: itemDesc
      });

      if (desc) {
        if (this.currentData.suspensionNote) {
          this.currentData.suspensionNote += ` | ${desc}`;
        } else {
          this.currentData.suspensionNote = desc;
        }
      }

      descInput.value = '';
      laborInput.value = '';
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
      toast.success('تمت إضافة صيانة العفشة ✅');
    });

    // 9. قطع الغيار (بحث فوري وإضافة)
    const partSearchInput = container.querySelector('#cashierPartSearchInput');
    const partDropdown = container.querySelector('#cashierPartAutocompleteDropdown');
    const partPriceInput = container.querySelector('#cashierPartPriceInput');
    const partQtyInput = container.querySelector('#cashierPartQtyInput');
    const btnAddPart = container.querySelector('#btnPosAddPart');
    const btnToggleManualPart = container.querySelector('#btnPosToggleManualPart');

    let selectedPartMeta = null;
    let isManualOnly = false;

    btnToggleManualPart?.addEventListener('click', () => {
      isManualOnly = !isManualOnly;
      if (isManualOnly) {
        btnToggleManualPart.textContent = '📋 من المخزن';
        partSearchInput.placeholder = 'اكتب اسم الصنف الخارجي...';
        partDropdown.style.display = 'none';
        selectedPartMeta = null;
        partSearchInput.focus();
      } else {
        btnToggleManualPart.textContent = '✍️ صنف خارجي';
        partSearchInput.placeholder = '🔍 اكتب اسم القطعة (تيل، زيت...)';
      }
    });

    partSearchInput?.addEventListener('input', (e) => {
      if (isManualOnly) {
        partDropdown.style.display = 'none';
        return;
      }
      const q = e.target.value.trim().toLowerCase();
      if (!q || q.length < 1) {
        partDropdown.style.display = 'none';
        return;
      }
      const matches = partsList.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.carBrand && p.carBrand.toLowerCase().includes(q)) ||
        (p.partNumber && p.partNumber.toLowerCase().includes(q))
      ).slice(0, 8);

      if (!matches.length) {
        partDropdown.innerHTML = `
          <div style="padding:10px;font-size:12px;color:var(--text-muted);text-align:center;">
            لا توجد قطعة مطابقة بالمخزن (يمكن إضافتها كصنف خارجي)
          </div>
        `;
        partDropdown.style.display = 'block';
        return;
      }

      partDropdown.innerHTML = matches.map(p => `
        <div class="part-suggestion-item" data-id="${p.id}" data-name="${p.name}" data-price="${p.sellPrice}" data-stock="${p.currentStock}"
          style="padding:8px 12px;border-bottom:1px solid var(--border-color);cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:13px;font-weight:800;color:#FFFFFF;">${p.name} ${p.carBrand ? `(${p.carBrand})` : ''}</div>
            <div style="font-size:11px;color:${p.currentStock > 0 ? '#34D399' : '#EF4444'};">متاح بالمخزن: ${p.currentStock} قطعة</div>
          </div>
          <strong style="color:#38BDF8;font-size:14px;">${p.sellPrice} ج.م</strong>
        </div>
      `).join('');
      partDropdown.style.display = 'block';

      partDropdown.querySelectorAll('.part-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          const name = item.dataset.name;
          const price = Number(item.dataset.price) || 0;
          selectedPartMeta = { id, name, price };
          partSearchInput.value = name;
          partPriceInput.value = price;
          partDropdown.style.display = 'none';
          partQtyInput.focus();
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#cashierPartSearchInput') && !e.target.closest('#cashierPartAutocompleteDropdown')) {
        if (partDropdown) partDropdown.style.display = 'none';
      }
    });

    btnAddPart?.addEventListener('click', () => {
      const name = partSearchInput.value.trim();
      const unitPrice = Number(partPriceInput.value) || 0;
      const qty = Number(partQtyInput.value) || 1;

      if (!name) {
        toast.warning('يرجى كتابة اسم القطعة أو اختيارها من القائمة');
        partSearchInput.focus();
        return;
      }
      if (unitPrice <= 0) {
        toast.warning('يرجى تحديد سعر صحيح للقطعة');
        partPriceInput.focus();
        return;
      }

      const isCustom = !selectedPartMeta || (selectedPartMeta.name !== name);
      const partId = isCustom ? null : selectedPartMeta.id;

      this.currentData.parts.push({
        id: partId,
        name,
        unitPrice,
        quantity: qty,
        totalPrice: unitPrice * qty,
        isCustom
      });

      partSearchInput.value = '';
      partPriceInput.value = 0;
      partQtyInput.value = 1;
      selectedPartMeta = null;
      if (partDropdown) partDropdown.style.display = 'none';

      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
      toast.success(`تمت إضافة ${name} ✅`);
    });

    // 10. خدمة مخرطة أو خدمة أخرى (المربع الكحلي ظاهر دائماً، والضغط على الزر يركز المؤشر للكتابة)
    const toggleCustomBtn = container.querySelector('#btnToggleCustomOtherService');
    const customRow = container.querySelector('#customOtherServiceRow');
    toggleCustomBtn?.addEventListener('click', () => {
      customRow.style.display = 'flex';
      container.querySelector('#cashierCustomServiceName')?.focus();
    });

    container.querySelector('#btnAddCustomServiceBtn')?.addEventListener('click', () => {
      const nameInput = container.querySelector('#cashierCustomServiceName');
      const priceInput = container.querySelector('#cashierCustomServicePrice');
      const name = nameInput.value.trim() || 'شغل مخرطة وتعديل';
      const price = Number(priceInput.value) || 0;
      this.currentData.services.push({
        id: 'SRV-CUSTOM-' + Date.now(),
        name,
        price,
        category: 'custom'
      });
      nameInput.value = '';
      priceInput.value = 100;
      // يبقى الصف الكحلي ظاهراً دائماً لسهولة إضافة بنود أخرى
      customRow.style.display = 'flex';
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
      toast.success(`تمت إضافة ${name} ✅`);
    });

    // 11. مسح جميع الخدمات والقطع
    container.querySelector('#btnClearAllItems')?.addEventListener('click', () => {
      this.currentData.services = [];
      this.currentData.parts = [];
      updateAlignmentUI();
      this.renderCashierAddedItemsList(container);
      this.recalculateCashierTotals(container);
      toast.info('تم مسح جميع العناصر');
    });

    // أول عرض لقائمة العناصر المضافة
    this.renderCashierAddedItemsList(container);

    // 12. اختيار الصنايعية
    container.querySelectorAll('.cashier-worker-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const wId = chip.dataset.workerId, wName = chip.dataset.workerName;
        const icon = chip.querySelector('.worker-check-icon');
        const idx = this.currentData.workers.findIndex(w => w.id === wId);
        if (idx >= 0) {
          this.currentData.workers.splice(idx, 1);
          chip.classList.remove('selected');
          chip.style.borderColor = '';
          chip.style.background = '';
          if (icon) icon.textContent = '⬜';
        } else {
          this.currentData.workers.push({ id: wId, name: wName });
          chip.classList.add('selected');
          chip.style.borderColor = '#10B981';
          chip.style.background = 'rgba(16, 185, 129, 0.25)';
          if (icon) icon.textContent = '✅';
        }
      });
    });

    // 13. الخصم والدفع (في حال التعديل المباشر أو المزامنة)
    const discountInput = container.querySelector('#cashierDiscountInput');
    if (discountInput) {
      discountInput.addEventListener('input', () => {
        this.currentData.discountValue = Number(discountInput.value) || 0;
        this.recalculateCashierTotals(container);
      });
    }

    const cashInput = container.querySelector('#cashierCashAmount');
    const vodafoneInput = container.querySelector('#cashierVodafoneAmount');
    const instaInput = container.querySelector('#cashierInstaAmount');

    const updatePayments = () => {
      if (cashInput) this.currentData.cashAmount = Number(cashInput.value) || 0;
      if (vodafoneInput) this.currentData.vodafoneCashAmount = Number(vodafoneInput.value) || 0;
      if (instaInput) this.currentData.instaPayAmount = Number(instaInput.value) || 0;
      this.recalculateRemainingAlert(container);
    };

    if (cashInput) cashInput.addEventListener('input', updatePayments);
    if (vodafoneInput) vodafoneInput.addEventListener('input', updatePayments);
    if (instaInput) instaInput.addEventListener('input', updatePayments);

    const btnPayFull = container.querySelector('#btnCashierPayFullCash');
    if (btnPayFull) {
      btnPayFull.addEventListener('click', () => {
        if (cashInput) cashInput.value = this.calculatedNetTotal || 0;
        if (vodafoneInput) vodafoneInput.value = 0;
        if (instaInput) instaInput.value = 0;
        updatePayments();
        toast.success('تم ضبط الدفع نقداً بالكامل');
      });
    }

    container.querySelector('#btnResetCashierForm').addEventListener('click', () => this.render(container));

    // تاريخ الفاتورة (النهارده افتراضياً، وممكن يتغير لفاتورة قديمة، مش مسموح بتاريخ في المستقبل)
    const dateInput = container.querySelector('#cashierInvoiceDate');
    const backdateBadge = container.querySelector('#cashierBackdateBadge');
    dateInput?.addEventListener('change', () => {
      const today = this.todayLocal();
      let v = dateInput.value || today;
      if (v > today) { v = today; toast.warning('مينفعش تاريخ في المستقبل، اتظبط على النهارده'); }
      dateInput.value = v;
      this.currentData.invoiceDate = v;
      backdateBadge.style.display = v !== today ? 'inline-block' : 'none';
    });
    container.querySelector('#btnSwitchToManager').addEventListener('click', () => {
      if (authService.isManager()) {
        window.app.navigate('home');
      } else {
        authService.logout();
        toast.info('تم تسجيل الخروج. يمكنك الآن تسجيل الدخول بحساب المدير 👑');
      }
    });

    // أحداث سجل الفواتير وشريط آخر فاتورة
    container.querySelector('#btnOpenInvoicesLog')?.addEventListener('click', () => {
      invoiceService.showInvoicesLogModal();
    });

    container.querySelector('#btnOpenExpense')?.addEventListener('click', () => showExpenseModal());

    // سجل العميل برقم التليفون (ياخد الرقم المكتوب في خانة التليفون لو موجود)
    container.querySelector('#btnOpenCustomerHistory')?.addEventListener('click', () => {
      invoiceService.showCustomerHistoryModal(container.querySelector('#cashierPhoneInput')?.value || '');
    });

    container.querySelector('#btnOpenLastInvoicePdf')?.addEventListener('click', async () => {
      if (this.lastSavedInvoice) {
        await invoiceService.openInvoicePdf(this.lastSavedInvoice);
      }
    });

    container.querySelector('#btnPrintLastInvoicePrint')?.addEventListener('click', async () => {
      if (this.lastSavedInvoice) {
        await invoiceService.printInvoice(this.lastSavedInvoice, 'standard');
      }
    });

    container.querySelector('#btnThermalLastInvoice')?.addEventListener('click', async () => {
      if (this.lastSavedInvoice) await invoiceService.printInvoice(this.lastSavedInvoice, 'thermal');
    });

    container.querySelector('#btnWhatsAppLastInvoice')?.addEventListener('click', () => {
      if (this.lastSavedInvoice) invoiceService.sendWhatsApp(this.lastSavedInvoice);
    });

    this.updateTodayInvoicesBadge(container);

    // زر واحد: يفتح نافذة الحساب والمبلغ متحط كاش بالكامل تلقائياً (ويتعدل لو الدفع فودافون/إنستا/آجل)
    container.querySelector('#btnOpenCheckoutModal')?.addEventListener('click', () => {
      this.openCheckoutModal(container, servicesList);
    });
  },

  openCheckoutModal(container, servicesList) {
    const phoneInput = container.querySelector('#cashierPhoneInput');
    const nameInput = container.querySelector('#cashierNameInput');
    const phone = phoneInput?.value.trim() || '';
    const name = nameInput?.value.trim() || '';

    if (!phone) { toast.warning('يرجى إدخال رقم تليفون العميل أولاً'); phoneInput?.focus(); return; }
    if (!name) { toast.warning('يرجى إدخال اسم العميل أولاً'); nameInput?.focus(); return; }

    this.recalculateCashierTotals(container);

    if (!this.currentData.services.length && !this.currentData.parts.length) {
      toast.warning('يرجى اختيار خدمة أو قطعة غيار واحدة على الأقل قبل المتابعة');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'cashierCheckoutModalOverlay';

    const subTotal = this.currentData.services.reduce((s, x) => s + (Number(x.price) || 0), 0) +
                     this.currentData.parts.reduce((s, p) => s + (Number(p.totalPrice) || 0), 0);
    const initialDiscount = Number(this.currentData.discountValue) || 0;
    const initialNet = Math.max(0, subTotal - initialDiscount);

    // الافتراضي: المبلغ كله كاش، إلا لو الكاشير كان مقسّم الدفع على فودافون/إنستا
    if (!(Number(this.currentData.vodafoneCashAmount) > 0) && !(Number(this.currentData.instaPayAmount) > 0)) {
      this.currentData.cashAmount = initialNet;
    }

    overlay.innerHTML = `
      <div class="modal-content" style="max-width:580px;padding:24px;border:1px solid var(--border-color);background:var(--bg-surface);box-shadow:var(--shadow-lg);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border-subtle);padding-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#10B981;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <h2 style="font-size:18px;font-weight:700;color:var(--text-primary);margin:0;">ملخص الحساب وطرق الدفع والطباعة</h2>
          </div>
          <button type="button" class="btn btn-secondary btn-icon-only" id="btnCloseCheckoutModal" style="width:32px;height:32px;font-size:14px;border-radius:6px;">✕</button>
        </div>

        <div style="background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;padding:14px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-secondary);margin-bottom:6px;">
            <span>العميل: <strong style="color:var(--text-primary);">${name}</strong> (${phone})</span>
            <span>📅 <strong style="color:${this.currentData.invoiceDate !== this.todayLocal() ? '#FCD34D' : 'var(--text-primary)'};">${this.currentData.invoiceDate}</strong></span>
            <span>السيارة: <strong style="color:var(--text-primary);">${this.currentData.car.brand || 'سيارة'}</strong></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-secondary);margin-bottom:6px;">
            <span>إجمالي الخدمات والقطع:</span>
            <strong id="modalSubTotalDisplay" style="color:var(--text-primary);font-family:monospace;">${subTotal} ج.م</strong>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:var(--text-secondary);margin-bottom:8px;">
            <span>خصم خاص:</span>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="number" id="modalDiscountInput" class="form-control" value="${initialDiscount}" min="0"
                style="width:90px;height:32px;font-size:14px;font-weight:700;text-align:center;background:var(--bg-surface);border-color:var(--border-color);">
              <span style="font-size:12px;color:var(--text-muted);">ج.م</span>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 2px 0;border-top:1px solid var(--border-subtle);">
            <span style="font-size:16px;font-weight:700;color:var(--text-primary);">المطلوب نهائياً:</span>
            <span id="modalNetTotalDisplay" style="font-size:32px;font-weight:800;color:#60A5FA;font-family:monospace;">${initialNet} ج.م</span>
          </div>
        </div>

        <!-- طرق الدفع -->
        <div style="margin-bottom:14px;">
          <button type="button" class="btn btn-secondary" id="btnModalPayFullCash"
            style="width:100%;margin-bottom:10px;background:rgba(16,185,129,0.08);border-color:rgba(16,185,129,0.3);color:#34D399;font-size:14px;font-weight:600;min-height:38px;padding:6px;">
            ⚡ سداد المبلغ كاملاً نقداً
          </button>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div>
              <label style="font-size:12px;color:var(--text-secondary);font-weight:600;display:block;margin-bottom:4px;">كاش (نقدي):</label>
              <input type="number" id="modalCashAmount" class="form-control" value="${this.currentData.cashAmount || 0}" min="0"
                style="width:100%;height:38px;font-size:16px;font-weight:700;text-align:center;background:var(--bg-surface-elevated);border-color:var(--border-color);">
            </div>
            <div>
              <label style="font-size:12px;color:#F87171;font-weight:600;display:block;margin-bottom:4px;">فودافون كاش:</label>
              <input type="number" id="modalVodafoneAmount" class="form-control" value="${this.currentData.vodafoneCashAmount || 0}" min="0"
                style="width:100%;height:38px;font-size:16px;font-weight:700;text-align:center;background:var(--bg-surface-elevated);border-color:var(--border-color);">
            </div>
            <div>
              <label style="font-size:12px;color:#818CF8;font-weight:600;display:block;margin-bottom:4px;">إنستا باي:</label>
              <input type="number" id="modalInstaAmount" class="form-control" value="${this.currentData.instaPayAmount || 0}" min="0"
                style="width:100%;height:38px;font-size:16px;font-weight:700;text-align:center;background:var(--bg-surface-elevated);border-color:var(--border-color);">
            </div>
          </div>
        </div>

        <!-- تنبيه المتبقي -->
        <div id="modalRemainingAlert" style="display:none;padding:8px 12px;border-radius:6px;font-size:13.5px;font-weight:600;margin-bottom:14px;"></div>

        <!-- أزرار الإجراءات والطباعة -->
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn btn-secondary" id="btnCancelCheckout" style="flex:1;min-height:46px;font-size:14px;">
            تراجع وتعديل
          </button>
          <button type="button" class="btn btn-success" id="btnConfirmAndPrintInvoice" style="flex:2;min-height:46px;font-size:16px;font-weight:700;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>تأكيد وطباعة الفاتورة</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const discountInp = overlay.querySelector('#modalDiscountInput');
    const netDisp = overlay.querySelector('#modalNetTotalDisplay');
    const cashInp = overlay.querySelector('#modalCashAmount');
    const vodaInp = overlay.querySelector('#modalVodafoneAmount');
    const instaInp = overlay.querySelector('#modalInstaAmount');
    const alertBox = overlay.querySelector('#modalRemainingAlert');

    const updateModalCalculations = () => {
      const disc = Number(discountInp.value) || 0;
      this.currentData.discountValue = disc;
      const net = Math.max(0, subTotal - disc);
      this.calculatedNetTotal = net;
      netDisp.textContent = `${net} ج.م`;

      const cash = Number(cashInp.value) || 0;
      const voda = Number(vodaInp.value) || 0;
      const insta = Number(instaInp.value) || 0;
      this.currentData.cashAmount = cash;
      this.currentData.vodafoneCashAmount = voda;
      this.currentData.instaPayAmount = insta;

      const paid = cash + voda + insta;
      const remaining = net - paid;

      if (remaining > 0 && paid > 0) {
        alertBox.style.display = 'block';
        alertBox.style.cssText += ';background:rgba(239,68,68,0.15);border:1px solid #EF4444;color:#FCA5A5;';
        alertBox.innerHTML = `⚠️ متبقي آجل على العميل: <strong>${remaining} ج.م</strong>`;
      } else if (remaining < 0) {
        alertBox.style.display = 'block';
        alertBox.style.cssText += ';background:rgba(245,158,11,0.15);border:1px solid #F59E0B;color:#FCD34D;';
        alertBox.innerHTML = `⚠️ المبلغ المدفوع زائد: <strong>${Math.abs(remaining)} ج.م</strong>`;
      } else {
        alertBox.style.display = 'none';
      }

      this.recalculateCashierTotals(container);
    };

    discountInp.addEventListener('input', updateModalCalculations);
    cashInp.addEventListener('input', updateModalCalculations);
    vodaInp.addEventListener('input', updateModalCalculations);
    instaInp.addEventListener('input', updateModalCalculations);

    overlay.querySelector('#btnModalPayFullCash').addEventListener('click', () => {
      const net = Math.max(0, subTotal - (Number(discountInp.value) || 0));
      cashInp.value = net;
      vodaInp.value = 0;
      instaInp.value = 0;
      updateModalCalculations();
      toast.success('تم تعيين السداد نقداً بالكامل');
    });

    const closeModal = () => {
      overlay.remove();
    };

    overlay.querySelector('#btnCloseCheckoutModal').addEventListener('click', closeModal);
    overlay.querySelector('#btnCancelCheckout').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const confirmBtn = overlay.querySelector('#btnConfirmAndPrintInvoice');
    confirmBtn.addEventListener('click', async () => {
      // ضغطة واحدة بس: أي ضغطات زيادة يتم تجاهلها عشان الفاتورة متتسجلش مرتين
      if (confirmBtn.disabled || this.isSavingInvoice) return;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span>⏳ جاري الحفظ...</span>';
      // فتح التاب فوراً في لحظة نقرة المستخدم لمنع حظر النوافذ المنبثقة من المتصفح
      let preOpenedTab = null;
      try {
        if (!invoiceService.isDesktop()) preOpenedTab = window.open('about:blank', '_blank');
        if (preOpenedTab) {
          preOpenedTab.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head><meta charset="UTF-8"><title>جاري فتح الفاتورة...</title>
            <style>body{font-family:'Cairo',sans-serif;background:#0F172A;color:#FFF;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:22px;font-weight:bold;text-align:center;}</style>
            </head>
            <body>
              <div>
                <div style="font-size:48px;margin-bottom:12px;">⏳</div>
                <div>جاري إصدار الفاتورة وتجهيز صفحة الـ PDF...</div>
              </div>
            </body>
            </html>
          `);
        }
      } catch (e) {
        console.warn('Could not pre-open tab synchronously:', e);
      }

      updateModalCalculations();
      closeModal();
      await this.processCashierInvoice(container, servicesList, preOpenedTab);
    });

    updateModalCalculations();
  },

  renderCashierAddedItemsList(container) {
    const listEl = container.querySelector('#cashierAddedItemsList');
    const badgeCountEl = container.querySelector('#cashierItemsCountBadge');
    const btnClearAll = container.querySelector('#btnClearAllItems');
    if (!listEl) return;

    const totalCount = this.currentData.services.length + this.currentData.parts.length;
    if (badgeCountEl) badgeCountEl.textContent = totalCount;
    if (btnClearAll) btnClearAll.style.display = totalCount > 0 ? 'inline-block' : 'none';

    if (totalCount === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:12px 6px;color:var(--text-muted);font-size:12.5px;border:1px dashed var(--border-color);border-radius:6px;">
          💡 اختر ضبط الزوايا أو أضف الترصيص والكاوتش والعفشة والقطع من الأعلى للإدراج الفوري
        </div>
      `;
      return;
    }

    const categoryBadges = {
      alignment: { label: 'زوايا', bg: 'rgba(59,130,246,0.2)', color: '#60A5FA', border: '#3B82F6' },
      balancing: { label: 'ترصيص', bg: 'rgba(245,158,11,0.2)', color: '#FBBF24', border: '#F59E0B' },
      tire: { label: 'كاوتش', bg: 'rgba(16,185,129,0.2)', color: '#34D399', border: '#10B981' },
      suspension: { label: 'عفشة', bg: 'rgba(139,92,246,0.2)', color: '#C084FC', border: '#8B5CF6' },
      custom: { label: 'مخرطة/أخرى', bg: 'rgba(148,163,184,0.2)', color: '#CBD5E1', border: '#64748B' },
      part: { label: 'قطعة غيار', bg: 'rgba(14,165,233,0.2)', color: '#38BDF8', border: '#0EA5E9' }
    };

    let html = '';

    // عرض الخدمات المضافة
    this.currentData.services.forEach((srv, idx) => {
      const cat = categoryBadges[srv.category] || categoryBadges.alignment;
      html += `
        <div class="pos-added-item-row" data-type="service" data-idx="${idx}">
          <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
            <span class="badge" style="background:${cat.bg};color:${cat.color};border:1px solid ${cat.border};font-size:11px;padding:1px 6px;flex-shrink:0;">
              ${cat.label}
            </span>
            <span style="font-size:13px;font-weight:800;color:#FFFFFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${srv.name}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${Number(srv.quantity) > 0 ? `
              <input type="number" class="form-control item-edit" data-kind="service" data-idx="${idx}" data-field="quantity" value="${srv.quantity}" min="1" title="العدد"
                style="width:52px;height:30px;min-height:30px;font-size:13px;font-weight:700;text-align:center;padding:0 2px;">
              <span style="font-size:12px;color:var(--text-muted);">×</span>
              <input type="number" class="form-control item-edit" data-kind="service" data-idx="${idx}" data-field="unitPrice" value="${srv.unitPrice ?? Math.round(srv.price / srv.quantity)}" min="0" title="سعر الوحدة"
                style="width:64px;height:30px;min-height:30px;font-size:13px;font-weight:700;text-align:center;padding:0 2px;">
              <span style="font-size:12px;color:var(--text-muted);">=</span>
              <strong class="item-line-total" style="color:#34D399;font-size:15px;font-weight:900;min-width:70px;">${srv.price} ج.م</strong>
            ` : `
              <input type="number" class="form-control item-edit" data-kind="service" data-idx="${idx}" data-field="price" value="${srv.price}" min="0" title="عدّل السعر"
                style="width:84px;height:30px;min-height:30px;font-size:14px;font-weight:800;text-align:center;padding:0 2px;color:#34D399;">
              <span style="font-size:12px;color:var(--text-muted);">ج.م</span>
            `}
            <button type="button" class="btn btn-danger btn-icon-only btn-remove-service" data-idx="${idx}"
              style="width:22px;height:22px;font-size:11px;padding:0;border-radius:4px;" title="حذف">
              ✕
            </button>
          </div>
        </div>
      `;
    });

    // عرض قطع الغيار المضافة
    this.currentData.parts.forEach((p, idx) => {
      const cat = categoryBadges.part;
      html += `
        <div class="pos-added-item-row" data-type="part" data-idx="${idx}">
          <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
            <span class="badge" style="background:${cat.bg};color:${cat.color};border:1px solid ${cat.border};font-size:11px;padding:1px 6px;flex-shrink:0;">
              ${cat.label}
            </span>
            <span style="font-size:13px;font-weight:800;color:#FFFFFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${p.name}
            </span>

            ${p.isCustom ? `<span style="font-size:10px;color:#38BDF8;">[خارجي]</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <input type="number" class="form-control item-edit" data-kind="part" data-idx="${idx}" data-field="quantity" value="${p.quantity}" min="1" title="العدد"
              style="width:52px;height:30px;min-height:30px;font-size:13px;font-weight:700;text-align:center;padding:0 2px;">
            <span style="font-size:12px;color:var(--text-muted);">×</span>
            <input type="number" class="form-control item-edit" data-kind="part" data-idx="${idx}" data-field="unitPrice" value="${p.unitPrice}" min="0" title="سعر الوحدة"
              style="width:64px;height:30px;min-height:30px;font-size:13px;font-weight:700;text-align:center;padding:0 2px;">
            <span style="font-size:12px;color:var(--text-muted);">=</span>
            <strong class="item-line-total" style="color:#34D399;font-size:15px;font-weight:900;min-width:70px;">${p.totalPrice} ج.م</strong>
            <button type="button" class="btn btn-danger btn-icon-only btn-remove-part" data-idx="${idx}"
              style="width:22px;height:22px;font-size:11px;padding:0;border-radius:4px;" title="حذف">
              ✕
            </button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // تعديل السعر/العدد مباشرة (بدل الحذف والإضافة من جديد)
    listEl.querySelectorAll('.item-edit').forEach(inp => {
      inp.addEventListener('input', () => {
        const list = inp.dataset.kind === 'part' ? this.currentData.parts : this.currentData.services;
        const item = list[Number(inp.dataset.idx)];
        if (!item) return;
        const v = Math.max(0, Number(inp.value) || 0);
        item[inp.dataset.field] = inp.dataset.field === 'quantity' ? Math.max(1, v) : v;
        if (inp.dataset.kind === 'part') {
          item.totalPrice = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
        } else if (Number(item.quantity) > 0) {
          item.price = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
        }
        const totalEl = inp.closest('.pos-added-item-row')?.querySelector('.item-line-total');
        if (totalEl) totalEl.textContent = `${inp.dataset.kind === 'part' ? item.totalPrice : item.price} ج.م`;
        this.recalculateCashierTotals(container);
      });
    });

    // ربط أحداث الحذف
    listEl.querySelectorAll('.btn-remove-service').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const item = this.currentData.services[idx];
        if (item) {
          if (item.id === 'SRV-ALIGN-FRONT') container.querySelector('#tileAlignFront')?.classList.remove('active');
          if (item.id === 'SRV-ALIGN-REAR') container.querySelector('#tileAlignRear')?.classList.remove('active');
          if (item.id === 'SRV-ALIGN-FULL') container.querySelector('#tileAlignFull')?.classList.remove('active');
          this.currentData.services.splice(idx, 1);
          this.renderCashierAddedItemsList(container);
          this.recalculateCashierTotals(container);
        }
      });
    });

    listEl.querySelectorAll('.btn-remove-part').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        this.currentData.parts.splice(idx, 1);
        this.renderCashierAddedItemsList(container);
        this.recalculateCashierTotals(container);
      });
    });
  },

  recalculateCashierTotals(container) {
    const servicesTotal = this.currentData.services.reduce((s, x) => s + (Number(x.price) || 0), 0);
    const partsTotal = this.currentData.parts.reduce((s, p) => s + (Number(p.totalPrice) || 0), 0);
    const subTotal = servicesTotal + partsTotal;
    const discount = Number(this.currentData.discountValue) || 0;
    const netTotal = Math.max(0, subTotal - discount);
    this.calculatedNetTotal = netTotal;
    const subTotalEl = container.querySelector('#cashierSubTotalDisplay');
    const netTotalEl = container.querySelector('#cashierNetTotalDisplay');
    if (subTotalEl) subTotalEl.textContent = `${subTotal} ج.م`;
    if (netTotalEl) netTotalEl.textContent = `${netTotal} ج.م`;

    const liveTotalEl = container.querySelector('#cashierLiveTotalDisplay');
    if (liveTotalEl) liveTotalEl.textContent = `${netTotal} ج.م`;
    const footerCountEl = container.querySelector('#cashierFooterItemCount');
    if (footerCountEl) footerCountEl.textContent = this.currentData.services.length + this.currentData.parts.length;

    this.recalculateRemainingAlert(container);
  },

  recalculateRemainingAlert(container) {
    const net = this.calculatedNetTotal || 0;
    const paid = (this.currentData.cashAmount || 0) + (this.currentData.vodafoneCashAmount || 0) + (this.currentData.instaPayAmount || 0);
    const remaining = net - paid;
    const alertBox = container.querySelector('#cashierRemainingAlert');
    if (!alertBox) return;
    if (remaining > 0 && paid > 0) {
      alertBox.style.display = 'block';
      alertBox.style.cssText += ';background:rgba(239,68,68,0.2);border:1px solid #EF4444;color:#FCA5A5;';
      alertBox.innerHTML = `⚠️ متبقي آجل: <strong>${remaining} ج.م</strong>`;
    } else if (remaining < 0) {
      alertBox.style.display = 'block';
      alertBox.style.cssText += ';background:rgba(245,158,11,0.2);border:1px solid #F59E0B;color:#FCD34D;';
      alertBox.innerHTML = `⚠️ زيادة عند الزبون: <strong>${Math.abs(remaining)} ج.م</strong>`;
    } else {
      alertBox.style.display = 'none';
    }
  },

  async processCashierInvoice(container, servicesList, preOpenedTab = null) {
    if (this.isSavingInvoice) return;
    this.isSavingInvoice = true;
    try {
      await this._processCashierInvoice(container, servicesList, preOpenedTab);
    } finally {
      this.isSavingInvoice = false;
    }
  },

  async _processCashierInvoice(container, servicesList, preOpenedTab = null) {
    const phoneInput = container.querySelector('#cashierPhoneInput');
    const nameInput = container.querySelector('#cashierNameInput');
    const brandInput = container.querySelector('#cashierCarBrand');
    const modelInput = container.querySelector('#cashierCarModel');

    const phone = phoneInput.value.trim();
    const name = nameInput.value.trim();

    if (!phone) { toast.warning('يرجى إدخال رقم تليفون العميل'); phoneInput.focus(); return; }
    if (!name) { toast.warning('يرجى إدخال اسم العميل'); nameInput.focus(); return; }

    this.recalculateCashierTotals(container);

    if (!this.currentData.services.length && !this.currentData.parts.length) {
      toast.warning('يرجى اختيار خدمة أو قطعة غيار واحدة على الأقل'); return;
    }

    const plateVal = this.platePicker.getValue();

    const brandVal = brandInput.value.trim();
    const modelVal = modelInput.value.trim();
    const custResult = await customerService.saveCustomerWithCar({
      customerId: this.currentData.customer.id,
      name: this.currentData.customer.id ? (this.currentData.customer.name || name) : name,
      phone,
      carId: this.currentData.customer.id ? this.resolveCarId(this.platePicker.getValue().plateFull, brandVal, modelVal) : null,
      brand: brandInput.value.trim(),
      model: modelInput.value.trim() || '',
      plateLetters: plateVal.letters,
      plateNumbers: plateVal.numbers,
      plateFull: plateVal.plateFull,
      plateType: plateVal.plateType
    });

    if (!custResult.success) {
      toast.error(custResult.message);
      return;
    }

    const customer = custResult.customer;
    const car = custResult.car;

    const subTotal = this.currentData.services.reduce((s, x) => s + x.price, 0) +
                     this.currentData.parts.reduce((s, p) => s + p.totalPrice, 0);
    const discountAmount = Number(this.currentData.discountValue) || 0;
    const netTotal = Math.max(0, subTotal - discountAmount);
    const cash = Number(this.currentData.cashAmount) || 0;
    const vodafone = Number(this.currentData.vodafoneCashAmount) || 0;
    const insta = Number(this.currentData.instaPayAmount) || 0;
    const totalPaid = cash + vodafone + insta;
    const remainingBalance = Math.max(0, netTotal - totalPaid);

    let paymentStatus = 'paid';
    if (totalPaid === 0 && netTotal > 0) paymentStatus = 'unpaid';
    else if (remainingBalance > 0) paymentStatus = 'partial';

    const invoiceId = await db.getNextId('INV', 'maintenance');
    const invoiceRecord = {
      id: invoiceId,
      customerId: customer.id, customerName: customer.name, customerPhone: customer.phone,
      carId: car.id, carInfo: `${car.brand} ${car.model || ''}`.trim(),
      plateLetters: plateVal.letters, plateNumbers: plateVal.numbers, plateFull: plateVal.plateFull,
      problem: this.currentData.carProblem || 'صيانة وضبط دوري',
      futureNeeds: this.currentData.nextService || '',
      suspensionNote: this.currentData.services.filter(x => x.category === 'suspension').map(x => x.customNote || x.name).filter(Boolean).join(' | '),
      diagnosis: 'تم الفحص والصيانة وضبط المقاسات بنجاح',
      services: this.currentData.services,
      parts: this.currentData.parts,
      workers: this.currentData.workers.map(w => w.name),
      subTotal, discountAmount, netTotal,
      cashAmount: cash, vodafoneCashAmount: vodafone, instaPayAmount: insta,
      totalPaid, remainingBalance, paymentStatus,
      payments: financeService.initialPayments(this.invoiceDateIso(), cash, vodafone, insta),
      date: this.invoiceDateIso(), createdAt: new Date().toISOString(),
      isBackdated: this.currentData.invoiceDate !== this.todayLocal()
    };

    await db.add('maintenance', invoiceRecord);

    for (const partItem of this.currentData.parts) {
      if (partItem.id) {
        await inventoryService.recordPartSale({
          partId: partItem.id, partName: partItem.name,
          quantity: partItem.quantity, unitPrice: partItem.unitPrice, totalPrice: partItem.totalPrice,
          customerId: customer.id, invoiceId, saleType: 'in_maintenance'
        });
      }
    }

    toast.success(`تم حفظ الفاتورة رقم ${invoiceId} بنجاح 🎉`);
    this.lastSavedInvoice = invoiceRecord;

    // فتح الفاتورة PDF (وحفظها في فولدر الأسبوع على الديسكتوب)
    await invoiceService.deliverNewInvoice(invoiceRecord, preOpenedTab);

    // تذكرة جديدة فاضية للزبون التالي تلقائياً، مع شريط آخر فاتورة للطباعة أو الواتساب
    await this.render(container);
    this.showLastSavedBar(container);
    container.querySelector('#cashierPhoneInput')?.focus();
  },

  // شريط "آخر فاتورة" فوق التذكرة الجديدة: فتح PDF / طباعة / بون حراري / واتساب
  showLastSavedBar(container) {
    const inv = this.lastSavedInvoice;
    const lastSavedBar = container.querySelector('#cashierLastSavedBar');
    const lastSavedText = container.querySelector('#cashierLastSavedText');
    if (!inv || !lastSavedBar || !lastSavedText) return;
    lastSavedText.innerHTML = `✅ آخر فاتورة: <strong style="color:#FFF;font-family:monospace;font-size:15px;">${inv.id}</strong> للعميل <strong>${inv.customerName}</strong> (${inv.carInfo}) بمبلغ <strong>${inv.netTotal} ج.م</strong>`;
    lastSavedBar.style.display = 'flex';
    this.updateTodayInvoicesBadge(container);
  },

  // تاريخ النهارده بالتوقيت المحلي (YYYY-MM-DD)
  todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // تاريخ الفاتورة: النهارده = الوقت الحالي، يوم قديم = نفس اليوم الساعة 12 الظهر (عشان التاريخ ميتغيرش مع فرق التوقيت)
  invoiceDateIso() {
    const chosen = this.currentData.invoiceDate || this.todayLocal();
    if (chosen === this.todayLocal()) return new Date().toISOString();
    const [y, m, d] = chosen.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).toISOString();
  },

  // عميل مسجل: الاسم بيتملى ويتقفل، وعربياته كلها بتظهر للاختيار (أو عربية جديدة)
  applyReturningCustomer(container, profile) {
    const phoneInput = container.querySelector('#cashierPhoneInput');
    const nameInput = container.querySelector('#cashierNameInput');
    this.lockedPhone = profile.phone;
    this.currentData.customer = { id: profile.id, name: profile.name, phone: profile.phone };
    phoneInput.value = profile.phone;
    nameInput.value = profile.name;
    nameInput.readOnly = true;
    nameInput.title = 'اسم عميل مسجل (مش بيتغير من هنا)';
    nameInput.style.background = 'rgba(16,185,129,0.10)';
    nameInput.style.borderColor = '#10B981';
    this.customerCars = [...(profile.cars || [])].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    this.renderCarChooser(container);
    if (this.customerCars.length) this.selectCustomerCar(container, this.customerCars[0].id);
    this.showCustomerInvoiceCountBadge(container, profile.phone);
  },

  unlockCustomer(container) {
    const nameInput = container.querySelector('#cashierNameInput');
    this.currentData.customer.id = null;
    this.lockedPhone = '';
    this.customerCars = [];
    this.currentData.car.id = null;
    if (nameInput) {
      nameInput.readOnly = false;
      nameInput.title = '';
      nameInput.style.background = '';
      nameInput.style.borderColor = '';
      nameInput.value = '';
      this.currentData.customer.name = '';
    }
    const chooser = container.querySelector('#cashierCarChooser');
    if (chooser) { chooser.style.display = 'none'; chooser.innerHTML = ''; }
    const badge = container.querySelector('#cashierFoundCustomerBadge');
    if (badge) badge.style.display = 'none';
  },

  renderCarChooser(container) {
    const chooser = container.querySelector('#cashierCarChooser');
    if (!chooser) return;
    const cars = this.customerCars || [];
    chooser.style.display = 'flex';
    chooser.innerHTML = `
      <span style="font-size:12.5px;font-weight:800;color:var(--text-secondary);">🚗 عربيات العميل:</span>
      ${cars.map(c => `
        <button type="button" class="btn btn-secondary car-choice" data-car-id="${c.id}"
          style="font-size:12.5px;font-weight:700;height:32px;padding:0 10px;border-radius:16px;white-space:nowrap;">
          ${c.brand || ''} ${c.model || ''} ${c.plateFull ? `[${c.plateFull}]` : ''}
        </button>`).join('')}
      <button type="button" class="btn btn-secondary car-choice" data-car-id=""
        style="font-size:12.5px;font-weight:800;height:32px;padding:0 10px;border-radius:16px;border-style:dashed;">➕ عربية جديدة</button>`;
    chooser.querySelectorAll('.car-choice').forEach(b => b.addEventListener('click', () => this.selectCustomerCar(container, b.dataset.carId)));
  },

  selectCustomerCar(container, carId) {
    const car = (this.customerCars || []).find(c => c.id === carId) || null;
    this.currentData.car.id = car ? car.id : null;
    this.currentData.car.brand = car ? (car.brand || '') : '';
    this.currentData.car.model = car ? (car.model || '') : '';
    container.querySelector('#cashierCarBrand').value = this.currentData.car.brand;
    container.querySelector('#cashierCarModel').value = this.currentData.car.model;
    this.refreshModelSuggestions(container);
    this.platePicker.setValues(car ? car.plateLetters || '' : '', car ? car.plateNumbers || '' : '', car?.plateType || 'private');
    container.querySelectorAll('#cashierCarChooser .car-choice').forEach(b => {
      const active = (b.dataset.carId || '') === (carId || '');
      b.style.background = active ? '#2563EB' : '';
      b.style.color = active ? '#FFFFFF' : '';
      b.style.borderColor = active ? '#60A5FA' : '';
    });
  },

  // العربية اللي هتتسجل عليها الفاتورة: نفس اللوحة لعربية مسجلة = نفس العربية، غير كده عربية جديدة
  resolveCarId(plateFull, brand, model) {
    const cars = this.customerCars || [];
    const norm = (x) => String(x || '').replace(/\s+/g, '').trim();
    if (norm(plateFull)) {
      const same = cars.find(c => norm(c.plateFull) === norm(plateFull));
      return same ? same.id : null;
    }
    const selected = cars.find(c => c.id === this.currentData.car.id);
    if (selected && !norm(selected.plateFull) && (selected.brand || '') === (brand || '') && (selected.model || '') === (model || '')) return selected.id;
    return null;
  },

  // إظهار عدد فواتير العميل السابقة بجانب بياناته (والضغط عليه يفتح سجله)
  async showCustomerInvoiceCountBadge(container, phone) {
    const badge = container.querySelector('#cashierFoundCustomerBadge');
    if (!badge) return;
    const h = await invoiceService.getCustomerHistoryByPhone(phone, { includeRemote: false });
    if (!h.invoices.length) return;
    const name = h.customer?.name || h.invoices[0].customerName || '';
    badge.innerHTML = `✅ عميل سابق: <strong>${name}</strong> — 🧾 ${h.invoices.length} فاتورة <u style="cursor:pointer;">(عرض السجل)</u>`;
    badge.style.display = 'inline-block';
    badge.style.cursor = 'pointer';
    badge.onclick = () => invoiceService.showCustomerHistoryModal(phone);
  },

  async updateTodayInvoicesBadge(container) {
    try {
      const today = await invoiceService.getTodayInvoices();
      const badge = container.querySelector('#cashierInvoicesCountBadge');
      if (badge) badge.textContent = today.length;
    } catch (e) {
      console.warn('Could not update badge:', e);
    }
  },

  showPostCashierPrintModal(invoice, parentContainer) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const waUrl = invoiceService.generateWhatsAppShareUrl(invoice);

    overlay.innerHTML = `
      <div class="modal-content" style="max-width:560px;text-align:center;padding:26px;">
        <div style="font-size:52px;margin-bottom:8px;">🎉</div>
        <h2 style="font-size:26px;font-weight:900;color:#34D399;margin-bottom:6px;">تم إصدار الفاتورة بنجاح!</h2>
        <p style="font-size:16px;color:var(--text-secondary);margin-bottom:18px;">
          رقم الفاتورة: <strong>${invoice.id}</strong> | العميل: <strong>${invoice.customerName}</strong><br>
          المطلوب: <strong>${invoice.netTotal} ج.م</strong> | المدفوع: <strong>${invoice.totalPaid} ج.م</strong>
        </p>

        <!-- أزرار العرض الإلكتروني والواتساب والطباعة -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
          <button type="button" class="btn btn-primary" id="btnOpenDigitalPDF"
            style="grid-column:1/-1;font-size:18px;font-weight:900;padding:14px;justify-content:center;gap:10px;background:linear-gradient(135deg, #2563EB, #1D4ED8);border:2px solid #60A5FA;box-shadow:0 6px 18px rgba(37,99,235,0.4);">
            <span>📸</span>
            <span>عرض الفاتورة PDF في تاب مستقلة (لتصوير الموبايل)</span>
          </button>

          ${waUrl ? `
            <a href="${waUrl}" target="WhatsAppTab" class="btn btn-success"
              style="grid-column:1/-1;font-size:17px;font-weight:900;padding:12px;text-decoration:none;justify-content:center;gap:10px;background:linear-gradient(135deg, #10B981, #059669);border:2px solid #34D399;color:#FFFFFF;border-radius:10px;box-shadow:0 6px 18px rgba(16,185,129,0.4);">
              <span>📱</span>
              <span>إرسال واتساب للعميل في التاب المفتوحة (${invoice.customerPhone})</span>
            </a>
          ` : ''}

          <button type="button" class="btn btn-secondary" id="btnA5PrintFast" style="font-size:16px;font-weight:800;padding:12px;justify-content:center;">
            📄 طباعة ورقية A4
          </button>

          <button type="button" class="btn btn-secondary" id="btnThermalPrintFast" style="font-size:16px;font-weight:800;padding:12px;justify-content:center;">
            🖨️ طباعة بون حراري
          </button>
        </div>

        <button type="button" class="btn btn-secondary" id="btnNextCustomer" style="width:100%;font-size:17px;font-weight:800;padding:12px;background:rgba(255,255,255,0.08);border:1px solid var(--border-color);">
          ➕ فاتورة جديدة للزبون التالي
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // فتح العرض الإلكتروني PDF
    overlay.querySelector('#btnOpenDigitalPDF').addEventListener('click', async () => {
      await invoiceService.openInvoicePdf(invoice);
    });

    // طباعة A4
    overlay.querySelector('#btnA5PrintFast').addEventListener('click', async () => {
      await invoiceService.printInvoice(invoice, 'standard');
    });

    // بون حراري
    overlay.querySelector('#btnThermalPrintFast').addEventListener('click', async () => {
      await invoiceService.printInvoice(invoice, 'thermal');
    });

    // عميل تالي
    overlay.querySelector('#btnNextCustomer').addEventListener('click', () => {
      overlay.remove();
      this.render(parentContainer);
    });
  }
};
