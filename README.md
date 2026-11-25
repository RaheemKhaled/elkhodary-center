# 🚗 AutoCareHub | نظام إدارة مركز صيانة السيارات وضبط الزوايا والعفشة
### (نظام متكامل، يعمل بدون إنترنت Offline-First، ومزامن مع Google Sheets)

## System Overview
AutoCareHub is an offline-first, client-side progressive web application tailored for automotive maintenance centers, wheel alignment workshops, and mechanics in Egypt. Built on pure Web standards (HTML5, ES Modules, CSS3, IndexedDB, Service Worker) without heavy runtime frameworks, the platform guarantees zero-latency point-of-sale invoicing, role-isolated operations, Arabic/RTL touch interactions, automated sync-queue logging, and remote persistence to Google Sheets via Google Apps Script.

---

## Architecture & Subdirectories

The repository architecture follows a modular decoupled structure governed by component-level contracts:

```
AutoCareHub/
├── index.html                 # Single-page application entry point and HTML shell
├── sw.js                      # Service Worker caching offline assets
├── google_apps_script.js      # Remote bridge script for Google Sheets API backend
├── css/                       # Visual design system and RTL print stylesheets
└── js/                        # Core JavaScript architecture
    ├── app.js                 # Application orchestrator, router, and event bus
    ├── components/            # Reusable UI widgets and custom plate picker
    ├── db/                    # IndexedDB persistence layer and auto-sync queue
    ├── services/              # Domain business logic, roles, and financial calculations
    ├── sync/                  # Offline sync engine and Google Apps Script caller
    └── views/                 # Screen presentation controllers and UI routes
```

### Component Blueprint Contracts
- [Application Core Blueprint](./js/README.md): High-level coordination, routing, and lifecycle management.
- [UI Components Contract](./js/components/README.md): `EgyptianPlatePicker`, modals, notifications, and plate styling.
- [Database Contract](./js/db/README.md): IndexedDB schema (16 stores), CRUD methods, and auto-sync mutation queue.
- [Services Contract](./js/services/README.md): Domain services (`auth`, `customer`, `inventory`, `invoice`, `supplier`, `worker`, `report`).
- [Sync Engine Contract](./js/sync/README.md): Offline FIFO queue processing, network telemetry, and backoff retries.
- [Views Contract](./js/views/README.md): 10 view controllers, rendering lifecycles, and access control.

---

## Global Invariants
1. **Offline Autonomy**: Every business function (ticket creation, billing, customer lookup, inventory adjustments) executes locally against IndexedDB (`AutoCareHub_DB`). Lack of network connectivity never disables or degrades local POS capabilities.
2. **Causal Sync Logging**: Any local mutation (`add`, `put`, `delete`) performed in `js/db` automatically registers an entry in `syncQueue` (unless explicitly suppressed), preserving mutation causality for the remote backend.
3. **Role & Privilege Separation**: Non-administrative users (`cashier`) are strictly isolated from cost prices, profit margins, supplier balances, and payroll statistics across both presentation views and business services.
4. **Egyptian Localization**:
   - Customer phone numbers strictly adhere to the 11-digit Egyptian format (`01xxxxxxxxx`).
   - Egyptian vehicle license plates enforce official letter sets and separate private from governmental plate layouts.
   - Financial sums are formatted and rounded to 2 decimal places in Egyptian Pounds (EGP).
5. **Print & Invoice Layout Standard**: Invoices rendered in `invoiceView` are formatted for standard A4 document printing (`@media print`) and thermal receipt rolls (80mm) without layout truncation.

---

## Global Side Effects
- Mutates client storage: IndexedDB (`AutoCareHub_DB`) and `localStorage` (session authentication state).
- Triggers remote HTTP POST requests from `syncEngine` to configured Google Apps Script Web App URLs.
- Modifies browser history and document hash routes (`#cashier`, `#inventory`, `#reports`, etc.).
- Registers and runs a Service Worker (`sw.js`) for full-cache offline shell availability.

---

## Verification & Health Check
1. **Local Server Verification**:
   - Serve the repository using any standard static file server (e.g., Python `python -m http.server 8080`).
   - Open `http://localhost:8080/index.html` in an evergreen browser (Chrome, Edge, Firefox).
   - Check the Developer Console: Verify `db.open()` succeeds, seed data loads on empty stores, and the Service Worker registers.
2. **Offline Resilience Check**:
   - In browser DevTools, switch to `Network > Offline`.
   - Create a customer invoice. Verify the transaction completes instantly and an item is appended to the `syncQueue` store.
3. **Hardware & Print Check**:
   - Press `F2` from any screen to ensure rapid navigation to the POS Cashier.
   - Click "طباعة فاتورة" on a generated invoice and verify the A4 print preview.

---

