/**
 * نقطة الانطلاق الرئيسية لتطبيق مركز صيانة السيارات (App Engine)
 * التوجيه (Router)، الصلاحيات (فصل الكاشير عن المدير)، وشريط الحالة
 */

import { db } from './db/indexeddb.js';
import { seedDatabaseIfEmpty } from './db/seed.js';
import { syncEngine } from './sync/syncEngine.js';
import { authService } from './services/authService.js';
import { invoiceService } from './services/invoiceService.js';
import { toast } from './components/toast.js';

// استيراد الشاشات
import { cashierView } from './views/cashierView.js?v=30';
import { homeView } from './views/homeView.js?v=30';
import { invoiceView } from './views/invoiceView.js?v=30';
import { customersView } from './views/customersView.js?v=30';
import { inventoryView } from './views/inventoryView.js?v=30';
import { suppliersView } from './views/suppliersView.js?v=30';
import { reportsView } from './views/reportsView.js?v=30';
import { workersView } from './views/workersView.js?v=30';
import { settingsView } from './views/settingsView.js?v=30';
import { loginView } from './views/loginView.js?v=30';

class App {
  constructor() {
    this.currentView = 'login';
    this.views = {
      login: loginView,
      cashier: cashierView,
      home: homeView,
      invoice: invoiceView,
      customers: customersView,
      inventory: inventoryView,
      suppliers: suppliersView,
      workers: workersView,
      reports: reportsView,
      settings: settingsView
    };

    // الشاشات المحمية الخاصة بالمدير فقط
    this.managerOnlyViews = new Set(['home', 'customers', 'inventory', 'suppliers', 'workers', 'reports', 'settings']);

    this.container = document.getElementById('mainAppContainer');
  }

  async init() {
    console.log('🚀 تشغيل نظام إدارة مركز صيانة السيارات...');
    
    try {
      // 1. فتح قاعدة البيانات وحقن البيانات التجريبية إن كانت فارغة
      await db.init();
      await seedDatabaseIfEmpty();

      // 2. مراقبة حالة المزامنة والإنترنت وتحديث شريط الحالة العلوي
      this.setupSyncIndicator();

      // 3. إعداد شريط الأدوار (كاشير / مدير)
      this.setupRoleManagement();

      // 4. مفاتيح الاختصار السريعة (Keyboard Shortcuts)
      this.setupKeyboardShortcuts();

      // 5. أحداث إغلاق النوافذ المنبثقة بالنقر بالماوس بالخارج
      this.setupGlobalModalClose();

      // 6. أحداث شريط العنوان العلوي
      this.setupHeaderActions();

      // 7. تحديد الشاشة الافتراضية حسب الصلاحية الحالية
      const initialRoute = this.getInitialRoute();
      this.navigate(initialRoute);

      window.addEventListener('hashchange', () => {
        const route = window.location.hash.replace('#', '') || this.getInitialRoute();
        this.navigate(route, {}, false);
      });
    } catch (err) {
      console.error('Fatal initialization error:', err);
      if (this.container) {
        this.container.innerHTML = `
          <div class="card" style="border-color: #EF4444; text-align: center; padding: 40px; max-width: 600px; margin: 40px auto;">
            <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
            <h2 style="color: #F87171; font-size: 26px; margin-bottom: 12px;">حدث خطأ في تشغيل النظام</h2>
            <p style="font-size: 18px; color: var(--text-secondary); margin-bottom: 24px;">${err.message || 'تعذر بدء قاعدة البيانات المحلية'}</p>
            <button type="button" class="btn btn-primary" onclick="window.location.reload(true)" style="padding: 12px 28px; font-size: 18px;">
              🔄 إعادة تحميل الصفحة
            </button>
          </div>
        `;
      }
    }
  }

  getInitialRoute() {
    if (!authService.isLoggedIn()) {
      return 'login';
    }
    const hash = window.location.hash.replace('#', '');
    if (hash && this.views[hash] && hash !== 'login') {
      if (authService.isCashier() && this.managerOnlyViews.has(hash)) {
        return 'cashier';
      }
      return hash;
    }
    return authService.isManager() ? 'home' : 'cashier';
  }

  setupRoleManagement() {
    this.renderRoleBadge();

    // الاستماع لتغيير المستخدم (تسجيل الدخول / الخروج)
    window.addEventListener('auth:userChanged', (e) => {
      this.renderRoleBadge();
      const user = e.detail?.user;
      if (!user) {
        this.navigate('login');
      } else if (user.role === authService.ROLE_MANAGER) {
        this.navigate('home');
      } else {
        this.navigate('cashier');
      }
    });
  }

