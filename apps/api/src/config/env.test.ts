import { describe, expect, it } from 'vitest'
import { loadEnv } from './env.ts'

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  WEB_ORIGIN: 'https://nail.example.test',
  SESSION_SECRET: 'x'.repeat(32),
}

describe('loadEnv storage driver', () => {
  it('defaults to local storage and pool size 10', () => {
    expect(loadEnv(base)).toMatchObject({ STORAGE_DRIVER: 'local', DB_POOL_MAX: 10 })
  })

  it('accepts vercel-blob with a token', () => {
    expect(loadEnv({ ...base, STORAGE_DRIVER: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'tok', VERCEL: '1' }))
      .toMatchObject({ STORAGE_DRIVER: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'tok' })
  })

  it('accepts vercel-blob connected through OIDC (store id, no token)', () => {
    expect(loadEnv({ ...base, STORAGE_DRIVER: 'vercel-blob', BLOB_STORE_ID: 'store_x', VERCEL: '1' }))
      .toMatchObject({ STORAGE_DRIVER: 'vercel-blob', BLOB_STORE_ID: 'store_x' })
  })

  it('fails fast when vercel-blob has neither a store id nor a token', () => {
    expect(() => loadEnv({ ...base, STORAGE_DRIVER: 'vercel-blob' })).toThrow('BLOB_STORE_ID')
  })

  it('fails fast when running on Vercel with local disk storage', () => {
    expect(() => loadEnv({ ...base, VERCEL: '1' })).toThrow('STORAGE_DRIVER')
  })
})
