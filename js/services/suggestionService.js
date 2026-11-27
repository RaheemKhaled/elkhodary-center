/**
 * اقتراحات الكتابة (شكاوي العميل، أعمال العفشة، الصيانة القادمة)
 * - قائمة بتتحفظ وتتزامن بين الأجهزة، والمدير يقدر يعدّل أو يمسح أي اقتراح من الإعدادات.
 * - أي نص جديد بيتكتب في فاتورة بيتضاف لوحده.
 * - المسح "ناعم" (isDeleted) عشان الاقتراح الممسوح ميرجعش تاني من الفواتير القديمة.
 */

import { db } from '../db/indexeddb.js';

export const SUGGESTION_KINDS = {
  problem: { label: 'شكاوي العميل' },
  suspension: { label: 'أعمال العفشة' },
  nextService: { label: 'الصيانة القادمة' }
};

const IMPORT_FLAG = 'suggestionsImported_v1';
const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();

// كود ثابت لكل نص: نفس النص على أي جهاز = نفس السجل (من غير تكرار)
function idFor(kind, text) {
  let h = 5381;
  const s = `${kind}|${clean(text)}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `SUG-${kind}-${h.toString(36)}`;
}

export const suggestionService = {
  async list(kind, { includeDeleted = false } = {}) {
    const all = await db.getAll('suggestions');
    return all
      .filter(x => x.kind === kind && (includeDeleted || !x.isDeleted))
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || String(a.text).localeCompare(String(b.text), 'ar'));
  },

  // تسجيل استخدام نص (بيضيفه لو جديد، ويرجعه لو كان ممسوح واتكتب تاني)
  async recordUse(kind, text) {
    const t = clean(text);
    if (t.length < 2 || !SUGGESTION_KINDS[kind]) return;
    const id = idFor(kind, t);
    const existing = await db.get('suggestions', id);
    await db.put('suggestions', {
      ...(existing || {}), id, kind, text: t,
      useCount: (existing?.useCount || 0) + 1,
      isDeleted: false
    });
  },

  async add(kind, text) {
    const t = clean(text);
    if (t.length < 2) throw new Error('اكتب الاقتراح');
    const id = idFor(kind, t);
    const existing = await db.get('suggestions', id);
    if (existing && !existing.isDeleted) throw new Error('الاقتراح ده موجود بالفعل');
    await db.put('suggestions', { ...(existing || {}), id, kind, text: t, useCount: existing?.useCount || 0, isDeleted: false });
  },

  async remove(id) {
    const existing = await db.get('suggestions', id);
    if (existing) await db.put('suggestions', { ...existing, isDeleted: true });
  },

  async rename(id, newText) {
    const t = clean(newText);
    if (t.length < 2) throw new Error('اكتب النص الجديد');
    const old = await db.get('suggestions', id);
    if (!old) return;
    if (clean(old.text) === t) return;
    const newId = idFor(old.kind, t);
    const target = await db.get('suggestions', newId);
    await db.put('suggestions', { ...(target || {}), id: newId, kind: old.kind, text: t, useCount: (target?.useCount || 0) + (old.useCount || 0), isDeleted: false });
    await db.put('suggestions', { ...old, isDeleted: true });
  },

  // مرة واحدة على كل جهاز: نبدأ القائمة من الفواتير القديمة
  async importFromInvoicesOnce() {
    if ((await db.get('settings', IMPORT_FLAG))?.value) return;
    const invoices = await db.getAll('maintenance');
    const counts = new Map();
    const bump = (kind, text) => {
      const t = clean(text);
      if (t.length < 2 || t === 'صيانة وضبط دوري') return;
      const k = `${kind}|${t}`;
      counts.set(k, { kind, text: t, n: (counts.get(k)?.n || 0) + 1 });
    };
    for (const inv of invoices) {
      String(inv.problem || '').split('،').forEach(p => bump('problem', p));
      bump('nextService', inv.futureNeeds);
      (inv.services || []).filter(s => s.category === 'suspension')
        .forEach(s => bump('suspension', s.customNote || String(s.name || '').replace(/^صيانة عفشة:\s*/, '')));
    }
    for (const { kind, text, n } of counts.values()) {
      const id = idFor(kind, text);
      if (await db.get('suggestions', id)) continue; // موجود (أو ممسوح) من جهاز تاني
      await db.put('suggestions', { id, kind, text, useCount: n, isDeleted: false });
    }
    await db.put('settings', { key: IMPORT_FLAG, value: true }, false);
  }
};