  renderRoleBadge() {
    const mount = document.getElementById('headerRoleBadgeMount');
    const navHomeBtn = document.getElementById('navHomeBtn');
    const navSettingsBtn = document.getElementById('navSettingsBtn');
    const navCashierBtn = document.getElementById('navCashierBtn');

    if (!mount) return;

    const user = authService.getCurrentUser();

    if (!user) {
      // وضع غير مسجل الدخول
      mount.innerHTML = `
        <span class="badge" style="font-size: 15px; padding: 5px 12px; background: rgba(255, 255, 255, 0.08); color: var(--text-muted); border: 1px solid var(--border-color);">
          🔒 تسجيل الدخول
        </span>
      `;

      if (navHomeBtn) navHomeBtn.style.display = 'none';
      if (navSettingsBtn) navSettingsBtn.style.display = 'none';
      if (navCashierBtn) navCashierBtn.style.display = 'none';
      return;
    }

    if (user.role === authService.ROLE_MANAGER) {
      // وضع المدير
      mount.innerHTML = `
        <span class="badge badge-warning" style="font-size: 16px; padding: 6px 12px; background: rgba(245, 158, 11, 0.2); border-color: #F59E0B; color: #FDE68A;">
          👑 ${user.name} (مدير)
        </span>
        <button type="button" class="btn btn-secondary" id="btnLogoutHeader" style="padding: 5px 12px; min-height: 38px; font-size: 15px;" title="تسجيل الخروج">
          🚪 خروج
        </button>
      `;

      if (navHomeBtn) navHomeBtn.style.display = 'inline-flex';
      if (navSettingsBtn) navSettingsBtn.style.display = 'inline-flex';
      if (navCashierBtn) navCashierBtn.style.display = 'inline-flex';
    } else {
      // وضع الكاشير
      mount.innerHTML = `
        <span class="badge badge-info" style="font-size: 16px; padding: 6px 12px; background: rgba(59, 130, 246, 0.2); border-color: #3B82F6; color: #93C5FD;">
          🧑‍💼 ${user.name} (كاشير)
        </span>
        <button type="button" class="btn btn-secondary" id="btnLogoutHeader" style="padding: 5px 12px; min-height: 38px; font-size: 15px;" title="تسجيل الخروج">
          🚪 خروج
        </button>
      `;

      if (navHomeBtn) navHomeBtn.style.display = 'none';
      if (navSettingsBtn) navSettingsBtn.style.display = 'none';
      if (navCashierBtn) navCashierBtn.style.display = 'inline-flex';
    }

    const logoutBtn = mount.querySelector('#btnLogoutHeader');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        authService.logout();
        toast.info('تم تسجيل الخروج بنجاح 👋');
      });
    }
  }

  setupSyncIndicator() {
    const badgeEl = document.getElementById('topSyncStatusBadge');
    if (!badgeEl) return;

    syncEngine.onStatusChange((status) => {
      badgeEl.className = 'status-badge';
      if (status.isSyncing) {
        badgeEl.classList.add('syncing');
        badgeEl.innerHTML = `
          <span>🔄</span>
          <span>جاري المزامنة...</span>
        `;
      } else if (status.isOnline) {
        badgeEl.classList.add('online');
        badgeEl.innerHTML = `
          <span>🟢</span>
          <span>متصل</span>
          ${status.pendingCount > 0 ? `<span class="pending-counter" title="${status.pendingCount} عملية بانتظار المزامنة">${status.pendingCount}</span>` : ''}
        `;
      } else {
        badgeEl.classList.add('offline');
        badgeEl.innerHTML = `
          <span>🔴</span>
          <span>أوفلاين (محلي)</span>
          ${status.pendingCount > 0 ? `<span class="pending-counter">${status.pendingCount}</span>` : ''}
        `;
      }
    });

    badgeEl.addEventListener('click', async () => {
      const status = await syncEngine.getStatus();
      if (!status.hasWebhook) {
        if (authService.isManager()) {
          toast.info('اضغط هنا للانتقال للإعدادات وربط Google Sheets');
          this.navigate('settings');
        } else {
          toast.info('يرجى مراجعة المدير لضبط رابط Google Sheets');
        }
        return;
      }
      if (!status.isOnline) {
        toast.warning(`الجهاز أوفلاين حالياً. لديك ${status.pendingCount} عملية محفوظة محلياً بأمان وستُرفع تلقائياً عند عودة النت.`);
        return;
      }
      try {
        toast.info('جاري بدء المزامنة الفورية...');
        await syncEngine.syncNow();
        toast.success('اكتملت المزامنة بنجاح ✅');
      } catch (err) {
        toast.warning(err.message);
      }
    });
  }

  setupHeaderActions() {
    const brandBtn = document.getElementById('brandLogoBtn');
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        if (!authService.isLoggedIn()) {
          this.navigate('login');
        } else if (authService.isManager()) {
          this.navigate('home');
        } else {
          this.navigate('cashier');
        }
      });
    }

    const homeNavBtn = document.getElementById('navHomeBtn');
    if (homeNavBtn) {
      homeNavBtn.addEventListener('click', () => this.navigate('home'));
    }

    const cashierNavBtn = document.getElementById('navCashierBtn');
    if (cashierNavBtn) {
      cashierNavBtn.addEventListener('click', () => this.navigate('cashier'));
    }

    const settingsNavBtn = document.getElementById('navSettingsBtn');
    if (settingsNavBtn) {
      settingsNavBtn.addEventListener('click', () => this.navigate('settings'));
    }
  }

  setupGlobalModalClose() {
    // إغلاق أي نافذة منبثقة أو قائمة عند النقر بالماوس خارجها (طلب المستخدم رقم 2)
    document.addEventListener('click', (e) => {
      // 1. النقر على خلفية النافذة المنبثقة .modal-overlay
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        setTimeout(() => e.target.remove(), 250);
      }

      // 2. النقر خارج القائمة المنسدلة لاقتراحات العملاء
      const dropdown = document.getElementById('customerSuggestionsDropdown');
      const phoneInput = document.getElementById('cashierPhoneInput');
      if (dropdown && dropdown.style.display !== 'none') {
        if (!dropdown.contains(e.target) && e.target !== phoneInput) {
          dropdown.style.display = 'none';
        }
      }
    });
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // F2 لفتح فاتورة جديدة أو فتح نافذة الحساب السريع في الكاشير
      if (e.key === 'F2') {
        e.preventDefault();
        const openCheckoutBtn = document.getElementById('btnOpenCheckoutModal');
        if (openCheckoutBtn && this.currentView === 'cashier') {
          openCheckoutBtn.click();
        } else if (authService.isCashier()) {
          this.navigate('cashier');
          const phoneInp = document.getElementById('cashierPhoneInput');
          if (phoneInp) phoneInp.focus();
        } else {
          this.navigate('cashier');
        }
      }
      // F3 لفتح سجل وبحث الفواتير السابقة
      if (e.key === 'F3') {
        e.preventDefault();
        invoiceService.showInvoicesLogModal();
      }
      // Esc للعودة للشاشة الرئيسية
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (!activeModal) {
          if (authService.isCashier() && this.currentView !== 'cashier') {
            this.navigate('cashier');
          } else if (authService.isManager() && this.currentView !== 'home') {
            this.navigate('home');
          }
        }
      }
    });
  }

  async navigate(viewName, params = {}, updateHash = true) {
    let target = viewName;

    // 1. التحقق من تسجيل الدخول
    if (!authService.isLoggedIn()) {
      target = 'login';
    } else if (target === 'login') {
      target = authService.isManager() ? 'home' : 'cashier';
    } else if (!this.views[target]) {
      target = authService.isManager() ? 'home' : 'cashier';
    }

    // 2. حماية شاشات المدير
    if (authService.isLoggedIn() && authService.isCashier() && this.managerOnlyViews.has(target)) {
      toast.warning('هذه الشاشة مخصصة للمدير فقط');
      target = 'cashier';
    }

    this.currentView = target;

    if (updateHash) {
      window.location.hash = target;
    }

    // تحديث تظليل أزرار الهيدر
    const homeBtn = document.getElementById('navHomeBtn');
    const settingsBtn = document.getElementById('navSettingsBtn');
    const cashierBtn = document.getElementById('navCashierBtn');
    if (homeBtn) homeBtn.style.opacity = target === 'home' ? '1' : '0.6';
    if (settingsBtn) settingsBtn.style.opacity = target === 'settings' ? '1' : '0.6';
    if (cashierBtn) cashierBtn.style.opacity = target === 'cashier' ? '1' : '0.6';

    // مسح الحاوية وتشغيل ريندر الشاشة المطلوبة
    this.container.innerHTML = `
      <div style="text-align: center; padding: 60px; font-size: 24px; color: var(--text-muted);">
        ⏳ جاري التحميل...
      </div>
    `;

    try {
      await this.views[target].render(this.container, params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
      this.container.innerHTML = `
        <div class="card" style="border-color: #EF4444; text-align: center; padding: 40px;">
          <h2 style="color: #F87171; font-size: 28px; margin-bottom: 12px;">حدث خطأ في تحميل الشاشة</h2>
          <p style="font-size: 20px; color: var(--text-secondary); margin-bottom: 24px;">${error.message}</p>
          <button type="button" class="btn btn-primary" onclick="window.app.navigate('${authService.isManager() ? 'home' : 'cashier'}')">العودة للشاشة الرئيسية</button>
        </div>
      `;
    }
  }
}

// تهيئة التطبيق عند اكتمال تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
