# Slice 3 — Layers, Materials, History, Versions, and Offline Drafts

**Date:** 2026-08-13  
**Status:** Approved  
**Scope:** Slice 3, weeks 8–10

## Goal

Deliver a complete five-nail editing workflow for the currently editable right hand: layer management, pooled nail materials, delta-based undo/redo, immutable version history, offline draft recovery, and safe conflict handling.

The document schema continues to preserve all ten nails. Commands described as “apply to all nails” affect only the five editable right-hand nails defined by `EDITABLE_NAILS`; left-hand nail data must remain unchanged.

## Scope

### Included

- Add, rename, remove, hide, show, reorder, and select nail layers.
- Change layer opacity and blend mode (`normal`, `multiply`, `screen`).
- Enforce one to six layers per nail and singleton layer-kind rules when singleton kinds are introduced.
- Support the four existing finishes: `glossy`, `matte`, `chrome`, and `glitter`.
- Reuse equivalent Three.js materials through a reference-counted `MaterialPool`.
- Replace direct document mutation paths with delta-based commands and a 100-entry ring-buffer history.
- Support undo, redo, 500 ms command coalescing, composite commands, keyboard shortcuts, and action labels.
- List, load, and label immutable project versions.
- Load an older version into the editor as a new draft without modifying the stored version.
- Duplicate the current document into a new project.
- Persist browser-local drafts in IndexedDB and offer explicit recovery when a local draft is newer.
- Resolve optimistic-concurrency conflicts without force overwrite.
- Measure command-history memory against snapshot-history memory and record the result.

### Excluded

- Editing or displaying the left hand.
- Decorations, nail shape morphing, hand proportions, thumbnails, and exporters from Slice 4.
- Collaborative editing, CRDTs, event sourcing, and force overwrite.
- Changing an immutable historical version in place.

## Architecture

### Command history

History is independent of Zustand and React.

- `apps/web/src/3d/history/Command.ts` defines the command contract. A command exposes `do(document)`, `undo(document)`, `label`, `affects`, and an optional `mergeKey`/merge operation.
- `apps/web/src/3d/history/HistoryStack.ts` owns undo and redo ring buffers capped at 100 entries. Executing a new command after undo clears redo history.
- `apps/web/src/3d/history/commands/` contains focused commands for strokes, nail appearance, layer operations, and apply-to-all behavior.
- `CompositeCommand` groups multiple commands into one history item. Its `do` order is forward and its `undo` order is reverse.
- Consecutive mergeable commands with the same `mergeKey` inside 500 ms retain the first `before` value and latest `after` value.

Commands are pure document transformations. They store only the delta required to reverse their own operation, never a cloned `DesignDocument`. A command that produces no document change is not recorded and does not increment the editor revision.

### Store integration

`designStore.ts` coordinates the command engine with UI state.

- All actions that change `DesignDocument` execute a command.
- Selection, focus, active tool, and other view-only state stay outside history.
- Each successful execute, undo, or redo increments `revision` once.
- The command’s `affects` set identifies nails whose textures must be rebuilt.
- Loading a server document clears history because commands from a different document base cannot be replayed safely.
- Active layers are stored by nail key and layer ID, not by one global array index. Removing or reordering layers therefore cannot silently point the editor at a different layer.

### Layer system

`LayerPanel.tsx` provides layer selection and controls for name, visibility, opacity, blend mode, order, creation, and deletion.

- Each nail always has at least one layer and no more than six.
- Deleting the active layer selects the nearest surviving layer.
- Reordering preserves the active layer by ID.
- Operations apply to the selected editable nails only when the UI explicitly presents a multi-nail action. Ordinary layer selection remains local to the primary selected nail.
- Invalid operations leave the document unchanged and produce a Thai notice.

The existing texture compositor remains the rendering authority. Layer visibility, opacity, blend, and order feed its current layer compositing path.

### Material pool

`apps/web/src/3d/materials/MaterialPool.ts` caches materials by a stable key derived from finish and all shader-relevant options.

- `acquire(key, factory)` returns an existing material or creates one and increments its reference count.
- `release(key)` decrements the count and disposes the material at zero.
- `disposeAll()` releases remaining GPU resources during scene teardown.
- Nail meshes never dispose pooled materials directly.

The existing finish definitions remain the single source of visual parameters.

### Version API and UI

The projects API adds owner-scoped operations for:

- listing version metadata without selecting the document JSON;
- loading one version by version number;
- updating a version label;
- duplicating a project from the editor’s current document.

Historical versions remain immutable except for their label. Loading a historical version places its document in the editor as a new unsaved draft based on the latest server version. Saving creates the next version through the existing optimistic-concurrency endpoint.

`VersionHistoryPanel.tsx` lists version number, label, creation time, and document size. It supports load, rename, and duplicate actions.

### Offline drafts

