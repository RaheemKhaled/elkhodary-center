# Synchronization Component (`js/sync`)

## Overview
The `js/sync` package manages bidirectional and offline-first synchronization between the local client (IndexedDB) and external remote backends, primarily Google Apps Script Web App endpoints that bridge to Google Sheets. It tracks connectivity status, buffers pending mutations in a persistent queue, and executes batch flushes.

## Interface

### Exported Singletons
- `syncEngine` (`SyncEngine`): Controller managing background synchronization lifecycles and queue processing.

### Core Methods on `syncEngine`
- `init()`: Attaches browser network event listeners (`online`, `offline`), `db:changed` listener, loads configuration from `settings` store, and schedules a 30-second poll interval.
- `setWebhookUrl(url)`: Updates target Web App URL and triggers sync if online.
- `triggerSync()`: Asynchronously processes pending items in batches of up to 25 items at a time.
- `getPendingCount()`: Returns total items with status `pending` or `failed`.
- `getStatus()`: Returns current telemetry object `{ isOnline, isSyncing, pendingCount, hasWebhook }`.
- `onStatusChange(callback)`: Registers UI subscribers for sync status indicators.

### Payload Schema
Outbound HTTP POST payloads sent to the Google Apps Script endpoint follow the structure:
```json
{
  "action": "sync_batch",
  "deviceId": "DEV-...",
  "operations": [
    {
      "id": "SYNC-OP-...",
      "entityType": "customers",
      "action": "upsert",
      "recordId": "CUST-...",
      "payload": { ... },
      "status": "pending",
      "retries": 0,
      "createdAt": "2026-11-20T15:00:00.000Z"
    }
  ]
}
```

## Invariants
1. **Batch Delivery Limit**: Outbound sync chunks mutations into batches of 25 records maximum (`pending.slice(0, 25)`) to avoid server timeouts.
2. **Network & Webhook Guard**: If `navigator.onLine` is `false` or `webhookUrl` is empty, synchronization attempts are aborted immediately.
3. **Queue Eviction on Success**: Mutations are removed from `syncQueue` only after the remote Google Apps Script Web App returns HTTP 200 with `{ success: true }`.

## Side Effects
- Emits network requests via `fetch()` to external Google Apps Script Web App URL.
- Reads and deletes records from the `syncQueue` IndexedDB store upon successful acknowledgment.
- Dispatches status notifications to registered UI listeners.

## Verification
- Test offline buffering: In browser DevTools (`Network > Offline`), perform a customer update, and confirm record is queued in `syncQueue` with status `pending`.
- Test online batch sync: Re-enable network and call `syncEngine.triggerSync()`; verify HTTP POST batch format and queue deletion.
