-- ==============================================================================
-- نظام إدارة مركز صيانة السيارات وضبط الزوايا (المركز)
-- سكريبت إنشاء قاعدة بيانات Supabase (PostgreSQL Schema)
-- ==============================================================================
-- طريقة الاستخدام:
-- 1. افتح مشروعك في Supabase (https://supabase.com/dashboard)
-- 2. من القائمة الجانبية ادخل على "SQL Editor"
-- 3. اضغط "New query" والصق هذا الكود بالكامل
-- 4. اضغط "Run" (أو Ctrl+Enter) لتنفيذ السكريبت وإنشاء الجداول فوراً.
-- ==============================================================================

-- 1. جدول العملاء (Customers)
CREATE TABLE IF NOT EXISTS "customers" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 2. جدول السيارات (Cars)
CREATE TABLE IF NOT EXISTS "cars" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT,
    "carType" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "plateLetters" TEXT,
    "plateNumbers" TEXT,
    "plateFull" TEXT,
    "plateType" TEXT,
    "color" TEXT,
    "chassisNumber" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 3. جدول عمليات الصيانة والفواتير (Maintenance & Invoices)
CREATE TABLE IF NOT EXISTS "maintenance" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "carId" TEXT,
    "carInfo" TEXT,
    "plateFull" TEXT,
    "plateLetters" TEXT,
    "plateNumbers" TEXT,
    "date" TEXT,
    "problem" TEXT,
    "diagnosis" TEXT,
    "suspensionNote" TEXT,
    "futureNeeds" TEXT,
    "followUp" TEXT,
    "workers" JSONB DEFAULT '[]'::jsonb,
    "servicesTotal" NUMERIC DEFAULT 0,
    "partsTotal" NUMERIC DEFAULT 0,
    "subTotal" NUMERIC DEFAULT 0,
    "discountType" TEXT,
    "discountValue" NUMERIC DEFAULT 0,
    "discountAmount" NUMERIC DEFAULT 0,
    "netTotal" NUMERIC DEFAULT 0,
    "cashAmount" NUMERIC DEFAULT 0,
    "vodafoneCashAmount" NUMERIC DEFAULT 0,
    "instaPayAmount" NUMERIC DEFAULT 0,
    "totalPaid" NUMERIC DEFAULT 0,
    "remainingBalance" NUMERIC DEFAULT 0,
    "paymentStatus" TEXT,
    "services" JSONB DEFAULT '[]'::jsonb,
    "parts" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 4. جدول الخدمات والإضافات (Services)
CREATE TABLE IF NOT EXISTS "services" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultPrice" NUMERIC DEFAULT 0,
    "hasAddons" BOOLEAN DEFAULT false,
    "availableAddons" JSONB DEFAULT '[]'::jsonb,
    "isActive" BOOLEAN DEFAULT true,
    "isCustom" BOOLEAN DEFAULT false,
    "category" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 5. جدول الفنيين والعمالة (Workers)
CREATE TABLE IF NOT EXISTS "workers" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "weeklySalary" NUMERIC DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 5b. سجل حضور وانصراف العمالة (Worker Attendance)
CREATE TABLE IF NOT EXISTS "worker_attendance" (
    "id" TEXT PRIMARY KEY,
    "workerId" TEXT,
    "workerName" TEXT,
    "date" TEXT,
    "status" TEXT,
    "clockIn" TEXT,
    "clockOut" TEXT,
    "notes" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 5c. مصروفات وسلفيات العمالة (Worker Expenses)
CREATE TABLE IF NOT EXISTS "worker_expenses" (
    "id" TEXT PRIMARY KEY,
    "workerId" TEXT,
    "workerName" TEXT,
    "date" TEXT,
    "amount" NUMERIC DEFAULT 0,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 6. جدول قطع الغيار والمخزن (Parts Inventory)
CREATE TABLE IF NOT EXISTS "parts" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "carBrand" TEXT,
    "carModel" TEXT,
    "category" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "purchaseDate" TEXT,
    "lastPurchaseDate" TEXT,
    "costPrice" NUMERIC DEFAULT 0,
    "sellPrice" NUMERIC DEFAULT 0,
    "minStockLevel" NUMERIC DEFAULT 3,
    "initialStock" NUMERIC DEFAULT 0,
    "isCustom" BOOLEAN DEFAULT false,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 7. جدول حركة المبيعات (Sales)
CREATE TABLE IF NOT EXISTS "sales" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT,
    "partId" TEXT,
    "partName" TEXT,
    "quantity" NUMERIC DEFAULT 1,
    "unitPrice" NUMERIC DEFAULT 0,
    "totalPrice" NUMERIC DEFAULT 0,
    "invoiceId" TEXT,
    "saleType" TEXT,
    "date" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 8. جدول الموردين (Suppliers)
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 9. جدول فواتير التوريد (Supplier Invoices)
CREATE TABLE IF NOT EXISTS "supplier_invoices" (
    "id" TEXT PRIMARY KEY,
    "invoiceNumber" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "invoiceDate" TEXT,
    "dueDate" TEXT,
    "totalAmount" NUMERIC DEFAULT 0,
    "paidAmount" NUMERIC DEFAULT 0,
    "remainingAmount" NUMERIC DEFAULT 0,
    "status" TEXT,
    "notes" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 10. جدول المشتريات (Purchases)
CREATE TABLE IF NOT EXISTS "purchases" (
    "id" TEXT PRIMARY KEY,
    "supplierInvoiceId" TEXT,
    "invoiceNumber" TEXT,
    "partId" TEXT,
    "partName" TEXT,
    "unitCost" NUMERIC DEFAULT 0,
    "quantity" NUMERIC DEFAULT 1,
    "totalCost" NUMERIC DEFAULT 0,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "date" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 11. جدول مدفوعات الموردين (Supplier Payments)
CREATE TABLE IF NOT EXISTS "supplier_payments" (
    "id" TEXT PRIMARY KEY,
    "supplierId" TEXT,
    "supplierInvoiceId" TEXT,
    "amount" NUMERIC DEFAULT 0,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "date" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 12. جدول المستخدمين وصلاحيات الدخول (Users & Permissions)
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB DEFAULT '["all"]'::jsonb,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- 13. جدول إعدادات النظام (Settings)
CREATE TABLE IF NOT EXISTS "settings" (
    "key" TEXT PRIMARY KEY,
    "value" JSONB,
    "updatedAt" TEXT
);

-- ==============================================================================
-- إنشاء الفهارس لتسريع البحث والاستعلامات (Indexes)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_customers_phone ON "customers" ("phone");
CREATE INDEX IF NOT EXISTS idx_customers_name ON "customers" ("name");

CREATE INDEX IF NOT EXISTS idx_cars_customer ON "cars" ("customerId");
CREATE INDEX IF NOT EXISTS idx_cars_plate_full ON "cars" ("plateFull");

CREATE INDEX IF NOT EXISTS idx_maintenance_customer ON "maintenance" ("customerId");
CREATE INDEX IF NOT EXISTS idx_maintenance_car ON "maintenance" ("carId");
CREATE INDEX IF NOT EXISTS idx_maintenance_created ON "maintenance" ("createdAt");

CREATE INDEX IF NOT EXISTS idx_sales_part ON "sales" ("partId");
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON "sales" ("invoiceId");

CREATE INDEX IF NOT EXISTS idx_worker_attendance_worker_date ON "worker_attendance" ("workerId", "date");
CREATE INDEX IF NOT EXISTS idx_worker_expenses_worker_date ON "worker_expenses" ("workerId", "date");

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON "supplier_invoices" ("supplierId");
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON "supplier_payments" ("supplierId");

-- ==============================================================================
-- تفعيل سياسات الأمان (Row Level Security - RLS)
-- تتيح هذه السياسات للتطبيق القراءة والكتابة بسلاسة عبر مفتاح anon key
-- ==============================================================================
DO $$ 
DECLARE 
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'customers', 'cars', 'maintenance', 'services', 'workers', 
            'worker_attendance', 'worker_expenses', 'parts', 'sales', 
            'suppliers', 'supplier_invoices', 'purchases', 'supplier_payments', 
            'users', 'settings'
        )
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public access on %s" ON %I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Public access on %s" ON %I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;

-- ==============================================================================
-- تهيئة الحساب الافتراضي للمدير في حالة عدم وجود مستخدمين
-- ==============================================================================
INSERT INTO "users" ("id", "name", "username", "password", "role", "permissions", "isActive", "createdAt")
VALUES ('USR-ADMIN-1', 'مدير النظام', 'admin', '123456', 'manager', '["all"]'::jsonb, true, NOW()::text)
ON CONFLICT ("username") DO NOTHING;
