import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, type DesignDocument } from '@nail-studio/contracts'
import {
  createOfflineDraftStore,
  requestToPromise,
  type OfflineDraftBackend,
  type OfflineDraftRecord,
} from './offlineDraft.ts'
import {
  applyOfflineDraftChoice,
  createOfflineDraftRecoveryController,
  createOfflineDraftPersistence,
  inspectOfflineDraft,
  isOfflineDraftNewer,
  clearPendingVersionFallback,
  retainPendingVersionFallback,
} from './useOfflineDraft.ts'

function documentWithColor(color: string): DesignDocument {
  const document = structuredClone(createEmptyDocument())
  document.nails['right.index'].baseColor = color
  return document
}

function record(
  projectId: string,
  revision: number,
  overrides: Partial<OfflineDraftRecord> = {},
): OfflineDraftRecord {
  const userId = overrides.userId ?? 'user-1'
  return {
    key: `${userId}:${projectId}`,
    userId,
    projectId,
    document: documentWithColor(revision === 1 ? '#111111' : '#222222'),
    baseVersion: 4,
    revision,
    updatedAt: revision === 1 ? '2026-08-13T03:00:00.000Z' : '2026-08-13T04:00:00.000Z',
    ...overrides,
  }
}

function memoryBackend(): OfflineDraftBackend {
  const records = new Map<string, OfflineDraftRecord>()
  return {
    get: async (key) => records.get(key) ?? null,
    put: async (draft) => { records.set(draft.key, structuredClone(draft)) },
    delete: async (key) => { records.delete(key) },
  }
}

describe('offline draft adapter', () => {
  it('replaces only the record with the same user and project key', async () => {
    const store = createOfflineDraftStore(memoryBackend())
    await store.put(record('project-a', 1))
    await store.put(record('project-a', 2))

    expect(await store.get('user-1', 'project-a')).toEqual(record('project-a', 2))
  })

  it('isolates records by both user and project', async () => {
    const store = createOfflineDraftStore(memoryBackend())
    const first = record('project-a', 1)
    const otherProject = record('project-b', 2)
    const otherUser = record('project-a', 2, { userId: 'user-2', key: 'ignored-by-adapter' })
    await store.put(first)
    await store.put(otherProject)
    await store.put(otherUser)

    expect(await store.get('user-1', 'project-a')).toEqual(first)
    expect(await store.get('user-1', 'project-b')).toEqual(otherProject)
    expect(await store.get('user-2', 'project-a')).toMatchObject({ userId: 'user-2' })
  })

  it('deletes only the requested user and project record', async () => {
    const store = createOfflineDraftStore(memoryBackend())
    await store.put(record('project-a', 1))
    await store.put(record('project-b', 2))

    await store.delete('user-1', 'project-a')

    expect(await store.get('user-1', 'project-a')).toBeNull()
    expect(await store.get('user-1', 'project-b')).toEqual(record('project-b', 2))
  })

  it('resolves and rejects browser requests through the request wrapper', async () => {
    const success = {} as IDBRequest<string>
    const successPromise = requestToPromise(success)
    Object.defineProperty(success, 'result', { value: 'stored' })
    success.onsuccess?.({} as Event)

    const failure = {} as IDBRequest<string>
    const failurePromise = requestToPromise(failure)
    const storageError = new Error('quota') as DOMException
    Object.defineProperty(failure, 'error', { value: storageError })
    failure.onerror?.({} as Event)

    await expect(successPromise).resolves.toBe('stored')
    await expect(failurePromise).rejects.toBe(storageError)
  })
})

