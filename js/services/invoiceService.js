/**
 * خدمات إدارة الفواتير وعمليات الصيانة والحسابات المالية
 */

import { db } from '../db/indexeddb.js';
import { inventoryService } from './inventoryService.js';
import { customerService } from './customerService.js';

export const invoiceService = {
  // حساب المجموع والخصومات والمدفوعات بدقة
  calculateTotals({ services = [], parts = [], discountType = 'none', discountValue = 0, cash = 0, vodafone = 0, instapay = 0 }) {
    // 1. إجمالي الخدمات المنفذة مع إضافاتها
    let servicesTotal = 0;
    for (const s of services) {
      const basePrice = Number(s.price) || 0;
      const addonsTotal = (s.addons || []).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      const qty = Number(s.quantity) || 1;
      servicesTotal += (basePrice + addonsTotal) * qty;
    }

    // 2. إجمالي قطع الغيار
    let partsTotal = 0;
    for (const p of parts) {
      const unitPrice = Number(p.unitPrice) || 0;
      const qty = Number(p.quantity) || 1;
      partsTotal += unitPrice * qty;
    }

    // 3. المجموع قبل الخصم
    const subTotal = servicesTotal + partsTotal;

    // 4. حساب الخصم
    let discountAmount = 0;
    const numDiscountValue = Number(discountValue) || 0;
    if (discountType === 'fixed') {
      discountAmount = Math.min(subTotal, numDiscountValue);
    } else if (discountType === 'percentage') {
      discountAmount = Math.min(subTotal, (subTotal * numDiscountValue) / 100);
    }

    // 5. الإجمالي النهائي المطلوب
    const netTotal = Math.max(0, subTotal - discountAmount);

    // 6. طرق الدفع والمدفوع
    const cashAmount = Number(cash) || 0;
    const vodafoneCashAmount = Number(vodafone) || 0;
    const instaPayAmount = Number(instapay) || 0;
    const totalPaid = cashAmount + vodafoneCashAmount + instaPayAmount;

    // 7. المتبقي
    const remainingBalance = netTotal - totalPaid;

    // 8. تحذيرات الدفع
    let paymentWarning = null;
    if (totalPaid !== netTotal) {
      if (totalPaid < netTotal) {
        paymentWarning = `يوجد متبقي على العميل قدره ${remainingBalance.toFixed(2)} ج.م`;
      } else {
        paymentWarning = `المبلغ المدفوع أكبر من الإجمالي المطلوب بـ ${(totalPaid - netTotal).toFixed(2)} ج.م`;
      }
    }

    let paymentStatus = 'paid';
    if (totalPaid === 0 && netTotal > 0) paymentStatus = 'unpaid';
    else if (totalPaid < netTotal) paymentStatus = 'partial';

    return {
      servicesTotal,
      partsTotal,
      subTotal,
      discountType,
      discountValue: numDiscountValue,
      discountAmount,
      netTotal,
      cashAmount,
      vodafoneCashAmount,
      instaPayAmount,
      totalPaid,
      remainingBalance,
      paymentStatus,
      paymentWarning
    };
  },

  // حفظ وإنشاء فاتورة صيانة كاملة مع كل ارتباطاتها
  async createMaintenanceInvoice(wizardData) {
    const {
      customer,
      car,
      services,
      parts,
      problem,
      diagnosis,
      futureNeeds,
      followUp,
      workers,
      discountType,
      discountValue,
      cashAmount,
      vodafoneCashAmount,
      instaPayAmount
    } = wizardData;

    // 1. التأكد من حفظ أو تحديث العميل
    let savedCustomer;
    if (customer.id) {
      savedCustomer = await customerService.saveCustomer(customer);
    } else {
      savedCustomer = await customerService.saveCustomer(customer);
    }

    // 2. التأكد من حفظ أو تحديث السيارة
    let savedCar;
    const carToSave = {
      ...car,
      customerId: savedCustomer.id
    };
    if (car.id) {
      savedCar = await customerService.saveCar(carToSave);
    } else {
      savedCar = await customerService.saveCar(carToSave);
    }

    // 3. احتساب المجاميع
    const totals = this.calculateTotals({
      services,
      parts,
      discountType,
      discountValue,
      cash: cashAmount,
      vodafone: vodafoneCashAmount,
      instapay: instaPayAmount
    });

    const invoiceId = db.generateId('INV');

    // 4. إنشاء سجل الفاتورة
    const maintenanceRecord = {
      id: invoiceId,
      customerId: savedCustomer.id,
      customerName: savedCustomer.name,
      customerPhone: savedCustomer.phone,
      carId: savedCar.id,
      carInfo: `${savedCar.brand || ''} ${savedCar.model || ''}`.trim(),
      plateFull: savedCar.plateFull,
      date: new Date().toISOString(),
      problem: problem || '',
      diagnosis: diagnosis || '',
      futureNeeds: futureNeeds || '',
      followUp: followUp || '',
      workers: Array.isArray(workers) ? workers : (workers ? [workers] : []),
      services: services || [],
      parts: parts || [],
      ...totals,
      createdAt: new Date().toISOString()
    };

    await db.add('maintenance', maintenanceRecord);

    // 5. خصم قطع الغيار من المخزن وتسجيلها في جدول المبيعات
    if (parts && parts.length > 0) {
      for (const p of parts) {
        await inventoryService.recordPartSale({
          partId: p.id,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          customerId: savedCustomer.id,
          invoiceId: invoiceId,
          saleType: 'in_maintenance'
        });
      }
    }

    return maintenanceRecord;
  },

  // جلب الفواتير مع إمكانية البحث والفلترة حسب التاريخ
  async getInvoices({ limit = 100, query = '', period = 'all' } = {}) {
    const allInvoices = await db.getAll('maintenance');

    // ترتيب تنازلي: الأحدث أولاً دائماً
    allInvoices.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

    let filtered = allInvoices;

    // تصفية حسب الفترة
    if (period === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartTs = todayStart.getTime();
      filtered = filtered.filter(inv => new Date(inv.date || inv.createdAt).getTime() >= todayStartTs);
    } else if (period === 'week') {
      const weekStart = Date.now() - 7 * 86400000;
      filtered = filtered.filter(inv => new Date(inv.date || inv.createdAt).getTime() >= weekStart);
    }

    // تصفية حسب نص البحث
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      filtered = filtered.filter(inv => {
        return (
          (inv.id && inv.id.toLowerCase().includes(q)) ||
          (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
          (inv.customerPhone && inv.customerPhone.includes(q)) ||
          (inv.carInfo && inv.carInfo.toLowerCase().includes(q)) ||
          (inv.plateFull && inv.plateFull.includes(q)) ||
          (inv.plateLetters && inv.plateLetters.includes(q)) ||
          (inv.plateNumbers && inv.plateNumbers.includes(q))
        );
      });
    }

    return filtered.slice(0, limit);
  },

  // جلب فواتير اليوم
  async getTodayInvoices() {
    return this.getInvoices({ period: 'today', limit: 200 });
  },

  // جلب فاتورة بكودها
  async getInvoiceById(invoiceId) {
    if (!invoiceId) return null;
    return await db.get('maintenance', invoiceId);
  },

  // إنشاء رابط مشاركة الفاتورة عبر واتساب بنص عربي واضح ومنظم
  generateWhatsAppShareUrl(invoice) {
    if (!invoice || !invoice.customerPhone) return null;
    let cleanPhone = invoice.customerPhone.replace(/[\s-]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '2' + cleanPhone; // إضافة كود مصر الدولي 20
    }

    const servicesList = (invoice.services || [])
      .map(s => `• ${s.name}: ${s.price} ج.م`)
      .join('\n');

    const partsList = (invoice.parts && invoice.parts.length > 0)
      ? '\n*قطع الغيار:*\n' + invoice.parts.map(p => `• ${p.name} (عدد ${p.quantity}): ${p.totalPrice} ج.م`).join('\n')
      : '';

    const text = `
🚗 *مركز الصيانة وضبط الزوايا*
مرحباً يا فندم: *${invoice.customerName}*
فاتورة صيانة رقم: *${invoice.id}*
سيارة: *${invoice.carInfo}* (نمرة: ${invoice.plateFull || (invoice.plateLetters + ' ' + invoice.plateNumbers)})
التاريخ: ${new Date(invoice.date || invoice.createdAt).toLocaleDateString('ar-EG')}

*الخدمات المنفذة:*
${servicesList}${partsList}

💵 *الإجمالي النهائي:* ${invoice.netTotal} ج.م
💰 *المدفوع:* ${invoice.totalPaid} ج.م
${invoice.remainingBalance > 0 ? `⚠️ *المتبقي (آجل):* ${invoice.remainingBalance} ج.م\n` : '✅ *تم السداد بالكامل*\n'}
شكراً لثقتكم ونسعد دائماً بخدمتكم! 🔧
    `.trim();

    // استخدام api.whatsapp.com/send للتوجه إلى تاب الويب النشطة أو تطبيق واتساب المفتوح
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  },

  // طباعة الفاتورة بالطريقة الأصلية الموثوقة 100% بدون فتح أي تبويبات بيضاء أو تهنيج
  async printInvoice(invoice, mode = 'standard') {
    const printContainer = document.getElementById('printableInvoiceContainer');
    if (!printContainer) {
      console.warn('printableInvoiceContainer not found, calling window.print() directly');
      window.print();
      return;
    }

    // جلب بيانات المركز من الإعدادات
    const [centerNameSetting, centerPhoneSetting, centerAddressSetting] = await Promise.all([
      db.get('settings', 'centerName'),
      db.get('settings', 'centerPhone'),
      db.get('settings', 'centerAddress')
    ]);
    const centerName = centerNameSetting?.value || 'المركز الهندسي لصيانة السيارات';
    const centerPhone = centerPhoneSetting?.value || '';
    const centerAddress = centerAddressSetting?.value || '';

    printContainer.className = `printable-invoice-container ${mode === 'thermal' ? 'thermal-mode' : 'standard-mode'}`;

    if (mode === 'thermal') {
      printContainer.innerHTML = `
        <div class="thermal-header">
          <div class="thermal-title">${centerName}</div>
          <div class="thermal-subtitle">${centerAddress} ${centerPhone ? ' - ت: ' + centerPhone : ''}</div>
          <div style="font-size: 11px; margin-top: 3px; font-weight: bold;">إيصال صيانة وضبط زوايا وعفشة</div>
        </div>

        <div class="thermal-meta-row">
          <span>فاتورة: <strong>${invoice.id}</strong></span>
          <span>التاريخ: ${new Date(invoice.date || invoice.createdAt).toLocaleDateString('ar-EG')}</span>
        </div>
        <div class="thermal-meta-row">
          <span>العميل: <strong>${invoice.customerName}</strong></span>
          <span>ت: ${invoice.customerPhone}</span>
        </div>

        <div class="thermal-plate-box">
          🚗 ${invoice.carInfo} | لوحة: [ ${invoice.plateFull || (invoice.plateLetters + ' ' + invoice.plateNumbers)} ]
        </div>

        <!-- بيانات الصيانة الفنية -->
        <div class="thermal-maintenance-box">
          ${invoice.problem ? `<div><strong>المشكلة:</strong> ${invoice.problem}</div>` : ''}
          ${invoice.suspensionNote ? `<div><strong>صيانة العفشة:</strong> ${invoice.suspensionNote}</div>` : ''}
          ${invoice.futureNeeds ? `<div><strong>توصية قادمة:</strong> ${invoice.futureNeeds}</div>` : ''}
          ${invoice.workers && invoice.workers.length ? `<div><strong>الفنيين:</strong> ${Array.isArray(invoice.workers) ? invoice.workers.join('، ') : invoice.workers}</div>` : ''}
        </div>

        <table class="thermal-table">
          <thead>
            <tr>
              <th>البيان (الخدمات والقطع)</th>
              <th>السعر</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.services || []).map(s => `
              <tr>
                <td>• ${s.name} ${s.customNote ? `(${s.customNote})` : ''} ${s.addons?.length ? `(${s.addons.map(a => a.name).join('+')})` : ''}</td>
                <td>${s.price} ج.م</td>
              </tr>
            `).join('')}
            ${(invoice.parts || []).map(p => `
              <tr>
                <td>• ${p.name} (×${p.quantity})</td>
                <td>${p.totalPrice} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="thermal-totals-section">
          <div class="thermal-total-row">
            <span>المجموع:</span>
            <span>${invoice.subTotal} ج.م</span>
          </div>
          ${invoice.discountAmount > 0 ? `
            <div class="thermal-total-row">
              <span>الخصم:</span>
              <span>-${invoice.discountAmount} ج.م</span>
            </div>
          ` : ''}
          <div class="thermal-total-row grand-total">
            <span>الإجمالي الصافي:</span>
            <span>${invoice.netTotal} ج.م</span>
          </div>
          <div class="thermal-total-row">
            <span>المدفوع:</span>
            <span>${invoice.totalPaid} ج.م</span>
          </div>
          ${invoice.remainingBalance > 0 ? `
            <div class="thermal-total-row" style="font-weight: 900; color: #000;">
              <span>المتبقي (آجل):</span>
              <span>${invoice.remainingBalance} ج.م</span>
            </div>
          ` : ''}
        </div>

        <div class="thermal-footer">
          <div>الضمان ساري على ضبط الزوايا والعفشة لمدة 7 أيام</div>
          <div style="font-weight: bold; margin-top: 3px;">شكراً لثقتكم ونتمنى لكم قيادة آمنة 🔧</div>
        </div>
      `;
    } else {
      // Standard A4 layout مع إطار ثابت وهيدر وفوتر وبيانات الصيانة
      printContainer.innerHTML = `
        <div>
          <!-- الهيدر الثابت -->
          <div class="standard-header">
            <div>
              <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 4px 0; color: #0F172A;">${centerName}</h1>
              <div style="font-size: 14px; color: #334155; font-weight: 700;">صيانة السيارات وضبط الزوايا والعفشة والمخرطة</div>
              <div style="font-size: 13px; color: #475569; margin-top: 3px;">📍 ${centerAddress} ${centerPhone ? ' | 📞 تليفون: ' + centerPhone : ''}</div>
            </div>
            <div style="text-align: left; display: flex; flex-direction: column; align-items: flex-end;">
              <div style="font-size: 17px; font-weight: 900; border: 2px solid #000; padding: 5px 14px; border-radius: 6px; display: inline-block; margin-bottom: 4px; background: #F8FAFC;">
                فاتورة رقم: ${invoice.id}
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #334155;">التاريخ: ${new Date(invoice.date || invoice.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div style="font-size: 12px; color: #64748B;">الوقت: ${new Date(invoice.date || invoice.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <!-- مربع بيانات العميل والسيارة -->
          <div class="standard-info-grid">
            <div>
              <div style="margin-bottom: 5px;"><strong>👤 اسم العميل:</strong> <span style="font-weight: 800; font-size: 15px;">${invoice.customerName}</span></div>
              <div><strong>📱 رقم التليفون:</strong> <span style="direction: ltr; display: inline-block; font-weight: 700; font-size: 14px;">${invoice.customerPhone}</span></div>
            </div>
            <div>
              <div style="margin-bottom: 5px;"><strong>🚘 موديل السيارة:</strong> <span style="font-weight: 700; font-size: 15px;">${invoice.carInfo}</span></div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <strong>🚗 نمرة اللوحة:</strong> 
                <span style="border: 1.5px solid #000; padding: 2px 10px; border-radius: 4px; font-weight: 900; font-size: 15px; background: #FFF; letter-spacing: 1px;">
                  ${invoice.plateFull || (invoice.plateLetters + ' ' + invoice.plateNumbers)}
                </span>
              </div>
            </div>
          </div>

          <!-- مربع بيانات الصيانة الفنية قبل وبعد العمل -->
          <div class="standard-maintenance-section">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div style="background: rgba(239,68,68,0.04); border: 1px solid #FECACA; padding: 6px 10px; border-radius: 4px;">
                <strong style="color: #991B1B; font-size: 13px;">⚠️ شكوى العميل / المشكلة المرصودة:</strong>
                <div style="font-size: 13px; font-weight: 700; margin-top: 2px; color: #1E293B;">${invoice.problem || 'فحص وضبط دوري'}</div>
              </div>
              <div style="background: rgba(59,130,246,0.04); border: 1px solid #BFDBFE; padding: 6px 10px; border-radius: 4px;">
                <strong style="color: #1E40AF; font-size: 13px;">💡 التوصية وميعاد الصيانة القادمة:</strong>
                <div style="font-size: 13px; font-weight: 700; margin-top: 2px; color: #1E293B;">${invoice.futureNeeds || 'متابعة الصيانة الدورية بعد 5000 كم'}</div>
              </div>
            </div>
            ${invoice.suspensionNote ? `
              <div style="margin-top: 6px; padding: 6px 10px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 4px; font-size: 13px;">
                <strong style="color: #92400E;">🛠️ أعمال العفشة والمخرطة المنفذة:</strong> <span style="font-weight: 700; color: #1E293B;">${invoice.suspensionNote}</span>
              </div>
            ` : ''}
            ${invoice.workers && invoice.workers.length ? `
              <div style="margin-top: 6px; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 6px;">
                <span>👷 <strong>الفنيين المنفذين للعمل:</strong></span>
                <span style="font-weight: 700; color: #0F172A;">${Array.isArray(invoice.workers) ? invoice.workers.join('، ') : invoice.workers}</span>
              </div>
            ` : ''}
          </div>

          <!-- جدول الخدمات وقطع الغيار -->
          <table class="standard-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">م</th>
                <th style="width: 45%;">البيان / الخدمة / القطعة</th>
                <th style="width: 15%; text-align: center;">النوع</th>
                <th style="width: 10%; text-align: center;">الكمية</th>
                <th style="width: 12%; text-align: left;">سعر الوحدة</th>
                <th style="width: 13%; text-align: left;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.services || []).map((s, idx) => `
                <tr>
                  <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                  <td>
                    <strong>${s.name}</strong>
                    ${s.customNote ? `<div style="font-size: 12px; color: #444;">• ${s.customNote}</div>` : ''}
                    ${s.addons?.length ? `<div style="font-size: 12px; color: #555;">(${s.addons.map(a => a.name).join(' + ')})</div>` : ''}
                  </td>
                  <td style="text-align: center;">خدمة مصنعية</td>
                  <td style="text-align: center;">1</td>
                  <td style="text-align: left;">${s.price} ج.م</td>
                  <td style="text-align: left; font-weight: 700;">${s.price} ج.م</td>
                </tr>
              `).join('')}
              ${(invoice.parts || []).map((p, idx) => `
                <tr>
                  <td style="text-align: center; font-weight: 700;">${(invoice.services?.length || 0) + idx + 1}</td>
                  <td>
                    <strong>${p.name}</strong>
                    ${p.isCustom ? '<small style="color: #666;"> (صنف خارجي)</small>' : ''}
                  </td>
                  <td style="text-align: center;">قطع غيار</td>
                  <td style="text-align: center;">${p.quantity}</td>
                  <td style="text-align: left;">${p.unitPrice} ج.م</td>
                  <td style="text-align: left; font-weight: 700;">${p.totalPrice} ج.م</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- ملخص الحساب النهائي وشروط الضمان -->
          <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 12px;">
            <div style="width: 52%; border: 1.5px solid #000; padding: 10px 14px; border-radius: 6px; font-size: 12px; background: #FAFAFA; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-weight: 900; margin-bottom: 6px; font-size: 13px; color: #0F172A; border-bottom: 1px dashed #CBD5E1; padding-bottom: 4px;">
                  📌 شروط الضمان والملاحظات الهامة:
                </div>
                <div style="line-height: 1.6; color: #334155;">
                  <div>• الضمان ساري على أعمال ضبط الزوايا والعفشة لمدة <strong>7 أيام</strong> من تاريخ الفاتورة.</div>
                  <div>• يرجى الاحتفاظ بالفاتورة الأصلية عند أي مراجعة أو فحص بالمركز.</div>
                  <div>• قطع الغيار المباعة تخضع لضمان الشركة المصنعة أو الوكيل.</div>
                  <div>• المركز غير مسؤول عن أي أعطال ناتجة عن سوء الاستخدام أو الحوادث.</div>
                </div>
              </div>
              <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 6px; border-top: 1px solid #E2E8F0;">
                <span style="font-size: 12px; color: #475569;">الختم المعتمد للمركز:</span>
                <div style="width: 80px; height: 40px; border: 1.5px dashed #94A3B8; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #94A3B8;">(الختم هنا)</div>
              </div>
            </div>

            <div style="width: 44%; font-size: 13px; border: 1.5px solid #000; padding: 10px 14px; border-radius: 6px; background: #FFFFFF; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #E2E8F0;">
                  <span>إجمالي الخدمات والقطع:</span>
                  <strong>${invoice.subTotal} ج.م</strong>
                </div>
                ${invoice.discountAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #E2E8F0; color: #DC2626;">
                    <span>الخصم الممنوح:</span>
                    <strong>-${invoice.discountAmount} ج.م</strong>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 18px; font-weight: 900; background: #F1F5F9; margin: 6px 0; padding-left: 6px; padding-right: 6px; border-radius: 4px;">
                  <span>الإجمالي النهائي المطلوب:</span>
                  <span style="color: #0F172A;">${invoice.netTotal} ج.م</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #047857;">
                  <span>المبلغ المدفوع:</span>
                  <strong>${invoice.totalPaid} ج.م</strong>
                </div>
              </div>
              ${invoice.remainingBalance > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 6px 8px; font-size: 14px; font-weight: 900; color: #B91C1C; background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 4px; margin-top: 4px;">
                  <span>المتبقي (آجل):</span>
                  <span>${invoice.remainingBalance} ج.م</span>
                </div>
              ` : `
                <div style="text-align: center; padding: 4px 0; color: #059669; font-weight: 800; font-size: 13px; background: #ECFDF5; border-radius: 4px; margin-top: 4px;">
                  ✅ تم السداد بالكامل
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- الفوتر الثابت -->
        <div class="standard-footer">
          <div>توقيع العميل المستلم: .......................................</div>
          <div style="font-weight: 900; font-size: 13px; color: #0F172A;">نتمنى لكم دائماً قيادة آمنة وسلامة مستمرة 🚗🔧</div>
          <div>توقيع الإدارة / الختم: .......................................</div>
        </div>
      `;
    }

    setTimeout(() => {
      window.print();
    }, 150);
  },

  // إرسال الفاتورة عبر واتساب مستهدفاً التاب المفتوحة
  sendWhatsApp(invoice) {
    const waUrl = this.generateWhatsAppShareUrl(invoice);
    if (waUrl) {
      try {
        // نحدد اسم للنافذة 'WhatsAppTab' لإعادة استخدام نفس التاب المفتوحة للواتساب بدلاً من فتح نوافذ جديدة متكررة
        window.open(waUrl, 'WhatsAppTab');
      } catch (err) {
        console.warn('Auto open whatsapp failed:', err);
      }
    }
    return waUrl;
  },

  // فتح الفاتورة بشكل نظيف وواضح في تبويب جديد بدون تشغيل نافذة الطباعة المزعجة تلقائياً
  // لكي تظهر كـ صفحة PDF إلكترونية يسهل على العميل تصويرها بكاميرا الموبايل فوراً أو مراجعتها
  // مع دعم التبويب المفتوح مسبقاً (targetWindow) لتجاوز حظر النوافذ المنبثقة بشكل قاطع
  async openInvoiceDigitalView(invoice, mode = 'standard', targetWindow = null) {
    const [centerNameSetting, centerPhoneSetting, centerAddressSetting] = await Promise.all([
      db.get('settings', 'centerName'),
      db.get('settings', 'centerPhone'),
      db.get('settings', 'centerAddress')
    ]);

    const meta = {
      centerName: centerNameSetting?.value || 'المركز الهندسي لصيانة السيارات',
      centerPhone: centerPhoneSetting?.value || '',
      centerAddress: centerAddressSetting?.value || '',
      waUrl: this.generateWhatsAppShareUrl(invoice)
    };

    const invoiceHtml = this.buildInvoiceHtml(invoice, mode, meta);

    // 1. محاولة استخدام النافذة المجهزة مسبقاً في حدث النقر
    let win = targetWindow;
    if (!win || win.closed) {
      try {
        win = window.open('', '_blank');
      } catch (e) {
        console.warn('Direct window.open failed:', e);
      }
    }

    if (win && !win.closed) {
      try {
        win.document.open();
        win.document.write(invoiceHtml);
        win.document.close();
        try { win.focus(); } catch (e) {}
        return win;
      } catch (err) {
        console.warn('Error writing to target window:', err);
      }
    }

    // 2. حل احتياطي فوري إذا كان المتصفح يطبق حظراً صارماً: فتح عبر Blob URL
    try {
      const blob = new Blob([invoiceHtml], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 10000);
    } catch (e) {
      console.warn('Fallback link open failed:', e);
    }
  },

  // للتوافق مع أي استدعاءات قديمة
  async openInvoicePDFAndWhatsApp(invoice, mode = 'standard', existingTab = null) {
    if (existingTab && !existingTab.closed) {
      try { existingTab.close(); } catch (e) {}
    }
    this.sendWhatsApp(invoice);
    await this.openInvoiceDigitalView(invoice, mode);
  },

  // بناء كود الـ HTML الأنيق والمتوافق تماماً مع الطباعة والحفظ كـ PDF
  buildInvoiceHtml(invoice, mode, meta) {
    const dateFormatted = new Date(invoice.date || invoice.createdAt).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const isThermal = mode === 'thermal';

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة صيانة #${invoice.id} - ${invoice.customerName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      background: #E2E8F0;
      color: #0F172A;
      direction: rtl;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* شريط الأدوات العلوي للشاشة (يختفي عند الطباعة والحفظ PDF) */
    .screen-toolbar {
      background: #0F172A;
      padding: 12px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      position: sticky;
      top: 0;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .btn-print {
      background: linear-gradient(135deg, #2563EB, #1D4ED8);
      color: #FFFFFF;
      box-shadow: 0 4px 10px rgba(37,99,235,0.4);
    }
    .btn-print:hover { background: #1D4ED8; transform: translateY(-1px); }

    .btn-whatsapp {
      background: #10B981;
      color: #FFFFFF;
    }
    .btn-whatsapp:hover { background: #059669; }

    .btn-close {
      background: #475569;
      color: #FFFFFF;
    }
    .btn-close:hover { background: #334155; }

    /* الحاوية الورقية للفاتورة */
    .invoice-sheet {
      background: #FFFFFF;
      margin: 24px auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      border-radius: 4px;
      color: #000000;
      ${isThermal ? 'width: 80mm; padding: 14px 10px;' : 'width: 148mm; min-height: 210mm; padding: 14mm 12mm; border: 2px solid #000;'}
    }

    /* نمرة العربية الرسمية المصغرة داخل الفاتورة */
    .plate-badge {
      display: inline-flex;
      flex-direction: column;
      border: 1.5px solid #000;
      border-radius: 4px;
      overflow: hidden;
      background: #FFF;
      vertical-align: middle;
      margin: 0 4px;
    }
    .plate-badge-top {
      background: #0284C7;
      color: #FFF;
      font-size: 9px;
      font-weight: 900;
      padding: 1px 6px;
      display: flex;
      justify-content: space-between;
      line-height: 1;
    }
    .plate-badge-body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 6px;
      font-weight: 900;
      font-size: 13px;
      line-height: 1;
      gap: 6px;
    }

    /* رأس وتفاصيل الفاتورة العلوية */
    .invoice-header-block {
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: avoid;
      break-after: avoid;
    }

    /* جدول الخدمات وقطع الغيار */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: ${isThermal ? '12px' : '12.5px'};
      page-break-inside: auto;
      break-inside: auto;
    }
    table.data-table thead {
      display: table-header-group !important;
    }
    table.data-table tbody {
      display: table-row-group;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #000;
      padding: ${isThermal ? '5px 4px' : '5px 8px'};
      text-align: right;
    }
    table.data-table th {
      background: #F1F5F9 !important;
      font-weight: 800;
      font-size: 12px;
    }
    table.data-table tbody tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* الكتلة السفلية للفاتورة: ملخص الحساب + شروط الضمان + التوقيعات (كتلة موحدة غير منكسرة) */
    .invoice-bottom-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-top: 10px;
    }

    .summary-and-warranty-section {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .invoice-footer-signature {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1.5px solid #000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }

    /* إعدادات الطباعة الدقيقة وحفظ الـ PDF */
    @media print {
      body {
        background: #FFFFFF !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .invoice-sheet {
        margin: 0 auto !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        ${isThermal ? 'width: 74mm !important; padding: 4px !important; border: 1px dashed #000 !important;' : 'width: 100% !important; max-width: 190mm !important; border: 2px solid #000 !important; padding: 8mm 10mm !important; box-sizing: border-box !important; -webkit-box-decoration-break: clone; box-decoration-break: clone;'}
      }
      @page {
        margin: ${isThermal ? '2mm' : '8mm 10mm'};
        size: ${isThermal ? '76mm auto' : 'A4 portrait'};
      }
    }
  </style>
</head>
<body>

  <!-- شريط التحكم والإرسال (يختفي عند الطباعة أو التصدير لـ PDF) -->
  <div class="screen-toolbar no-print">
    <div style="color: #F8FAFC; font-weight: 800; font-size: 15px; margin-left: 10px;">
      📸 يمكنك تصوير الشاشة بالموبايل أو حفظها
    </div>
    <button type="button" class="btn-action btn-print" onclick="window.print()">
      🖨️ طباعة ورقية / حفظ PDF
    </button>
    ${meta.waUrl ? `
      <a href="${meta.waUrl}" target="WhatsAppTab" class="btn-action btn-whatsapp">
        📱 إرسال واتساب للزبون
      </a>
    ` : ''}
    <button type="button" class="btn-action btn-close" onclick="window.close()">
      ✕ إغلاق
    </button>
  </div>

  <!-- جسم الفاتورة (A4 القياسية أو البون الحراري) -->
  <div class="invoice-sheet">
    ${isThermal ? this.renderThermalContent(invoice, meta, dateFormatted) : this.renderStandardA4Content(invoice, meta, dateFormatted)}
  </div>
</body>
</html>`;
  },

  // محتوى الفاتورة النظامية A4 المعتمدة (مع تدفق طبيعي للجدول وتكرار عنوان الجدول تلقائياً في الصفحة الثانية وتثبيت الملخص والفوتر في نهاية الفاتورة)
  renderStandardA4Content(invoice, meta, dateFormatted) {
    return `
      <!-- 1. الهيدر الرئيسي وبيانات العميل والسيارة والصيانة (أعلى الصفحة الأولى) -->
      <div class="invoice-header-block">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 900; margin-bottom: 3px; color: #000;">${meta.centerName}</h1>
            <div style="font-size: 13px; color: #333; font-weight: 700;">صيانة السيارات وضبط الزوايا والعفشة والمخرطة</div>
            <div style="font-size: 11px; color: #555;">${meta.centerAddress} ${meta.centerPhone ? '| ت: ' + meta.centerPhone : ''}</div>
          </div>
          <div style="text-align: left;">
            <div style="border: 2px solid #000; padding: 4px 10px; border-radius: 4px; font-size: 15px; font-weight: 900; display: inline-block;">
              فاتورة رقم: ${invoice.id}
            </div>
            <div style="font-size: 11px; margin-top: 4px; color: #444;">${dateFormatted}</div>
          </div>
        </div>

        <!-- شبكة بيانات العميل والسيارة الثابتة بالأعلى -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #F8FAFC; border: 1.5px solid #CBD5E1; padding: 8px 10px; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">
          <div>
            <div><strong>اسم العميل:</strong> ${invoice.customerName}</div>
            <div style="margin-top: 2px;"><strong>رقم التليفون:</strong> ${invoice.customerPhone}</div>
          </div>
          <div>
            <div><strong>السيارة:</strong> ${invoice.carInfo}</div>
            <div style="margin-top: 2px; display: flex; align-items: center;">
              <strong>نمرة اللوحة:</strong>
              <div class="plate-badge">
                <div class="plate-badge-top"><span>مصر</span><span>EGYPT</span></div>
                <div class="plate-badge-body">
                  <span>${invoice.plateLetters || ''}</span>
                  <span style="width:1.5px;height:12px;background:#000;"></span>
                  <span dir="ltr">${invoice.plateNumbers || ''}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- تفاصيل الصيانة الفنية -->
        ${(invoice.problem || invoice.suspensionNote || invoice.futureNeeds) ? `
          <div style="border: 1px solid #CBD5E1; background: #FFF; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; font-size: 12px; line-height: 1.5;">
            ${invoice.problem ? `<div><strong>⚠️ مشكلة السيارة قبل الصيانة:</strong> ${invoice.problem}</div>` : ''}
            ${invoice.suspensionNote ? `<div><strong>🛠️ صيانة العفشة المنفذة:</strong> ${invoice.suspensionNote}</div>` : ''}
            ${invoice.futureNeeds ? `<div><strong>💡 الصيانة القادمة المُرشحة:</strong> ${invoice.futureNeeds}</div>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- 2. جدول الخدمات وقطع الغيار (يبدأ فوراً بصفحة 1 ويتدفق للصفحة 2 ويتكرر thead تلقائياً) -->
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 44%;">البيان / الخدمة / القطعة</th>
            <th style="width: 15%; text-align: center;">النوع</th>
            <th style="width: 11%; text-align: center;">الكمية</th>
            <th style="width: 15%; text-align: center;">السعر</th>
            <th style="width: 15%; text-align: center;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.services || []).map(s => `
            <tr>
              <td>
                <strong>${s.name}</strong>
                ${s.customNote ? `<div style="font-size: 11px; color: #444;">• ${s.customNote}</div>` : ''}
                ${s.addons?.length ? `<div style="font-size: 10px; color: #555;">(${s.addons.map(a => a.name).join(' + ')})</div>` : ''}
              </td>
              <td style="font-size: 11px; text-align: center;">مصنعية صيانة</td>
              <td style="text-align: center;">1</td>
              <td style="text-align: center;">${s.price} ج.م</td>
              <td style="text-align: center; font-weight: 700;">${s.price} ج.م</td>
            </tr>
          `).join('')}
          ${(invoice.parts || []).map(p => `
            <tr>
              <td>
                <strong>${p.name}</strong>
                ${p.isCustom ? '<span style="font-size: 10px; color: #666;"> (خارجي)</span>' : ''}
              </td>
              <td style="font-size: 11px; text-align: center;">قطع غيار</td>
              <td style="text-align: center;">${p.quantity}</td>
              <td style="text-align: center;">${p.unitPrice} ج.م</td>
              <td style="text-align: center; font-weight: 700;">${p.totalPrice} ج.م</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- 3. المربع السفلي المتكامل (ملخص الحساب، شروط الضمان، التوقيعات) - غير قابل للتجزئة ويقع في نهاية الفاتورة -->
      <div class="invoice-bottom-block">
        <div class="summary-and-warranty-section" style="display: flex; justify-content: space-between; gap: 10px;">
          <div style="width: 52%; border: 1px solid #CCC; padding: 6px 8px; border-radius: 4px; font-size: 10.5px; background: #FAFAFA; line-height: 1.4;">
            <div style="font-weight: bold; margin-bottom: 2px;">📌 شروط الضمان:</div>
            <div>• الضمان ساري على ضبط الزوايا والعفشة لمدة 7 أيام من تاريخ الفاتورة.</div>
            <div>• يرجى الاحتفاظ بالفاتورة عند أي مراجعة بالمركز.</div>
          </div>

          <div style="width: 45%; font-size: 12.5px;">
            <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #DDD;">
              <span>المجموع:</span>
              <strong>${invoice.subTotal} ج.م</strong>
            </div>
            ${invoice.discountAmount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #DDD; color: #DC2626;">
                <span>الخصم:</span>
                <strong>-${invoice.discountAmount} ج.م</strong>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 2px solid #000; font-size: 15px; font-weight: 900;">
              <span>الإجمالي الصافي:</span>
              <span>${invoice.netTotal} ج.م</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
              <span>المدفوع:</span>
              <span>${invoice.totalPaid} ج.م</span>
            </div>
            ${invoice.remainingBalance > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 2px 0; font-weight: 900; color: #DC2626;">
                <span>المتبقي (آجل):</span>
                <span>${invoice.remainingBalance} ج.م</span>
              </div>
            ` : '<div style="color: #059669; font-weight: bold; font-size: 11px; text-align: left; margin-top: 2px;">✅ مدفوع بالكامل</div>'}
          </div>
        </div>

        <!-- الفوتر وتوقيع الإدارة المعتمد -->
        <div class="invoice-footer-signature">
          <div>توقيع العميل: ....................</div>
          <div style="font-weight: bold;">نتمنى لكم قيادة آمنة وسلامة دائمة 🚗🔧</div>
          <div>ختم وتوقيع المركز: ....................</div>
        </div>
      </div>
    `;
  },

  // محتوى البون الحراري 80mm
  renderThermalContent(invoice, meta, dateFormatted) {
    return `
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-size: 16px; font-weight: 900;">${meta.centerName}</div>
        <div style="font-size: 11px;">${meta.centerAddress}</div>
        ${meta.centerPhone ? `<div style="font-size: 11px;">ت: ${meta.centerPhone}</div>` : ''}
        <div style="font-size: 12px; font-weight: 800; margin-top: 4px; border: 1px solid #000; padding: 2px; display: inline-block;">إيصال صيانة #${invoice.id}</div>
      </div>

      <div style="font-size: 11.5px; line-height: 1.4; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div><strong>التاريخ:</strong> ${dateFormatted}</div>
        <div><strong>العميل:</strong> ${invoice.customerName} (${invoice.customerPhone})</div>
        <div><strong>العربية:</strong> ${invoice.carInfo} [ ${invoice.plateFull || (invoice.plateLetters + ' ' + invoice.plateNumbers)} ]</div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>البيان</th>
            <th style="width: 25%; text-align: center;">السعر</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.services || []).map(s => `
            <tr>
              <td>• ${s.name} ${s.customNote ? `(${s.customNote})` : ''}</td>
              <td style="text-align: center;">${s.price} ج.م</td>
            </tr>
          `).join('')}
          ${(invoice.parts || []).map(p => `
            <tr>
              <td>• ${p.name} (×${p.quantity})</td>
              <td style="text-align: center;">${p.totalPrice} ج.م</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="font-size: 12px; line-height: 1.5; border-top: 1px dashed #000; padding-top: 6px;">
        <div style="display: flex; justify-content: space-between;"><span>المجموع:</span><span>${invoice.subTotal} ج.م</span></div>
        ${invoice.discountAmount > 0 ? `<div style="display: flex; justify-content: space-between;"><span>الخصم:</span><span>-${invoice.discountAmount} ج.م</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 14px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 0; margin: 3px 0;">
          <span>الصافي المطلوب:</span><span>${invoice.netTotal} ج.م</span>
        </div>
        <div style="display: flex; justify-content: space-between;"><span>المدفوع:</span><span>${invoice.totalPaid} ج.م</span></div>
        ${invoice.remainingBalance > 0 ? `<div style="display: flex; justify-content: space-between; font-weight: 900;"><span>المتبقي:</span><span>${invoice.remainingBalance} ج.م</span></div>` : ''}
      </div>

      <div style="text-align: center; margin-top: 8px; font-size: 10.5px; border-top: 1px dashed #000; padding-top: 4px;">
        <div>الضمان ساري على الزوايا والعفشة 7 أيام</div>
        <div style="font-weight: bold; margin-top: 2px;">شكراً لزيارتكم 🔧</div>
      </div>
    `;
  },

  // للتوافق مع أي استدعاءات قديمة
  renderStandardA5Content(invoice, meta, dateFormatted) {
    return this.renderStandardA4Content(invoice, meta, dateFormatted);
  },

  // نافذة عرض وسجل وبحث الفواتير السابقة
  async showInvoicesLogModal(initialQuery = '') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const [invoices, todayInvoices] = await Promise.all([
      this.getInvoices({ limit: 100, query: initialQuery }),
      this.getTodayInvoices()
    ]);

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 950px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; padding: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 28px;">📋</span>
            <div>
              <h2 style="font-size: 24px; font-weight: 900; margin: 0; color: #FFFFFF;">سجل فواتير المركز والبحث السريع</h2>
              <div style="font-size: 14px; color: var(--text-muted); margin-top: 2px;">
                فواتير اليوم: <strong style="color: #38BDF8;">${todayInvoices.length}</strong> | إجمالي المسجل: <strong style="color: #34D399;">${invoices.length}</strong>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-secondary" id="btnCloseLogModal" style="padding: 6px 16px; min-height: 40px; font-size: 16px;">✕ إغلاق</button>
        </div>

        <!-- شريط البحث السريع والفلترة -->
        <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
          <input type="text" id="logSearchInput" class="form-control"
            placeholder="🔍 ابحث برقم الفاتورة، اسم العميل، التليفون، أو رقم اللوحة..."
            value="${initialQuery}"
            style="flex: 1; min-width: 280px; height: 44px; font-size: 15px;">
          <button type="button" class="btn btn-secondary" id="btnFilterTodayInvoices" style="padding: 0 16px; height: 44px; font-size: 14px; font-weight: 700;">
            فواتير اليوم (${todayInvoices.length})
          </button>
          <button type="button" class="btn btn-secondary" id="btnFilterAllInvoices" style="padding: 0 16px; height: 44px; font-size: 14px; font-weight: 700;">
            عرض الكل
          </button>
        </div>

        <!-- قائمة الفواتير -->
        <div id="invoicesLogListContainer" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
          <!-- سيتم بناؤه بالجافاسكربت -->
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const listContainer = overlay.querySelector('#invoicesLogListContainer');
    const searchInput = overlay.querySelector('#logSearchInput');

    const renderList = (items) => {
      if (!items || items.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 18px;">
            لا توجد فواتير مطابقة للبحث.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = items.map(inv => {
        const timeStr = new Date(inv.date || inv.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(inv.date || inv.createdAt).toLocaleDateString('ar-EG');
        const plate = inv.plateFull || `${inv.plateLetters || ''} ${inv.plateNumbers || ''}`.trim() || 'بدون لوحة';

        return `
          <div style="background: var(--bg-surface-elevated); border: 1.5px solid var(--border-color); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap;">
            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="color: #60A5FA; font-size: 16px; font-family: monospace;">${inv.id}</strong>
                <span style="font-size: 12px; color: var(--text-muted);">${dateStr} (${timeStr})</span>
              </div>
              <div style="font-size: 17px; font-weight: 800; color: #FFFFFF;">
                👤 ${inv.customerName} - <span style="direction: ltr; display: inline-block; color: #38BDF8; font-size: 15px;">${inv.customerPhone}</span>
              </div>
              <div style="font-size: 13.5px; color: var(--text-secondary);">
                🚗 ${inv.carInfo} | <span style="color: #FBBF24; font-weight: 700;">[ ${plate} ]</span>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
              <div style="font-size: 18px; font-weight: 900; color: #34D399;">
                ${inv.netTotal} ج.م
              </div>
              <div style="font-size: 13px; color: var(--text-muted);">
                المدفوع: ${inv.totalPaid} ج.م ${inv.remainingBalance > 0 ? `| <span style="color: #F87171; font-weight: 800;">متبقي ${inv.remainingBalance} ج</span>` : '| خالص ✅'}
              </div>
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn btn-primary btn-open-log-pdf" data-inv-id="${inv.id}" style="padding: 6px 14px; font-size: 13.5px; min-height: 38px; background: linear-gradient(135deg, #2563EB, #1D4ED8); font-weight: 800;">
                📄 فتح PDF
              </button>
              <button type="button" class="btn btn-secondary btn-print-log-a4" data-inv-id="${inv.id}" style="padding: 6px 12px; font-size: 13.5px; min-height: 38px;">
                🖨️ طباعة
              </button>
              <button type="button" class="btn btn-secondary btn-wa-log" data-inv-id="${inv.id}" style="padding: 6px 12px; font-size: 14px; min-height: 38px;" title="إرسال واتساب">
                📱
              </button>
            </div>
          </div>
        `;
      }).join('');

      listContainer.querySelectorAll('.btn-open-log-pdf').forEach(btn => {
        btn.addEventListener('click', async () => {
          const invId = btn.dataset.invId;
          const targetInv = items.find(x => x.id === invId);
          if (targetInv) {
            await this.openInvoiceDigitalView(targetInv, 'standard');
          }
        });
      });

      listContainer.querySelectorAll('.btn-print-log-a4').forEach(btn => {
        btn.addEventListener('click', async () => {
          const invId = btn.dataset.invId;
          const targetInv = items.find(x => x.id === invId);
          if (targetInv) {
            await this.printInvoice(targetInv, 'standard');
          }
        });
      });

      listContainer.querySelectorAll('.btn-wa-log').forEach(btn => {
        btn.addEventListener('click', () => {
          const invId = btn.dataset.invId;
          const targetInv = items.find(x => x.id === invId);
          if (targetInv) {
            this.sendWhatsApp(targetInv);
          }
        });
      });
    };

    renderList(invoices);

    // بحث حي
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        const results = await this.getInvoices({ query, limit: 100 });
        renderList(results);
      }, 200);
    });

    overlay.querySelector('#btnFilterTodayInvoices').addEventListener('click', async () => {
      searchInput.value = '';
      const today = await this.getTodayInvoices();
      renderList(today);
    });

    overlay.querySelector('#btnFilterAllInvoices').addEventListener('click', async () => {
      searchInput.value = '';
      const all = await this.getInvoices({ limit: 100 });
      renderList(all);
    });

    overlay.querySelector('#btnCloseLogModal').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
};
