/**
 * نسخ احتياطي تلقائي لقاعدة البيانات كملف على الجهاز (نسخة الديسكتوب فقط)
 * بيتحفظ في: <مكان الحفظ اللي اختاره المدير>\نسخ احتياطية\نسخة احتياطية YYYY-MM-DD.json
 * نسخة واحدة لكل يوم (بتتحدث طول اليوم) + الاحتفاظ بآخر 60 نسخة.
 */

import { db } from '../db/indexeddb.js';

const INTERVAL_MS = 2 * 60 * 60 * 1000; // كل ساعتين
const FIRST_RUN_DELAY_MS = 15000;

class LocalBackupService {
  constructor() {
    this.timer = null;
  }

  isAvailable() {
    return Boolean(window.desktopAPI && window.desktopAPI.writeBackup);
  }

  start() {
    if (!this.isAvailable() || this.timer) return;
    setTimeout(() => this.backupNow('auto').catch(err => console.warn('Auto backup failed:', err)), FIRST_RUN_DELAY_MS);
    this.timer = setInterval(() => this.backupNow('auto').catch(err => console.warn('Auto backup failed:', err)), INTERVAL_MS);
  }

  async backupNow(label = 'manual') {
    if (!this.isAvailable()) throw new Error('النسخ على الجهاز متاح في نسخة الديسكتوب فقط');
    const backup = await db.exportFullBackup();
    return window.desktopAPI.writeBackup(JSON.stringify(backup), label);
  }
}

export const localBackupService = new LocalBackupService();
