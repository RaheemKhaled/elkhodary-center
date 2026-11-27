/**
 * خدمات إدارة العملاء والسيارات
 * (رقم التليفون هو الحقل الفريد Unique لمنع التكرار)
 */

import { db } from '../db/indexeddb.js';

export const customerService = {
  // التحقق من صحة رقم التليفون
  validateEgyptianPhone(phone) {
    if (!phone) return { isValid: false, message: 'رقم التليفون مطلوب' };
    const cleaned = String(phone).replace(/[\s-]/g, '').trim();
    if (cleaned.length < 5) {
      return { isValid: false, message: 'رقم التليفون يجب أن يكون 5 أرقام على الأقل' };
    }
    return { isValid: true, cleaned };
  },

  // التحقق من صحة رقم اللوحة المصرية
  validateEgyptianPlate(letters, numbers) {
    if (!letters || !letters.trim()) {
      return { isValid: false, message: 'يرجى إدخال حروف اللوحة (3 حروف)' };
    }
    if (!numbers || !numbers.trim()) {
      return { isValid: false, message: 'يرجى إدخال أرقام اللوحة (حتى 4 أرقام)' };
    }
    const cleanLetters = letters.trim();
    const cleanNumbers = numbers.trim();
    
    // الحروف 2 إلى 3، والأرقام من 1 إلى 4
    if (cleanLetters.length < 2 || cleanLetters.length > 4) {
      return { isValid: false, message: 'حروف اللوحة يجب أن تكون من 2 إلى 3 حروف' };
    }
    if (!/^\d{1,4}$/.test(cleanNumbers)) {
      return { isValid: false, message: 'أرقام اللوحة يجب أن تكون أرقاماً صحيحة (من 1 إلى 4 أرقام)' };
    }
    return { isValid: true, plateFull: `${cleanLetters} ${cleanNumbers}` };
  },

  // حفظ أو تعديل عميل (رقم التليفون فريد لمنع التكرار)
  async saveCustomer(customerData) {
    const phoneCheck = this.validateEgyptianPhone(customerData.phone);
    if (!phoneCheck.isValid) throw new Error(phoneCheck.message);

    const cleanPhone = phoneCheck.cleaned;
    customerData.phone = cleanPhone;

    if (!customerData.name || !customerData.name.trim()) {
      throw new Error('اسم العميل مطلوب');
    }

    // فحص ما إذا كان العميل مسجلاً بنفس رقم التليفون مسبقاً
    const existing = await db.find('customers', c => c.phone === cleanPhone);

    if (existing.length > 0) {
      // إعادة استخدام نفس كود العميل وتحديث اسمه وملاحظاته
      const existingCustomer = existing[0];
      const updated = {
        ...existingCustomer,
        name: customerData.name.trim(),
        notes: customerData.notes !== undefined ? customerData.notes : (existingCustomer.notes || ''),
        updatedAt: new Date().toISOString()
      };
      await db.put('customers', updated);
      return updated;
    }

    // عميل جديد بالكامل
    if (!customerData.id) {
      customerData.id = db.generateId('CUST');
    }
    customerData.createdAt = new Date().toISOString();
    customerData.updatedAt = new Date().toISOString();
    return await db.add('customers', customerData);
  },

  // حفظ أو تعديل سيارة تابعة لعميل
  async saveCar(carData) {
    if (!carData.customerId) throw new Error('يجب تحديد كود العميل التابعة له السيارة');
    
    let cleanLetters = (carData.plateLetters || '').trim();
    let cleanNumbers = (carData.plateNumbers || '').trim();
    let cleanPlateFull = (carData.plateFull || '').trim();

    if (cleanLetters && cleanNumbers) {
      cleanPlateFull = `${cleanLetters} ${cleanNumbers}`;
    } else if (!cleanPlateFull) {
      if (cleanLetters || cleanNumbers) {
        cleanPlateFull = `${cleanLetters || ''} ${cleanNumbers || ''}`.trim();
      } else {
        cleanPlateFull = 'بدون لوحة';
      }
    }

    carData.plateLetters = cleanLetters;
    carData.plateNumbers = cleanNumbers;
    carData.plateFull = cleanPlateFull;
    if (carData.plateType) {
      carData.plateType = carData.plateType;
    }

    // فحص لو السيارة بنفس اللوحة مسجلة بالفعل لنفس العميل
    const existingCars = await db.find('cars', c => c.plateFull === carData.plateFull && c.customerId === carData.customerId);
    if (existingCars.length > 0) {
      const existingCar = existingCars[0];
      const updated = {
        ...existingCar,
        brand: carData.brand || existingCar.brand,
        model: carData.model || existingCar.model,
        carType: carData.carType || existingCar.carType || 'سيدان',
        plateLetters: cleanLetters,
        plateNumbers: cleanNumbers,
        plateFull: cleanPlateFull
      };
      await db.put('cars', updated);
      return updated;
    }

    if (carData.id) {
      return await db.put('cars', carData);
    } else {
      carData.id = db.generateId('CAR');
      return await db.add('cars', carData);
    }
  },

  // حفظ العميل والسيارة في خطوة واحدة للكاشير
  async saveCustomerWithCar({ customerId, name, phone, notes, carId, brand, model, carType, plateLetters, plateNumbers, plateFull }) {
    try {
      const savedCustomer = await this.saveCustomer({
        id: customerId,
        name,
        phone,
        notes: notes || ''
      });

      const plateCheck = this.validateEgyptianPlate(plateLetters, plateNumbers);
      const cleanPlateFull = plateCheck.isValid ? plateCheck.plateFull : (plateFull || `${plateLetters || ''} ${plateNumbers || ''}`.trim());

      const savedCar = await this.saveCar({
        id: carId,
        customerId: savedCustomer.id,
        brand: brand || '',
        model: model || '',
        carType: carType || 'سيدان',
        plateLetters: plateLetters || '',
        plateNumbers: plateNumbers || '',
        plateFull: cleanPlateFull
      });

      return {
        success: true,
        customer: savedCustomer,
        car: savedCar
      };
    } catch (err) {
      return {
        success: false,
        message: err.message
      };
    }
  },

  // اقتراحات فورية للكاشير (Autocomplete Suggestions أثناء الكتابة)
  async getAutocompleteSuggestions(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    const [customers, cars] = await Promise.all([
      db.getAll('customers'),
      db.getAll('cars')
    ]);

    const carsByCustomerId = new Map();
    for (const car of cars) {
      const list = carsByCustomerId.get(car.customerId) || [];
      list.push(car);
      carsByCustomerId.set(car.customerId, list);
    }

    const matches = [];

    for (const c of customers) {
      const cCars = carsByCustomerId.get(c.id) || [];
      const isPhoneMatch = c.phone && c.phone.includes(q);
      const isNameMatch = c.name && c.name.toLowerCase().includes(q);
      const isPlateMatch = cCars.some(car => car.plateFull && car.plateFull.includes(q));

      if (isPhoneMatch || isNameMatch || isPlateMatch) {
        matches.push({
          customer: c,
          cars: cCars,
          primaryCar: cCars[0] || null,
          matchType: isPhoneMatch ? 'phone' : (isNameMatch ? 'name' : 'plate')
        });
      }

      if (matches.length >= 8) break; // أقصى حد 8 اقتراحات لسرعة العرض
    }

    return matches;
  },

  // البحث السريع بالاسم أو التليفون أو رقم اللوحة
  async searchCustomers(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    const [customers, cars] = await Promise.all([
      db.getAll('customers'),
      db.getAll('cars')
    ]);

    const matchedCustomerIds = new Set();
    const results = [];

    for (const c of customers) {
      if (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      ) {
        matchedCustomerIds.add(c.id);
        const customerCars = cars.filter(car => car.customerId === c.id);
        results.push({ customer: c, cars: customerCars });
      }
    }

    for (const car of cars) {
      if (!matchedCustomerIds.has(car.customerId)) {
        if (
          (car.plateFull && car.plateFull.includes(q)) ||
          (car.plateNumbers && car.plateNumbers.includes(q)) ||
          (car.plateLetters && car.plateLetters.includes(q)) ||
          (car.brand && car.brand.toLowerCase().includes(q))
        ) {
          matchedCustomerIds.add(car.customerId);
          const c = customers.find(item => item.id === car.customerId);
          if (c) {
            const customerCars = cars.filter(item => item.customerId === c.id);
            results.push({ customer: c, cars: customerCars });
          }
        }
      }
    }

    return results;
  },

  // جلب تفاصيل عميل بالكامل مع سياراته وفواتيره وإحصائياته المحسوبة
  async getCustomerFullProfile(customerId) {
    const customer = await db.get('customers', customerId);
    if (!customer) return null;

    const [cars, maintenance] = await Promise.all([
      db.find('cars', car => car.customerId === customerId),
      db.find('maintenance', m => m.customerId === customerId)
    ]);

    const visitsCount = maintenance.length;
    const invoicesCount = maintenance.length;
    const totalSpent = maintenance.reduce((sum, inv) => sum + (Number(inv.netTotal) || 0), 0);
    const totalPaid = maintenance.reduce((sum, inv) => sum + (Number(inv.totalPaid) || 0), 0);
    const totalRemaining = maintenance.reduce((sum, inv) => sum + (Number(inv.remainingBalance) || 0), 0);

    return {
      ...customer,
      cars,
      maintenance,
      computed: {
        visitsCount,
        invoicesCount,
        totalSpent,
        totalPaid,
        totalRemaining
      }
    };
  },

  // العثور على عميل تلقائي برقم التليفون الفريد
  async findByPhone(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/[\s-]/g, '').trim();
    const found = await db.find('customers', c => c.phone === cleaned);
    if (found.length > 0) {
      return await this.getCustomerFullProfile(found[0].id);
    }
    return null;
  },

  // العثور على سيارة وعميلها تلقائي برقم اللوحة
  async findByPlate(plateLetters, plateNumbers) {
    const plateCheck = this.validateEgyptianPlate(plateLetters, plateNumbers);
    if (!plateCheck.isValid) return null;

    const cars = await db.find('cars', car => car.plateFull === plateCheck.plateFull);
    if (cars.length > 0) {
      const car = cars[0];
      const customer = await this.getCustomerFullProfile(car.customerId);
      return { customer, car };
    }
    return null;
  }
};
