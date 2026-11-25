# Database Component (`js/db`)

## Overview
The `js/db` package manages client-side persistence for the application using the browser's IndexedDB engine. It acts as the local Single Source of Truth (SSOT), providing schema definitions, transactional CRUD methods, automated sync-queue event logging, and full database export/import routines.

## Interface

### Exported Singletons and Classes
- `db` (`Database`): Default export singleton handling indexed storage operations.
- `Database`: Class defining the low-level IndexedDB connection, schema versioning, and high-level store accessors.
- `seedDatabaseIfEmpty()`: Asynchronous bootstrapping function that populates default services, settings, and users if the stores are empty.

### Object Stores Managed
The IndexedDB database (`AutoCareHub_DB`, Version `1`) maintains 16 distinct object stores:
1. `customers` (KeyPath: `id`): Customer contact and identity records.
2. `cars` (KeyPath: `id`, Indexes: `customerId`, `plateText`): Vehicle data linked to customers.
3. `maintenance` (KeyPath: `id`, Indexes: `carId`, `date`, `status`): Service job cards and work orders.
4. `services` (KeyPath: `id`): Catalog of available repair and maintenance labor services.
5. `workers` (KeyPath: `id`): Technician and employee roster.
6. `workerAttendance` (KeyPath: `id`, Indexes: `workerId`, `date`): Daily clock-in/attendance records.
7. `workerExpenses` (KeyPath: `id`, Indexes: `workerId`, `date`): Wage advances, bonuses, and penalties.
8. `parts` (KeyPath: `id`, Indexes: `category`, `supplierId`): Spare parts inventory and stock tracking.
9. `sales` (KeyPath: `id`, Indexes: `partId`, `invoiceId`, `createdAt`): Invoices, itemized charges, and payment tracking.
10. `suppliers` (KeyPath: `id`): Vendor master records.
11. `supplierInvoices` (KeyPath: `id`, Indexes: `supplierId`, `dueDate`, `status`): Invoices for purchased parts.
12. `purchases` (KeyPath: `id`, Indexes: `invoiceId`, `partId`): Individual line items for parts purchases.
13. `supplierPayments` (KeyPath: `id`, Indexes: `supplierId`, `date`): Supplier debt settlements.
14. `syncQueue` (KeyPath: `id`, Indexes: `status`, `createdAt`): FIFO buffer for outgoing synchronization mutations.
15. `settings` (KeyPath: `key`): System configuration (center name, tax rate, phone, webhook URL).
16. `users` (KeyPath: `id`, Indexes: `username`): Local authentication accounts (`admin`, `cashier`).

### Core Methods on `db`
- `init()`: Initializes IndexedDB structure and connection promise.
- `generateId(prefix)`: Generates device-prefixed unique ID: `${prefix}-${this.deviceId}-${timestamp}${rand}`.
- `getAll(storeName)`: Fetches all records from a target store.
- `get(storeName, key)`: Fetches a single record by primary key.
- `find(storeName, filterFn)`: Queries and filters records in a store.
- `add(storeName, item, pushToSync = true)`: Inserts a record; auto-generates ID and createdAt if omitted, auto-pushes mutation to `syncQueue`.
- `put(storeName, item, pushToSync = true)`: Alias to `add` (upsert behavior in IndexedDB).
- `delete(storeName, key, pushToSync = true)`: Deletes a record by key, auto-pushes delete action to `syncQueue`.
- `clear(storeName)`: Truncates a single object store.
- `exportFullBackup()`: Dumps all stores into a JSON-serializable backup object with metadata.
- `importBackup(backupJson)`: Restores database from a backup JSON payload without triggering sync mutations.

## Invariants
1. **Mutation Auditing / Auto-Sync**: Every call to `add`, `put`, or `delete` automatically pushes an entry (`{ id: 'SYNC-...', entityType: storeName, action: 'upsert'|'delete', recordId, payload, status: 'pending', retries: 0, createdAt }`) into the `syncQueue` store unless `pushToSync` is explicitly set to `false`.
2. **Device Isolation Keying**: Primary keys are string identifiers generated via `generateId(prefix)` incorporating the device ID from `localStorage` (`almarkaz_device_id`) to prevent conflict during multi-device synchronization.
3. **Idempotent Bootstrapping**: `seedDatabaseIfEmpty()` checks existing item counts before injecting initial data, preventing accidental duplication on successive application startups.

## Side Effects
- Mutates the browser's IndexedDB storage under database name `AutoCareHub_DB`.
- Modifies `syncQueue` records as a side effect of normal store mutations.
- Dispatches global window event `db:changed` on mutation.

## Verification
- Verify database creation and versioning in browser DevTools: `Application > Storage > IndexedDB > AutoCareHub_DB`.
- Verify sync logging by performing `await db.add('customers', { name: 'Test' })` and querying `await db.getAll('syncQueue')`.
