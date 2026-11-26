/**
 * جسر آمن بين واجهة البرنامج ونظام الملفات في نسخة سطح المكتب
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  // حفظ الفاتورة PDF في فولدر الأسبوع وفتحها
  saveInvoicePdf: (payload) => ipcRenderer.invoke('invoice:savePdf', payload),
  saveReportPdf: (payload) => ipcRenderer.invoke('report:savePdf', payload),
  // فتح ملف PDF محفوظ مسبقاً (يرجع false لو الملف مش موجود)
  openPdf: (filePath) => ipcRenderer.invoke('invoice:openPdf', filePath),
  // فتح فولدر الفواتير
  openInvoicesFolder: () => ipcRenderer.invoke('invoice:openFolder'),
  getInvoicesRoot: () => ipcRenderer.invoke('invoice:getRoot'),
  // إعدادات مكان الحفظ على الجهاز
  getStorageInfo: () => ipcRenderer.invoke('storage:getInfo'),
  chooseStorageFolder: () => ipcRenderer.invoke('storage:chooseFolder'),
  resetStorageFolder: () => ipcRenderer.invoke('storage:resetFolder'),
  openStorageFolder: (which) => ipcRenderer.invoke('storage:openFolder', which),
  // نسخة احتياطية من قاعدة البيانات كملف على الجهاز
  writeBackup: (json, label) => ipcRenderer.invoke('backup:write', { json, label })
});
