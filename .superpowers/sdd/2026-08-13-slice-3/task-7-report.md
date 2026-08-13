# Task 7 Report: IndexedDB Draft Persistence and Recovery

## Result

Implemented browser-local draft persistence with native IndexedDB and explicit recovery decisions.

- Database: `nail-studio`
- Object store: `drafts`
- Key: `${userId}:${projectId}`
- Record: document, base version, revision, and ISO update timestamp
- Writes debounce revision changes and persist the latest snapshot.
- Recovery is offered only when the local record has the same server base version and a later timestamp.
- “Recover local” loads through `designStore.loadDocument`, retaining the record for later persistence.
- “Use server” deletes only the current user/project record, then loads the server document.
- IndexedDB read/write/delete failures become a non-blocking Thai warning; editing and server autosave remain active.
- Autosave HTTP 409 errors remain structured as `source: 'autosave'`, use the existing conflict dialog, and are not retried automatically.

## Lifecycle and race handling

- The persistence effect unsubscribes from the design store and calls `persistence.cancel()` during cleanup, so a pending debounce cannot write after unmount or an identity/project/base-version transition.
- Recovery reads capture an effect-local `active` flag. Cleanup sets it to `false`, preventing a stale IndexedDB result from a previous user, project, or base version from replacing the current recovery state.
- Server-choice loads suppress the single revision produced by `loadDocument`, preventing the just-deleted local record from being recreated automatically.
- IndexedDB operations close their database after the relevant request and transaction settle; the transaction promise closes over only that transaction.

## TDD evidence

### Adapter and recovery RED

Command:

```text
npm test --workspace apps/web -- src/features/design/offlineDraft.test.ts
```

Observed failure: `Cannot find module './offlineDraft.ts'` (feature absent).

### Adapter and recovery GREEN

Focused result after implementation: 12/12 tests passed, covering record replacement, user/project isolation, scoped deletion, request helper resolve/reject, freshness/base-version comparison, both recovery choices, storage rejection, debounce/latest snapshot, and rejected-write warning.

### Autosave conflict RED

Command:

```text
npm test --workspace apps/web -- src/features/design/useAutosave.test.ts
```

Observed failure: `autosaveFailureFromError is not a function` for both structured-conflict and ordinary-error cases.

### Autosave conflict GREEN

Combined focused result: 2 files passed, 14/14 tests passed.

## Final verification

```text
npm test --workspace apps/web
17 test files passed, 181/181 tests passed

npm run typecheck --workspace apps/web
exit 0

npm run build --workspace apps/web
exit 0; 757 modules transformed
```

Vite emitted its existing advisory that the main minified chunk exceeds 500 kB; the build completed successfully.