`offlineDraft.ts` uses native IndexedDB and adds no runtime dependency. Records are keyed by authenticated user ID and project ID and contain:

- `document`;
- `baseVersion`;
- `revision`;
- `updatedAt`.

Local writes are debounced after document changes. IndexedDB failure does not stop server autosave or editing; the UI reports that local offline backup is unavailable.

When opening a project, the client compares the local record with server draft/version data. If the local record is newer, a recovery dialog requires the user to choose:

- **Recover local draft:** load it into the editor and keep it eligible for autosave;
- **Use server version:** delete only that project’s local record and load server data.

No recovery decision is automatic.

### Conflict handling

Version saves and draft autosaves continue to send their expected/base version. On HTTP 409, the editor stops automatic retries and presents two explicit options:

- **Load latest server version:** discard the conflicting in-memory/local draft only after user confirmation, fetch the latest server document, and clear history;
- **Duplicate current work:** create a new project containing the current in-memory document, navigate to the copy, and preserve the original project.

There is no force-overwrite action.

## Data Flow

### Edit, undo, and autosave

1. A UI event constructs a typed command.
2. The store sends it to `HistoryStack.execute`.
3. The command returns the next document and affected nail keys.
4. The store commits the document, increments `revision` once, and publishes history labels/state.
5. Texture consumers rebuild affected nails.
6. Server autosave and IndexedDB persistence observe the new revision independently.

Undo and redo follow the same path using the command’s inverse/forward transformation. They are normal document changes and therefore trigger texture rebuild and draft persistence.

### Version loading

1. The user selects a historical version.
2. The client fetches that version after owner authorization.
3. The document is loaded as a new draft while the save base remains the latest server version.
4. History is cleared.
5. A later save creates a new immutable version; it never edits the selected historical row.

## User Interface

- `LayerPanel` appears alongside the existing paint toolbar and remains usable with keyboard navigation.
- `HistoryControls` exposes Undo/Redo buttons and the next action label, such as “เลิกทำ: เปลี่ยนสีเล็บ”.
- Supported shortcuts are `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`, and `Ctrl/Cmd+Shift+Z`. Shortcuts do not fire while a text input, textarea, select, or contenteditable element owns focus.
- Recovery and conflict dialogs require an explicit button selection and have no destructive default.
- Notices and validation errors are written in Thai, matching the existing UI.

## Error Handling and Invariants

- History never exceeds 100 commands.
- A no-op command does not enter history.
- A new command after undo invalidates redo.
- Every editable nail always has one to six layers.
- Layer IDs remain unique within a nail.
- The active layer ID always resolves to a layer; otherwise the store repairs it to the nearest valid layer.
- Left-hand document data is byte-for-byte structurally equal before and after five-nail bulk commands.
- Material references never become negative; unknown releases are safe no-ops in production and detectable in tests.
- IndexedDB errors are isolated from server persistence.
- HTTP 401 follows the existing authentication flow; HTTP 403/404 show the existing API error; HTTP 409 enters the conflict flow.

## Testing Strategy

Development follows red-green-refactor for each behavior.

### Unit and property tests

- Every command is tested with `do` followed by `undo`, asserting deep equality of every document field.
- Commands cover no-op behavior, affected nail keys, labels, five-nail bulk scope, and preservation of left-hand data.
- `HistoryStack` covers the 100-entry ring buffer, undo/redo, redo invalidation, 500 ms merging, and composite ordering.
- Layer tests cover limits, deletion of the final layer, reordering, active-layer repair, visibility, opacity, blend, and naming.
- `MaterialPool` tests cover equivalent-key reuse, reference counts, zero-count disposal, and teardown.
- IndexedDB tests use a real browser IndexedDB implementation where available and a narrow storage adapter for deterministic unit tests.

### API and integration tests

- Version list responses omit document JSON and enforce owner isolation.
- Version load, label update, duplication, and stale-version 409 behavior are covered through HTTP integration tests.
- Store integration tests cover command execution, revision changes, autosave-visible state, and keyboard shortcut guards.
- Recovery tests cover both user choices and IndexedDB failure fallback.
- Conflict tests cover loading the latest server version and duplicating the current document.

### Verification and measurement

- Run all workspace tests, TypeScript checks, and the production build.
- Perform a heap comparison between 100 delta commands and 100 full-document snapshots using the same representative design document.
- Record method, environment, raw measurements, and conclusion under M4 in `docs/performance.md`.
- Slice 3 is complete only when 100 sequential undo/redo operations preserve correct state and a two-tab stale save produces a visible 409 recovery choice.

## Delivery Order

1. Command contract, ring buffer, and foundational commands.
2. Store integration, shortcuts, and history controls.
3. Layer commands and `LayerPanel`.
4. Material pooling and scene integration.
5. Version contracts, API endpoints, and history UI.
6. IndexedDB persistence, recovery dialog, and 409 conflict dialog.
7. Heap measurement, full verification, and documentation updates.

