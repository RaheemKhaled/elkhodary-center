/**
 * واجهة إدارة العمالة (Workers Management View)
 * - تسجيل الحضور والانصراف اليومي
 * - تسجيل المصروفات اليومية (سُلف، مكافآت)
 * - تعيين عامل جديد / إلغاء تنشيط
 * - بروفايل كل صنايعي (مرتب أسبوعي + حضور + مصروفات)
 */

import { db } from '../db/indexeddb.js';
import { workerService } from '../services/workerService.js';
import { toast } from '../components/toast.js';

export const workersView = {
  async render(container) {
    const today = workerService.getTodayString();
    const todaySummary = await workerService.getTodaySummary();
    const allWorkers = await workerService.getAllWorkers();
    const activeCount = allWorkers.filter(w => w.isActive !== false).length;
    const totalExpensesToday = todaySummary.reduce((s, w) => s + w.totalExpensesToday, 0);

    container.innerHTML = `
      <div class="workers-screen">
        <!-- الهيدر -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 style="font-size:30px;font-weight:900;color:#fff;margin:0;">👷 إدارة العمالة والصنايعية</h1>
            <p style="font-size:18px;color:var(--text-muted);margin:4px 0 0;">
              الصنايعية النشطين: <strong>${activeCount}</strong> | تاريخ اليوم: <strong>${new Date(today).toLocaleDateString('ar-EG')}</strong>
              | مصروفات اليوم: <strong style="color:#FBBF24;">${totalExpensesToday} ج.م</strong>
            </p>
          </div>
          <div style="display:flex;gap:10px;">
            <button type="button" class="btn btn-primary" id="btnAddWorker" style="font-size:18px;">
              ➕ تعيين صنايعي جديد
            </button>
          </div>
        </div>

        <!-- تبويبات: الحضور اليومي / المصروفات / البروفايلات -->
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;" id="workersTabBar">
          <button type="button" class="btn btn-primary workers-tab-btn active" data-tab="attendance" style="font-size:17px;padding:10px 22px;">
            📋 الحضور والانصراف اليومي
          </button>
          <button type="button" class="btn btn-secondary workers-tab-btn" data-tab="expenses" style="font-size:17px;padding:10px 22px;">
            💸 المصروفات اليومية
          </button>
          <button type="button" class="btn btn-secondary workers-tab-btn" data-tab="profiles" style="font-size:17px;padding:10px 22px;">
            👤 بروفايل الصنايعية
          </button>
          <button type="button" class="btn btn-secondary workers-tab-btn" data-tab="roster" style="font-size:17px;padding:10px 22px;">
            📑 قائمة العمالة (تعيين / إلغاء)
          </button>
        </div>

        <!-- محتوى التبويب -->
        <div id="workersTabContent"></div>
      </div>
    `;

    // أحداث التبويبات
    container.querySelectorAll('.workers-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.workers-tab-btn').forEach(b => {
          b.classList.remove('active');
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.add('active');
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        this.renderTab(container, btn.dataset.tab, todaySummary, allWorkers);
      });
    });

    container.querySelector('#btnAddWorker').addEventListener('click', () => {
      this.showAddWorkerModal(container);
    });

    // تحميل أول تبويب
    this.renderTab(container, 'attendance', todaySummary, allWorkers);
  },

  // ================== تبديل التبويبات ==================
  async renderTab(container, tab, todaySummary, allWorkers) {
    const contentEl = container.querySelector('#workersTabContent');
    if (tab === 'attendance') {
      this.renderAttendanceTab(contentEl, todaySummary, container);
    } else if (tab === 'expenses') {
      this.renderExpensesTab(contentEl, todaySummary, container);
    } else if (tab === 'profiles') {
      await this.renderProfilesTab(contentEl, allWorkers, container);
    } else if (tab === 'roster') {
      this.renderRosterTab(contentEl, allWorkers, container);
    }
  },

  // ================== 1. الحضور والانصراف ==================
  renderAttendanceTab(contentEl, todaySummary, parentContainer) {
    const today = workerService.getTodayString();

    contentEl.innerHTML = `
      <div class="card" style="padding:18px;">
        <h2 class="card-title" style="font-size:20px;margin-bottom:14px;">
          <span>📋</span> <span>سجل حضور وانصراف اليوم — ${new Date(today).toLocaleDateString('ar-EG')}</span>
        </h2>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:25%;">اسم الصنايعي</th>
                <th style="width:15%;">التخصص</th>
                <th style="width:15%;">الحالة</th>
                <th style="width:12%;">وقت الحضور</th>
                <th style="width:12%;">وقت الانصراف</th>
                <th style="width:21%;">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${todaySummary.map(w => {
                const statusBadge = w.todayStatus === 'present'
                  ? '<span class="badge badge-success" style="font-size:16px;">✅ حاضر</span>'
                  : w.todayStatus === 'absent'
                  ? '<span class="badge badge-danger" style="font-size:16px;">❌ غائب</span>'
                  : '<span class="badge badge-info" style="font-size:16px;">⏳ لم يسجل</span>';

                return `
                  <tr data-wid="${w.id}">
                    <td style="font-size:20px;font-weight:800;">${w.name}</td>
                    <td><span class="badge badge-info">${w.specialty || 'عام'}</span></td>
                    <td>${statusBadge}</td>
                    <td style="font-size:18px;font-weight:700;color:#34D399;">${w.clockIn || '—'}</td>
                    <td style="font-size:18px;font-weight:700;color:#F87171;">${w.clockOut || '—'}</td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${!w.clockIn ? `
                          <button type="button" class="btn btn-success btn-clock-in" data-wid="${w.id}" data-wname="${w.name}" style="font-size:14px;padding:6px 12px;min-height:36px;">
                            🟢 تسجيل حضور
                          </button>
                        ` : ''}
                        ${w.clockIn && !w.clockOut ? `
                          <button type="button" class="btn btn-danger btn-clock-out" data-wid="${w.id}" style="font-size:14px;padding:6px 12px;min-height:36px;">
                            🔴 تسجيل انصراف
                          </button>
                        ` : ''}
                        ${w.todayStatus !== 'absent' && !w.clockIn ? `
                          <button type="button" class="btn btn-secondary btn-mark-absent" data-wid="${w.id}" data-wname="${w.name}" style="font-size:14px;padding:6px 12px;min-height:36px;">
                            ❌ غياب
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // أحداث الأزرار
    contentEl.querySelectorAll('.btn-clock-in').forEach(btn => {
      btn.addEventListener('click', async () => {
        const wid = btn.dataset.wid, wname = btn.dataset.wname;
        await workerService.recordClockIn(wid, wname, workerService.getTodayString());
        toast.success(`✅ تم تسجيل حضور ${wname} الساعة ${workerService.getNowTime()}`);
        this.render(parentContainer);
      });
    });

    contentEl.querySelectorAll('.btn-clock-out').forEach(btn => {
      btn.addEventListener('click', async () => {
        const wid = btn.dataset.wid;
        await workerService.recordClockOut(wid, workerService.getTodayString());
        toast.success(`🔴 تم تسجيل انصراف الساعة ${workerService.getNowTime()}`);
        this.render(parentContainer);
      });
    });

    contentEl.querySelectorAll('.btn-mark-absent').forEach(btn => {
      btn.addEventListener('click', async () => {
        const wid = btn.dataset.wid, wname = btn.dataset.wname;
        await workerService.markAbsent(wid, wname, workerService.getTodayString());
        toast.success(`❌ تم تسجيل غياب ${wname} لهذا اليوم`);
        this.render(parentContainer);
      });
    });
  },

  // ================== 2. المصروفات اليومية ==================
  renderExpensesTab(contentEl, todaySummary, parentContainer) {
    const today = workerService.getTodayString();

    contentEl.innerHTML = `
      <div class="card" style="padding:18px;margin-bottom:16px;">
        <h2 class="card-title" style="font-size:20px;margin-bottom:14px;">
          <span>💸</span> <span>تسجيل مصروف يومي لصنايعي</span>
        </h2>

        <div style="display:grid;grid-template-columns:1fr 120px 1fr 120px;gap:10px;align-items:end;">
          <div>
            <label class="form-label" style="font-size:14px;">اختر الصنايعي:</label>
            <select id="expWorkerSelect" class="form-control" style="font-size:16px;min-height:44px;">
              ${todaySummary.map(w => `<option value="${w.id}" data-name="${w.name}">${w.name} (${w.specialty || 'عام'})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:14px;">المبلغ (ج.م):</label>
            <input type="number" id="expAmountInput" class="form-control" value="50" min="1" style="font-size:20px;font-weight:800;text-align:center;min-height:44px;">
          </div>
          <div>
            <label class="form-label" style="font-size:14px;">السبب:</label>
            <select id="expReasonSelect" class="form-control" style="font-size:16px;min-height:44px;">
              <option value="مصروف يومي">مصروف يومي</option>
              <option value="سلفة">سلفة</option>
              <option value="مكافأة">مكافأة</option>
              <option value="بدل مواصلات">بدل مواصلات</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>
          <div>
            <button type="button" class="btn btn-success" id="btnSaveExpense" style="width:100%;font-size:16px;min-height:44px;font-weight:800;">
              ➕ تسجيل
            </button>
          </div>
        </div>
      </div>

      <!-- سجل مصروفات اليوم -->
      <div class="card" style="padding:18px;">
        <h2 class="card-title" style="font-size:18px;margin-bottom:12px;">
          <span>📄</span> <span>مصروفات اليوم — ${new Date(today).toLocaleDateString('ar-EG')}</span>
        </h2>
        <div id="todayExpensesList"></div>
      </div>
    `;

    // حساب وعرض مصروفات اليوم
    this.refreshTodayExpenses(contentEl, todaySummary);

    // حفظ المصروف
    contentEl.querySelector('#btnSaveExpense').addEventListener('click', async () => {
      const sel = contentEl.querySelector('#expWorkerSelect');
      const workerId = sel.value;
      const workerName = sel.selectedOptions[0]?.dataset.name || '';
      const amount = Number(contentEl.querySelector('#expAmountInput').value) || 0;
      const reason = contentEl.querySelector('#expReasonSelect').value;

      try {
        await workerService.recordExpense({ workerId, workerName, amount, reason });
        toast.success(`تم تسجيل ${amount} ج.م لـ ${workerName} (${reason}) ✅`);
        this.render(parentContainer);
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  refreshTodayExpenses(contentEl, todaySummary) {
    const listEl = contentEl.querySelector('#todayExpensesList');
    const allExpenses = [];
    todaySummary.forEach(w => {
      w.expensesDetails.forEach(e => allExpenses.push(e));
    });

    if (!allExpenses.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:18px;">لا توجد مصروفات مسجلة اليوم</div>';
      return;
    }

    listEl.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>الصنايعي</th>
              <th>المبلغ</th>
              <th>السبب</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${allExpenses.map(e => `
              <tr>
                <td style="font-weight:800;font-size:18px;">${e.workerName}</td>
                <td style="font-weight:900;font-size:20px;color:#FBBF24;">${e.amount} ج.م</td>
                <td><span class="badge badge-info">${e.reason}</span></td>
                <td style="font-size:15px;color:var(--text-muted);">${e.notes || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="text-align:left;margin-top:10px;font-size:20px;font-weight:900;color:#FBBF24;">
        إجمالي مصروفات اليوم: ${allExpenses.reduce((s, e) => s + (e.amount || 0), 0)} ج.م
      </div>
    `;
  },

  // ================== 3. بروفايلات الصنايعية (المدير) ==================
  async renderProfilesTab(contentEl, allWorkers, parentContainer) {
    const activeWorkers = allWorkers.filter(w => w.isActive !== false);

    contentEl.innerHTML = `
      <div class="card" style="padding:18px;">
        <h2 class="card-title" style="font-size:20px;margin-bottom:14px;">
          <span>👤</span> <span>بروفايل كل صنايعي (آخر 30 يوم)</span>
        </h2>
        <div id="profilesGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;">
          ${activeWorkers.map(w => `
            <div class="card" style="padding:16px;border-color:var(--border-color);cursor:pointer;" data-profile-wid="${w.id}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div>
                  <div style="font-size:22px;font-weight:900;color:#fff;">${w.name}</div>
                  <div style="font-size:14px;color:var(--text-muted);">${w.specialty || 'عام'} | 📱 ${w.phone || '—'}</div>
                </div>
                <span style="font-size:36px;">👷</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div style="background:rgba(0,0,0,0.3);padding:8px;border-radius:8px;text-align:center;">
                  <div style="font-size:12px;color:var(--text-muted);">المرتب الأسبوعي</div>
                  <div style="font-size:22px;font-weight:900;color:#34D399;">${w.weeklySalary || 0} ج.م</div>
                </div>
                <div style="background:rgba(0,0,0,0.3);padding:8px;border-radius:8px;text-align:center;">
                  <div style="font-size:12px;color:var(--text-muted);">جاري التحميل...</div>
                  <div class="profile-loading-${w.id}" style="font-size:14px;color:var(--text-muted);">⏳</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // تحميل إحصائيات كل عامل في الخلفية
    for (const w of activeWorkers) {
      const profile = await workerService.getWorkerProfile(w.id);
      const statEl = contentEl.querySelector(`.profile-loading-${w.id}`);
      if (statEl && profile) {
        statEl.parentElement.querySelector('div:first-child').textContent = `حضور / غياب (30 يوم)`;
        statEl.innerHTML = `<span style="color:#34D399;">${profile.stats.presentDays} حضور</span> / <span style="color:#F87171;">${profile.stats.absentDays} غياب</span>`;
      }
    }

    // الضغط على بروفايل لفتح التفاصيل
    contentEl.querySelectorAll('[data-profile-wid]').forEach(card => {
      card.addEventListener('click', async () => {
        const wid = card.dataset.profileWid;
        await this.showWorkerProfileModal(wid, parentContainer);
      });
    });
  },

  async showWorkerProfileModal(workerId, parentContainer) {
    const profile = await workerService.getWorkerProfile(workerId);
    if (!profile) { toast.error('العامل غير موجود'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width:750px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="font-size:26px;font-weight:900;color:#fff;margin:0;">👷 بروفايل: ${profile.name}</h2>
          <button type="button" class="btn btn-secondary" id="btnCloseProfile" style="font-size:14px;">✕ إغلاق</button>
        </div>

        <!-- معلومات أساسية -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
          <div style="background:var(--bg-input);padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:13px;color:var(--text-muted);">التخصص</div>
            <div style="font-size:18px;font-weight:800;color:#fff;">${profile.specialty || 'عام'}</div>
          </div>
          <div style="background:var(--bg-input);padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:13px;color:var(--text-muted);">التليفون</div>
            <div style="font-size:18px;font-weight:800;color:#38BDF8;">${profile.phone || '—'}</div>
          </div>
          <div style="background:var(--bg-input);padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:13px;color:var(--text-muted);">المرتب الأسبوعي</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
              <input type="number" id="profileSalaryInput" value="${profile.weeklySalary || 0}" min="0"
                class="form-control" style="width:100px;height:34px;font-size:18px;font-weight:900;text-align:center;color:#34D399;">
              <span style="font-size:13px;">ج.م</span>
            </div>
            <button type="button" class="btn btn-primary" id="btnUpdateSalary" style="font-size:12px;padding:4px 12px;margin-top:4px;min-height:28px;">حفظ</button>
          </div>
        </div>

        <!-- إحصائيات 30 يوم -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
          <div style="background:rgba(16,185,129,0.15);padding:10px;border-radius:8px;text-align:center;border:1px solid #10B981;">
            <div style="font-size:12px;color:#34D399;">أيام الحضور</div>
            <div style="font-size:28px;font-weight:900;color:#34D399;">${profile.stats.presentDays}</div>
          </div>
          <div style="background:rgba(239,68,68,0.15);padding:10px;border-radius:8px;text-align:center;border:1px solid #EF4444;">
            <div style="font-size:12px;color:#F87171;">أيام الغياب</div>
            <div style="font-size:28px;font-weight:900;color:#F87171;">${profile.stats.absentDays}</div>
          </div>
          <div style="background:rgba(251,191,36,0.15);padding:10px;border-radius:8px;text-align:center;border:1px solid #FBBF24;">
            <div style="font-size:12px;color:#FBBF24;">إجمالي المصروفات</div>
            <div style="font-size:28px;font-weight:900;color:#FBBF24;">${profile.stats.totalExpenses30d}</div>
          </div>
          <div style="background:rgba(56,189,248,0.15);padding:10px;border-radius:8px;text-align:center;border:1px solid #38BDF8;">
            <div style="font-size:12px;color:#38BDF8;">عمليات صيانة</div>
            <div style="font-size:28px;font-weight:900;color:#38BDF8;">${profile.stats.maintenanceCount}</div>
          </div>
        </div>

        <!-- سجل الحضور آخر 30 يوم -->
        <details open style="margin-bottom:14px;">
          <summary style="font-size:18px;font-weight:800;color:#93C5FD;cursor:pointer;margin-bottom:8px;">📋 سجل الحضور والانصراف (آخر 30 يوم)</summary>
          <div class="table-container" style="max-height:250px;overflow-y:auto;">
            <table class="data-table">
              <thead><tr><th>التاريخ</th><th>الحالة</th><th>الحضور</th><th>الانصراف</th></tr></thead>
              <tbody>
                ${profile.stats.attendance30d.sort((a, b) => b.date.localeCompare(a.date)).map(a => `
                  <tr>
                    <td style="font-size:15px;">${new Date(a.date).toLocaleDateString('ar-EG')}</td>
                    <td>${a.status === 'present' ? '<span class="badge badge-success">حاضر</span>' : '<span class="badge badge-danger">غائب</span>'}</td>
                    <td style="font-weight:700;color:#34D399;">${a.clockIn || '—'}</td>
                    <td style="font-weight:700;color:#F87171;">${a.clockOut || '—'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4" style="text-align:center;">لا يوجد سجلات</td></tr>'}
              </tbody>
            </table>
          </div>
        </details>

        <!-- سجل المصروفات آخر 30 يوم -->
        <details style="margin-bottom:14px;">
          <summary style="font-size:18px;font-weight:800;color:#FBBF24;cursor:pointer;margin-bottom:8px;">💸 سجل المصروفات (آخر 30 يوم)</summary>
          <div class="table-container" style="max-height:250px;overflow-y:auto;">
            <table class="data-table">
              <thead><tr><th>التاريخ</th><th>المبلغ</th><th>السبب</th></tr></thead>
              <tbody>
                ${profile.stats.expenses30d.sort((a, b) => b.date.localeCompare(a.date)).map(e => `
                  <tr>
                    <td style="font-size:15px;">${new Date(e.date).toLocaleDateString('ar-EG')}</td>
                    <td style="font-weight:900;font-size:18px;color:#FBBF24;">${e.amount} ج.م</td>
                    <td><span class="badge badge-info">${e.reason}</span></td>
                  </tr>
                `).join('') || '<tr><td colspan="3" style="text-align:center;">لا يوجد مصروفات</td></tr>'}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnCloseProfile').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#btnUpdateSalary').addEventListener('click', async () => {
      const salary = Number(overlay.querySelector('#profileSalaryInput').value) || 0;
      await workerService.updateWeeklySalary(workerId, salary);
      toast.success(`تم تحديث مرتب ${profile.name} إلى ${salary} ج.م أسبوعياً`);
    });
  },

  // ================== 4. قائمة العمالة (تعيين / إلغاء) ==================
  renderRosterTab(contentEl, allWorkers, parentContainer) {
    const active = allWorkers.filter(w => w.isActive !== false);
    const inactive = allWorkers.filter(w => w.isActive === false);

    contentEl.innerHTML = `
      <div class="card" style="padding:18px;margin-bottom:16px;">
        <h2 class="card-title" style="font-size:20px;margin-bottom:14px;">
          <span>✅</span> <span>العمالة النشطة (${active.length})</span>
        </h2>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الاسم</th>
                <th>التخصص</th>
                <th>التليفون</th>
                <th>المرتب الأسبوعي</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${active.map(w => `
                <tr>
                  <td style="font-size:14px;color:var(--text-muted);">${w.id}</td>
                  <td style="font-size:20px;font-weight:800;">${w.name}</td>
                  <td><span class="badge badge-info">${w.specialty || 'عام'}</span></td>
                  <td>${w.phone || '—'}</td>
                  <td style="font-weight:800;color:#34D399;">${w.weeklySalary || 0} ج.م</td>
                  <td>
                    <button type="button" class="btn btn-danger btn-deactivate" data-wid="${w.id}" data-wname="${w.name}" style="font-size:14px;padding:6px 14px;min-height:36px;">
                      🚫 إلغاء
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${inactive.length ? `
        <div class="card" style="padding:18px;">
          <h2 class="card-title" style="font-size:18px;margin-bottom:12px;">
            <span>⛔</span> <span>العمالة المُلغاة (${inactive.length})</span>
          </h2>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>التخصص</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                ${inactive.map(w => `
                  <tr>
                    <td style="font-size:18px;font-weight:800;color:var(--text-muted);">${w.name}</td>
                    <td>${w.specialty || 'عام'}</td>
                    <td>
                      <button type="button" class="btn btn-success btn-reactivate" data-wid="${w.id}" data-wname="${w.name}" style="font-size:14px;padding:6px 14px;min-height:36px;">
                        ♻️ إعادة تنشيط
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;

    contentEl.querySelectorAll('.btn-deactivate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const wid = btn.dataset.wid, wname = btn.dataset.wname;
        if (!confirm(`هل أنت متأكد من إلغاء تنشيط ${wname}؟ لن يظهر في واجهة الكاشير.`)) return;
        await workerService.deactivateWorker(wid);
        toast.success(`تم إلغاء تنشيط ${wname}`);
        this.render(parentContainer);
      });
    });

    contentEl.querySelectorAll('.btn-reactivate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const wid = btn.dataset.wid, wname = btn.dataset.wname;
        await workerService.activateWorker(wid);
        toast.success(`تم إعادة تنشيط ${wname} ✅`);
        this.render(parentContainer);
      });
    });
  },

  // ================== نافذة تعيين صنايعي جديد ==================
  showAddWorkerModal(parentContainer) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width:550px;">
        <h2 style="font-size:24px;font-weight:900;color:#fff;margin-bottom:16px;">➕ تعيين صنايعي جديد</h2>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label"><span class="required">*</span> اسم الصنايعي:</label>
          <input type="text" id="newWorkerName" class="form-control" placeholder="مثال: عم محمود...">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div class="form-group">
            <label class="form-label">التخصص:</label>
            <select id="newWorkerSpecialty" class="form-control">
              <option value="زوايا">زوايا</option>
              <option value="عفشة">عفشة</option>
              <option value="ترصيص">ترصيص</option>
              <option value="كاوتش">كاوتش</option>
              <option value="مخرطة">مخرطة</option>
              <option value="لحام">لحام</option>
              <option value="عام">عام</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">رقم التليفون:</label>
            <input type="tel" id="newWorkerPhone" class="form-control" placeholder="01xxxxxxxxx">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label">المرتب الأسبوعي (ج.م):</label>
          <input type="number" id="newWorkerSalary" class="form-control" value="0" min="0" style="font-size:22px;font-weight:800;text-align:center;">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <button type="button" class="btn btn-secondary" id="btnCancelAddWorker">إلغاء</button>
          <button type="button" class="btn btn-success" id="btnSaveAddWorker" style="font-weight:900;">💾 حفظ وتعيين</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btnCancelAddWorker').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnSaveAddWorker').addEventListener('click', async () => {
      const name = overlay.querySelector('#newWorkerName').value.trim();
      const specialty = overlay.querySelector('#newWorkerSpecialty').value;
      const phone = overlay.querySelector('#newWorkerPhone').value.trim();
      const weeklySalary = Number(overlay.querySelector('#newWorkerSalary').value) || 0;

      try {
        await workerService.saveWorker({ name, phone, specialty, weeklySalary });
        toast.success(`تم تعيين ${name} بنجاح! سيظهر في واجهة الكاشير 🎉`);
        overlay.remove();
        this.render(parentContainer);
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