## 🌟 المميزات الأساسية وتصميم الواجهة (UX)
تم تصميم هذا النظام خصيصاً ليناسب طبيعة العمل في ورش ومراكز الصيانة والفنيين في مصر:
1. **فصل كامل بين واجهة الكاشير وواجهة المدير (Role Separation)**:
   - **واجهة الكاشير (POS):** واجهة سريعة ومبسطة جداً، مخصصة لمحاسبة الزبائن وإصدار الفواتير فورياً، دون إمكانية الاطلاع على تقارير الأرباح أو أسعار الشراء أو مستحقات الموردين.
   - **واجهة المدير (Manager Dashboard):** محمية برقم سري (PIN) الافتراضي `1234`، تتيح الاطلاع على حجم المبيعات والإيرادات الكاملة، المخزن، الموردين، التقارير، والتحكم بالأسعار.
2. **رقم التليفون هو الحقل الفريد (Unique Identifier)**:
   - رقم التليفون هو المعرف الأساسي للعميل في قاعدة البيانات لمنع أي تكرار.
   - بمجرد كتابة رقم التليفون أو اسم العميل، تظهر قائمة اقتراحات فورية ذكية (Autocomplete) بالعملاء والسيارات السابقة لاختيارها بلمسة واحدة.
3. **أداة مخصصة لنمرة العربية المصرية (Egyptian License Plate Picker)**:
   - دعم كامل للوحات الملاكي والحكومية.
   - 3 خانات للحروف العربية الرسمية المستخدمة في اللوحات المصرية + 4 خانات للأرقام، مع خيار مخصص للوحات الهيئات والجهات الحكومية (حرية في عدد الحروف والأرقام).
   - لوحة مفاتيح لمسية كبيرة على الشاشة مع دعم الكتابة المباشرة من لوحة المفاتيح.
   - معاينة واقعية لشكل لوحة المرور المصرية بشريطها الأزرق العلوي.
4. **واجهة عربية RTL بالكامل** بخطوط كبيرة وواضحة جداً (الحد الأدنى **20px** للنصوص العادية، و **26px-36px** للعناوين والبيانات المالية).
5. **نظام مالي وحسابي دقيق**:
   - حساب تلقائي: إجمالي الخدمات + قطع الغيار − الخصم (مبلغ أو نسبة) = الإجمالي النهائي.
   - توزيع طرق الدفع المتعددة: (نقدي / كاش + فودافون كاش + إنستا باي).
   - زر سريع لاستلام المبلغ كاملاً نقداً بلمسة واحدة.
6. **الطباعة والمشاركة الفورية**:
   - طباعة بون حراري رول (Thermal Receipt 80mm).
   - طباعة فاتورة نظامية مقاس A4 و A5 مضبوطة.
   - إرسال تفاصيل الفاتورة مباشرة عبر واتساب بضغطة زر لرقم العميل.
7. **العمل بدون إنترنت (100% Offline-First)**:
   - تخزين محلي كامل في المتصفح باستخدام **IndexedDB** و **Service Worker**.
   - توليد أكواد فريدة برمز الجهاز والوقت لتفادي أي تعارض عند تشغيل أكثر من جهاز.
   - طابور مزامنة (Sync Queue) يحفظ العمليات ويرفعها تلقائياً لـ Google Sheets فور توفر الإنترنت.
   - شريط حالة علوي يوضح: (🟢 متصل / 🔴 أوفلاين / 🔄 جاري المزامنة / 📦 عدد العمليات المعلقة).

---

## 🚀 طريقة التشغيل السريعة (Windows)
1. **التشغيل بضغطة زر واحدة:**
   - اضغط مرتين على ملف **`تشغيل_النظام.bat`**.
   - سيقوم الخادم بالتشغيل التلقائي وفتح التطبيق في متصفحك على: `http://localhost:8080/`.
2. **الوصول من الموبايل أو التابلت في الورشة:**
   - تأكد أن الموبايل أو التابلت متصل بنفس شبكة الـ Wi-Fi مع الكمبيوتر.
   - افتح المتصفح في الموبايل واكتب عنوان الآي بي الخاص بالكمبيوتر متبوعاً بالمنفذ، مثلاً: `http://192.168.1.15:8080/`.
   - اضغط على خيارات المتصفح واختر **«إضافة إلى الشاشة الرئيسية» (Install App)** ليصبح تطبيقاً مستقلاً بأيقونته الخاصة!

---

## 📊 خطوات ربط Google Sheets خطوة بخطوة

لقد قمنا بتجهيز كود **`google_apps_script.js`** كاملاً ومرفقاً في المشروع، ليقوم بإنشاء الشيتات والأعمدة تلقائياً دون أي مجهود منك:

1. افتح حسابك في Google Drive وأنشئ ملف **Google Sheets** جديد، وسمّه مثلاً: `قاعدة بيانات مركز الصيانة`.
2. من القائمة العلوية داخل Google Sheets، اضغط على:
   **ملحقات (Extensions) > Apps Script**.
3. امسح أي كود موجود في نافذة المحرر، وافتح ملف **`google_apps_script.js`** في مجلد المشروع، وانسخ كل محتواه والصقه في المحرر.
4. اضغط على أيقونة **الحفظ (Save)** 💾 أو اختصار `Ctrl + S`.
5. اضغط على الزر الأزرق في الأعلى يميناً: **نشر (Deploy) > نشر جديد (New deployment)**.
6. بجوار "Select type" اضغط على الترس ⚙️ واختر: **تطبيق ويب (Web app)**.
7. املأ الإعدادات كالتالي:
   - **الوصف (Description):** مركز الصيانة API.
   - **تنفيذ باسم (Execute as):** أنا (حساب Google الخاص بك).
   - **من لديه حق الوصول (Who has access):** **أي مستخدم (Anyone)** 👈 *(مهم جداً ليعمل دون تعقيدات).*
