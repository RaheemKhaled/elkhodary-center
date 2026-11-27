/**
 * نوافذ الفلوس: تسجيل مصروف، وتحصيل آجل من عميل
 */

import { db } from '../db/indexeddb.js';
import { financeService, PAYMENT_METHODS, EXPENSE_CATEGORIES } from '../services/financeService.js';
import { authService } from '../services/authService.js';
import { toast } from './toast.js';
import { modal } from './modal.js';

const money = (n) => `${(Number(n) || 0).toLocaleString('ar-EG')} ج.م`;

function chips(name, options, selected) {
  return Object.entries(options).map(([key, o]) => `
    <button type="button" class="btn btn-secondary fm-chip" data-group="${name}" data-value="${key}"
      style="min-height:44px;font-size:15px;font-weight:800;padding:6px 14px;${key === selected ? 'background:#2563EB;color:#fff;border-color:#60A5FA;' : ''}">
      ${o.icon} ${o.label}
    </button>`).join('');
}

function bindChips(overlay, state, onChange) {
  overlay.querySelectorAll('.fm-chip').forEach(btn => btn.addEventListener('click', () => {
    state[btn.dataset.group] = btn.dataset.value;
    overlay.querySelectorAll(`.fm-chip[data-group="${btn.dataset.group}"]`).forEach(b => {
      const on = b === btn;
      b.style.background = on ? '#2563EB' : '';
      b.style.color = on ? '#fff' : '';
      b.style.borderColor = on ? '#60A5FA' : '';
    });
    onChange && onChange();
  }));
}

// تأكيد ثم مسح مصروف (للمدير)
export async function confirmDeleteExpense(expense, onDone) {
  if (!authService.isManager()) { toast.warning('مسح المصروفات للمدير بس'); return false; }
  const ok = await modal.confirm({
    title: 'مسح المصروف',
    message: `هيتمسح مصروف ${money(expense.amount)} (${EXPENSE_CATEGORIES[expense.category]?.label || expense.category}${expense.workerName ? ` - ${expense.workerName}` : ''}) من البرنامج والشيت وكل الأجهزة. متأكد؟`,
    confirmText: 'أيوه، امسحه',
    cancelText: 'لأ',
    type: 'danger'
  });
  if (!ok) return false;
  await financeService.deleteExpense(expense.id);
  toast.success('اتمسح المصروف');
  onDone && onDone();
  return true;
}

