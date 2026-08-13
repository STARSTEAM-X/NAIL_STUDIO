import { describe, expect, it } from 'vitest'
import { isDesignVersionNumberConflict } from './repository.ts'

describe('DesignVersion unique-race classification', () => {
  it('matches only the composite project/version target', () => {
    expect(isDesignVersionNumberConflict({
      code: 'P2002',
      meta: { modelName: 'DesignVersion', target: ['project_id', 'version_number'] },
    })).toBe(true)

    expect(isDesignVersionNumberConflict({
      code: 'P2002',
      meta: { modelName: 'User', target: ['email'] },
    })).toBe(false)
  })

  it('recognizes the PostgreSQL composite constraint but rejects unrelated constraints', () => {
    expect(isDesignVersionNumberConflict({
      code: 'P2002',
      meta: { constraint: 'design_versions_project_id_version_number_key' },
    })).toBe(true)
    expect(isDesignVersionNumberConflict({
      code: 'P2002',
      meta: { constraint: 'users_email_key' },
    })).toBe(false)
  })

  it('recognizes Prisma driver-adapter field metadata from the real PostgreSQL race', () => {
    expect(isDesignVersionNumberConflict({
      code: 'P2002',
      meta: {
        modelName: 'DesignVersion',
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { fields: ['project_id', 'version_number'] },
          },
        },
      },
    })).toBe(true)

    expect(isDesignVersionNumberConflict({
      code: 'P2002',
      meta: {
        modelName: 'User',
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { fields: ['email'] },
          },
        },
      },
    })).toBe(false)
  })
})