8. اضغط **نشر (Deploy)**، ثم وافق على الصلاحيات (Authorize access).
9. انسخ **رابط تطبيق الويب (Web app URL)** الناتج.
10. افتح نظام إدارة المركز، اذهب إلى شاشة **«الإعدادات» (⚙️)**، والصق الرابط في خانة **رابط تطبيق الويب**، واضغط **حفظ الرابط** ثم **اختبار وفحص**!
🎉 الآن كل عملية أو فاتورة تسجلها ستتزامن تلقائياً وبأمان في ملف الـ Sheets الخاص بك!

---

## 🗄️ هيكلة وتوثيق الجداول (Database Schema)

| اسم الجدول في Sheets | الاسم في IndexedDB | الوصف والحقول الأساسية |
| :--- | :--- | :--- |
| **Customers** | `customers` | كود العميل (PK)، الاسم، رقم التليفون (01x)، ملاحظات، إحصائيات محسوبة (الزيارات، الإجمالي). |
| **Cars** | `cars` | كود السيارة (PK)، كود العميل (FK)، الماركة، الموديل، النوع، حروف اللوحة، أرقام اللوحة، اللوحة كاملة. |
| **Maintenance** | `maintenance` | كود الصيانة (PK)، كود العميل، السيارة، اللوحة، المشكلة، التشخيص، التوصيات، الخدمات، القطع، الإجماليات، طرق الدفع، العمالة. |
| **Services** | `services` | كود الخدمة (PK)، الاسم، السعر الافتراضي، الإضافات المتاحة (برستا، مساعد، مقص، زرجينة)، الحالة. |
| **Workers** | `workers` | كود الفني (PK)، اسم العامل، التليفون، التخصص، الحالة (نشط/غير نشط). |
| **Parts** | `parts` | كود القطعة (PK)، اسم القطعة، التصنيف، المورد، سعر التكلفة، سعر البيع، حد التنبيه، الرصيد المحسوب. |
| **Sales** | `sales` | كود البيع (PK)، كود القطعة، الكمية، سعر الوحدة، الإجمالي، كود الفاتورة أو بيع مباشر، التاريخ. |
| **Suppliers** | `suppliers` | كود المورد (PK)، اسم الشركة، التليفون، التخصص، العنوان، إجمالي المشتريات والمستحق. |
| **Supplier_Invoices** | `supplierInvoices` | كود التوريد (PK)، رقم الفاتورة الورقية، كود المورد، تاريخ الفاتورة، ميعاد الاستحقاق، المبلغ، المدفوع، المتبقي. |
| **Purchases** | `purchases` | **PK مركب من (كود التوريد + رقم الفاتورة + كود القطعة)**، سعر الشراء، الكمية، الإجمالي (يزيد المخزون تلقائياً). |
| **Supplier_Payments**| `supplierPayments` | كود الدفعة (PK)، كود المورد، كود الفاتورة، المبلغ المسدد، طريقة الدفع، التاريخ. |

---

## 🧪 البيانات التجريبية الجاهزة للاختبار (Seed Data)
عند تشغيل النظام لأول مرة، يقوم النظام بحقن بيانات واقعية متكاملة لتبدأ بتجربة كل الشاشات فوراً:
- **خدمات مسبقة:** زوايا أمامي (مع إضافات برستا، شغل مساعد، مقص، زرجينة)، زوايا خلفي، عفشة كاملة، ترصيص عادي، ترصيص لزق، لحام كاوتش، وشغل مخرطة.
- **فنيين مسجلين:** الأسطى حسن زوايا، الفني أحمد عفشة، الفني محمود كاوتش، الأسطى إبراهيم مخرطة.
- **موردين مسجلين:** أولاد حسني لقطع الغيار، الأهرام لمهمات الكاوتش، الشركة الهندسية للمساعدين.
- **قطع غيار في المخزن:** تيل فرامل، بارات دركسيون، مساعدين KYB، رقع كاوتش ألماني، رصاص ترصيص، مسمار ضبط كامبر، وقطع بنواقص مسبقة لتجربة تنبيهات المخزن.
- **عملاء وسيارات:** عملاء بأرقام هواتف مصرية (010, 011, 012) ولوحات سيارات مصرية مجربة مثل `س ن د 1234` ولوحات حكومية.

---

## ⌨️ اختصارات لوحة المفاتيح
- **`F2`**: فتح شاشة إنشاء فاتورة وصيانة جديدة فوراً من أي مكان في البرنامج.
- **`Esc`**: إغلاق النوافذ المنبثقة أو العودة للشاشة الرئيسية.

---
تم التطوير والبرمجة وفق أحدث معايير الأداء والواجهات التفاعلية الحديثة والعمل دون إنترنت.
