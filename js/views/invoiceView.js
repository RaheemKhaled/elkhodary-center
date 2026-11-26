/**
 * شاشة إنشاء الفاتورة وعملية الصيانة (Wizard تفاعلي خطوة بخطوة)
 * مصمم خصيصاً للفنيين: خطوات مبسطة، خطوط ضخمة، واختيار باللمس
 */

import { db } from '../db/indexeddb.js';
import { customerService } from '../services/customerService.js';
import { inventoryService } from '../services/inventoryService.js';
import { invoiceService } from '../services/invoiceService.js';
import { EgyptianPlatePicker } from '../components/platePicker.js?v=21';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';

export const invoiceView = {
  async render(container, params = {}) {
    // تحميل البيانات الأولية المطلوبة للمعالج
    const [servicesList, partsList, workersList] = await Promise.all([
      db.find('services', s => s.isActive !== false),
      inventoryService.getAllPartsWithStock(),
      db.find('workers', w => w.isActive !== false)
    ]);

    // حالة المعالج (State)
    this.state = {
      currentStep: 1,
      totalSteps: 5,
      customer: {
        id: null,
        name: '',
        phone: '',
        notes: ''
      },
      car: {
        id: null,
        brand: '',
        model: '',
        carType: 'سيدان',
        plateLetters: '',
        plateNumbers: '',
        plateFull: '',
        color: ''
      },
      selectedServices: [], // [{ id, name, price, addons: [], quantity: 1, customNote: '' }]
      selectedParts: [],    // [{ id, name, unitPrice, quantity, currentStock, totalPrice }]
      maintenance: {
        problem: '',
        diagnosis: '',
        futureNeeds: '',
        followUp: '',
        workers: []
      },
      payment: {
        discountType: 'none', // 'none' | 'fixed' | 'percentage'
        discountValue: 0,
        cashAmount: 0,
        vodafoneCashAmount: 0,
        instaPayAmount: 0
      }
    };

    // التحقق لو تم تمرير عميل مسبق
    if (params.customerId) {
      const fullProfile = await customerService.getCustomerFullProfile(params.customerId);
      if (fullProfile) {
        this.state.customer.id = fullProfile.id;
        this.state.customer.name = fullProfile.name;
        this.state.customer.phone = fullProfile.phone;
        if (fullProfile.cars && fullProfile.cars.length > 0) {
          const firstCar = fullProfile.cars[0];
          this.state.car.id = firstCar.id;
          this.state.car.brand = firstCar.brand;
          this.state.car.model = firstCar.model;
          this.state.car.carType = firstCar.carType || 'سيدان';
          this.state.car.plateLetters = firstCar.plateLetters;
          this.state.car.plateNumbers = firstCar.plateNumbers;
          this.state.car.plateFull = firstCar.plateFull;
        }
      }
    } else if (params.prefillQuery) {
      if (/^01[0-9]{9}$/.test(params.prefillQuery)) {
        this.state.customer.phone = params.prefillQuery;
      } else {
        this.state.customer.name = params.prefillQuery;
      }
    }

    this.renderWizardLayout(container, { servicesList, partsList, workersList });
  },

  renderWizardLayout(container, data) {
    container.innerHTML = `
      <div class="wizard-container">
        <!-- شريط الخطوات العلوي -->
        <div class="wizard-stepper">
          <div class="step-item ${this.state.currentStep === 1 ? 'active' : ''}" data-step="1">
            <div class="step-circle">1</div>
            <div class="step-label">العميل والعربية</div>
          </div>
          <div class="step-connector"></div>

          <div class="step-item ${this.state.currentStep === 2 ? 'active' : ''}" data-step="2">
            <div class="step-circle">2</div>
            <div class="step-label">الخدمات</div>
          </div>
          <div class="step-connector"></div>

          <div class="step-item ${this.state.currentStep === 3 ? 'active' : ''}" data-step="3">
            <div class="step-circle">3</div>
            <div class="step-label">قطع الغيار</div>
          </div>
          <div class="step-connector"></div>

          <div class="step-item ${this.state.currentStep === 4 ? 'active' : ''}" data-step="4">
            <div class="step-circle">4</div>
            <div class="step-label">التشخيص والعمالة</div>
          </div>
          <div class="step-connector"></div>

          <div class="step-item ${this.state.currentStep === 5 ? 'active' : ''}" data-step="5">
            <div class="step-circle">5</div>
            <div class="step-label">الحساب والدفع</div>
          </div>
        </div>

        <!-- =================== الخطوة 1: بيانات العميل والسيارة =================== -->
        <div class="wizard-step-content ${this.state.currentStep === 1 ? 'active' : ''}" id="stepContent-1">
          <div class="step-header-box">
            <h1 class="step-title">👤 بيانات العميل ونمرة السيارة</h1>
            <p class="step-subtitle">سجل رقم تليفون العميل ورقم اللوحة، وسيتم جلب بياناته تلقائياً إن كان مسجلاً من قبل.</p>
          </div>

          <div class="grid-2">
            <!-- بيانات العميل -->
            <div class="card">
              <h2 class="card-title">
                <span>📱</span>
                <span>بيانات العميل</span>
              </h2>

              <div class="form-group">
                <label class="form-label" for="custPhoneInput">
                  <span class="required">*</span> رقم التليفون (11 رقم يبدأ بـ 01)
                </label>
                <div style="display: flex; gap: 10px;">
                  <input 
                    type="tel" 
                    id="custPhoneInput" 
                    class="form-control" 
                    placeholder="مثال: 01012345678" 
                    value="${this.state.customer.phone}" 
                    maxlength="11"
                    style="font-size: 26px; font-weight: 800; letter-spacing: 2px;"
                  >
                  <button type="button" class="btn btn-secondary" id="btnLookupPhone" style="min-width: 110px;">فحص 🔍</button>
                </div>
                <div id="phoneError" class="form-error" style="display: none;"></div>
                <div id="customerExistingNotice" class="badge badge-success" style="display: none; margin-top: 10px; font-size: 16px;"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="custNameInput">
                  <span class="required">*</span> اسم العميل بالكامل
                </label>
                <input 
                  type="text" 
                  id="custNameInput" 
                  class="form-control" 
                  placeholder="مثال: محمد أحمد علي" 
                  value="${this.state.customer.name}"
                >
                <div id="nameError" class="form-error" style="display: none;"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="custNotesInput">ملاحظات على العميل (اختياري)</label>
                <input 
                  type="text" 
                  id="custNotesInput" 
                  class="form-control" 
                  placeholder="ملاحظات هامة..." 
                  value="${this.state.customer.notes || ''}"
                >
              </div>
            </div>

            <!-- بيانات السيارة ونمرة اللوحة المصرية -->
            <div class="card">
              <h2 class="card-title">
                <span>🚗</span>
                <span>بيانات السيارة واللوحة</span>
              </h2>

              <div class="form-group">
                <label class="form-label"><span class="required">*</span> نمرة العربية (3 حروف عربية + 4 أرقام):</label>
                <!-- مكان تثبيت أداة اختيار النمرة المصرية -->
                <div id="egyptianPlatePickerMount"></div>
                <div id="plateError" class="form-error" style="display: none;"></div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label" for="carBrandInput"><span class="required">*</span> ماركة العربية</label>
                  <input 
                    type="text" 
                    id="carBrandInput" 
                    class="form-control" 
                    placeholder="مثال: هيونداي / تويوتا" 
                    value="${this.state.car.brand}"
                  >
                </div>

                <div class="form-group">
                  <label class="form-label" for="carModelInput">الموديل / سنة الصنع</label>
                  <input 
                    type="text" 
                    id="carModelInput" 
                    class="form-control" 
                    placeholder="مثال: النترا 2021" 
                    value="${this.state.car.model}"
                  >
                </div>
              </div>

              <!-- اختيار نوع العربية بالضغط السريع (Chips) -->
              <div class="form-group">
                <label class="form-label">نوع العربية:</label>
                <div class="chips-container" id="carTypeChips">
                  ${['سيدان', 'SUV / جيب', 'هاتشباك', 'نقل / ميكروباص', 'فان'].map(type => `
                    <div class="choice-chip ${this.state.car.carType === type ? 'selected' : ''}" data-type="${type}">
                      ${type}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- =================== الخطوة 2: اختيار الخدمات المنفذة =================== -->
        <div class="wizard-step-content ${this.state.currentStep === 2 ? 'active' : ''}" id="stepContent-2">
          <div class="step-header-box">
            <h1 class="step-title">🔧 الخدمات المنفذة للسيارة</h1>
            <p class="step-subtitle">اضغط على الخدمة لاختيارها، ويمكنك تعديل سعر أي خدمة للفاتورة الحالية حسب الاتفاق مع العميل.</p>
          </div>

          <div class="card">
            <div id="servicesSelectionList">
              ${data.servicesList.map(srv => {
                const isSelected = this.state.selectedServices.some(s => s.id === srv.id);
                const currentSelected = this.state.selectedServices.find(s => s.id === srv.id);
                const currentPrice = currentSelected ? currentSelected.price : srv.defaultPrice;

                return `
                  <div class="service-card-item ${isSelected ? 'selected' : ''}" id="serviceCard-${srv.id}" data-srv-id="${srv.id}">
                    <div class="service-main-row">
                      <div class="service-info">
                        <input type="checkbox" class="service-checkbox" id="chk-${srv.id}" ${isSelected ? 'checked' : ''}>
                        <span class="service-name">${srv.name}</span>
                      </div>
                      <div class="service-price-edit">
                        <span style="font-size: 20px; font-weight: 700; color: #94A3B8;">السعر:</span>
                        <input 
                          type="number" 
                          class="form-control service-price-input" 
                          id="priceInput-${srv.id}" 
                          value="${currentPrice}" 
                          min="0"
                        >
                        <span style="font-size: 18px; font-weight: 700;">ج.م</span>
                      </div>
                    </div>

                    ${srv.isCustom ? `
                      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                        <input 
                          type="text" 
                          class="form-control custom-service-desc" 
                          id="customDesc-${srv.id}" 
                          placeholder="اكتب وصف شغل المخرطة أو التعديل المطلوب..." 
                          value="${currentSelected?.customNote || ''}"
                        >
                      </div>
                    ` : ''}

                    ${srv.hasAddons && srv.availableAddons && srv.availableAddons.length > 0 ? `
                      <div class="service-addons-container" id="addons-${srv.id}">
                        <div style="width: 100%; font-size: 18px; font-weight: 800; color: #93C5FD; margin-bottom: 6px;">
                          ➕ إضافات اختيارية لخدمة ${srv.name}:
                        </div>
                        ${srv.availableAddons.map(addon => {
                          const addonSelected = currentSelected?.addons?.some(a => a.id === addon.id);
                          return `
                            <div class="choice-chip addon-chip ${addonSelected ? 'selected' : ''}" data-srv-id="${srv.id}" data-addon-id="${addon.id}" data-price="${addon.defaultPrice}">
                              <span>${addon.name}</span>
                              <span class="chip-price">+${addon.defaultPrice} ج.م</span>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- =================== الخطوة 3: اختيار قطع الغيار من المخزن =================== -->
        <div class="wizard-step-content ${this.state.currentStep === 3 ? 'active' : ''}" id="stepContent-3">
          <div class="step-header-box">
            <h1 class="step-title">📦 قطع الغيار المستخدمة من المخزن</h1>
            <p class="step-subtitle">اختر القطع التي تم تركيبها أو بيعها للعميل وسيتم خصمها من المخزن تلقائياً.</p>
          </div>

          <div class="grid-2">
            <!-- قائمة القطع المتاحة -->
            <div class="card">
              <h2 class="card-title">
                <span>🔍</span>
                <span>قائمة قطع غيار المخزن</span>
              </h2>
              <input 
                type="text" 
                id="searchPartsInput" 
                class="form-control" 
                placeholder="ابحث عن قطعة غيار بالاسم أو التصنيف..." 
                style="margin-bottom: 16px;"
              >
              <div id="availablePartsContainer" style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
                <!-- تُملأ بالجافاسكربت -->
              </div>
            </div>

            <!-- القطع المختارة في الفاتورة -->
            <div class="card">
              <h2 class="card-title">
                <span>🛒</span>
                <span>القطع المضافة للفاتورة</span>
              </h2>
              <div id="selectedPartsContainer">
                <!-- قائمة القطع المختارة -->
              </div>
            </div>
          </div>
        </div>

        <!-- =================== الخطوة 4: المشكلة والتشخيص والعمالة =================== -->
        <div class="wizard-step-content ${this.state.currentStep === 4 ? 'active' : ''}" id="stepContent-4">
          <div class="step-header-box">
            <h1 class="step-title">📋 تشخيص الصيانة وتوزيع العمالة</h1>
            <p class="step-subtitle">سجل شكوى العميل وتشخيص العفشة والزوايا، واختر الفنيين المشاركين في العملية.</p>
          </div>

          <div class="grid-2">
            <div class="card">
              <h2 class="card-title">
                <span>🔎</span>
                <span>الشكوى والتشخيص الفني</span>
              </h2>

              <div class="form-group">
                <label class="form-label" for="problemInput">شكوى العميل والمشكلة:</label>
                <!-- اختيارات سريعة للشكاوى الشائعة -->
                <div class="chips-container" id="commonIssuesChips">
                  ${['حدفة يمين على السرعة', 'حدفة شمال', 'رعشة في الطارة فوق 90', 'تآكل الكاوتش من الداخل', 'صوت خبط ودبدبة في العفشة', 'عومان العربية في الملفات'].map(issue => `
                    <div class="choice-chip issue-chip" data-issue="${issue}">
                      ${issue}
                    </div>
                  `).join('')}
                </div>
                <textarea id="problemInput" class="form-control" placeholder="اكتب وصف المشكلة...">${this.state.maintenance.problem}</textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="diagnosisInput">تشخيص المشكلة الفعلي:</label>
                <textarea id="diagnosisInput" class="form-control" placeholder="ما تم اكتشافه بعد الفحص...">${this.state.maintenance.diagnosis}</textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="futureNeedsInput">احتياجات وتوصيات مستقبلية (للزيارة القادمة):</label>
                <input type="text" id="futureNeedsInput" class="form-control" placeholder="مثال: تغيير بارات دركسيون بعد 3000 كم..." value="${this.state.maintenance.futureNeeds}">
              </div>

              <div class="form-group">
                <label class="form-label" for="followUpInput">متابعة الصيانة بعد التسليم:</label>
                <input type="text" id="followUpInput" class="form-control" placeholder="مثال: تجربة الطريق ممتازة والدركسيون مستقيم..." value="${this.state.maintenance.followUp}">
              </div>
            </div>

            <!-- اختيار الفنيين المشاركين -->
            <div class="card">
              <h2 class="card-title">
                <span>👨‍🔧</span>
                <span>العمالة المشاركة في الصيانة</span>
              </h2>
              <p style="color: var(--text-muted); font-size: 18px; margin-bottom: 16px;">
                اضغط لاختيار الفني أو أكثر من فني لحساب نسبة إنجاز كل عامل:
              </p>
              <div class="chips-container" id="workersChips">
                ${data.workersList.map(w => {
                  const isSelected = this.state.maintenance.workers.includes(w.name);
                  return `
                    <div class="choice-chip worker-chip ${isSelected ? 'selected' : ''}" data-worker-name="${w.name}" style="padding: 16px 24px; font-size: 22px;">
                      <span>👨‍🔧 ${w.name}</span>
                      <small style="font-size: 16px; color: #94A3B8;">(${w.specialty || 'فني'})</small>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- =================== الخطوة 5: الحسابات، الخصم والدفع =================== -->
        <div class="wizard-step-content ${this.state.currentStep === 5 ? 'active' : ''}" id="stepContent-5">
          <div class="step-header-box">
            <h1 class="step-title">💵 الحساب الإجمالي وطرق الدفع</h1>
            <p class="step-subtitle">راجع إجمالي الخدمات وقطع الغيار، وحدد الخصم وطرق الدفع والمدفوع.</p>
          </div>

          <div class="grid-2">
            <!-- تفاصيل الحساب والخصم -->
            <div class="card">
              <h2 class="card-title">
                <span>🧾</span>
                <span>المبالغ والخصم</span>
              </h2>

              <div class="calc-summary-card" id="calculationBreakdownBox">
                <!-- يتم تحديثه ديناميكياً -->
              </div>

              <div style="margin-top: 24px;">
                <label class="form-label">الخصم للعميل (إن وجد):</label>
                <div class="chips-container" id="discountTypeChips">
                  <div class="choice-chip ${this.state.payment.discountType === 'none' ? 'selected' : ''}" data-disc="none">بدون خصم</div>
                  <div class="choice-chip ${this.state.payment.discountType === 'fixed' ? 'selected' : ''}" data-disc="fixed">مبلغ ثابت (ج.م)</div>
                  <div class="choice-chip ${this.state.payment.discountType === 'percentage' ? 'selected' : ''}" data-disc="percentage">نسبة مئوية (%)</div>
                </div>

                <div id="discountValueWrapper" style="display: ${this.state.payment.discountType === 'none' ? 'none' : 'block'}; margin-top: 12px;">
                  <input 
                    type="number" 
                    id="discountValueInput" 
                    class="form-control" 
                    placeholder="قيمة الخصم..." 
                    value="${this.state.payment.discountValue || 0}" 
                    min="0"
                  >
                </div>
              </div>
            </div>

            <!-- طرق الدفع (نقدي / فودافون / إنستا) والتحذيرات -->
            <div class="card">
              <h2 class="card-title">
                <span>💳</span>
                <span>طرق الدفع والتسديد</span>
              </h2>

              <div class="form-group">
                <label class="form-label" for="cashAmountInput">💵 مبلغ نقدي (كاش):</label>
                <input 
                  type="number" 
                  id="cashAmountInput" 
                  class="form-control" 
                  value="${this.state.payment.cashAmount}" 
                  min="0"
                  style="font-size: 26px; font-weight: 800; color: #34D399;"
                >
              </div>

              <div class="form-group">
                <label class="form-label" for="vodafoneAmountInput">📱 مبلغ فودافون كاش (إن وجد):</label>
                <input 
                  type="number" 
                  id="vodafoneAmountInput" 
                  class="form-control" 
                  value="${this.state.payment.vodafoneCashAmount}" 
                  min="0"
                  style="font-size: 26px; font-weight: 800; color: #EF4444;"
                >
              </div>

              <div class="form-group">
                <label class="form-label" for="instaPayAmountInput">🏦 مبلغ إنستا باي (إن وجد):</label>
                <input 
                  type="number" 
                  id="instaPayAmountInput" 
                  class="form-control" 
                  value="${this.state.payment.instaPayAmount}" 
                  min="0"
                  style="font-size: 26px; font-weight: 800; color: #A78BFA;"
                >
              </div>

              <!-- زر تعيين المدفوع بالكامل نقدي بضغطة زر -->
              <button type="button" class="btn btn-secondary" id="btnFillTotalCash" style="width: 100%; margin-bottom: 16px;">
                ⚡ تم السداد بالكامل نقداً (كاش)
              </button>

              <div id="paymentWarningAlert" style="display: none; padding: 16px; border-radius: var(--radius-md); font-size: 20px; font-weight: 800; margin-bottom: 16px;"></div>
            </div>
          </div>
        </div>

        <!-- =================== الشريط السفلي الثابت للتنقل والأوامر =================== -->
        <div class="wizard-footer-nav">
          <div class="nav-summary-badge" id="bottomLiveSummary">
            <span>الإجمالي: <strong id="liveSummaryNetTotal">0</strong> ج.م</span>
          </div>

          <div class="nav-buttons-group">
            <button type="button" class="btn btn-secondary" id="btnWizardCancel" style="border-color: #EF4444; color: #FCA5A5;">
              ❌ إلغاء
            </button>

            <button type="button" class="btn btn-secondary" id="btnWizardPrev" style="display: none;">
              السابق ➡️
            </button>

            <button type="button" class="btn btn-primary" id="btnWizardNext" style="min-width: 160px;">
              التالي ⬅️
            </button>

            <button type="button" class="btn btn-success" id="btnWizardSaveAndPrint" style="display: none; min-width: 200px;">
              💾 حفظ وطباعة الفاتورة 🖨️
            </button>
          </div>
        </div>
      </div>
    `;

    this.initInteractiveComponents(container, data);
  },

  initInteractiveComponents(container, data) {
    // 1. تثبيت منتقي اللوحة المصرية
    this.platePicker = new EgyptianPlatePicker({
      containerId: 'egyptianPlatePickerMount',
      initialLetters: this.state.car.plateLetters,
      initialNumbers: this.state.car.plateNumbers,
      initialType: this.state.car.plateType || 'private',
      onChange: (val) => {
        this.state.car.plateLetters = val.letters;
        this.state.car.plateNumbers = val.numbers;
        this.state.car.plateFull = val.plateFull;
        this.state.car.plateType = val.plateType;

        // بحث تلقائي برقم اللوحة إذا اكتملت
        if (val.isValid && !this.state.customer.id) {
          customerService.findByPlate(val.letters, val.numbers).then(res => {
            if (res && res.customer) {
              this.applyExistingCustomerAndCar(container, res.customer, res.car);
            }
          });
        }
      }
    });

    // 2. فحص التليفون التلقائي
    const phoneInput = container.querySelector('#custPhoneInput');
    const lookupBtn = container.querySelector('#btnLookupPhone');
    const checkPhone = async () => {
      const phone = phoneInput.value.trim();
      if (phone.length === 11 && phone.startsWith('01')) {
        const found = await customerService.findByPhone(phone);
        if (found) {
          this.applyExistingCustomerAndCar(container, found, null);
        }
      }
    };
    phoneInput.addEventListener('blur', checkPhone);
    lookupBtn.addEventListener('click', checkPhone);

    // 3. شرائح نوع العربية
    container.querySelectorAll('#carTypeChips .choice-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('#carTypeChips .choice-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        this.state.car.carType = chip.getAttribute('data-type');
      });
    });

    // 4. خدمات الصيانة (الخطوة 2)
    this.bindServicesEvents(container, data.servicesList);

    // 5. قطع الغيار (الخطوة 3)
    this.bindPartsEvents(container, data.partsList);

    // 6. المشاكل والعمالة (الخطوة 4)
    this.bindMaintenanceDetailsEvents(container);

    // 7. الحسابات وطرق الدفع (الخطوة 5)
    this.bindPaymentEvents(container);

    // 8. التنقل في الـ Wizard
    this.bindNavigationEvents(container, data);

    // تحديث الملخص المالي الأولي
    this.updateCalculationsDisplay(container);
  },

  applyExistingCustomerAndCar(container, customer, car) {
    this.state.customer.id = customer.id;
    this.state.customer.name = customer.name;
    this.state.customer.phone = customer.phone;
    container.querySelector('#custNameInput').value = customer.name;
    container.querySelector('#custPhoneInput').value = customer.phone;

    const notice = container.querySelector('#customerExistingNotice');
    if (notice) {
      notice.style.display = 'inline-block';
      notice.textContent = `✅ عميل مسجل لدينا سابقاً: ${customer.name} (${customer.computed?.visitsCount || 1} زيارة)`;
    }

    // كل عربيات العميل تظهر للاختيار (مش أول واحدة بس) + عربية جديدة
    const cars = (customer.cars && customer.cars.length) ? customer.cars : (car ? [car] : []);
    let chooser = container.querySelector('#wizardCarChooser');
    if (!chooser && notice) {
      chooser = document.createElement('div');
      chooser.id = 'wizardCarChooser';
      chooser.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:10px 0;';
      notice.insertAdjacentElement('afterend', chooser);
    }
    const pick = (c) => {
      this.state.car.id = c ? c.id : null;
      this.state.car.brand = c ? c.brand || '' : '';
      this.state.car.model = c ? c.model || '' : '';
      this.state.car.carType = (c && c.carType) || 'سيدان';
      container.querySelector('#carBrandInput').value = this.state.car.brand;
      container.querySelector('#carModelInput').value = this.state.car.model;
      this.platePicker.setValues(c ? c.plateLetters || '' : '', c ? c.plateNumbers || '' : '', (c && c.plateType) || 'private');
      chooser?.querySelectorAll('.wiz-car').forEach(b => {
        const on = (b.dataset.carId || '') === (c ? c.id : '');
        b.style.background = on ? '#2563EB' : '';
        b.style.color = on ? '#FFFFFF' : '';
      });
    };
    if (chooser) {
      chooser.innerHTML = `<span style="font-size:16px;font-weight:800;color:var(--text-secondary);">🚗 عربيات العميل (${cars.length}):</span>` +
        cars.map(c => `<button type="button" class="btn btn-secondary wiz-car" data-car-id="${c.id}" style="font-size:15px;padding:6px 14px;border-radius:18px;">${c.brand || ''} ${c.model || ''} ${c.plateFull ? `[${c.plateFull}]` : ''}</button>`).join('') +
        `<button type="button" class="btn btn-secondary wiz-car" data-car-id="" style="font-size:15px;padding:6px 14px;border-radius:18px;border-style:dashed;">➕ عربية جديدة</button>`;
      chooser.querySelectorAll('.wiz-car').forEach(b => b.addEventListener('click', () => pick(cars.find(c => c.id === b.dataset.carId) || null)));
    }
    const initial = car && cars.find(c => c.id === car.id) ? cars.find(c => c.id === car.id) : cars[0];
    if (initial) pick(initial);
    toast.success(`تم جلب بيانات العميل ${customer.name} تلقائياً${cars.length > 1 ? ` (${cars.length} عربيات)` : ''}`);
  },

  bindServicesEvents(container, servicesList) {
    // اختيار الخدمة الرئيسية
    servicesList.forEach(srv => {
      const card = container.querySelector(`#serviceCard-${srv.id}`);
      const chk = container.querySelector(`#chk-${srv.id}`);
      const priceInput = container.querySelector(`#priceInput-${srv.id}`);
      const customDesc = container.querySelector(`#customDesc-${srv.id}`);

      const toggleService = () => {
        const isChecked = chk.checked;
        if (isChecked) {
          card.classList.add('selected');
          const existing = this.state.selectedServices.find(s => s.id === srv.id);
          if (!existing) {
            this.state.selectedServices.push({
              id: srv.id,
              name: srv.name,
              price: Number(priceInput.value) || srv.defaultPrice,
              addons: [],
              quantity: 1,
              customNote: customDesc ? customDesc.value : ''
            });
          }
        } else {
          card.classList.remove('selected');
          this.state.selectedServices = this.state.selectedServices.filter(s => s.id !== srv.id);
        }
        this.updateCalculationsDisplay(container);
      };

      chk.addEventListener('change', toggleService);

      // تحديث السعر الفوري
      priceInput.addEventListener('input', () => {
        const item = this.state.selectedServices.find(s => s.id === srv.id);
        if (item) {
          item.price = Number(priceInput.value) || 0;
          this.updateCalculationsDisplay(container);
        }
      });

      if (customDesc) {
        customDesc.addEventListener('input', () => {
          const item = this.state.selectedServices.find(s => s.id === srv.id);
          if (item) {
            item.customNote = customDesc.value;
          }
        });
      }
    });

    // الإضافات التابعة للخدمة (برستا، مساعد، مقص، زرجينة...)
    container.querySelectorAll('.addon-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const srvId = chip.getAttribute('data-srv-id');
        const addonId = chip.getAttribute('data-addon-id');
        const addonPrice = Number(chip.getAttribute('data-price')) || 0;
        const addonName = chip.querySelector('span').textContent;

        const srvChk = container.querySelector(`#chk-${srvId}`);
        if (!srvChk.checked) {
          srvChk.checked = true;
          srvChk.dispatchEvent(new Event('change'));
        }

        const srvItem = this.state.selectedServices.find(s => s.id === srvId);
        if (!srvItem) return;

        chip.classList.toggle('selected');
        const hasAddon = chip.classList.contains('selected');

        if (hasAddon) {
          srvItem.addons.push({ id: addonId, name: addonName, price: addonPrice });
        } else {
          srvItem.addons = srvItem.addons.filter(a => a.id !== addonId);
        }
        this.updateCalculationsDisplay(container);
      });
    });
  },

  bindPartsEvents(container, allParts) {
    const availableContainer = container.querySelector('#availablePartsContainer');
    const selectedContainer = container.querySelector('#selectedPartsContainer');
    const searchInput = container.querySelector('#searchPartsInput');

    const renderAvailable = (filterText = '') => {
      const q = filterText.toLowerCase().trim();
      const filtered = allParts.filter(p => !q || p.name.toLowerCase().includes(q) || (p.category && p.category.includes(q)));

      availableContainer.innerHTML = filtered.map(p => `
        <div style="background: var(--bg-surface-elevated); border: 2px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #FFFFFF;">${p.name}</div>
            <div style="font-size: 16px; color: ${p.isLowStock ? '#F87171' : '#34D399'}; font-weight: 700;">
              المتاح بالمخزن: ${p.currentStock} قطعة ${p.isLowStock ? '⚠️ (قارب على النفاد)' : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 22px; font-weight: 900; color: #FBBF24;">${p.sellPrice} ج.م</span>
            <button type="button" class="btn btn-primary btn-add-part" data-part-id="${p.id}" style="padding: 8px 16px; min-height: 48px;">
              ➕ إضافة
            </button>
          </div>
        </div>
      `).join('');

      availableContainer.querySelectorAll('.btn-add-part').forEach(btn => {
        btn.addEventListener('click', () => {
          const partId = btn.getAttribute('data-part-id');
          const part = allParts.find(p => p.id === partId);
          if (!part) return;

          const existing = this.state.selectedParts.find(p => p.id === partId);
          if (existing) {
            existing.quantity += 1;
            existing.totalPrice = existing.quantity * existing.unitPrice;
          } else {
            this.state.selectedParts.push({
              id: part.id,
              name: part.name,
              unitPrice: part.sellPrice,
              quantity: 1,
              currentStock: part.currentStock,
              totalPrice: part.sellPrice
            });
          }
          renderSelected();
          this.updateCalculationsDisplay(container);
          toast.success(`تمت إضافة ${part.name}`);
        });
      });
    };

    const renderSelected = () => {
      if (this.state.selectedParts.length === 0) {
        selectedContainer.innerHTML = `
          <div style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 20px;">
            لم يتم اختيار أي قطع غيار بعد. اختر من القائمة على اليمين.
          </div>
        `;
        return;
      }

      selectedContainer.innerHTML = this.state.selectedParts.map((p, idx) => `
        <div style="background: var(--bg-input); border: 2px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-size: 20px; font-weight: 800; color: #FFFFFF;">${p.name}</div>
            <div style="font-size: 16px; color: #94A3B8;">سعر الوحدة: ${p.unitPrice} ج.م</div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-qty-minus" data-idx="${idx}" style="min-height: 44px; padding: 8px 14px; font-size: 22px;">-</button>
            <span style="font-size: 24px; font-weight: 900; min-width: 32px; text-align: center;">${p.quantity}</span>
            <button type="button" class="btn btn-secondary btn-qty-plus" data-idx="${idx}" style="min-height: 44px; padding: 8px 14px; font-size: 22px;">+</button>
            <span style="font-size: 22px; font-weight: 900; color: #38BDF8; min-width: 90px; text-align: left;">${p.totalPrice} ج.م</span>
            <button type="button" class="btn btn-danger btn-remove-part" data-idx="${idx}" style="min-height: 44px; padding: 8px 12px;">🗑️</button>
          </div>
        </div>
      `).join('');

      selectedContainer.querySelectorAll('.btn-qty-minus').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-idx'));
          if (this.state.selectedParts[idx].quantity > 1) {
            this.state.selectedParts[idx].quantity -= 1;
            this.state.selectedParts[idx].totalPrice = this.state.selectedParts[idx].quantity * this.state.selectedParts[idx].unitPrice;
          } else {
            this.state.selectedParts.splice(idx, 1);
          }
          renderSelected();
          this.updateCalculationsDisplay(container);
        });
      });

      selectedContainer.querySelectorAll('.btn-qty-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-idx'));
          this.state.selectedParts[idx].quantity += 1;
          this.state.selectedParts[idx].totalPrice = this.state.selectedParts[idx].quantity * this.state.selectedParts[idx].unitPrice;
          renderSelected();
          this.updateCalculationsDisplay(container);
        });
      });

      selectedContainer.querySelectorAll('.btn-remove-part').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-idx'));
          this.state.selectedParts.splice(idx, 1);
          renderSelected();
          this.updateCalculationsDisplay(container);
        });
      });
    };

    searchInput.addEventListener('input', (e) => renderAvailable(e.target.value));
    renderAvailable();
    renderSelected();
  },

  bindMaintenanceDetailsEvents(container) {
    // شرائح الشكاوى الشائعة
    container.querySelectorAll('.issue-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const issue = chip.getAttribute('data-issue');
        const problemInput = container.querySelector('#problemInput');
        if (problemInput.value.includes(issue)) {
          problemInput.value = problemInput.value.replace(issue, '').trim();
          chip.classList.remove('selected');
        } else {
          problemInput.value = (problemInput.value + ' ' + issue).trim();
          chip.classList.add('selected');
        }
        this.state.maintenance.problem = problemInput.value;
      });
    });

    container.querySelector('#problemInput').addEventListener('input', (e) => {
      this.state.maintenance.problem = e.target.value;
    });
    container.querySelector('#diagnosisInput').addEventListener('input', (e) => {
      this.state.maintenance.diagnosis = e.target.value;
    });
    container.querySelector('#futureNeedsInput').addEventListener('input', (e) => {
      this.state.maintenance.futureNeeds = e.target.value;
    });
    container.querySelector('#followUpInput').addEventListener('input', (e) => {
      this.state.maintenance.followUp = e.target.value;
    });

    // شرائح العمالة
    container.querySelectorAll('.worker-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const wName = chip.getAttribute('data-worker-name');
        chip.classList.toggle('selected');
        if (chip.classList.contains('selected')) {
          if (!this.state.maintenance.workers.includes(wName)) {
            this.state.maintenance.workers.push(wName);
          }
        } else {
          this.state.maintenance.workers = this.state.maintenance.workers.filter(w => w !== wName);
        }
      });
    });
  },

  bindPaymentEvents(container) {
    // شرائح نوع الخصم
    container.querySelectorAll('#discountTypeChips .choice-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('#discountTypeChips .choice-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        const discType = chip.getAttribute('data-disc');
        this.state.payment.discountType = discType;

        const valWrapper = container.querySelector('#discountValueWrapper');
        if (discType === 'none') {
          valWrapper.style.display = 'none';
          this.state.payment.discountValue = 0;
        } else {
          valWrapper.style.display = 'block';
        }
        this.updateCalculationsDisplay(container);
      });
    });

    // قيمة الخصم
    const discInput = container.querySelector('#discountValueInput');
    discInput.addEventListener('input', () => {
      this.state.payment.discountValue = Number(discInput.value) || 0;
      this.updateCalculationsDisplay(container);
    });

    // طرق الدفع
    const cashInput = container.querySelector('#cashAmountInput');
    const vodafoneInput = container.querySelector('#vodafoneAmountInput');
    const instaPayInput = container.querySelector('#instaPayAmountInput');

    const onPaymentInput = () => {
      this.state.payment.cashAmount = Number(cashInput.value) || 0;
      this.state.payment.vodafoneCashAmount = Number(vodafoneInput.value) || 0;
      this.state.payment.instaPayAmount = Number(instaPayInput.value) || 0;
      this.updateCalculationsDisplay(container);
    };

    cashInput.addEventListener('input', onPaymentInput);
    vodafoneInput.addEventListener('input', onPaymentInput);
    instaPayInput.addEventListener('input', onPaymentInput);

    // زر تعبئة كامل المبلغ نقداً
    container.querySelector('#btnFillTotalCash').addEventListener('click', () => {
      const totals = invoiceService.calculateTotals({
        services: this.state.selectedServices,
        parts: this.state.selectedParts,
        discountType: this.state.payment.discountType,
        discountValue: this.state.payment.discountValue
      });
      cashInput.value = totals.netTotal;
      vodafoneInput.value = 0;
      instaPayInput.value = 0;
      onPaymentInput();
      toast.info('تم تعيين كامل المبلغ المطلوب نقداً');
    });
  },

  updateCalculationsDisplay(container) {
    const totals = invoiceService.calculateTotals({
      services: this.state.selectedServices,
      parts: this.state.selectedParts,
      discountType: this.state.payment.discountType,
      discountValue: this.state.payment.discountValue,
      cash: this.state.payment.cashAmount,
      vodafone: this.state.payment.vodafoneCashAmount,
      instapay: this.state.payment.instaPayAmount
    });

    // تحديث الملخص في الخطوة 5
    const breakdownBox = container.querySelector('#calculationBreakdownBox');
    if (breakdownBox) {
      breakdownBox.innerHTML = `
        <div class="calc-row">
          <span>إجمالي الخدمات المنفذة:</span>
          <strong>${totals.servicesTotal} ج.م</strong>
        </div>
        <div class="calc-row">
          <span>إجمالي قطع الغيار:</span>
          <strong>${totals.partsTotal} ج.م</strong>
        </div>
        <div class="calc-row">
          <span>المجموع قبل الخصم:</span>
          <strong>${totals.subTotal} ج.م</strong>
        </div>
        ${totals.discountAmount > 0 ? `
          <div class="calc-row" style="color: #34D399;">
            <span>الخصم المطبق:</span>
            <strong>-${totals.discountAmount} ج.م</strong>
          </div>
        ` : ''}
        <div class="calc-row total-highlight">
          <span>الإجمالي النهائي المطلوب:</span>
          <span>${totals.netTotal} ج.م</span>
        </div>
        <div class="calc-row paid-highlight">
          <span>إجمالي المدفوع:</span>
          <span>${totals.totalPaid} ج.م</span>
        </div>
        <div class="calc-row ${totals.remainingBalance > 0 ? 'remaining-highlight' : ''}">
          <span>المتبقي:</span>
          <span>${totals.remainingBalance} ج.م</span>
        </div>
      `;
    }

    // تنبيه عدم تطابق المدفوع مع الإجمالي
    const warningAlert = container.querySelector('#paymentWarningAlert');
    if (warningAlert) {
      if (totals.paymentWarning) {
        warningAlert.style.display = 'block';
        if (totals.totalPaid < totals.netTotal) {
          warningAlert.style.background = 'rgba(239, 68, 68, 0.2)';
          warningAlert.style.border = '2px solid #EF4444';
          warningAlert.style.color = '#FCA5A5';
        } else {
          warningAlert.style.background = 'rgba(245, 158, 11, 0.2)';
          warningAlert.style.border = '2px solid #F59E0B';
          warningAlert.style.color = '#FDE68A';
        }
        warningAlert.innerHTML = `⚠️ تنبيه الدفع: ${totals.paymentWarning}`;
      } else {
        warningAlert.style.display = 'none';
      }
    }

    // الشريط السفلي الحي
    const liveNet = container.querySelector('#liveSummaryNetTotal');
    if (liveNet) {
      liveNet.textContent = totals.netTotal;
    }
  },

  validateStep(stepNumber, container) {
    if (stepNumber === 1) {
      const nameInput = container.querySelector('#custNameInput');
      const phoneInput = container.querySelector('#custPhoneInput');
      const brandInput = container.querySelector('#carBrandInput');
      const nameErr = container.querySelector('#nameError');
      const phoneErr = container.querySelector('#phoneError');
      const plateErr = container.querySelector('#plateError');

      nameErr.style.display = 'none';
      phoneErr.style.display = 'none';
      plateErr.style.display = 'none';

      let isValid = true;
      const phoneCheck = customerService.validateEgyptianPhone(phoneInput.value);
      if (!phoneCheck.isValid) {
        phoneErr.style.display = 'flex';
        phoneErr.textContent = `❌ ${phoneCheck.message}`;
        phoneInput.focus();
        isValid = false;
      }

      if (!nameInput.value.trim()) {
        nameErr.style.display = 'flex';
        nameErr.textContent = '❌ اسم العميل مطلوب';
        if (isValid) nameInput.focus();
        isValid = false;
      }

      const plateVal = this.platePicker.getValue();
      if (!plateVal.isValid) {
        plateErr.style.display = 'flex';
        plateErr.textContent = plateVal.isGovernment 
          ? '❌ يرجى إدخال رقم اللوحة أو الحروف للسيارة الحكومية' 
          : '❌ يرجى إدخال حروف اللوحة (3 حروف) وأرقام اللوحة (حتى 4 أرقام)';
        isValid = false;
      }

      if (!brandInput.value.trim()) {
        brandInput.value = 'هيونداي'; // ماركة افتراضية شائعة لو تركها فارغة
      }

      if (isValid) {
        this.state.customer.name = nameInput.value.trim();
        this.state.customer.phone = phoneCheck.cleaned;
        this.state.customer.notes = container.querySelector('#custNotesInput').value.trim();
        this.state.car.brand = brandInput.value.trim();
        this.state.car.model = container.querySelector('#carModelInput').value.trim();
        this.state.car.plateLetters = plateVal.letters;
        this.state.car.plateNumbers = plateVal.numbers;
        this.state.car.plateFull = plateVal.plateFull;
        this.state.car.plateType = plateVal.plateType;
      }
      return isValid;
    }

    if (stepNumber === 2) {
      if (this.state.selectedServices.length === 0 && this.state.selectedParts.length === 0) {
        // يسمح بالمرور للخطوة 3 إذا كان يريد فقط بيع قطع غيار بدون خدمات
        return true;
      }
      return true;
    }

    if (stepNumber === 3) {
      if (this.state.selectedServices.length === 0 && this.state.selectedParts.length === 0) {
        toast.warning('يرجى اختيار خدمة صيانة واحدة على الأقل أو قطعة غيار واحدة للفاتورة');
        return false;
      }
      return true;
    }

    return true;
  },

  bindNavigationEvents(container, data) {
    const btnNext = container.querySelector('#btnWizardNext');
    const btnPrev = container.querySelector('#btnWizardPrev');
    const btnCancel = container.querySelector('#btnWizardCancel');
    const btnSaveAndPrint = container.querySelector('#btnWizardSaveAndPrint');

    const updateStepViews = () => {
      // إخفاء/إظهار محتوى الخطوة
      for (let i = 1; i <= this.state.totalSteps; i++) {
        const stepEl = container.querySelector(`#stepContent-${i}`);
        const stepNav = container.querySelector(`.step-item[data-step="${i}"]`);
        if (stepEl) {
          if (i === this.state.currentStep) {
            stepEl.classList.add('active');
            stepNav?.classList.add('active');
          } else {
            stepEl.classList.remove('active');
            stepNav?.classList.remove('active');
            if (i < this.state.currentStep) {
              stepNav?.classList.add('completed');
            }
          }
        }
      }

      // أزرار الشريط السفلي
      if (this.state.currentStep === 1) {
        btnPrev.style.display = 'none';
      } else {
        btnPrev.style.display = 'inline-flex';
      }

      if (this.state.currentStep === this.state.totalSteps) {
        btnNext.style.display = 'none';
        btnSaveAndPrint.style.display = 'inline-flex';
        // تعيين الافتراضي عند الوصول للخطوة 5
        if (this.state.payment.cashAmount === 0 && this.state.payment.vodafoneCashAmount === 0 && this.state.payment.instaPayAmount === 0) {
          const totals = invoiceService.calculateTotals({
            services: this.state.selectedServices,
            parts: this.state.selectedParts,
            discountType: this.state.payment.discountType,
            discountValue: this.state.payment.discountValue
          });
          this.state.payment.cashAmount = totals.netTotal;
          container.querySelector('#cashAmountInput').value = totals.netTotal;
        }
        this.updateCalculationsDisplay(container);
      } else {
        btnNext.style.display = 'inline-flex';
        btnSaveAndPrint.style.display = 'none';
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    btnNext.addEventListener('click', () => {
      if (this.validateStep(this.state.currentStep, container)) {
        if (this.state.currentStep < this.state.totalSteps) {
          this.state.currentStep += 1;
          updateStepViews();
        }
      }
    });

    btnPrev.addEventListener('click', () => {
      if (this.state.currentStep > 1) {
        this.state.currentStep -= 1;
        updateStepViews();
      }
    });

    btnCancel.addEventListener('click', async () => {
      const confirmed = await modal.confirm({
        title: 'إلغاء الفاتورة',
        message: 'هل أنت متأكد من إلغاء إنشاء الفاتورة والعودة للرئيسية؟ سيتم فقد البيانات المدخلة.',
        confirmText: 'نعم، إلغاء الفاتورة',
        cancelText: 'الاستمرار في الفاتورة',
        type: 'danger'
      });
      if (confirmed) {
        window.app.navigate('home');
      }
    });

    btnSaveAndPrint.addEventListener('click', async () => {
      // ضغطة واحدة بس عشان الفاتورة متتسجلش مرتين
      if (btnSaveAndPrint.disabled) return;
      btnSaveAndPrint.disabled = true;
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
                <div>جاري حفظ الفاتورة وتجهيز صفحة الـ PDF...</div>
              </div>
            </body>
            </html>
          `);
        }
      } catch (e) {
        console.warn('Could not pre-open tab synchronously:', e);
      }

      const ok = await this.saveAndProcessInvoice(container, preOpenedTab);
      if (!ok) btnSaveAndPrint.disabled = false;
    });
  },

  async saveAndProcessInvoice(container, preOpenedTab = null) {
    try {
      const invoice = await invoiceService.createMaintenanceInvoice({
        customer: this.state.customer,
        car: this.state.car,
        services: this.state.selectedServices,
        parts: this.state.selectedParts,
        problem: this.state.maintenance.problem,
        diagnosis: this.state.maintenance.diagnosis,
        futureNeeds: this.state.maintenance.futureNeeds,
        followUp: this.state.maintenance.followUp,
        workers: this.state.maintenance.workers,
        discountType: this.state.payment.discountType,
        discountValue: this.state.payment.discountValue,
        cashAmount: this.state.payment.cashAmount,
        vodafoneCashAmount: this.state.payment.vodafoneCashAmount,
        instaPayAmount: this.state.payment.instaPayAmount
      });

      toast.success(`تم حفظ الفاتورة بنجاح برقم: ${invoice.id}`);

      // فتح الفاتورة الرقمية في تاب مستقلة لكي يصورها العميل بموبايله مباشرة
      await invoiceService.deliverNewInvoice(invoice, preOpenedTab);

      this.showPostSaveModal(invoice);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(`حدث خطأ أثناء حفظ الفاتورة: ${error.message}`);
      return false;
    }
  },

  // نافذة الطباعة والمشاركة بعد حفظ الفاتورة
  showPostSaveModal(invoice) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const waUrl = invoiceService.generateWhatsAppShareUrl(invoice);

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 720px; text-align: center;">
        <div style="font-size: 54px; margin-bottom: 12px;">🎉</div>
        <h2 style="font-size: 32px; font-weight: 900; color: #34D399; margin-bottom: 8px;">تم حفظ الفاتورة بنجاح!</h2>
        <p style="font-size: 22px; color: var(--text-secondary); margin-bottom: 24px;">
          رقم الفاتورة: <strong>${invoice.id}</strong> | العميل: <strong>${invoice.customerName}</strong>
          <br>
          الإجمالي: <strong>${invoice.netTotal} ج.م</strong> | المدفوع: <strong>${invoice.totalPaid} ج.م</strong>
        </p>

        <div class="grid-2" style="margin-bottom: 24px;">
          <button type="button" class="btn btn-primary" id="btnWizardOpenDigital" style="grid-column: 1 / -1; font-size: 20px; font-weight: 900; padding: 18px; background: linear-gradient(135deg, #2563EB, #1D4ED8); border: 3px solid #60A5FA; justify-content: center; gap: 12px; box-shadow: 0 6px 20px rgba(37,99,235,0.4);">
            <span>📸</span>
            <span>عرض الفاتورة PDF في تاب مستقلة (لتصوير الموبايل) 📱</span>
          </button>
          <button type="button" class="btn btn-secondary" id="btnPrintThermal" style="font-size: 18px; padding: 14px; justify-content: center;">
            🖨️ طباعة بون حراري (80mm)
          </button>
          <button type="button" class="btn btn-secondary" id="btnPrintA5" style="font-size: 18px; padding: 14px; justify-content: center;">
            📄 طباعة ورقية A4
          </button>
          ${waUrl ? `
            <a href="${waUrl}" target="WhatsAppTab" class="btn btn-success" style="grid-column: 1 / -1; font-size: 17px; font-weight: 800; padding: 12px; text-decoration: none; justify-content: center; background: rgba(16,185,129,0.15); border: 1px dashed #10B981; color: #34D399;">
              📱 إرسال الفاتورة عبر الواتساب في التاب المفتوحة للعميل
            </a>
          ` : ''}
        </div>

        <button type="button" class="btn btn-secondary" id="btnFinishInvoice" style="width: 100%; font-size: 20px;">
          🏠 العودة للشاشة الرئيسية
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnWizardOpenDigital').addEventListener('click', async () => {
      await invoiceService.openInvoicePdf(invoice);
    });

    overlay.querySelector('#btnPrintThermal').addEventListener('click', () => {
      this.triggerPrint(invoice, 'thermal');
    });

    overlay.querySelector('#btnPrintA5').addEventListener('click', () => {
      this.triggerPrint(invoice, 'standard');
    });

    overlay.querySelector('#btnFinishInvoice').addEventListener('click', () => {
      overlay.remove();
      window.app.navigate('home');
    });
  },

  // تجهيز الفاتورة وتشغيل الطباعة المباشرة الأصلية
  async triggerPrint(invoice, mode = 'standard') {
    await invoiceService.printInvoice(invoice, mode);
  }
};
