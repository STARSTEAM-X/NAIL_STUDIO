import { afterEach, describe, expect, it, vi } from 'vitest'
import { nailHulls } from './render.ts'

afterEach(() => { vi.unstubAllEnvs() })

describe('nailHulls', () => {
  it('reads hand.glb from NAIL_STUDIO_HAND_GLB when set (bundled Vercel function)', () => {
    vi.stubEnv('NAIL_STUDIO_HAND_GLB', '/nonexistent/hand.glb')
    expect(() => nailHulls()).toThrow(/ENOENT/)
  })
})
