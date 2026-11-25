# UI Components Package (Peanuts)

## Overview
Provides reusable, touch-first, and high-contrast user interface widgets across the application. These include the customized Egyptian License Plate Picker widget, global modal dialogs (confirmations, prompts, alerts), and auto-expiring notification toasts.

## Interface
- `EgyptianPlatePicker`: Class in `platePicker.js`.
  - `constructor({ containerId, initialLetters, initialNumbers, initialType, onChange })`: Mounts compact plate widget into container DOM.
  - `setValues(letters, numbers, plateType)`: Programmatically updates plate letters, digits, and category.
  - `getValue()`: Returns `{ letters, numbers, plateType, isGovernment, plateFull, isValid }`.
  - `updatePlateVisual()`: Synchronizes slot visual styling with current values.
  - `notifyChange()`: Triggers external change handler callback.
- `modal`: Singleton instance of `ModalManager` in `modal.js`.
  - `confirm({ title, message, confirmText, cancelText, confirmColor, onConfirm })`: Displays non-blocking modal confirmation overlay.
  - `alert({ title, message, buttonText, icon })`: Displays informational modal with acknowledgement button.
  - `prompt({ title, message, inputType, defaultValue, onConfirm })`: Displays text/number input modal dialog.
- `toast`: Singleton instance of `ToastManager` in `toast.js`.
  - `success(message, duration)`: Green notification toast.
  - `error(message, duration)`: Red notification toast.
  - `warning(message, duration)`: Amber notification toast.
  - `info(message, duration)`: Blue notification toast.

## Invariants
- `EgyptianPlatePicker` handles two plate categories:
  - `private`: 2 to 3 Arabic characters, 1 to 4 digits rendered strictly from Left-to-Right (LTR) with Egyptian blue header bar.
  - `gov`: Flexible letter strings (e.g., "ش ر ط ة" or empty) and arbitrary digit lengths (e.g., 5-6 digits) with slate-gray header bar (`مـصـر (حـكـومـة) | GOV`).
- Active modals inject backdrop overlay into `document.body` and trap focus until resolved; outside click closes only if designated non-critical.
- All toasts append to `#toastContainer` with automatic timeout removal (default 3000ms) and slide-in transition.

## Side Effects
- Direct DOM injection and mutation on `#toastContainer`, dynamic `.modal-overlay` elements, and `#cashierPlateMount` / `#egyptianPlatePickerMount`.
- Attaches document-level click and keyboard escape listeners.

## Verification
- Run: Interactive verification via `http://localhost:8080/index.html` or automated headless browser check.
