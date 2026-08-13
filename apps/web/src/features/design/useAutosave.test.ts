import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '@/api/client.ts'
import { autosaveFailureFromError, createAutosaveAttemptState } from './useAutosave.ts'

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
})
