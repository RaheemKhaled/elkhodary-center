/**
 * شاشة تسجيل الدخول الرئيسية للنظام (Login View)
 * تفتح تلقائياً عند تشغيل النظام لحماية البيانات وتحديد الواجهة حسب الصلاحيات
 */

import { authService } from '../services/authService.js';
import { toast } from '../components/toast.js';

export const loginView = {
  render(container) {
    container.innerHTML = `
      <div class="login-screen-wrapper" style="min-height: calc(100vh - 120px); display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="card login-card" style="max-width: 500px; width: 100%; padding: 36px 32px; border: 3px solid var(--border-color); box-shadow: var(--shadow-xl); border-radius: 20px; background: var(--bg-surface);">
          
          <!-- اللوجو والعنوان -->
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="font-size: 54px; line-height: 1; margin-bottom: 12px; filter: drop-shadow(0 4px 12px rgba(37,99,235,0.4));">🔧</div>
            <h1 style="font-size: 32px; font-weight: 900; color: #FFFFFF; margin: 0 0 6px 0;">الـمـركـز</h1>
            <p style="font-size: 18px; color: var(--text-muted); margin: 0;">صيانة السيارات وضبط الزوايا والعفشة</p>
            <div style="height: 3px; width: 80px; background: linear-gradient(90deg, #3B82F6, #10B981); margin: 16px auto 0; border-radius: 4px;"></div>
          </div>

          <h2 style="font-size: 22px; font-weight: 800; color: #93C5FD; margin-bottom: 18px; text-align: center;">
            🔐 تسجيل الدخول للنظام
          </h2>

          <!-- صندوق التنبيه في حالة الخطأ -->
          <div id="loginAlertBox" style="display: none; background: rgba(239,68,68,0.18); border: 2px solid #EF4444; color: #FCA5A5; padding: 12px 16px; border-radius: 10px; font-size: 16px; font-weight: 800; margin-bottom: 18px; text-align: center;"></div>

          <!-- نموذج تسجيل الدخول -->
          <form id="loginMainForm" autocomplete="on">
            <div class="form-group" style="margin-bottom: 18px;">
              <label class="form-label" for="loginUsernameInput" style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">
                👤 اسم المستخدم:
              </label>
              <input 
                type="text" 
                id="loginUsernameInput" 
                class="form-control" 
                placeholder="أدخل اسم المستخدم..."
                autocomplete="username"
                required
                style="font-size: 20px; font-weight: 800; min-height: 52px; padding: 10px 16px;"
              >
            </div>

            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" for="loginPasswordInput" style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">
                🔑 كلمة المرور:
              </label>
              <div style="position: relative;">
                <input 
                  type="password" 
                  id="loginPasswordInput" 
                  class="form-control" 
                  placeholder="أدخل كلمة المرور..."
                  autocomplete="current-password"
                  required
                  style="font-size: 20px; font-weight: 800; min-height: 52px; padding: 10px 48px 10px 16px;"
                >
                <button 
                  type="button" 
                  id="btnToggleLoginPass" 
                  style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted); padding: 4px;"
                  title="إظهار / إخفاء كلمة المرور"
                >
                  👁️
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              class="btn btn-primary" 
              id="btnSubmitLogin"
              style="width: 100%; min-height: 56px; font-size: 22px; font-weight: 900; justify-content: center; gap: 10px; background: linear-gradient(135deg, #2563EB, #1D4ED8); border: 2px solid #60A5FA; box-shadow: 0 6px 20px rgba(37,99,235,0.4);"
            >
              <span>🚀</span>
              <span>دخول للنظام</span>
            </button>
          </form>

          <!-- بطاقات الدخول السريع للاختبار أو التسهيل -->
          <div style="margin-top: 26px; padding-top: 20px; border-top: 1px dashed var(--border-color);">
            <div style="font-size: 14px; color: var(--text-muted); font-weight: 700; margin-bottom: 10px; text-align: center;">
              ⚡ اختصارات الدخول السريع:
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <button 
                type="button" 
                class="btn btn-secondary" 
                id="btnQuickLoginAdmin"
                style="padding: 8px 10px; font-size: 14px; font-weight: 800; border-color: #F59E0B; color: #FDE68A; background: rgba(245,158,11,0.1); justify-content: center;"
              >
                👑 دخول كمدير (admin)
              </button>
              <button 
                type="button" 
                class="btn btn-secondary" 
                id="btnQuickLoginCashier"
                style="padding: 8px 10px; font-size: 14px; font-weight: 800; border-color: #3B82F6; color: #93C5FD; background: rgba(59,130,246,0.1); justify-content: center;"
              >
                🧑‍💼 دخول ككاشير (cashier)
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    this.attachEvents(container);
  },

  attachEvents(container) {
    const form = container.querySelector('#loginMainForm');
    const userInp = container.querySelector('#loginUsernameInput');
    const passInp = container.querySelector('#loginPasswordInput');
    const alertBox = container.querySelector('#loginAlertBox');
    const togglePassBtn = container.querySelector('#btnToggleLoginPass');

    // إظهار وإخفاء الباسوورد
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInp.type === 'password';
      passInp.type = isPass ? 'text' : 'password';
      togglePassBtn.textContent = isPass ? '🙈' : '👁️';
    });

    // معالجة الدخول
    const doLogin = async (username, password) => {
      alertBox.style.display = 'none';
      const submitBtn = container.querySelector('#btnSubmitLogin');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳</span> <span>جاري التحقق...</span>';

      try {
        const result = await authService.login(username, password);
        if (result.success) {
          toast.success(`أهلاً بك يا ${result.user.name} 👋`);
          // توجيه تلقائي: المدير للشاشة الرئيسية، والكاشير لشاشة الكاشير
          if (result.user.role === 'manager') {
            window.app.navigate('home');
          } else {
            window.app.navigate('cashier');
          }
        } else {
          alertBox.style.display = 'block';
          alertBox.textContent = `❌ ${result.message}`;
          passInp.value = '';
          passInp.focus();
        }
      } catch (err) {
        alertBox.style.display = 'block';
        alertBox.textContent = `❌ حدث خطأ: ${err.message}`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> <span>دخول للنظام</span>';
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      doLogin(userInp.value, passInp.value);
    });

    // أزرار الدخول السريع
    container.querySelector('#btnQuickLoginAdmin').addEventListener('click', () => {
      userInp.value = 'admin';
      passInp.value = 'admin';
      doLogin('admin', 'admin');
    });

    container.querySelector('#btnQuickLoginCashier').addEventListener('click', () => {
      userInp.value = 'cashier';
      passInp.value = '1234';
      doLogin('cashier', '1234');
    });

    // تركيز أوتوماتيكي
    setTimeout(() => userInp.focus(), 100);
  }
};
