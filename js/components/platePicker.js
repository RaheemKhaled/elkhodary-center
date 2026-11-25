/**
 * منتقي لوحة السيارة المصرية المخصص فائق الخفة والسرعة (Compact Egyptian Plate Picker)
 * - يدعم نمطين:
 *   1. ملاكي / عادي: (حروف 2-4 وأرقام 1-4 قياسية).
 *   2. جهة حكومية / هيئة / شرطة: شريط علوي رمادي/فضي مخصص، حروف مرنة وأرقام غير مقيدة بأي عدد.
 * - إدخال سلس من الكيبورد فقط.
 * - معاينة حية وفورية متجاوبة.
 * - الأرقام تُكتب وتُعرض بدقة من اليسار إلى اليمين (LTR).
 */

export class EgyptianPlatePicker {
  constructor({ containerId, initialLetters = '', initialNumbers = '', initialType = 'private', onChange = null }) {
    this.container = document.getElementById(containerId);
    this.letters = (initialLetters || '').trim();
    this.numbers = (initialNumbers || '').trim();
    this.plateType = initialType; // 'private' أو 'gov'
    this.onChange = onChange;

    this.render();
  }

  setValues(letters, numbers, plateType = null) {
    this.letters = (letters || '').trim();
    this.numbers = (numbers || '').trim();
    if (plateType) {
      this.plateType = plateType;
    }

    const lettersInp = this.container?.querySelector('#compactPlateLettersInput');
    const numbersInp = this.container?.querySelector('#compactPlateNumbersInput');
    if (lettersInp) lettersInp.value = this.letters;
    if (numbersInp) numbersInp.value = this.numbers;

    this.updatePlateTypeUI();
    this.updatePlateVisual();
    this.notifyChange();
  }

  getValue() {
    const letters = (this.letters || '').trim();
    const numbers = (this.numbers || '').trim();
    const isGov = this.plateType === 'gov';

    // اللوحة الحكومية قد تحتوي على أرقام فقط أو حروف طويلة مثل "ش ر ط ة" أو غيرها
    const isValid = isGov
      ? (numbers.length >= 1 || letters.length >= 1)
      : (letters.length >= 2 && numbers.length >= 1);

    return {
      letters,
      numbers,
      plateType: this.plateType,
      isGovernment: isGov,
      plateFull: letters && numbers ? `${letters} ${numbers}` : (letters || numbers || ''),
      isValid
    };
  }

