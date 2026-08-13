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

  it('runs the post-save reconciliation only after the explicit save succeeds', async () => {
    const events: string[] = []
    const gate = createAutosavePersistenceGate()

    await gate.runExclusive(async () => {
      events.push('version persisted')
      return 2
    }, () => { events.push('autosave reconciled') })

    expect(events).toEqual(['version persisted', 'autosave reconciled'])
  })

  it('serializes two explicit save requests instead of running them concurrently', async () => {
    let finishFirst!: () => void
    const firstPending = new Promise<void>((resolve) => { finishFirst = resolve })
    const events: string[] = []
    const gate = createAutosavePersistenceGate()

    const first = gate.runExclusive(async () => {
      events.push('first start')
      await firstPending
      events.push('first end')
    })
    const second = gate.runExclusive(async () => { events.push('second start') })
    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['first start'])

    finishFirst()
    await Promise.all([first, second])
    expect(events).toEqual(['first start', 'first end', 'second start'])
  })
})
