/**
 * خدمات إدارة العمالة (Worker Service)
 * - تعيين وإزالة الصنايعية
 * - تسجيل الحضور والانصراف يومياً
 * - تسجيل المصروفات اليومية (سُلف، مكافآت)
 * - بروفايل الصنايعي: المرتب الأسبوعي + إجمالي ما أخذه + سجل الحضور
 */

import { db } from '../db/indexeddb.js';

class WorkerService {

  // ============ إدارة العمالة ============

  async getAllActiveWorkers() {
    return db.find('workers', w => w.isActive !== false);
  }

  async getAllWorkers() {
    return db.getAll('workers');
  }

  async getWorkerById(id) {
    return db.get('workers', id);
  }

  async saveWorker({ id, name, phone, specialty, weeklySalary }) {
    if (!name || !name.trim()) throw new Error('اسم العامل مطلوب');
    const worker = {
      id: id || db.generateId('WRK'),
      name: name.trim(),
      phone: phone || '',
      specialty: specialty || '',
      weeklySalary: Number(weeklySalary) || 0,
      isActive: true
    };
    await db.put('workers', worker);
    return worker;
  }

  async deactivateWorker(id) {
    const worker = await db.get('workers', id);
    if (!worker) throw new Error('العامل غير موجود');
    worker.isActive = false;
    await db.put('workers', worker);
    return worker;
  }

  async activateWorker(id) {
    const worker = await db.get('workers', id);
    if (!worker) throw new Error('العامل غير موجود');
    worker.isActive = true;
    await db.put('workers', worker);
    return worker;
  }

  async updateWeeklySalary(workerId, salary) {
    const worker = await db.get('workers', workerId);
    if (!worker) throw new Error('العامل غير موجود');
    worker.weeklySalary = Number(salary) || 0;
    await db.put('workers', worker);
    return worker;
  }

  // ============ الحضور والانصراف ============

  getTodayString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  getNowTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  async getAttendanceForDate(dateStr) {
    return db.find('workerAttendance', rec => rec.date === dateStr);
  }

  async getAttendanceForWorker(workerId, fromDate, toDate) {
    return db.find('workerAttendance', rec => {
      return rec.workerId === workerId && rec.date >= fromDate && rec.date <= toDate;
    });
  }

  async recordClockIn(workerId, workerName, dateStr, time) {
    const existing = await this.findAttendanceRecord(workerId, dateStr);
    if (existing) {
      existing.clockIn = time || this.getNowTime();
      existing.status = 'present';
      await db.put('workerAttendance', existing);
      return existing;
    }
    const rec = {
      id: db.generateId('ATT'),
      workerId, workerName,
      date: dateStr || this.getTodayString(),
      status: 'present',
      clockIn: time || this.getNowTime(),
      clockOut: '',
      notes: ''
    };
    await db.add('workerAttendance', rec);
    return rec;
  }

  async recordClockOut(workerId, dateStr, time) {
    const existing = await this.findAttendanceRecord(workerId, dateStr);
    if (existing) {
      existing.clockOut = time || this.getNowTime();
      await db.put('workerAttendance', existing);
      return existing;
    }
    throw new Error('لم يتم تسجيل حضور لهذا العامل اليوم');
  }

  async markAbsent(workerId, workerName, dateStr) {
    const existing = await this.findAttendanceRecord(workerId, dateStr);
    if (existing) {
      existing.status = 'absent';
      existing.clockIn = '';
      existing.clockOut = '';
      await db.put('workerAttendance', existing);
      return existing;
    }
    const rec = {
      id: db.generateId('ATT'),
      workerId, workerName,
      date: dateStr || this.getTodayString(),
      status: 'absent',
      clockIn: '', clockOut: '',
      notes: 'غياب'
    };
    await db.add('workerAttendance', rec);
    return rec;
  }

  async findAttendanceRecord(workerId, dateStr) {
    const records = await db.find('workerAttendance',
      r => r.workerId === workerId && r.date === dateStr
    );
    return records.length ? records[0] : null;
  }

  // ============ المصروفات اليومية ============

  async getExpensesForDate(dateStr) {
    return db.find('workerExpenses', rec => rec.date === dateStr);
  }

  async getExpensesForWorker(workerId, fromDate, toDate) {
    return db.find('workerExpenses', rec => {
      return rec.workerId === workerId && rec.date >= fromDate && rec.date <= toDate;
    });
  }

  async recordExpense({ workerId, workerName, amount, reason, notes, dateStr }) {
    if (!workerId) throw new Error('يرجى اختيار العامل');
    if (!amount || amount <= 0) throw new Error('يرجى إدخال مبلغ صحيح');
    const rec = {
      id: db.generateId('WEXP'),
      workerId,
      workerName: workerName || '',
      date: dateStr || this.getTodayString(),
      amount: Number(amount),
      reason: reason || 'مصروف يومي',
      notes: notes || ''
    };
    await db.add('workerExpenses', rec);
    return rec;
  }

  // ============ بروفايل الصنايعي (إجماليات) ============

  async getWorkerProfile(workerId) {
    const worker = await db.get('workers', workerId);
    if (!worker) return null;

    // أول و آخر 30 يوم
    const today = this.getTodayString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const attendance30d = await this.getAttendanceForWorker(workerId, thirtyDaysAgo, today);
    const expenses30d = await this.getExpensesForWorker(workerId, thirtyDaysAgo, today);

    const presentDays = attendance30d.filter(a => a.status === 'present').length;
    const absentDays = attendance30d.filter(a => a.status === 'absent').length;
    const totalExpenses30d = expenses30d.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // عمليات الصيانة التي شارك فيها (في آخر 30 يوم)
    const allMaintenance = await db.find('maintenance', m => {
      return m.date >= thirtyDaysAgo && m.workers && m.workers.includes(worker.name);
    });

    return {
      ...worker,
      stats: {
        presentDays,
        absentDays,
        totalExpenses30d,
        maintenanceCount: allMaintenance.length,
        attendance30d,
        expenses30d
      }
    };
  }

  // ============ ملخص اليوم لكل الصنايعية ============

  async getTodaySummary() {
    const today = this.getTodayString();
    const workers = await this.getAllActiveWorkers();
    const todayAttendance = await this.getAttendanceForDate(today);
    const todayExpenses = await this.getExpensesForDate(today);

    return workers.map(w => {
      const att = todayAttendance.find(a => a.workerId === w.id);
      const expenses = todayExpenses.filter(e => e.workerId === w.id);
      const totalExpensesToday = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

      return {
        ...w,
        todayStatus: att?.status || 'unknown',
        clockIn: att?.clockIn || '',
        clockOut: att?.clockOut || '',
        totalExpensesToday,
        expensesDetails: expenses
      };
    });
  }
}

export const workerService = new WorkerService();
