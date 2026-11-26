/**
 * تقرير PDF شامل لأي فترة (يوم / أسبوع / شهر / من تاريخ لتاريخ)
 * فيه: التحصيل حسب طريقة الدفع، المصروفات، الصافي، الآجل، الخدمات، الصنايعية، وكل الفواتير.
 */

import { db } from '../db/indexeddb.js';
import { financeService, PAYMENT_METHODS, EXPENSE_CATEGORIES } from './financeService.js';
import { toast } from '../components/toast.js';

const m = (n) => `${(Number(n) || 0).toLocaleString('ar-EG')} ج.م`;
const d = (iso) => new Date(iso).toLocaleDateString('ar-EG');
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const reportPdfService = {
  buildHtml(sum, centerName) {
    const row = (cells, bold) => `<tr${bold ? ' class="total"' : ''}>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    const methods = Object.keys(PAYMENT_METHODS);
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>تقرير ${esc(sum.range.label)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #0F172A; margin: 0; padding: 18px 22px; font-size: 12.5px; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 15px; margin: 16px 0 6px; border-bottom: 2px solid #0F172A; padding-bottom: 3px; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px double #0F172A; padding-bottom: 8px; }
  .muted { color: #475569; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
  .card { border: 1.5px solid #CBD5E1; border-radius: 6px; padding: 6px 8px; }
  .card .l { font-size: 11px; color: #475569; } .card .v { font-size: 16px; font-weight: 900; }
  .green { color: #047857; } .red { color: #B91C1C; } .blue { color: #1D4ED8; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; page-break-inside: auto; }
  th, td { border: 1px solid #CBD5E1; padding: 3px 6px; text-align: right; }
  th { background: #F1F5F9; font-weight: 900; } tr { page-break-inside: avoid; }
  tr.total td { font-weight: 900; background: #F8FAFC; }
  .note { font-size: 11px; color: #475569; margin-top: 4px; }
</style></head><body>
  <div class="head">
    <div><h1>📊 تقرير المركز</h1><div class="muted">${esc(centerName)}</div></div>
    <div style="text-align:left;"><strong>${esc(sum.range.label)}</strong><div class="muted">اتعمل: ${new Date().toLocaleString('ar-EG')}</div></div>
  </div>

  <div class="cards">
    <div class="card"><div class="l">المحصّل فعلاً</div><div class="v green">${m(sum.collectedTotal)}</div></div>
    <div class="card"><div class="l">المصروفات</div><div class="v red">${m(sum.expensesTotal)}</div></div>
    <div class="card"><div class="l">الصافي</div><div class="v ${sum.net.total >= 0 ? 'green' : 'red'}">${m(sum.net.total)}</div></div>
    <div class="card"><div class="l">الآجل المستحق على العملاء</div><div class="v red">${m(sum.outstandingCredit)}</div></div>
    <div class="card"><div class="l">عدد الفواتير</div><div class="v blue">${sum.invoicesCount}</div></div>
    <div class="card"><div class="l">قيمة فواتير الفترة</div><div class="v">${m(sum.salesTotal)}</div></div>
    <div class="card"><div class="l">آجل جديد من فواتير الفترة</div><div class="v red">${m(sum.newCredit)}</div></div>
    <div class="card"><div class="l">تحصيل آجل قديم</div><div class="v green">${m(sum.collectedOldDebt)}</div></div>
  </div>

  <h2>💵 الفلوس حسب طريقة الدفع</h2>
  <table><thead><tr><th>الطريقة</th><th>المحصّل</th><th>المصروف</th><th>الصافي</th></tr></thead><tbody>
    ${methods.map(k => row([`${PAYMENT_METHODS[k].icon} ${PAYMENT_METHODS[k].label}`, m(sum.collected[k]), m(sum.spent[k]), m(sum.net[k])])).join('')}
    ${row(['الإجمالي', m(sum.collectedTotal), m(sum.expensesTotal), m(sum.net.total)], true)}
  </tbody></table>
  <div class="note">الإيراد هنا = الفلوس اللي اتحصلت فعلاً. الآجل مش بيتحسب إيراد غير يوم ما يتسدد.${sum.discounts ? ` الخصومات في الفترة: ${m(sum.discounts)}.` : ''}</div>

  <h2>🧾 المصروفات (${sum.expenses.length})</h2>
  ${sum.expenses.length ? `<table><thead><tr><th>التاريخ</th><th>البند</th><th>الصنايعي</th><th>البيان</th><th>الطريقة</th><th>المبلغ</th></tr></thead><tbody>
    ${sum.expenses.map(e => row([d(e.date), `${EXPENSE_CATEGORIES[e.category]?.label || e.category}`, esc(e.workerName || '-'), esc(e.description || '-'), PAYMENT_METHODS[e.method]?.label || e.method, m(e.amount)])).join('')}
    ${Object.entries(sum.byCategory).map(([k, v]) => row([`إجمالي ${EXPENSE_CATEGORIES[k]?.label || k}`, '', '', '', '', m(v)], true)).join('')}
  </tbody></table>` : '<div class="note">مفيش مصروفات في الفترة دي.</div>'}

  <h2>🔧 الخدمات وقطع الغيار</h2>
  ${sum.services.length ? `<table><thead><tr><th>البند</th><th>العدد</th><th>الإجمالي</th></tr></thead><tbody>
    ${sum.services.map(s => row([esc(s.name), s.count, m(s.revenue)])).join('')}
    ${row(['إجمالي المصنعيات', '', m(sum.servicesRevenue)], true)}${row(['إجمالي قطع الغيار', '', m(sum.partsRevenue)], true)}
  </tbody></table>` : '<div class="note">مفيش شغل في الفترة دي.</div>'}

  ${sum.workers.length ? `<h2>👷 الصنايعية</h2><table><thead><tr><th>الاسم</th><th>عدد الشغلانات</th><th>اتصرفله</th></tr></thead><tbody>
    ${sum.workers.map(w => row([esc(w.name), w.jobs, m(w.paid)])).join('')}</tbody></table>` : ''}

  <h2>⏳ الآجل المستحق على العملاء (لحد النهارده)</h2>
  ${sum.debtors.length ? `<table><thead><tr><th>العميل</th><th>التليفون</th><th>عدد الفواتير</th><th>المتبقي</th></tr></thead><tbody>
    ${sum.debtors.map(x => row([esc(x.name), esc(x.phone), x.invoices.length, m(x.amount)])).join('')}
    ${row(['الإجمالي', '', '', m(sum.outstandingCredit)], true)}</tbody></table>` : '<div class="note">مفيش آجل على حد ✅</div>'}

  ${sum.debtCollections.length ? `<h2>💰 تحصيل آجل في الفترة</h2><table><thead><tr><th>التاريخ</th><th>العميل</th><th>الفاتورة</th><th>المبلغ</th></tr></thead><tbody>
    ${sum.debtCollections.map(c => row([d(c.date), esc(c.customerName), c.invoiceId, m(c.amount)])).join('')}</tbody></table>` : ''}

  <h2>📋 الفواتير (${sum.invoicesCount})</h2>
  ${sum.invoices.length ? `<table><thead><tr><th>التاريخ</th><th>رقم الفاتورة</th><th>العميل</th><th>العربية</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>
    ${sum.invoices.map(i => row([d(i.date || i.createdAt), i.id, esc(i.customerName), esc(i.carInfo || ''), m(i.netTotal), m(i.totalPaid), Number(i.remainingBalance) > 0 ? `<span class="red">${m(i.remainingBalance)}</span>` : '-'])).join('')}
    ${row(['الإجمالي', '', '', '', m(sum.salesTotal), m(sum.invoices.reduce((s, i) => s + (Number(i.totalPaid) || 0), 0)), m(sum.newCredit)], true)}
  </tbody></table>` : '<div class="note">مفيش فواتير في الفترة دي.</div>'}
</body></html>`;
  },

  async open(period) {
    const sum = await financeService.getSummary(period);
    const center = (await db.get('settings', 'centerName'))?.value || 'المركز';
    const html = this.buildHtml(sum, center);
    if (window.desktopAPI?.saveReportPdf) {
      try {
        const res = await window.desktopAPI.saveReportPdf({ html, fileName: `تقرير ${sum.range.from || 'البداية'} إلى ${sum.range.to || 'النهارده'}` });
        toast.success(`📁 اتحفظ التقرير PDF:\n${res.filePath}`);
        return res;
      } catch (err) {
        toast.error(`تعذر حفظ التقرير: ${err.message}`);
      }
    }
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => w.print(), 800); }
  }
};
