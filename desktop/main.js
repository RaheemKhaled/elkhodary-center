/**
 * مشغل تطبيق سطح المكتب عبر Electron (Windows Desktop Application Entry Point)
 * - سيرفر محلي مدمج على بورت ثابت (عشان بيانات IndexedDB تفضل ثابتة على نفس الجهاز)
 * - حفظ الفواتير PDF تلقائياً في: المستندات\فواتير المركز\<أسبوع>\<تاريخ> - <رقم الفاتورة>.pdf
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startLocalServer } from './server.js';
import updaterPkg from 'electron-updater';

const { autoUpdater } = updaterPkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// بورت ثابت ومش شائع: تغييره يغيّر مكان البيانات المحلية، فمتغيروش
const APP_PORT = 48080;
const INVOICES_FOLDER_NAME = 'فواتير المركز';

let mainWindow = null;

// ===== أدوات التواريخ والفولدرات =====
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// الأسبوع يبدأ يوم السبت وينتهي يوم الجمعة
function weekFolderName(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffToSaturday = (start.getDay() + 1) % 7; // السبت = 6
  start.setDate(start.getDate() - diffToSaturday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `أسبوع ${ymd(start)} إلى ${ymd(end)}`;
}

function safeName(s) {
  return String(s || '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim();
}

// ===== إعدادات الجهاز (مكان الحفظ) محفوظة في ملف داخل بيانات البرنامج =====
const BACKUPS_FOLDER_NAME = 'نسخ احتياطية';
const MAX_BACKUPS = 60;

function settingsFile() {
  return path.join(app.getPath('userData'), 'almarkaz-device-settings.json');
}

function readDeviceSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeDeviceSettings(patch) {
  const next = { ...readDeviceSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function defaultInvoicesRoot() {
  return path.join(app.getPath('documents'), INVOICES_FOLDER_NAME);
}

// الفولدر اللي اختاره المدير، ولو مش متاح (فلاشة مفصولة / بارتيشن مش موجود) نرجع للافتراضي
function invoicesRoot() {
  const custom = readDeviceSettings().invoicesRoot;
  if (custom) {
    try {
      fs.mkdirSync(custom, { recursive: true });
      fs.accessSync(custom, fs.constants.W_OK);
      return custom;
    } catch (err) {
      console.warn('Custom folder unavailable, using default:', err.message);
    }
  }
  return defaultInvoicesRoot();
}

function storageInfo() {
  const custom = readDeviceSettings().invoicesRoot || '';
  const active = invoicesRoot();
  return {
    root: active,
    customRoot: custom,
    defaultRoot: defaultInvoicesRoot(),
    isCustom: Boolean(custom),
    customUnavailable: Boolean(custom) && active !== custom,
    backupsFolder: path.join(active, BACKUPS_FOLDER_NAME),
    lastBackupAt: readDeviceSettings().lastBackupAt || null
  };
}

async function renderHtmlToPdf(html) {
  const tmpFile = path.join(app.getPath('temp'), `almarkaz-invoice-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { offscreen: false, javascript: true }
  });

  try {
    await win.loadFile(tmpFile);
    // انتظار تحميل الخطوط (مع حد أقصى لو مفيش نت)
    await win.webContents.executeJavaScript(
      'Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]).then(() => true)'
    ).catch(() => true);
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' }
    });
  } finally {
    win.destroy();
    fs.unlink(tmpFile, () => {});
  }
}

function registerIpc() {
  ipcMain.handle('invoice:savePdf', async (_e, payload) => {
    const { html, invoiceId, date, open = true } = payload || {};
    if (!html || !invoiceId) throw new Error('بيانات الفاتورة غير مكتملة');

    const d = date ? new Date(date) : new Date();
    const folder = path.join(invoicesRoot(), weekFolderName(d));
    fs.mkdirSync(folder, { recursive: true });

    const filePath = path.join(folder, `${ymd(d)} - ${safeName(invoiceId)}.pdf`);
    const pdf = await renderHtmlToPdf(html);
    fs.writeFileSync(filePath, pdf);

    if (open) {
      const err = await shell.openPath(filePath);
      if (err) console.warn('openPath:', err);
    }
    return { success: true, filePath };
  });

  ipcMain.handle('report:savePdf', async (_e, { html, fileName } = {}) => {
    if (!html) throw new Error('التقرير فاضي');
    const folder = path.join(invoicesRoot(), 'تقارير');
    fs.mkdirSync(folder, { recursive: true });
    const filePath = path.join(folder, `${safeName(fileName || 'تقرير')}.pdf`);
    fs.writeFileSync(filePath, await renderHtmlToPdf(html));
    await shell.openPath(filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('invoice:openPdf', async (_e, filePath) => {
    if (!filePath || !/\.pdf$/i.test(String(filePath)) || !fs.existsSync(filePath)) return false;
    const err = await shell.openPath(filePath);
    return !err;
  });

  ipcMain.handle('invoice:openFolder', async () => {
    fs.mkdirSync(invoicesRoot(), { recursive: true });
    await shell.openPath(invoicesRoot());
    return invoicesRoot();
  });

  ipcMain.handle('invoice:getRoot', () => invoicesRoot());
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // ===== إعدادات مكان الحفظ =====
  ipcMain.handle('storage:getInfo', () => storageInfo());

  ipcMain.handle('storage:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'اختار مكان حفظ الفواتير والنسخ الاحتياطية',
      defaultPath: invoicesRoot(),
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true, ...storageInfo() };

    const picked = result.filePaths[0];
    // لو اختار فولدر عام (زي D:\) نعمل جواه فولدر باسم البرنامج عشان الملفات متتبعترش
    const root = path.basename(picked) === INVOICES_FOLDER_NAME ? picked : path.join(picked, INVOICES_FOLDER_NAME);
    try {
      fs.mkdirSync(root, { recursive: true });
      fs.accessSync(root, fs.constants.W_OK);
    } catch (err) {
      throw new Error(`مينفعش الحفظ في المكان ده: ${err.message}`);
    }
    writeDeviceSettings({ invoicesRoot: root });
    return { canceled: false, ...storageInfo() };
  });

  ipcMain.handle('storage:resetFolder', () => {
    writeDeviceSettings({ invoicesRoot: '' });
    return storageInfo();
  });

  // ===== النسخ الاحتياطي المحلي =====
  ipcMain.handle('backup:write', (_e, { json, label = 'auto' } = {}) => {
    if (!json) throw new Error('لا توجد بيانات للنسخ');
    const folder = path.join(invoicesRoot(), BACKUPS_FOLDER_NAME);
    fs.mkdirSync(folder, { recursive: true });
    const now = new Date();
    const stamp = label === 'manual'
      ? `${ymd(now)} ${pad(now.getHours())}-${pad(now.getMinutes())} يدوي`
      : ymd(now);
    const filePath = path.join(folder, `نسخة احتياطية ${stamp}.json`);
    fs.writeFileSync(filePath, json, 'utf-8');

    // الاحتفاظ بآخر 60 نسخة بس
    const files = fs.readdirSync(folder)
      .filter(f => f.startsWith('نسخة احتياطية') && f.endsWith('.json'))
      .map(f => ({ f, t: fs.statSync(path.join(folder, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(MAX_BACKUPS).forEach(({ f }) => fs.unlink(path.join(folder, f), () => {}));

    writeDeviceSettings({ lastBackupAt: now.toISOString() });
    return { filePath, ...storageInfo() };
  });

  ipcMain.handle('storage:openFolder', async (_e, which = 'root') => {
    const target = which === 'backups' ? path.join(invoicesRoot(), BACKUPS_FOLDER_NAME) : invoicesRoot();
    fs.mkdirSync(target, { recursive: true });
    await shell.openPath(target);
    return target;
  });
}

async function createWindow() {
  try {
    await startLocalServer(APP_PORT, { strictPort: true });
  } catch (err) {
    dialog.showErrorBox('تعذر تشغيل البرنامج', `البورت ${APP_PORT} مستخدم من برنامج تاني.\n${err.message}`);
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'المركز - إدارة صيانة السيارات',
    icon: path.join(__dirname, '..', 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // روابط خارجية (واتساب وغيره) تفتح في المتصفح الافتراضي، ونوافذ الفاتورة الداخلية تفتح عادي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(`http://127.0.0.1:${APP_PORT}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
  });

  mainWindow.maximize();
  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}/index.html`);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ===== التحديث التلقائي من GitHub Releases =====
// بيدوّر على نسخة جديدة عند الفتح وكل 4 ساعات، وينزّلها في الخلفية، ويسأل قبل إعادة التشغيل.
// النسخة المحمولة (Portable) مش بتدعم التحديث التلقائي.
const UPDATE_CHECK_MS = 4 * 60 * 60 * 1000;

function setupAutoUpdate() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', async (info) => {
    if (!mainWindow) return;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'تحديث جديد للبرنامج',
      message: `نسخة جديدة (${info.version}) اتنزلت وجاهزة.`,
      detail: 'البيانات والفواتير مش هتتأثر.\nلو اخترت "بعدين"، التحديث هيتثبت لوحده لما تقفل البرنامج.',
      buttons: ['إعادة التشغيل والتحديث دلوقتي', 'بعدين'],
      defaultId: 0,
      cancelId: 1
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => console.warn('Auto-update:', err && err.message));

  const check = () => autoUpdater.checkForUpdates().catch(err => console.warn('Update check failed:', err && err.message));
  setTimeout(check, 10000);
  setInterval(check, UPDATE_CHECK_MS);
}

// نسخة واحدة فقط من البرنامج تشتغل في نفس الوقت
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    createWindow();
    setupAutoUpdate();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
