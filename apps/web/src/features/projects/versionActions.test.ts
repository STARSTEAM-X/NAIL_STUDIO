import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '@nail-studio/contracts'
import { ApiRequestError } from '@/api/client.ts'
import {
  buildDuplicateCurrentInput,
  conflictStateFromError,
  loadHistoricalVersion,
} from './versionActions.ts'

function conflictError(status: number) {
  return new ApiRequestError(status, {
    success: false,
    error: {
      code: 'CONFLICT',
      message: 'มีเวอร์ชันใหม่กว่าอยู่บนเซิร์ฟเวอร์',
      requestId: 'request-1',
    },
  })
}

describe('version conflict actions', () => {
  it('maps only a 409 API response to reusable explicit-save conflict state', () => {
    expect(conflictStateFromError(conflictError(409), 'explicit-save')).toEqual({
      kind: 'server-version-conflict',
      source: 'explicit-save',
    })
    expect(conflictStateFromError(conflictError(400), 'explicit-save')).toBeNull()
    expect(conflictStateFromError(new Error('offline'), 'explicit-save')).toBeNull()
  })

  it('loads an old document as a draft without changing the latest server save base', () => {
    const oldDocument = createEmptyDocument()
    oldDocument.hand.skinTone = '#7a5548'
    const loadDocument = vi.fn()

    const result = loadHistoricalVersion(
      { number: 2, document: oldDocument },
      5,
      loadDocument,
    )

    expect(loadDocument).toHaveBeenCalledWith(oldDocument)
    expect(result).toEqual({ loadedVersion: 2, saveBaseVersion: 5 })
  })

  it('builds duplicate input from the current in-memory document at action time', () => {
    const earlierDocument = createEmptyDocument()
    let currentDocument = earlierDocument
    const getCurrentDocument = () => currentDocument
    currentDocument = createEmptyDocument()
    currentDocument.hand.skinTone = '#4f382f'

    const input = buildDuplicateCurrentInput('สำเนางานปัจจุบัน', getCurrentDocument)

    expect(input).toEqual({ name: 'สำเนางานปัจจุบัน', document: currentDocument })
    expect(input.document).not.toBe(earlierDocument)
  })
})