  notifyChange() {
    if (this.onChange) {
      this.onChange(this.getValue());
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="compact-plate-widget" style="background: var(--bg-surface); border: 2px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 8px;">
        
        <!-- مفتاح تبديل نوع اللوحة (ملاكي / جهة حكومية) -->
        <div style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid #38BDF8; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 16px;">🏷️</span>
            <span style="font-size: 13.5px; font-weight: 900; color: #FFFFFF;">نوع لوحة السيارة:</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button 
              type="button" 
              id="btnPlateTypePrivate" 
              class="btn-plate-toggle ${this.plateType === 'private' ? 'active' : ''}" 
              style="border: 2px solid ${this.plateType === 'private' ? '#0284C7' : 'var(--border-color)'}; padding: 6px 14px; font-size: 13px; font-weight: 900; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; ${this.plateType === 'private' ? 'background: #0284C7; color: #FFFFFF; box-shadow: 0 0 10px rgba(2,132,199,0.5);' : 'background: var(--bg-surface-elevated); color: var(--text-muted);'}">
              🚙 ملاكي / عادي
            </button>
            <button 
              type="button" 
              id="btnPlateTypeGov" 
              class="btn-plate-toggle ${this.plateType === 'gov' ? 'active' : ''}" 
              style="border: 2px solid ${this.plateType === 'gov' ? '#F59E0B' : 'var(--border-color)'}; padding: 6px 14px; font-size: 13px; font-weight: 900; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; ${this.plateType === 'gov' ? 'background: #D97706; color: #FFFFFF; box-shadow: 0 0 12px rgba(245,158,11,0.6);' : 'background: var(--bg-surface-elevated); color: var(--text-muted);'}">
              🏛️ جهة حكومية / هيئة
            </button>
          </div>
        </div>

        <!-- معاينة شكل اللوحة المصرية الرسمية المصغرة والأنيقة -->
        <div style="display: flex; justify-content: center; margin-bottom: 8px;">
          <div id="cPlateBadge" class="egypt-plate-badge" style="width: 100%; max-width: 330px; min-height: 68px; background: #FFFFFF; border: 3px solid #0F172A; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.4); display: flex; flex-direction: column; overflow: hidden; user-select: none;">
            
            <!-- الشريط العلوي: مصر / EGYPT (يتغير لونه حسب حكومي أو ملاكي) -->
            <div id="cPlateTopBar" style="height: 22px; background: ${this.plateType === 'gov' ? 'linear-gradient(180deg, #64748B 0%, #334155 100%)' : '#0077D7'}; display: flex; justify-content: space-between; align-items: center; padding: 0 10px; color: #FFFFFF; font-weight: 900; line-height: 1;">
              <span id="cPlateTopAr" style="font-size: 13.5px; letter-spacing: 1px;">${this.plateType === 'gov' ? 'مـصـر (حـكـومـة)' : 'مـصـر'}</span>
              <span id="cPlateTopEn" style="font-size: 11px; font-family: Arial, sans-serif; letter-spacing: 1px;">${this.plateType === 'gov' ? 'GOV' : 'EGYPT'}</span>
            </div>

            <!-- جسم اللوحة: الحروف يميناً والأرقام يساراً من الشمال لليمين LTR -->
            <div style="flex: 1; display: flex; align-items: center; justify-content: space-around; padding: 4px 8px; background: #FFFFFF; min-height: 44px;">
              
              <!-- قسم الحروف (اليمين - عربي) -->
              <div id="cPlateLettersSection" style="display: flex; gap: 4px; justify-content: center; align-items: center; min-width: 80px; flex-wrap: wrap;" dir="rtl">
                <!-- يُملأ ديناميكياً -->
              </div>

              <!-- الفاصل الرأسي الأسود -->
              <div style="width: 3px; height: 36px; background: #0F172A; border-radius: 2px; margin: 0 4px; flex-shrink: 0;"></div>

              <!-- قسم الأرقام (اليسار - من الشمال لليمين LTR) -->
              <div id="cPlateNumbersSection" style="display: flex; gap: 4px; justify-content: center; align-items: center; min-width: 100px; flex-wrap: wrap;" dir="ltr">
                <!-- يُملأ ديناميكياً -->
              </div>

            </div>
          </div>
        </div>

        <!-- خانات الكتابة السريعة والمباشرة من الكيبورد -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 38px; gap: 8px; align-items: center;">
          
          <!-- خانة الحروف -->
          <div>
            <label id="lblLetters" class="form-label" style="font-size: 11px; margin-bottom: 2px; color: #93C5FD; font-weight: 700;">
              🔤 الحروف:
            </label>
            <input 
              type="text" 
              id="compactPlateLettersInput" 
              class="form-control" 
              placeholder="${this.plateType === 'gov' ? 'اختياري أو مفتوح' : 'مثال: س ن د'}"
              maxlength="${this.plateType === 'gov' ? 12 : 7}"
              value="${this.letters}"
              autocomplete="off"
              style="height: 38px; font-size: 16px; font-weight: 800; text-align: center; border-color: #3B82F6;"
            >
          </div>

          <!-- خانة الأرقام (LTR) -->
          <div>
            <label id="lblNumbers" class="form-label" style="font-size: 11px; margin-bottom: 2px; color: #34D399; font-weight: 700;">
              🔢 الأرقام (شمال ليمين):
            </label>
            <input 
              type="text" 
              id="compactPlateNumbersInput" 
              class="form-control" 
              placeholder="${this.plateType === 'gov' ? 'أي عدد أرقام (مثال: 12543)' : '1234'}"
              maxlength="${this.plateType === 'gov' ? 10 : 4}"
              value="${this.numbers}"
              autocomplete="off"
              dir="ltr"
              style="height: 38px; font-size: 18px; font-weight: 900; text-align: center; direction: ltr; font-family: monospace; border-color: #10B981;"
            >
          </div>

          <!-- زر مسح سريع -->
          <div style="display: flex; align-items: flex-end; height: 100%;">
            <button 
              type="button" 
              class="btn btn-secondary" 
              id="btnCompactClearPlate" 
              title="مسح النمرة"
              style="width: 38px; height: 38px; padding: 0; font-size: 14px; min-height: 38px; display: flex; align-items: center; justify-content: center; background: rgba(239,68,68,0.15); border-color: #EF4444; color: #FCA5A5;"
            >
              ✕
            </button>
          </div>

        </div>

      </div>
    `;

    this.attachEvents();
    this.updatePlateVisual();
  }

  updatePlateTypeUI() {
    const btnPriv = this.container?.querySelector('#btnPlateTypePrivate');
    const btnGov = this.container?.querySelector('#btnPlateTypeGov');
    const topBar = this.container?.querySelector('#cPlateTopBar');
    const topAr = this.container?.querySelector('#cPlateTopAr');
    const topEn = this.container?.querySelector('#cPlateTopEn');
    const lettersInp = this.container?.querySelector('#compactPlateLettersInput');
    const numbersInp = this.container?.querySelector('#compactPlateNumbersInput');

    if (!btnPriv || !btnGov) return;

    if (this.plateType === 'gov') {
      btnPriv.style.background = 'var(--bg-surface-elevated)';
      btnPriv.style.color = 'var(--text-muted)';
      btnPriv.style.borderColor = 'var(--border-color)';
      btnPriv.style.boxShadow = 'none';

      btnGov.style.background = '#D97706';
      btnGov.style.color = '#FFFFFF';
      btnGov.style.borderColor = '#F59E0B';
      btnGov.style.boxShadow = '0 0 12px rgba(245,158,11,0.6)';

      if (topBar) topBar.style.background = 'linear-gradient(180deg, #64748B 0%, #334155 100%)';
      if (topAr) topAr.textContent = 'مـصـر (حـكـومـة)';
      if (topEn) topEn.textContent = 'GOV';

      if (lettersInp) {
        lettersInp.placeholder = 'اختياري أو مفتوح (مثال: شرطة)';
        lettersInp.setAttribute('maxlength', '12');
      }
      if (numbersInp) {
        numbersInp.placeholder = 'أي عدد أرقام (مثال: 12543)';
        numbersInp.setAttribute('maxlength', '10');
      }
    } else {
      btnPriv.style.background = '#0284C7';
      btnPriv.style.color = '#FFFFFF';
      btnPriv.style.borderColor = '#0284C7';
      btnPriv.style.boxShadow = '0 0 10px rgba(2,132,199,0.5)';

      btnGov.style.background = 'var(--bg-surface-elevated)';
      btnGov.style.color = 'var(--text-muted)';
      btnGov.style.borderColor = 'var(--border-color)';
      btnGov.style.boxShadow = 'none';

      if (topBar) topBar.style.background = '#0077D7';
      if (topAr) topAr.textContent = 'مـصـر';
      if (topEn) topEn.textContent = 'EGYPT';

      if (lettersInp) {
        lettersInp.placeholder = 'مثال: س ن د';
        lettersInp.setAttribute('maxlength', '7');
      }
      if (numbersInp) {
        numbersInp.placeholder = '1234';
        numbersInp.setAttribute('maxlength', '4');
      }
    }
  }

  attachEvents() {
    const lettersInp = this.container.querySelector('#compactPlateLettersInput');
    const numbersInp = this.container.querySelector('#compactPlateNumbersInput');
    const clearBtn = this.container.querySelector('#btnCompactClearPlate');
    const btnPriv = this.container.querySelector('#btnPlateTypePrivate');
    const btnGov = this.container.querySelector('#btnPlateTypeGov');

    // تبديل النمط إلى ملاكي
    btnPriv?.addEventListener('click', () => {
      this.plateType = 'private';
      this.updatePlateTypeUI();
      // إذا كانت الأرقام أكثر من 4، يتم تقليصها
      if (this.numbers.length > 4) {
        this.numbers = this.numbers.slice(0, 4);
        numbersInp.value = this.numbers;
      }
      // تقليص الحروف إن زادت
      const rawLetters = this.letters.replace(/\s+/g, '').slice(0, 4);
      this.letters = rawLetters.split('').join(' ');
      lettersInp.value = this.letters;

      this.updatePlateVisual();
      this.notifyChange();
    });

    // تبديل النمط إلى حكومي
    btnGov?.addEventListener('click', () => {
      this.plateType = 'gov';
      this.updatePlateTypeUI();
      this.updatePlateVisual();
      this.notifyChange();
    });

    // 1. الكتابة في خانة الحروف
    lettersInp.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^\u0600-\u06FF\s]/g, '');
      val = val.replace(/[إأآا]/g, 'أ').replace(/[ة]/g, 'هـ').replace(/[ى]/g, 'ي');

      if (this.plateType === 'gov') {
        // جهة حكومية: مفتوح حتى 6 حروف أو كلمات مثل "شرطة"
        const cleanChars = val.replace(/\s+/g, '').slice(0, 6);
        this.letters = cleanChars.split('').join(' ');
      } else {
        // ملاكي عادي: بحد أقصى 3 أو 4 حروف
        const cleanChars = val.replace(/\s+/g, '').slice(0, 3);
        this.letters = cleanChars.split('').join(' ');
      }
      e.target.value = this.letters;

      this.updatePlateVisual();
      this.notifyChange();
    });

    // 2. الكتابة في خانة الأرقام (من الشمال لليمين LTR)
    numbersInp.addEventListener('input', (e) => {
      const maxDigits = this.plateType === 'gov' ? 10 : 4;
      let val = e.target.value
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/[^0-9]/g, '')
        .slice(0, maxDigits);

      this.numbers = val;
      e.target.value = this.numbers;

      this.updatePlateVisual();
      this.notifyChange();
    });

    // 3. زر المسح
    clearBtn.addEventListener('click', () => {
      this.letters = '';
      this.numbers = '';
      lettersInp.value = '';
      numbersInp.value = '';
      this.updatePlateVisual();
      this.notifyChange();
      lettersInp.focus();
    });
  }

  updatePlateVisual() {
    if (!this.container) return;

    const lettersSec = this.container.querySelector('#cPlateLettersSection');
    const numbersSec = this.container.querySelector('#cPlateNumbersSection');
    if (!lettersSec || !numbersSec) return;

    const rawChars = (this.letters || '').replace(/\s+/g, '').split('');
    const rawDigits = (this.numbers || '').replace(/[^0-9]/g, '').split('');

    // رسم قسم الحروف
    if (this.plateType === 'gov' && rawChars.length === 0) {
      // إذا كانت جهة حكومية بدون حروف (مثل سيارات الشرطة/الجيش التي تكتفي برقم كود)
      lettersSec.innerHTML = `
        <span style="font-size: 13px; font-weight: 800; color: #64748B; padding: 2px 4px;">[جهة حكومية]</span>
      `;
    } else {
      const slotsCount = this.plateType === 'gov' ? Math.max(rawChars.length, 2) : 3;
      let lettersHtml = '';
      for (let i = 0; i < slotsCount; i++) {
        const char = rawChars[i] || '';
        if (char) {
          lettersHtml += `
            <div class="compact-slot" style="width: 24px; height: 34px; border: 2px solid #0F172A; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #0F172A; background: #FFFFFF;">
              ${char}
            </div>
          `;
        } else {
          lettersHtml += `
            <div class="compact-slot" style="width: 24px; height: 34px; border: 1.5px dashed #CBD5E1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #94A3B8; background: transparent;">
              •
            </div>
          `;
        }
      }
      lettersSec.innerHTML = lettersHtml;
    }

    // رسم قسم الأرقام
    const minDigitSlots = this.plateType === 'gov' ? Math.max(rawDigits.length, 3) : 4;
    let numbersHtml = '';
    for (let i = 0; i < minDigitSlots; i++) {
      const digit = rawDigits[i] || '';
      if (digit) {
        numbersHtml += `
          <div class="compact-slot" style="width: 24px; height: 34px; border: 2px solid #0F172A; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #0F172A; background: #FFFFFF; font-family: monospace;">
            ${digit}
          </div>
        `;
      } else {
        numbersHtml += `
          <div class="compact-slot" style="width: 24px; height: 34px; border: 1.5px dashed #CBD5E1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #94A3B8; background: transparent; font-family: monospace;">
            •
          </div>
        `;
      }
    }
    numbersSec.innerHTML = numbersHtml;
  }
}
