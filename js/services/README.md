# Services Component (`js/services`)

## Overview
The `js/services` package houses the core business logic layer of the application. It acts as an intermediary between the UI views (`js/views`) and the IndexedDB storage layer (`js/db`), encapsulating domain rules, role permissions, Egyptian localization logic (e.g., phone validation, EGP currency calculation), financial aggregations, and external URL formatting.

## Interface

### Exported Singletons
1. `authService`:
   - `login(username, password)`: Validates credentials against `users` store and sets active session in `localStorage`.
   - `logout()`: Clears active user session.
   - `getCurrentUser()`: Returns current user object `{ username, name, role }`.
   - `isLoggedIn()`: Returns boolean authentication status.
   - `getRole()`: Returns current role (`admin` or `cashier`).
   - `isManager()`, `isCashier()`: Role verification boolean helpers.
2. `customerService`:
   - `validateEgyptianPhone(phone)`: Cleans and validates phone numbers.
   - `validateEgyptianPlate(letters, numbers)`: Validates Egyptian license plate formatting.
   - `saveCustomer(customerData)`: Validates phone uniqueness and creates/updates customer record.
   - `saveCar(carData)`: Validates plate and persists vehicle linked to customer.
3. `inventoryService`:
   - `getPartStock(partId)`: Computes available on-hand stock by reconciling purchases and sales ledger.
   - `getAllPartsWithStock()`: Retrieves all parts with calculated on-hand quantities.
   - `getLowStockAlerts()`: Returns parts currently at or below their `minStockLevel`.
   - `savePart(partData)`: Creates or updates spare part definition.
   - `procurePart(procureData)`: Records new incoming stock batch, creating a purchase ledger entry.
4. `invoiceService`:
   - `calculateTotals({ services, parts, discountType, discountValue, cash, vodafone, instapay })`: Calculates subtotal, discounts, netTotal, totalPaid, and payment status (`paid`, `partial`, `unpaid`).
   - `createMaintenanceInvoice(wizardData)`: Persists maintenance record, sales records, customer update, and returns generated invoice ID.
5. `supplierService`:
   - `getAllSuppliersWithStats()`: Returns suppliers with aggregated purchases, paid amounts, and outstanding balance.
   - `saveSupplier(supplierData)`: Creates or updates vendor record.
   - `createSupplierInvoice({ supplierId, invoiceNumber, invoiceDate, dueDate, items, notes })`: Creates supplier invoice, batch purchase records, and updates stock.
   - `recordSupplierPayment({ supplierId, supplierInvoiceId, amount, paymentMethod, notes })`: Logs payment against supplier balance.
6. `workerService`:
   - `getAllActiveWorkers()`, `getAllWorkers()`, `getWorkerById(id)`: Worker queries.
   - `saveWorker({ id, name, phone, specialty, weeklySalary })`: Saves worker profile.
   - `deactivateWorker(id)`, `activateWorker(id)`: Toggles active status.
   - `updateWeeklySalary(workerId, salary)`: Modifies compensation.
7. `reportService`:
   - `filterInvoicesByPeriod(invoices, period)`: Filters invoices by timeframe (`today`, `yesterday`, `week`, `month`, `all`).
   - `getRevenueReport(period)`: Aggregates revenue, net profits, parts profit, service profit, and payment methods.
   - `getTopServices(period)`: Returns most requested labor services.
   - `getTopCustomers()`: Identifies top-spending customers.
   - `getWorkerStats(period)`: Summarizes jobs and performance per technician.

## Invariants
1. **Egyptian Mobile & Plate Rules**: Customer phone numbers and vehicle plates must pass `validateEgyptianPhone` and `validateEgyptianPlate`.
2. **Role Isolation**: Non-admin users (`cashier`) are restricted from manager capabilities (`isManager()`), including cost prices, profit margins, supplier debt totals, and payroll calculations.
3. **Monetary Precision**: All monetary totals are calculated as IEEE 754 floating point numbers and rounded to 2 decimal places (`Math.round(val * 100) / 100`) in Egyptian Pounds (EGP).

## Side Effects
- Mutates IndexedDB records via `db.add`, `db.put`, and `db.delete`.
- Modifies `localStorage` for user session authentication persistence (`almarkaz_auth_user`).
- Dispatches window events and triggers DOM notifications.

## Verification
- Test user role authorization: Ensure `authService.isManager()` evaluates to `false` when logged in as `cashier`.
- Test financial balance: Ensure `invoiceService.calculateTotals()` produces mathematically sound `netTotal = subtotal - discountAmount`.
