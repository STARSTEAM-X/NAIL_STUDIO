import { createEmptyDocument, type DesignDocument } from '@nail-studio/contracts'
import { describe, expect, it } from 'vitest'
import { exportProjectJson } from './exportProjectJson.ts'

describe('exportProjectJson', () => {
  it('round-trips a valid design document', () => {
    const document = createEmptyDocument()
    expect(JSON.parse(exportProjectJson(document))).toEqual(document)
  })

  it('rejects an invalid document', () => {
    const invalid = { ...createEmptyDocument(), schemaVersion: 0 } as unknown as DesignDocument
    expect(() => exportProjectJson(invalid)).toThrow()
  })
})