// ===== تسجيل مصروف جديد أو تعديل مصروف موجود (expense) =====
export async function showExpenseModal(onSaved, expense = null) {
  const isEdit = Boolean(expense);
  if (isEdit && !authService.isManager()) { toast.warning('تعديل المصروفات للمدير بس'); return; }
  const workers = (await db.getAll('workers')).filter(w => w.isActive !== false || (expense && w.id === expense.workerId));
  if (expense?.workerId && !workers.some(w => w.id === expense.workerId)) {
    workers.push({ id: expense.workerId, name: expense.workerName || 'صنايعي' });
  }
  const state = { method: expense?.method || 'cash', category: expense?.category || 'labor' };
  const todayRange = financeService.getRange('today');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:640px;width:95%;max-height:92vh;overflow-y:auto;padding:22px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h2 style="font-size:22px;font-weight:900;margin:0;color:#fff;">${isEdit ? '✏️ تعديل مصروف' : '💸 تسجيل مصروف (فلوس طالعة)'}</h2>
        <button type="button" class="btn btn-secondary" id="fmClose" style="min-height:40px;">✕</button>
      </div>
      ${isEdit ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">مصروف يوم ${new Date(expense.date).toLocaleDateString('ar-EG')}${expense.createdBy ? ` — سجله ${expense.createdBy}` : ''}</div>` : ''}

      <label class="form-label" style="font-size:15px;">المبلغ (ج.م):</label>
      <input type="number" id="fmAmount" class="form-control" min="0" placeholder="0" value="${isEdit ? Number(expense.amount) || '' : ''}" style="font-size:26px;font-weight:900;height:56px;text-align:center;margin-bottom:12px;">

      <label class="form-label" style="font-size:15px;">اتدفع إزاي؟</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">${chips('method', PAYMENT_METHODS, state.method)}</div>

      <label class="form-label" style="font-size:15px;">اتصرف في إيه؟</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">${chips('category', EXPENSE_CATEGORIES, state.category)}</div>

      <div id="fmWorkerRow" style="margin-bottom:12px;">
        <label class="form-label" style="font-size:15px;">لمين من الصنايعية؟</label>
        <select id="fmWorker" class="form-control" style="height:48px;font-size:16px;">
          <option value="">— اختار الصنايعي —</option>
          ${workers.map(w => `<option value="${w.id}" ${expense?.workerId === w.id ? 'selected' : ''}>${w.name}${w.specialty ? ` (${w.specialty})` : ''}</option>`).join('')}
        </select>
      </div>

      <label class="form-label" style="font-size:15px;">البيان / ملاحظة:</label>
      <input type="text" id="fmDesc" class="form-control" value="${isEdit ? String(expense.description || '').replace(/"/g, '&quot;') : ''}" placeholder="مثال: يومية، تيل من المحل، توصيل قطع..." style="height:46px;font-size:15px;margin-bottom:16px;">

      <div style="display:flex;gap:10px;">
        ${isEdit ? `<button type="button" class="btn btn-danger" id="fmDelete" style="flex:1;min-height:54px;font-size:17px;font-weight:900;justify-content:center;">🗑️ مسح</button>` : ''}
        <button type="button" class="btn btn-success" id="fmSave" style="flex:2;width:100%;min-height:54px;font-size:19px;font-weight:900;justify-content:center;">💾 ${isEdit ? 'حفظ التعديل' : 'حفظ المصروف'}</button>
      </div>

      ${isEdit ? '' : `
      <div style="margin-top:18px;border-top:1px dashed var(--border-color);padding-top:12px;">
        <div style="font-size:15px;font-weight:800;color:var(--text-secondary);margin-bottom:8px;">مصروفات النهارده: <span id="fmTodayTotal"></span></div>
        <div id="fmTodayList" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>`}
    </div>`;
  document.body.appendChild(overlay);

  const workerRow = overlay.querySelector('#fmWorkerRow');
  const refreshWorker = () => { workerRow.style.display = state.category === 'labor' ? 'block' : 'none'; };
  bindChips(overlay, state, refreshWorker);
  refreshWorker();

  const renderToday = async () => {
    if (isEdit) return;
    const list = await financeService.getExpenses(todayRange);
    overlay.querySelector('#fmTodayTotal').textContent = money(list.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    overlay.querySelector('#fmTodayList').innerHTML = list.length ? list.map(e => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--bg-surface-elevated);border:1px solid var(--border-color);border-radius:8px;padding:8px 12px;">
        <div style="font-size:14px;">
          <strong style="color:#F87171;">${money(e.amount)}</strong> —
          ${EXPENSE_CATEGORIES[e.category]?.icon || ''} ${EXPENSE_CATEGORIES[e.category]?.label || e.category}
          ${e.workerName ? `(${e.workerName})` : ''} — ${PAYMENT_METHODS[e.method]?.label || e.method}
          ${e.description ? `<div style="font-size:12.5px;color:var(--text-muted);">${e.description}</div>` : ''}
        </div>
        ${authService.isManager() ? `<div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-secondary fm-edit" data-id="${e.id}" style="min-height:32px;padding:2px 10px;">✏️</button>
          <button type="button" class="btn btn-danger fm-del" data-id="${e.id}" style="min-height:32px;padding:2px 10px;">🗑️</button>
        </div>` : ''}
      </div>`).join('') : '<div style="color:var(--text-muted);font-size:14px;">مفيش مصروفات النهارده.</div>';
    overlay.querySelectorAll('.fm-del').forEach(b => b.addEventListener('click', async () => {
      const e = list.find(x => x.id === b.dataset.id);
      if (e) await confirmDeleteExpense(e, () => { renderToday(); onSaved && onSaved(); });
    }));
    overlay.querySelectorAll('.fm-edit').forEach(b => b.addEventListener('click', () => {
      const e = list.find(x => x.id === b.dataset.id);
      if (!e) return;
      showExpenseModal(() => { renderToday(); onSaved && onSaved(); }, e);
    }));
  };
  renderToday();

  overlay.querySelector('#fmDelete')?.addEventListener('click', async () => {
    if (await confirmDeleteExpense(expense, onSaved)) overlay.remove();
  });

  overlay.querySelector('#fmSave').addEventListener('click', async () => {
    const btn = overlay.querySelector('#fmSave');
    if (btn.disabled) return;
    const workerSel = overlay.querySelector('#fmWorker');
    const worker = workers.find(w => w.id === workerSel.value);
    const data = {
      amount: overlay.querySelector('#fmAmount').value,
      method: state.method,
      category: state.category,
      workerId: state.category === 'labor' ? workerSel.value : '',
      workerName: state.category === 'labor' ? (worker?.name || '') : '',
      description: overlay.querySelector('#fmDesc').value
    };
    try {
      btn.disabled = true;
      if (isEdit) {
        await financeService.updateExpense(expense.id, data);
        toast.success('✅ اتعدل المصروف');
        overlay.remove();
        onSaved && onSaved();
        return;
      }
      await financeService.addExpense({ ...data, createdBy: authService.getCurrentUser()?.name || '' });
      toast.success('✅ اتسجل المصروف');
      overlay.querySelector('#fmAmount').value = '';
      overlay.querySelector('#fmDesc').value = '';
      renderToday(); onSaved && onSaved();
    } catch (err) {
      toast.warning(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  overlay.querySelector('#fmClose').addEventListener('click', () => overlay.remove());
  setTimeout(() => overlay.querySelector('#fmAmount').focus(), 50);
}

// ===== تحصيل آجل من فاتورة =====
export function showCollectDebtModal(invoice, onDone) {
  const remaining = Number(invoice.remainingBalance) || 0;
  const state = { method: 'cash' };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:520px;width:95%;padding:22px;">
      <h2 style="font-size:21px;font-weight:900;margin:0 0 6px;color:#fff;">💰 تحصيل آجل</h2>
      <div style="font-size:15px;color:var(--text-secondary);margin-bottom:12px;">
        ${invoice.customerName || ''} — فاتورة <span style="font-family:monospace;">${invoice.id}</span><br>
        المتبقي عليه: <strong style="color:#F87171;font-size:18px;">${money(remaining)}</strong>
      </div>
      <label class="form-label">المبلغ المدفوع دلوقتي:</label>
      <input type="number" id="cdAmount" class="form-control" value="${remaining}" min="1" max="${remaining}" style="font-size:24px;font-weight:900;height:54px;text-align:center;margin-bottom:12px;">
      <label class="form-label">دفع إزاي؟</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">${chips('method', PAYMENT_METHODS, state.method)}</div>
      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-secondary" id="cdCancel" style="flex:1;min-height:48px;">إلغاء</button>
        <button type="button" class="btn btn-success" id="cdSave" style="flex:2;min-height:48px;font-size:17px;font-weight:900;">✅ تأكيد التحصيل</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  bindChips(overlay, state);
  overlay.querySelector('#cdCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#cdSave').addEventListener('click', async () => {
    const btn = overlay.querySelector('#cdSave');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const updated = await financeService.collectDebt(invoice.id, overlay.querySelector('#cdAmount').value, state.method);
      toast.success(updated.remainingBalance > 0 ? `اتحصل جزء، الباقي ${money(updated.remainingBalance)}` : 'اتسدد الآجل بالكامل ✅');
      overlay.remove();
      onDone && onDone(updated);
    } catch (err) {
      toast.warning(err.message);
      btn.disabled = false;
    }
  });
}
