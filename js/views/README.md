# Views Component (`js/views`)

## Overview
The `js/views` package contains the presentation controllers and user interface screens for AutoCareHub. Each view module adheres to a consistent screen lifecycle: generating localized Arabic DOM trees, binding event listeners, querying business services (`js/services`), and mounting into the primary application container (`#app-content`).

## Interface

### Exported View Modules
Each module exports a singleton view controller implementing the standardized lifecycle interface:
- `render()`: Asynchronously builds and mounts the view's HTML template into the DOM container.
- `init()`: Binds interactive event handlers, shortcut listeners, and form submit delegates.
- `destroy()`: (Optional) Unbinds listeners or timers before navigating away.

1. `cashierView`: Fast-paced Point of Sale (POS) interface for quick work order creation, service picker, parts lookup, Egyptian license plate input, and receipt generation.
2. `invoiceView`: Dedicated billing, payment settlement, PDF rendering (formatted for standard A4 printing), and WhatsApp sharing interface.
3. `homeView`: Operational dashboard summarizing active vehicles in the center, daily sales tally, and quick-action shortcuts.
4. `customersView`: Customer directory, contact cards, vehicle history, and registration modal.
5. `inventoryView`: Spare parts catalog, stock levels, reorder thresholds, barcode/code search, and inventory adjustment modals.
6. `suppliersView`: Supplier accounts, pending invoices, debt ledgers, and payment registration forms.
7. `workersView`: Technician attendance tracking, daily logs, salary advance entries, and payroll summaries.
8. `reportsView`: Comprehensive business intelligence reports, income statements, daily reconciliations, and expense summaries.
9. `settingsView`: Application configuration (center branding, tax percentages, phone, printer preferences, backup export/import, and sync endpoint URL).
10. `loginView`: Authentication interface with username and password inputs, role-based session initialization, and validation alerts.

## Invariants
1. **Container Isolation**: Views must exclusively render inside the root container element (`#app-content` or designated modal wrapper) without wiping application-wide shell components (e.g., `#main-nav`, `#status-bar`).
2. **Role-Based Visibility**: Views enforcing access control (`reportsView`, `settingsView`, `suppliersView`) must verify `authService.hasRole('admin')` before rendering sensitive financial sections; unauthorized users must be redirected or shown access denied notices.
3. **RTL & Arabic Localization**: All visual strings, tables, and form labels must adhere to Right-to-Left (RTL) formatting and Egyptian Arabic terminology.

## Side Effects
- Mutates the browser DOM within `#app-content`.
- Calls business services (`customerService`, `invoiceService`, etc.), triggering IndexedDB transactions.
- Modifies browser URL hash during view transitions (`#cashier`, `#invoices`, `#reports`).

## Verification
- Test view rendering: Navigate between hash routes (`#cashier`, `#inventory`) and verify `#app-content` reflects the target screen.
- Test responsive plate picker: Ensure `EgyptianPlatePicker` operates correctly inside `cashierView` modal.
- Test print view: Trigger print action in `invoiceView` and verify CSS `@media print` formats to single/multi-page A4 dimensions without cutting off headers.
