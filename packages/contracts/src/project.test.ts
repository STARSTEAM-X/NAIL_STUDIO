import { describe, expect, it } from 'vitest'
import { projectSummarySchema } from './project.ts'

describe('projectSummarySchema', () => {
  it('requires hasThumbnail as a boolean', () => {
    const valid = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Test',
      status: 'draft',
      versionCount: 1,
      hasThumbnail: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect(projectSummarySchema.safeParse(valid).success).toBe(true)
    expect(projectSummarySchema.safeParse({ ...valid, hasThumbnail: undefined }).success).toBe(false)
  })
})