describe('offline draft persistence', () => {
  afterEach(() => vi.useRealTimers())

  it('debounces revisions and stores only the latest document snapshot', async () => {
    vi.useFakeTimers()
    const drafts: OfflineDraftRecord[] = []
    const persistence = createOfflineDraftPersistence({
      store: {
        get: async () => null,
        put: async (draft) => { drafts.push(draft) },
        delete: async () => undefined,
      },
      userId: 'user-1',
      projectId: 'project-a',
      delayMs: 500,
      now: () => new Date('2026-08-13T05:00:00.000Z'),
    })

    persistence.schedule(documentWithColor('#111111'), 4, 1)
    await vi.advanceTimersByTimeAsync(300)
    persistence.schedule(documentWithColor('#222222'), 4, 2)
    await vi.advanceTimersByTimeAsync(499)
    expect(drafts).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(drafts).toEqual([record('project-a', 2, {
      document: documentWithColor('#222222'),
      updatedAt: '2026-08-13T05:00:00.000Z',
      createdAt: '2026-08-13T05:00:00.000Z',
    })])
  })

  it('turns a rejected write into a warning without throwing from the timer', async () => {
    vi.useFakeTimers()
    const warnings: string[] = []
    const persistence = createOfflineDraftPersistence({
      store: {
        get: async () => null,
        put: async () => { throw new Error('blocked') },
        delete: async () => undefined,
      },
      userId: 'user-1',
      projectId: 'project-a',
      delayMs: 500,
      onWarning: (warning) => warnings.push(warning),
    })

    persistence.schedule(documentWithColor('#111111'), 4, 1)
    await vi.advanceTimersByTimeAsync(500)

    expect(warnings).toEqual(['ไม่สามารถสำรองข้อมูลในเครื่องได้ งานยังบันทึกบนเซิร์ฟเวอร์ตามปกติ'])
  })

  it('cancels a pending debounce and ignores the server-load revision before the choice settles', async () => {
    vi.useFakeTimers()
    const writes: OfflineDraftRecord[] = []
    const local = record('project-a', 2)
    const serverDocument = documentWithColor('#eeeeee')
    const persistence = createOfflineDraftPersistence({
      store: {
        get: async () => null,
        put: async (draft) => { writes.push(draft) },
        delete: async () => undefined,
      },
      userId: 'user-1',
      projectId: 'project-a',
      delayMs: 500,
    })
    let controller: ReturnType<typeof createOfflineDraftRecoveryController>
    controller = createOfflineDraftRecoveryController({
      persistence,
      deleteLocal: async () => undefined,
      loadDocument: (document) => {
        controller.schedule(document, 4, 3)
      },
    })
    controller.schedule(local.document, 4, 2)

    await controller.useServer(local, serverDocument)
    await vi.advanceTimersByTimeAsync(500)

    expect(writes).toHaveLength(0)
  })

  it('serializes repeated server choices into one delete and load', async () => {
    let releaseDelete!: () => void
    const deletePending = new Promise<void>((resolve) => { releaseDelete = resolve })
    let deleteCount = 0
    let loadCount = 0
    const persistence = createOfflineDraftPersistence({
      store: memoryBackend(),
      userId: 'user-1',
      projectId: 'project-a',
    })
    const controller = createOfflineDraftRecoveryController({
      persistence,
      deleteLocal: async () => {
        deleteCount += 1
        await deletePending
      },
      loadDocument: () => { loadCount += 1 },
    })
    const local = record('project-a', 2)

    const first = controller.useServer(local, documentWithColor('#eeeeee'))
    const second = controller.useServer(local, documentWithColor('#dddddd'))

    expect(second).toBe(first)
    expect(deleteCount).toBe(1)
    releaseDelete()
    await first
    expect(loadCount).toBe(1)
  })

  it('flushes the latest pending snapshot exactly once when cleanup repeats', async () => {
    vi.useFakeTimers()
    const writes: OfflineDraftRecord[] = []
    const persistence = createOfflineDraftPersistence({
      store: {
        get: async () => null,
        put: async (draft) => { writes.push(draft) },
        delete: async () => undefined,
      },
      userId: 'user-1',
      projectId: 'project-a',
      delayMs: 500,
    })
    const controller = createOfflineDraftRecoveryController({
      persistence,
      deleteLocal: async () => undefined,
      loadDocument: () => undefined,
    })
    controller.schedule(documentWithColor('#222222'), 4, 2)

    await Promise.all([controller.cancel(), controller.cancel()])
    await vi.advanceTimersByTimeAsync(500)

    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ baseVersion: 4, revision: 2 })
  })

  it('marks only edits scheduled after a version save starts as cross-base recovery records', async () => {
    vi.useFakeTimers()
    const writes: OfflineDraftRecord[] = []
    const persistence = createOfflineDraftPersistence({
      store: {
        get: async () => null,
        put: async (draft) => { writes.push(draft) },
        delete: async () => undefined,
      },
      userId: 'user-1',
      projectId: 'project-a',
      delayMs: 500,
      now: () => new Date('2026-08-13T05:00:00.000Z'),
    })
    persistence.schedule(documentWithColor('#111111'), 4, 1)
    persistence.beginVersionSave()
    persistence.schedule(documentWithColor('#222222'), 4, 2)

    await persistence.flush()

    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      revision: 2,
      provenance: 'pending-version-save',
      createdAt: '2026-08-13T05:00:00.000Z',
    })
    persistence.endVersionSave()
    persistence.schedule(documentWithColor('#333333'), 5, 3)
    await persistence.flush()
    expect(writes[1]?.provenance).toBeUndefined()
  })
})

