import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '@/api/client.ts'
import { autosaveFailureFromError, createAutosaveAttemptState, createAutosavePersistenceGate } from './useAutosave.ts'

function apiError(status: number): ApiRequestError {
  return new ApiRequestError(status, {
    success: false,
    error: {
      code: status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR',
      message: 'server diagnostic',
      requestId: 'request-autosave',
    },
  })
}

describe('autosave failures', () => {
  it('preserves a 409 as an autosave conflict without a retry message', () => {
    expect(autosaveFailureFromError(apiError(409))).toEqual({
      conflict: { kind: 'server-version-conflict', source: 'autosave' },
      message: null,
    })
  })

  it('keeps ordinary failures non-conflicting and Thai-localized', () => {
    expect(autosaveFailureFromError(apiError(500))).toEqual({
      conflict: null,
      message: 'บันทึกอัตโนมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    })
  })

  it('blocks visibility and cleanup resends after a 409 conflict', () => {
    const attempts = createAutosaveAttemptState(0, 4)

    expect(attempts.start(1, 4, 'debounce')).toBe(true)
    attempts.fail(4, true)

    expect(attempts.start(1, 4, 'visibility')).toBe(false)
    expect(attempts.start(1, 4, 'cleanup')).toBe(false)
  })

  it('allows the dirty revision again after the save base transitions', () => {
    const attempts = createAutosaveAttemptState(0, 4)
    expect(attempts.start(1, 4, 'debounce')).toBe(true)
    attempts.fail(4, true)

    attempts.transitionBaseVersion(5)

    expect(attempts.start(1, 5, 'debounce')).toBe(true)
  })

  it('reports a newer revision that arrived while the saved revision was in flight', () => {
    const attempts = createAutosaveAttemptState(0, 1)
    expect(attempts.start(1, 1, 'debounce')).toBe(true)

    expect(attempts.succeed(1, 2)).toBe(true)
    expect(attempts.needsSave(2)).toBe(true)
  })
})

describe('autosave persistence ordering', () => {
  it('waits for an in-flight draft before starting an explicit version save', async () => {
    let finishDraft!: () => void
    const draft = new Promise<void>((resolve) => { finishDraft = resolve })
    const events: string[] = []
    const gate = createAutosavePersistenceGate()
    gate.track(draft.then(() => { events.push('draft settled') }))

    const explicit = gate.runExclusive(async () => {
      events.push('version started')
      return 2
    })
    await Promise.resolve()
    expect(events).toEqual([])
    expect(gate.isPaused()).toBe(true)

    finishDraft()
    await expect(explicit).resolves.toBe(2)
    expect(events).toEqual(['draft settled', 'version started'])
    expect(gate.isPaused()).toBe(false)
  })

  it('reconciles the revision snapshot captured for the version request, not a later live revision', async () => {
    let finishVersion!: () => void
    const versionPending = new Promise<void>((resolve) => { finishVersion = resolve })
    let liveRevision = 1
    let liveDocument = { marker: 'version-request' }
    let reconciledRevision: number | null = null
    let persistedDocument: { marker: string } | null = null
    const attempts = createAutosaveAttemptState(0, 1)
    const gate = createAutosavePersistenceGate()

    const saving = gate.runExclusive(async () => {
      const capturedRevision = liveRevision
      const capturedDocument = liveDocument
      await versionPending
      return { capturedRevision, capturedDocument }
    }, ({ capturedRevision, capturedDocument }) => {
      reconciledRevision = capturedRevision
      persistedDocument = capturedDocument
      attempts.succeed(capturedRevision, liveRevision)
    })
    await Promise.resolve()
    liveRevision = 2
    liveDocument = { marker: 'newer-edit' }
    finishVersion()
    await saving

    expect(reconciledRevision).toBe(1)
    expect(persistedDocument).toEqual({ marker: 'version-request' })
    expect(attempts.needsSave(2)).toBe(true)
  })

  it('deduplicates a second explicit save while the first waits for an in-flight draft', async () => {
    let finishDraft!: () => void
    const draftPending = new Promise<void>((resolve) => { finishDraft = resolve })
    let versionCalls = 0
    const gate = createAutosavePersistenceGate()
    gate.track(draftPending)

    const first = gate.runExclusive(async () => { versionCalls += 1 })
    const second = gate.runExclusive(async () => { versionCalls += 1 })
    await Promise.resolve()
    expect(versionCalls).toBe(0)

    finishDraft()
    await expect(second).resolves.toBeNull()
    await first
    expect(versionCalls).toBe(1)
  })
})
