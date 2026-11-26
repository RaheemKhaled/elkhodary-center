/**
 * خدمة إدارة المستخدمين، تسجيل الدخول، والصلاحيات (Auth & User Management Service)
 * دعم كامل لتسجيل الدخول باسم مستخدم وكلمة مرور، وإدارة الأدوار والصلاحيات.
 */

import { db } from '../db/indexeddb.js';

class AuthService {
  constructor() {
    this.ROLE_CASHIER = 'cashier';
    this.ROLE_MANAGER = 'manager';
    this.SESSION_KEY = 'almarkaz_session';
    // الجلسة بتتمسح مع قفل البرنامج: كل تشغيل لازم تسجيل دخول (ومسح أي جلسة قديمة كانت محفوظة دايماً)
    try { localStorage.removeItem(this.SESSION_KEY); } catch (e) {}
  }

  // المستخدم المسجل حالياً
  getCurrentUser() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // هل المستخدم مسجل دخوله؟
  isLoggedIn() {
    return Boolean(this.getCurrentUser());
  }

  // الدور الحالي
  getRole() {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  }

  isManager() {
    return this.getRole() === this.ROLE_MANAGER;
  }

  isCashier() {
    return this.getRole() === this.ROLE_CASHIER;
  }

  // تسجيل الدخول بالاسم وكلمة المرور
  async login(username, password) {
    await db.init();
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanUser) {
      return { success: false, message: 'يرجى إدخال اسم المستخدم' };
    }
    if (!cleanPass) {
      return { success: false, message: 'يرجى إدخال كلمة المرور' };
    }

    const allUsers = await db.getAll('users');
    const matched = allUsers.find(u => u.username && u.username.toLowerCase() === cleanUser);

    if (!matched) {
      return { success: false, message: 'اسم المستخدم غير موجود' };
    }

    if (matched.isActive === false) {
      return { success: false, message: 'هذا الحساب معطل حالياً، راجع المدير' };
    }

    if (matched.password !== cleanPass) {
      return { success: false, message: 'كلمة المرور غير صحيحة' };
    }

    // حفظ الجلسة
    const session = {
      id: matched.id,
      name: matched.name,
      username: matched.username,
      role: matched.role || this.ROLE_CASHIER,
      permissions: matched.permissions || (matched.role === this.ROLE_MANAGER ? ['all'] : ['cashier']),
      loggedInAt: new Date().toISOString()
    };

    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('auth:userChanged', { detail: { user: session } }));
    window.dispatchEvent(new CustomEvent('auth:roleChanged', { detail: { role: session.role } }));

    return { success: true, user: session };
  }

  // تسجيل الخروج
  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.dispatchEvent(new CustomEvent('auth:userChanged', { detail: { user: null } }));
    window.dispatchEvent(new CustomEvent('auth:roleChanged', { detail: { role: null } }));
  }

  // جلب كافة المستخدمين (خاص بالمدير)
  async getAllUsers() {
    await db.init();
    return await db.getAll('users');
  }

  // حفظ أو تعديل مستخدم (خاص بالمدير)
  async saveUser(userData) {
    await db.init();
    const name = (userData.name || '').trim();
    const username = (userData.username || '').trim().toLowerCase();
    const password = (userData.password || '').trim();
    const role = userData.role || this.ROLE_CASHIER;
    const permissions = userData.permissions || (role === this.ROLE_MANAGER ? ['all'] : ['cashier']);
    const isActive = userData.isActive !== false;

    if (!name) throw new Error('اسم الموظف مطلوب');
    if (!username) throw new Error('اسم المستخدم مطلوب');
    if (!password) throw new Error('كلمة المرور مطلوبة');

    const allUsers = await db.getAll('users');
    const duplicate = allUsers.find(u => u.username.toLowerCase() === username && u.id !== userData.id);
    if (duplicate) {
      throw new Error(`اسم المستخدم "${username}" مسجل لموظف آخر بالفعل`);
    }

    if (userData.id) {
      const existing = await db.get('users', userData.id);
      const updated = {
        ...existing,
        name,
        username,
        password,
        role,
        permissions,
        isActive,
        updatedAt: new Date().toISOString()
      };
      await db.put('users', updated);

      // تحديث الجلسة الحالية لو هو نفس المستخدم الحالي
      const current = this.getCurrentUser();
      if (current && current.id === userData.id) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({
          ...current,
          name,
          username,
          role,
          permissions
        }));
        window.dispatchEvent(new CustomEvent('auth:userChanged', { detail: { user: this.getCurrentUser() } }));
      }

      return updated;
    } else {
      const newUser = {
        id: db.generateId('USR'),
        name,
        username,
        password,
        role,
        permissions,
        isActive,
        createdAt: new Date().toISOString()
      };
      await db.add('users', newUser);
      return newUser;
    }
  }

  // حذف أو تعطيل مستخدم
  async deleteUser(userId) {
    await db.init();
    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      throw new Error('لا يمكنك حذف الحساب المسجل به حالياً!');
    }

    const allUsers = await db.getAll('users');
    const managers = allUsers.filter(u => u.role === this.ROLE_MANAGER && u.isActive !== false);
    const target = allUsers.find(u => u.id === userId);

    if (target?.role === this.ROLE_MANAGER && managers.length <= 1) {
      throw new Error('يجب الإبقاء على مدير واحد نشط على الأقل في النظام');
    }

    await db.delete('users', userId);
    return true;
  }
}

export const authService = new AuthService();
