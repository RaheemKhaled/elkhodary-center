/**
 * شاشة إعدادات النظام:
 * - تعديل قائمة الخدمات والإضافات والأسعار الافتراضية
 * - إدارة الفنيين والعمال
 * - ربط Google Sheets واختبار الاتصال
 * - النسخ الاحتياطي (تصدير واستيراد)
 */

import { db } from '../db/indexeddb.js';
import { syncEngine } from '../sync/syncEngine.js';
import { authService } from '../services/authService.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { localBackupService } from '../services/localBackupService.js';
import { suggestionService, SUGGESTION_KINDS } from '../services/suggestionService.js';

export const settingsView = {
  async render(container) {
    const [
      services, workers, users, webhookSetting, centerNameSetting, centerPhoneSetting, centerAddressSetting
    ] = await Promise.all([
      db.getAll('services'),
      db.getAll('workers'),
      authService.getAllUsers(),
      db.get('settings', 'googleSheetsWebhookUrl'),
      db.get('settings', 'centerName'),
      db.get('settings', 'centerPhone'),
      db.get('settings', 'centerAddress')
    ]);

    const webhookUrl = webhookSetting?.value || syncEngine.builtInUrl || '';
    const centerName = centerNameSetting?.value || 'مركز صيانة السيارات وضبط الزوايا';
    const centerPhone = centerPhoneSetting?.value || '';
    const centerAddress = centerAddressSetting?.value || '';

    container.innerHTML = `
      <div class="settings-screen">
        <div class="card-header" style="border: none; padding: 0; margin-bottom: 24px;">
          <div>
            <h1 style="font-size: 34px; font-weight: 900; color: #FFFFFF;">⚙️ إعدادات النظام والخدمات</h1>
            <p style="font-size: 20px; color: var(--text-muted);">
              ربط Google Sheets، أسعار الخدمات، الفنيين، المستخدمين، والنسخ الاحتياطي.
            </p>
          </div>
        </div>

        <!-- 2. ربط Google Sheets (المزامنة السحابية الإضافية) -->
        <div class="card" style="border-color: #2563EB;">
          <h2 class="card-title">
            <span>📊</span>
            <span>ربط وتخزين Google Sheets (المزامنة مع الشيتات)</span>
          </h2>
          <p style="color: var(--text-secondary); font-size: 18px; margin-bottom: 16px;">
            الصق رابط تطبيق الويب (Google Apps Script Web App URL) لمزامنة كافة العمليات تلقائياً في جداول Google Sheets.
          </p>

          <div class="form-group">
            <label class="form-label" for="settingWebhookInput">رابط تطبيق الويب (Web App URL):</label>
            <div style="display: flex; gap: 12px;">
              <input 
                type="url" 
                id="settingWebhookInput" 
                class="form-control" 
                placeholder="https://script.google.com/macros/s/..." 
                value="${webhookUrl}"
                style="direction: ltr; text-align: left; font-family: monospace;"
              >
              <button type="button" class="btn btn-primary" id="btnSaveWebhook" style="min-width: 140px;">
                💾 حفظ الرابط
              </button>
              <button type="button" class="btn btn-secondary" id="btnTestWebhook" style="min-width: 140px;">
                ⚡ اختبار وفحص
              </button>
            </div>
          </div>

          <div style="background: var(--bg-input); padding: 14px 20px; border-radius: var(--radius-md); font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              حالة الرابط: <strong id="webhookStatusDisplay" style="color: ${webhookUrl ? '#34D399' : '#FBBF24'};">${webhookUrl ? 'تم ضبط الرابط ✅' : 'لم يتم إدخال الرابط بعد ⚠️'}</strong>
            </div>
            <button type="button" class="btn btn-secondary" id="btnForceSyncNow" style="padding: 8px 16px; min-height: 44px;">
              🔄 تشغيل المزامنة اليدوية الآن
            </button>
          </div>
        </div>

        <!-- مكان حفظ الملفات على الجهاز (نسخة الديسكتوب فقط) -->
        ${window.desktopAPI ? `
        <div class="card" style="border-color: #F59E0B;">
          <h2 class="card-title">
            <span>📁</span>
            <span>مكان حفظ الفواتير والنسخ الاحتياطية على الجهاز</span>
          </h2>
          <p style="color: var(--text-secondary); font-size: 17px; margin-bottom: 14px;">
            الفواتير PDF بتتحفظ هنا في فولدر لكل أسبوع، ومعاها نسخة احتياطية يومية من كل بيانات البرنامج.
            الإعداد ده خاص بالجهاز ده بس، فلو البرنامج اتثبت على جهاز تاني اختار له المكان المناسب.
          </p>
          <div style="background: var(--bg-input); padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 14px;">
            <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 4px;">المكان الحالي:</div>
            <div id="storageRootDisplay" style="font-size: 17px; font-weight: 800; color: #FDE68A; direction: ltr; text-align: right; word-break: break-all;">...</div>
            <div id="storageStatusDisplay" style="font-size: 14px; color: var(--text-muted); margin-top: 6px;"></div>
            <div id="appVersionDisplay" style="font-size: 13px; color: var(--text-muted); margin-top: 6px;"></div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" id="btnChooseStorageFolder">📂 تغيير المكان</button>
            <button type="button" class="btn btn-secondary" id="btnOpenStorageFolder">🗂️ فتح فولدر الفواتير</button>
            <button type="button" class="btn btn-secondary" id="btnBackupNowLocal">💾 نسخة احتياطية دلوقتي</button>
            <button type="button" class="btn btn-secondary" id="btnOpenBackupsFolder">🗄️ فتح فولدر النسخ</button>
            <button type="button" class="btn btn-secondary" id="btnResetStorageFolder">↩️ رجوع للمكان الافتراضي</button>
          </div>
        </div>
        ` : ''}

        <!-- 2. بيانات المركز المطبوعة على الفاتورة -->
        <div class="card">
          <h2 class="card-title">
            <span>🏢</span>
            <span>بيانات المركز (التي تظهر في ترويسة الفاتورة)</span>
          </h2>
          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">اسم المركز / الورشة:</label>
              <input type="text" id="centerNameInput" class="form-control" value="${centerName}">
            </div>
            <div class="form-group">
              <label class="form-label">رقم تليفون المركز:</label>
              <input type="text" id="centerPhoneInput" class="form-control" value="${centerPhone}" placeholder="مثال: 01000000000">
            </div>
            <div class="form-group">
              <label class="form-label">العنوان:</label>
              <input type="text" id="centerAddressInput" class="form-control" value="${centerAddress}" placeholder="مثال: القاهرة - مصر">
            </div>
          </div>
          <button type="button" class="btn btn-success" id="btnSaveCenterInfo">
            💾 حفظ بيانات المركز
          </button>
        </div>

        <!-- 3. قائمة الخدمات والأسعار الافتراضية والإضافات -->
        <div class="card">
          <div class="card-header" style="border: none; padding: 0; margin-bottom: 16px;">
            <h2 class="card-title">
              <span>🔧</span>
              <span>قائمة خدمات الصيانة والأسعار (كل أسعار شاشة الكاشير من هنا)</span>
            </h2>
            <button type="button" class="btn btn-primary" id="btnAddNewService">
              ➕ إضافة خدمة جديدة
            </button>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>اسم الخدمة</th>
                  <th>السعر الافتراضي</th>
                  <th>الإضافات المتاحة</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${[...services].sort((a, b) => (b.quickGroup ? 1 : 0) - (a.quickGroup ? 1 : 0)).map(s => `
                  <tr>
                    <td style="font-weight: 800; font-size: 22px; color: #FFFFFF;">${s.name}
                      ${s.quickGroup ? `<div style="font-size: 13px; color: #60A5FA; font-weight: 700;">⚡ زرار سريع في شاشة الكاشير</div>` : ''}</td>
                    <td style="font-weight: 800; font-size: 20px; color: #FBBF24;">${s.defaultPrice} ج.م${s.perUnit ? '<div style="font-size: 13px; color: var(--text-muted);">للفردة الواحدة</div>' : ''}</td>
                    <td>
                      ${s.hasAddons && s.availableAddons?.length ? s.availableAddons.map(a => `
                        <span class="badge badge-info" style="margin-left: 4px; font-size: 15px;">${a.name} (+${a.defaultPrice} ج.م)</span>
                      `).join('') : '<span style="color: var(--text-muted);">بدون إضافات</span>'}
                    </td>
                    <td>
                      <span class="badge ${s.isActive !== false ? 'badge-success' : 'badge-danger'}">
                        ${s.isActive !== false ? 'نشطة ومفعلة' : 'معطلة / مخفية'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-secondary btn-edit-srv" data-srv-id="${s.id}" style="padding: 6px 14px; min-height: 44px;">
                          ✏️ تعديل
                        </button>
                        ${s.quickGroup ? '' : `<button type="button" class="btn btn-danger btn-delete-srv" data-srv-id="${s.id}" data-srv-name="${s.name}" style="padding: 6px 12px; min-height: 44px;" title="حذف الخدمة">
                          🗑️
                        </button>`}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- اقتراحات الكتابة -->
        <div class="card" style="border-color: #8B5CF6;">
          <h2 class="card-title"><span>💬</span><span>اقتراحات الكتابة في الكاشير</span></h2>
          <p style="color: var(--text-secondary); font-size: 16px; margin-bottom: 12px;">
            الاقتراحات اللي بتظهر وانت بتكتب شكوى العميل وأعمال العفشة والصيانة القادمة. عدّل أي اقتراح أو امسحه لو اتكتب غلط.
          </p>
          <div id="sugTabs" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
            ${Object.entries(SUGGESTION_KINDS).map(([k, v], i) => `<button type="button" class="btn ${i === 0 ? 'btn-primary' : 'btn-secondary'} sug-tab" data-kind="${k}">${v.label}</button>`).join('')}
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <input type="text" id="sugNewInput" class="form-control" placeholder="اقتراح جديد..." style="flex: 1;">
            <button type="button" class="btn btn-success" id="sugAddBtn">➕ إضافة</button>
          </div>
          <div id="sugList" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;"></div>
        </div>

        <!-- 4. إدارة الفنيين والعمالة -->
        <div class="card">
          <div class="card-header" style="border: none; padding: 0; margin-bottom: 16px;">
            <h2 class="card-title">
              <span>👨‍🔧</span>
              <span>الفنيين والعمالة المسجلين</span>
            </h2>
            <button type="button" class="btn btn-primary" id="btnAddWorker">
              ➕ إضافة فني جديد
            </button>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>اسم الفني</th>
                  <th>رقم التليفون</th>
                  <th>التخصص</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${workers.map(w => `
                  <tr>
                    <td style="font-weight: 800; font-size: 22px; color: #FFFFFF;">👨‍🔧 ${w.name}</td>
                    <td style="color: #38BDF8;">${w.phone || '-'}</td>
                    <td><span class="badge badge-info">${w.specialty || 'فني صيانة'}</span></td>
                    <td>
                      <span class="badge ${w.isActive !== false ? 'badge-success' : 'badge-danger'}">
                        ${w.isActive !== false ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td>
                      <button type="button" class="btn btn-secondary btn-edit-worker" data-worker-id="${w.id}" style="padding: 6px 14px; min-height: 44px;">
                        ✏️ تعديل
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. إدارة المستخدمين وصلاحيات الدخول -->
        <div class="card" style="border-color: #8B5CF6;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h2 class="card-title" style="margin: 0;">
                <span>👥</span>
                <span>إدارة المستخدمين وصلاحيات الدخول (الحسابات وكلمات المرور)</span>
              </h2>
              <p style="color: var(--text-secondary); font-size: 16px; margin: 4px 0 0;">
                المدير يعين اسم المستخدم، كلمة المرور، والدور (مدير أو كاشير) لكل موظف.
              </p>
            </div>
            <button type="button" class="btn btn-primary" id="btnAddUserBtn" style="font-size: 16px; padding: 8px 18px;">
              ➕ إضافة مستخدم جديد
            </button>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>اسم الموظف</th>
                  <th>اسم المستخدم</th>
                  <th>كلمة المرور</th>
                  <th>الدور الصلاحي</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td style="font-weight: 800; font-size: 18px; color: #FFFFFF;">${u.name}</td>
                    <td style="font-family: monospace; font-size: 18px; color: #38BDF8; font-weight: 700;">${u.username}</td>
                    <td style="font-family: monospace; font-size: 18px;">
                      <span class="user-pass-display" id="passText-${u.id}">••••••</span>
                      <button type="button" class="btn-toggle-user-pass" data-target="passText-${u.id}" data-pass="${u.password}" style="background: none; border: none; cursor: pointer; font-size: 16px; margin-right: 6px;" title="إظهار / إخفاء">👁️</button>
                    </td>
                    <td>
                      <span class="badge ${u.role === 'manager' ? 'badge-warning' : 'badge-info'}" style="font-size: 14px;">
                        ${u.role === 'manager' ? '👑 مدير (كامل الصلاحيات)' : '🧑‍💼 كاشير (فواتير فقط)'}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${u.isActive !== false ? 'badge-success' : 'badge-danger'}" style="font-size: 14px;">
                        ${u.isActive !== false ? '✅ نشط' : '❌ معطل'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        <button type="button" class="btn btn-secondary btn-edit-user" data-user-id="${u.id}" style="padding: 4px 10px; font-size: 14px; min-height: 36px;">
                          ✏️ تعديل
                        </button>
                        ${u.id !== 'USR-RAHEEM' ? `
                          <button type="button" class="btn btn-danger btn-delete-user" data-user-id="${u.id}" data-user-name="${u.name}" style="padding: 4px 10px; font-size: 14px; min-height: 36px;">
                            🗑️ حذف
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 6. النسخ الاحتياطي وتصدير البيانات -->
        <div class="card">
          <h2 class="card-title">
            <span>💾</span>
            <span>النسخ الاحتياطي واسترجاع البيانات (Backup)</span>
          </h2>
          <p style="color: var(--text-secondary); font-size: 18px; margin-bottom: 16px;">
            يمكنك تحميل نسخة احتياطية كاملة لجميع بيانات المركز في أي وقت، أو استرجاعها على جهاز آخر.
          </p>
          <div style="display: flex; gap: 16px;">
            <button type="button" class="btn btn-success" id="btnExportBackup" style="font-size: 20px;">
              📥 تحميل نسخة احتياطية كاملة (JSON)
            </button>
            <label class="btn btn-secondary" style="font-size: 20px; cursor: pointer; margin: 0;">
              📤 استعادة نسخة احتياطية من ملف
              <input type="file" id="importBackupFileInput" accept=".json" style="display: none;">
            </label>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container, services, workers, users);
  },

  attachEvents(container, services, workers, users = []) {
    // ===== اقتراحات الكتابة: تعديل ومسح =====
    let sugKind = 'problem';
    const sugList = container.querySelector('#sugList');
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const renderSug = async () => {
      if (!sugList) return;
      const items = await suggestionService.list(sugKind);
      sugList.innerHTML = items.length ? items.map(x => `
        <div style="display: flex; gap: 8px; align-items: center; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px;">
          <input type="text" class="form-control sug-text" data-id="${x.id}" value="${esc(x.text)}" style="flex: 1; min-height: 40px;">
          <span style="font-size: 13px; color: var(--text-muted); white-space: nowrap;">${x.useCount || 0} مرة</span>
          <button type="button" class="btn btn-secondary sug-save" data-id="${x.id}" style="min-height: 40px;">💾 حفظ</button>
          <button type="button" class="btn btn-danger sug-del" data-id="${x.id}" style="min-height: 40px;">🗑️</button>
        </div>`).join('') : '<div style="color: var(--text-muted); padding: 10px;">مفيش اقتراحات هنا لسه.</div>';
      sugList.querySelectorAll('.sug-save').forEach(b => b.addEventListener('click', async () => {
        const val = sugList.querySelector(`.sug-text[data-id="${b.dataset.id}"]`).value;
        try { await suggestionService.rename(b.dataset.id, val); toast.success('اتعدل الاقتراح'); renderSug(); } catch (e) { toast.warning(e.message); }
      }));
      sugList.querySelectorAll('.sug-del').forEach(b => b.addEventListener('click', async () => {
        await suggestionService.remove(b.dataset.id); toast.success('اتمسح الاقتراح'); renderSug();
      }));
    };
    container.querySelectorAll('.sug-tab').forEach(t => t.addEventListener('click', () => {
      sugKind = t.dataset.kind;
      container.querySelectorAll('.sug-tab').forEach(x => { x.classList.toggle('btn-primary', x === t); x.classList.toggle('btn-secondary', x !== t); });
      renderSug();
    }));
    container.querySelector('#sugAddBtn')?.addEventListener('click', async () => {
      const inp = container.querySelector('#sugNewInput');
      try { await suggestionService.add(sugKind, inp.value); inp.value = ''; toast.success('اتضاف الاقتراح'); renderSug(); } catch (e) { toast.warning(e.message); }
    });
    suggestionService.importFromInvoicesOnce().catch(() => {}).finally(renderSug);

    // ===== مكان الحفظ على الجهاز (ديسكتوب) =====
    if (window.desktopAPI) {
      const rootEl = container.querySelector('#storageRootDisplay');
      const statusEl = container.querySelector('#storageStatusDisplay');
      const showInfo = (info) => {
        if (!info || !rootEl) return;
        rootEl.textContent = info.root;
        const parts = [info.isCustom ? '📌 مكان مختار يدوياً' : '📄 المكان الافتراضي (المستندات)'];
        if (info.customUnavailable) parts.push(`⚠️ المكان المختار (${info.customRoot}) مش متاح دلوقتي، فالحفظ شغال مؤقتاً في المكان الافتراضي`);
        parts.push(info.lastBackupAt ? `آخر نسخة احتياطية: ${new Date(info.lastBackupAt).toLocaleString('ar-EG')}` : 'لسه مفيش نسخة احتياطية');
        statusEl.innerHTML = parts.join('<br>');
      };
      window.desktopAPI.getStorageInfo().then(showInfo);
      window.desktopAPI.getVersion?.().then(v => {
        const el = container.querySelector('#appVersionDisplay');
        if (el) el.textContent = `إصدار البرنامج: ${v} (التحديثات بتنزل تلقائياً)`;
      });

      container.querySelector('#btnChooseStorageFolder').addEventListener('click', async () => {
        try {
          const info = await window.desktopAPI.chooseStorageFolder();
          showInfo(info);
          if (!info.canceled) toast.success(`تم تغيير مكان الحفظ إلى:\n${info.root}`);
        } catch (err) {
          toast.error(err.message);
        }
      });
      container.querySelector('#btnResetStorageFolder').addEventListener('click', async () => {
        showInfo(await window.desktopAPI.resetStorageFolder());
        toast.success('تم الرجوع لمكان الحفظ الافتراضي');
      });
      container.querySelector('#btnOpenStorageFolder').addEventListener('click', () => window.desktopAPI.openStorageFolder('root'));
      container.querySelector('#btnOpenBackupsFolder').addEventListener('click', () => window.desktopAPI.openStorageFolder('backups'));
      container.querySelector('#btnBackupNowLocal').addEventListener('click', async () => {
        try {
          const res = await localBackupService.backupNow('manual');
          showInfo(res);
          toast.success(`تم حفظ نسخة احتياطية:\n${res.filePath}`);
        } catch (err) {
          toast.error(`فشل النسخ الاحتياطي: ${err.message}`);
        }
      });
    }

    // 2. حفظ رابط Webhook الشيتات
    const webhookInput = container.querySelector('#settingWebhookInput');
    container.querySelector('#btnSaveWebhook').addEventListener('click', async () => {
      const url = webhookInput.value.trim();
      await db.put('settings', { key: 'googleSheetsWebhookUrl', value: url });
      syncEngine.setWebhookUrl(url);
      toast.success('تم حفظ رابط Google Apps Script بنجاح');
      container.querySelector('#webhookStatusDisplay').textContent = url ? 'تم ضبط الرابط ✅' : 'لم يتم إدخال الرابط بعد ⚠️';
    });

    // اختبار الاتصال
    container.querySelector('#btnTestWebhook').addEventListener('click', async () => {
      const url = webhookInput.value.trim();
      if (!url) {
        toast.warning('يرجى إدخال الرابط أولاً للاختبار');
        return;
      }
      toast.info('جاري اختبار الاتصال برابط Google Sheets...');
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'online') {
          toast.success('الاتصال ناجح تماماً! تم التحقق من Google Sheets Web App بنجاح 🚀');
        } else {
          toast.warning(`تم الاتصال ولكن الاستجابة: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        toast.error(`تعذر الاتصال بالرابط: ${err.message}. تأكد من نشر الـ Web App بصلاحية "Anyone"`);
      }
    });

    // المزامنة الفورية اليدوية
    container.querySelector('#btnForceSyncNow').addEventListener('click', async () => {
      try {
        toast.info('جاري بدء المزامنة الفورية...');
        await syncEngine.syncNow();
        toast.success('تمت المزامنة بنجاح');
      } catch (err) {
        toast.warning(err.message);
      }
    });

    // حفظ بيانات المركز
    container.querySelector('#btnSaveCenterInfo').addEventListener('click', async () => {
      const name = container.querySelector('#centerNameInput').value.trim();
      const phone = container.querySelector('#centerPhoneInput').value.trim();
      const address = container.querySelector('#centerAddressInput').value.trim();

      await db.put('settings', { key: 'centerName', value: name });
      await db.put('settings', { key: 'centerPhone', value: phone });
      await db.put('settings', { key: 'centerAddress', value: address });
      toast.success('تم حفظ بيانات المركز بنجاح');
    });

    // تصدير نسخة احتياطية
    container.querySelector('#btnExportBackup').addEventListener('click', async () => {
      const backup = await db.exportFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `نسخة_احتياطية_المركز_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('تم تصدير النسخة الاحتياطية بنجاح');
    });

    // أحداث إدارة المستخدمين
    container.querySelector('#btnAddUserBtn')?.addEventListener('click', () => {
      this.showUserModal(container);
    });

    container.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.userId;
        const targetUser = users.find(u => u.id === uid);
        if (targetUser) this.showUserModal(container, targetUser);
      });
    });

    container.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.userId;
        const uname = btn.dataset.userName;
        if (!confirm(`هل أنت متأكد من حذف حساب "${uname}"؟`)) return;
        try {
          await authService.deleteUser(uid);
          toast.success(`تم حذف حساب ${uname}`);
          this.render(container);
        } catch (err) {
          toast.error(err.message);
        }
      });
    });

    container.querySelectorAll('.btn-toggle-user-pass').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const pass = btn.dataset.pass;
        const el = container.querySelector('#' + targetId);
        if (el) {
          const isMasked = el.textContent === '••••••';
          el.textContent = isMasked ? pass : '••••••';
          btn.textContent = isMasked ? '🙈' : '👁️';
        }
      });
    });

    // استيراد نسخة احتياطية
    container.querySelector('#importBackupFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const confirmed = await modal.confirm({
        title: 'استرجاع نسخة احتياطية',
        message: 'هل تريد استعادة البيانات من هذا الملف؟ سيتم دمج أو تحديث السجلات الحالية.',
        type: 'warning'
      });

      if (confirmed) {
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          await db.importBackup(json);
          toast.success('تمت استعادة النسخة الاحتياطية بنجاح');
          this.render(container);
        } catch (err) {
          toast.error(`فشل في قراءة الملف: ${err.message}`);
        }
      }
    });

    // إضافة خدمة
    container.querySelector('#btnAddNewService').addEventListener('click', () => {
      this.showServiceModal(container);
    });

    // تعديل خدمة
    container.querySelectorAll('.btn-edit-srv').forEach(btn => {
      btn.addEventListener('click', () => {
        const srvId = btn.getAttribute('data-srv-id');
        const srv = services.find(s => s.id === srvId);
        if (srv) this.showServiceModal(container, srv);
      });
    });

    // حذف خدمة
    container.querySelectorAll('.btn-delete-srv').forEach(btn => {
      btn.addEventListener('click', async () => {
        const srvId = btn.getAttribute('data-srv-id');
        const srvName = btn.getAttribute('data-srv-name') || 'الخدمة';
        if (!confirm(`هل أنت متأكد من حذف خدمة "${srvName}"؟ لن تظهر في الفواتير القادمة.`)) return;
        try {
          await db.delete('services', srvId);
          toast.success(`تم حذف خدمة "${srvName}" بنجاح`);
          this.render(container);
        } catch (err) {
          toast.error(`حدث خطأ أثناء الحذف: ${err.message}`);
        }
      });
    });

    // إضافة وتعديل فني
    container.querySelector('#btnAddWorker').addEventListener('click', () => {
      this.showWorkerModal(container);
    });

    container.querySelectorAll('.btn-edit-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        const wId = btn.getAttribute('data-worker-id');
        const w = workers.find(item => item.id === wId);
        if (w) this.showWorkerModal(container, w);
      });
    });
  },

  // نافذة إضافة وتعديل خدمة
  showServiceModal(parentContainer, srv = null) {
    const isEdit = Boolean(srv);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    let addons = srv?.availableAddons ? JSON.parse(JSON.stringify(srv.availableAddons)) : [];

    const renderAddonsList = () => {
      const box = overlay.querySelector('#serviceAddonsEditList');
      if (addons.length === 0) {
        box.innerHTML = '<div style="color: var(--text-muted); font-size: 16px;">لا توجد إضافات تابعة لهذه الخدمة بعد.</div>';
        return;
      }
      box.innerHTML = addons.map((a, idx) => `
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
          <input type="text" class="form-control addon-name-edit" data-idx="${idx}" value="${a.name}" placeholder="اسم الإضافة" style="min-height: 44px;">
          <input type="number" class="form-control addon-price-edit" data-idx="${idx}" value="${a.defaultPrice}" placeholder="السعر" min="0" style="min-height: 44px; width: 120px;">
          <button type="button" class="btn btn-danger btn-remove-addon-item" data-idx="${idx}" style="padding: 6px 12px; min-height: 40px;">🗑️</button>
        </div>
      `).join('');

      box.querySelectorAll('.addon-name-edit').forEach(inp => {
        inp.addEventListener('input', () => {
          addons[Number(inp.getAttribute('data-idx'))].name = inp.value;
        });
      });
      box.querySelectorAll('.addon-price-edit').forEach(inp => {
        inp.addEventListener('input', () => {
          addons[Number(inp.getAttribute('data-idx'))].defaultPrice = Number(inp.value) || 0;
        });
      });
      box.querySelectorAll('.btn-remove-addon-item').forEach(btn => {
        btn.addEventListener('click', () => {
          addons.splice(Number(btn.getAttribute('data-idx')), 1);
          renderAddonsList();
        });
      });
    };

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 650px;">
        <h2 class="modal-title">${isEdit ? '✏️ تعديل خدمة صيانة' : '➕ إضافة خدمة صيانة جديدة'}</h2>

        <div class="form-group">
          <label class="form-label"><span class="required">*</span> اسم الخدمة:</label>
          <input type="text" id="srvNameInput" class="form-control" value="${srv?.name || ''}">
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label"><span class="required">*</span> السعر الافتراضي (ج.م):</label>
            <input type="number" id="srvPriceInput" class="form-control" value="${srv?.defaultPrice || 0}" min="0">
          </div>

          <div class="form-group">
            <label class="form-label">حالة الخدمة:</label>
            <select id="srvActiveSelect" class="form-control">
              <option value="true" ${srv?.isActive !== false ? 'selected' : ''}>نشطة ومتاحة في الفاتورة</option>
              <option value="false" ${srv?.isActive === false ? 'selected' : ''}>معطلة ومخفية</option>
            </select>
          </div>
        </div>

        <div style="margin-top: 16px; border-top: 2px dashed var(--border-color); padding-top: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <label class="form-label" style="margin: 0;">الإضافات الاختيارية التابعة (مثل: برستا، شغل مقص...):</label>
            <button type="button" class="btn btn-secondary" id="btnAddAddonRow" style="padding: 6px 14px; min-height: 40px; font-size: 16px;">
              ➕ إضافة بند
            </button>
          </div>
          <div id="serviceAddonsEditList"></div>
        </div>

        <div class="modal-actions" style="margin-top: 24px;">
          <button type="button" class="btn btn-secondary" id="btnCancelSrvModal">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnSaveSrvModal">حفظ الخدمة</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    renderAddonsList();

    overlay.querySelector('#btnAddAddonRow').addEventListener('click', () => {
      addons.push({ id: 'ADD-' + Date.now().toString(36), name: '', defaultPrice: 50 });
      renderAddonsList();
    });

    overlay.querySelector('#btnCancelSrvModal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnSaveSrvModal').addEventListener('click', async () => {
      const name = overlay.querySelector('#srvNameInput').value.trim();
      const defaultPrice = Number(overlay.querySelector('#srvPriceInput').value) || 0;
      const isActive = overlay.querySelector('#srvActiveSelect').value === 'true';

      if (!name) {
        toast.error('اسم الخدمة مطلوب');
        return;
      }

      const cleanAddons = addons.filter(a => a.name.trim());

      const dataToSave = {
        ...(srv || {}),
        id: srv?.id || db.generateId('SRV'),
        name,
        defaultPrice,
        hasAddons: cleanAddons.length > 0,
        availableAddons: cleanAddons,
        isActive,
        isCustom: srv?.isCustom || false
      };

      await db.put('services', dataToSave);
      toast.success('تم حفظ الخدمة بنجاح');
      overlay.remove();
      this.render(parentContainer);
    });
  },

  // نافذة إضافة وتعديل فني
  showWorkerModal(parentContainer, w = null) {
    const isEdit = Boolean(w);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <h2 class="modal-title">${isEdit ? '✏️ تعديل بيانات فني' : '➕ إضافة فني جديد'}</h2>

        <div class="form-group">
          <label class="form-label"><span class="required">*</span> اسم الفني / العامل:</label>
          <input type="text" id="workerNameInput" class="form-control" value="${w?.name || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">رقم التليفون:</label>
          <input type="tel" id="workerPhoneInput" class="form-control" value="${w?.phone || ''}" placeholder="01xxxxxxxxx">
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">التخصصات (ممكن أكتر من واحد):</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${['زوايا', 'عفشة', 'ترصيص', 'كاوتش', 'مخرطة', 'لحام', 'عام'].map(sp => `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--border-color);border-radius:18px;cursor:pointer;font-weight:700;"><input type="checkbox" class="spec-chk" value="${sp}" ${(String(w?.specialty || '').split(/[،,]/).map(x => x.trim())).includes(sp) ? 'checked' : ''} style="width:18px;height:18px;"> ${sp}</label>`).join('')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">الحالة:</label>
            <select id="workerActiveSelect" class="form-control">
              <option value="true" ${w?.isActive !== false ? 'selected' : ''}>نشط ويعمل</option>
              <option value="false" ${w?.isActive === false ? 'selected' : ''}>غير نشط</option>
            </select>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="btnCancelWorkerModal">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnSaveWorkerModal">حفظ الفني</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnCancelWorkerModal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnSaveWorkerModal').addEventListener('click', async () => {
      const name = overlay.querySelector('#workerNameInput').value.trim();
      const phone = overlay.querySelector('#workerPhoneInput').value.trim();
      const specialty = [...overlay.querySelectorAll('.spec-chk:checked')].map(c => c.value).join('، ');
      const isActive = overlay.querySelector('#workerActiveSelect').value === 'true';

      if (!name) {
        toast.error('اسم الفني مطلوب');
        return;
      }

      await db.put('workers', {
        ...(w || {}),
        id: w?.id || db.generateId('WRK'),
        name,
        phone,
        specialty,
        isActive
      });

      toast.success('تم حفظ الفني بنجاح');
      overlay.remove();
      this.render(parentContainer);
    });
  },

  // نافذة إضافة وتعديل مستخدم وصلاحيات
  showUserModal(parentContainer, user = null) {
    const isEdit = Boolean(user);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 520px; padding: 24px;">
        <h2 style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin-bottom: 18px;">
          ${isEdit ? '✏️ تعديل بيانات المستخدم والصلاحيات' : '➕ إضافة مستخدم جديد للنظام'}
        </h2>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label"><span class="required">*</span> اسم الموظف / الفني:</label>
          <input type="text" id="usrModalName" class="form-control" value="${user?.name || ''}" placeholder="مثال: أحمد عبد الله...">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label"><span class="required">*</span> اسم الدخول (Username):</label>
            <input type="text" id="usrModalUsername" class="form-control" value="${user?.username || ''}" placeholder="مثال: ahmed..." style="direction: ltr; text-align: left;">
          </div>
          <div class="form-group">
            <label class="form-label"><span class="required">*</span> كلمة المرور:</label>
            <input type="text" id="usrModalPassword" class="form-control" value="${user?.password || ''}" placeholder="كلمة المرور..." style="direction: ltr; text-align: left;">
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label"><span class="required">*</span> الدور والصلاحيات:</label>
          <select id="usrModalRole" class="form-control" ${user?.id === 'USR-RAHEEM' ? 'disabled title="حساب المدير الأساسي مش بيتغير دوره"' : ''}>
            <option value="cashier" ${user?.role === 'cashier' ? 'selected' : ''}>🧑‍💼 كاشير (محاسبة الزبائن وإصدار الفواتير فقط)</option>
            <option value="manager" ${user?.role === 'manager' ? 'selected' : ''}>👑 مدير (كامل الصلاحيات: المخزن، العمالة، التقارير، والإعدادات)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 22px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 16px; font-weight: 700;">
            <input type="checkbox" id="usrModalIsActive" ${user?.isActive !== false ? 'checked' : ''} ${user?.id === 'USR-RAHEEM' ? 'disabled' : ''} style="width: 20px; height: 20px;">
            <span>الحساب نشط ومفعل لتسجيل الدخول</span>
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btnCancelUserModal">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnSaveUserModal">💾 حفظ المستخدم</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnCancelUserModal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnSaveUserModal').addEventListener('click', async () => {
      const name = overlay.querySelector('#usrModalName').value.trim();
      const username = overlay.querySelector('#usrModalUsername').value.trim();
      const password = overlay.querySelector('#usrModalPassword').value.trim();
      const role = overlay.querySelector('#usrModalRole').value;
      const isActive = overlay.querySelector('#usrModalIsActive').checked;

      try {
        await authService.saveUser({
          id: user?.id,
          name,
          username,
          password,
          role,
          isActive
        });
        toast.success(isEdit ? 'تم تحديث بيانات المستخدم بنجاح ✅' : 'تمت إضافة المستخدم بنجاح 🎉');
        overlay.remove();
        this.render(parentContainer);
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
