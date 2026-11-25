# Application Core Layer (`js`)

## Overview
The `js` package forms the architectural backbone of AutoCareHub. It coordinates client-side routing, dependency orchestration, global keyboard shortcut registration, and application lifecycle management. It ties together the presentation layer (`views`), domain business logic (`services`), local persistence (`db`), synchronization engine (`sync`), and shared UI widgets (`components`).

## Architecture & Subdirectories

```
js/
├── app.js             # Root application orchestrator, router, and event bus
├── components/        # Reusable UI widgets (EgyptianPlatePicker, modals, toasts)
├── db/                # IndexedDB database engine, object stores, and migrations
├── services/          # Core domain business logic and role-based permissions
├── sync/              # Offline synchronization engine and Google Apps Script bridge
└── views/             # Screen presentation controllers and UI routes
```

### Subcomponent Contracts
- [UI Components Contract](./components/README.md): Reusable UI widgets and Egyptian license plate builder.
- [Database Contract](./db/README.md): IndexedDB schema definitions, store accessors, and auto-sync queue logging.
- [Business Services Contract](./services/README.md): Domain services, role authorization, validation, and calculations.
- [Sync Engine Contract](./sync/README.md): Background synchronization, offline buffering, and retry queue.
- [Views Contract](./views/README.md): Screen controllers, lifecycle rendering, and route handling.

## Interface

### Exported Singletons and Bootstrapping
- `app.js`: Instantiates the global application object on `window.app`.
  - `init()`: Bootstraps the application, initializes IndexedDB (`db.init()`), initializes `syncEngine`, registers router handlers, and binds global keyboard shortcuts.
  - `navigate(route, params)`: Transitions the active screen by updating `window.location.hash` and delegating to the appropriate view controller in `js/views`.
  - `showNotification(message, type)`: Global toast helper.

### Global Keyboard Shortcuts
The core orchestrator listens for global accelerator keys:
- `F2`: Instantly transitions to `#cashier` view for rapid ticket creation.
- `Ctrl + N`: Opens New Customer / New Invoice modal depending on active view.
- `Escape`: Closes any currently active modal dialog.

## Invariants
1. **Router State Synchronization**: The visual screen mounted inside `#app-content` must strictly correspond to the current `window.location.hash`.
2. **Guarded Navigation**: If no active user session exists in `authService`, all route transitions must redirect to `#login`.
3. **Graceful Degradation**: Application initialization must succeed offline without errors, deferring remote connections until network availability.

## Side Effects
- Binds global `window` and `document` event listeners (`hashchange`, `keydown`, `online`, `offline`).
- Mutates the DOM structure of `#app-content` during route navigation.
- Exposes `window.app` for cross-component coordination.

## Verification
- Verify initial boot sequence: Load `http://localhost:8080/index.html` in browser; verify that `db.init()` completes and active view renders without console errors.
- Verify shortcut handling: Press `F2` from any screen and verify redirection to `#cashier`.