describe('offline draft recovery', () => {
  it.each([
    ['matching base and later timestamp', 4, '2026-08-13T03:30:00.000Z', true],
    ['matching base but older timestamp', 4, '2026-08-13T04:30:00.000Z', false],
    ['stale base despite later timestamp', 5, '2026-08-13T03:30:00.000Z', false],
  ])('%s determines whether the local draft is newer', (_label, baseVersion, updatedAt, expected) => {
    expect(isOfflineDraftNewer(record('project-a', 2), { baseVersion, updatedAt })).toBe(expected)
  })

  it('offers a newer pending-version snapshot after version N+1 exists but detached PUT failed', () => {
    const local = record('project-a', 2, {
      baseVersion: 4,
      provenance: 'pending-version-save',
      createdAt: '2026-08-13T05:00:00.000Z',
    })
    expect(isOfflineDraftNewer(local, {
      baseVersion: 5,
      updatedAt: '2026-08-13T04:59:00.000Z',
    })).toBe(true)
  })

  it('offers a newer pending-version snapshot after a 409 advances the server base', () => {
    const local = record('project-a', 2, {
      baseVersion: 4,
      provenance: 'pending-version-save',
      createdAt: '2026-08-13T05:00:00.000Z',
    })
    expect(isOfflineDraftNewer(local, {
      baseVersion: 7,
      updatedAt: '2026-08-13T04:59:00.000Z',
    })).toBe(true)
  })

  it('still rejects an ordinary draft from a stale base even when its timestamp is newer', () => {
    expect(isOfflineDraftNewer(record('project-a', 2, {
      baseVersion: 4,
      createdAt: '2026-08-13T05:00:00.000Z',
    }), {
      baseVersion: 5,
      updatedAt: '2026-08-13T04:59:00.000Z',
    })).toBe(false)
  })

  it('rejects a pending-version fallback when its createdAt is not newer than the server', () => {
    expect(isOfflineDraftNewer(record('project-a', 2, {
      baseVersion: 4,
      provenance: 'pending-version-save',
      createdAt: '2026-08-13T04:58:00.000Z',
    }), {
      baseVersion: 5,
      updatedAt: '2026-08-13T04:59:00.000Z',
    })).toBe(false)
  })

  it('removes only the matching pending-version fallback after detached persistence succeeds', async () => {
    const store = createOfflineDraftStore(memoryBackend())
    const pending = record('project-a', 2, {
      provenance: 'pending-version-save',
      createdAt: '2026-08-13T05:00:00.000Z',
    })
    await store.put(pending)

    await clearPendingVersionFallback(store, pending)

    expect(await store.get('user-1', 'project-a')).toBeNull()
  })

  it('reconciles a retained fallback to N+1 with a post-outcome createdAt', async () => {
    const store = createOfflineDraftStore(memoryBackend())
    const pending = record('project-a', 2, {
      provenance: 'pending-version-save',
      createdAt: '2026-08-13T04:58:00.000Z',
    })
    await store.put(pending)

    await retainPendingVersionFallback(
      store,
      pending,
      5,
      () => new Date('2026-08-13T05:01:00.000Z'),
    )

    const retained = await store.get('user-1', 'project-a')
    expect(retained).toMatchObject({
      baseVersion: 5,
      createdAt: '2026-08-13T05:01:00.000Z',
      provenance: 'pending-version-save',
    })
    expect(isOfflineDraftNewer(retained!, {
      baseVersion: 5,
      updatedAt: '2026-08-13T05:00:00.000Z',
    })).toBe(true)
  })

  it('recovers the local document only after the recover choice', async () => {
    const store = createOfflineDraftStore(memoryBackend())
    const local = record('project-a', 2)
    await store.put(local)
    let editorDocument = documentWithColor('#ffffff')

    const result = await applyOfflineDraftChoice({
      choice: 'recover-local',
      store,
      record: local,
      serverDocument: documentWithColor('#eeeeee'),
      loadDocument: (document) => { editorDocument = document },
    })

    expect(editorDocument).toEqual(local.document)
    expect(await store.get('user-1', 'project-a')).toEqual(local)
    expect(result.warning).toBeNull()
  })

  it('uses the server document and deletes only the selected local record', async () => {
    const store = createOfflineDraftStore(memoryBackend())
    const local = record('project-a', 2)
    const other = record('project-b', 1)
    const serverDocument = documentWithColor('#eeeeee')
    await store.put(local)
    await store.put(other)
    let editorDocument = local.document

    const result = await applyOfflineDraftChoice({
      choice: 'use-server',
      store,
      record: local,
      serverDocument,
      loadDocument: (document) => { editorDocument = document },
    })

    expect(editorDocument).toEqual(serverDocument)
    expect(await store.get('user-1', 'project-a')).toBeNull()
    expect(await store.get('user-1', 'project-b')).toEqual(other)
    expect(result.warning).toBeNull()
  })

  it('reports storage rejection without changing the usable editor document', async () => {
    const storageError = new Error('IndexedDB blocked')
    const store = createOfflineDraftStore({
      get: async () => { throw storageError },
      put: async () => { throw storageError },
      delete: async () => { throw storageError },
    })
    const serverDocument = documentWithColor('#eeeeee')
    let editorDocument = serverDocument

    const result = await inspectOfflineDraft({
      store,
      userId: 'user-1',
      projectId: 'project-a',
      server: { baseVersion: 4, updatedAt: '2026-08-13T03:30:00.000Z' },
    })

    expect(result.record).toBeNull()
    expect(result.warning).toMatch(/สำรองข้อมูลในเครื่อง/)
    expect(editorDocument).toBe(serverDocument)
  })
})
