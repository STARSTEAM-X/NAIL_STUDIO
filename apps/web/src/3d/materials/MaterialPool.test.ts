import { describe, expect, it, vi } from 'vitest'
import type { Texture } from 'three'
import { nailMaterialKey } from './finishes.ts'
import { MaterialPool } from './MaterialPool.ts'

describe('MaterialPool', () => {
  it('reuses the material for identical keys', () => {
    const pool = new MaterialPool<string, { dispose(): void }>()
    const material = { dispose: vi.fn() }
    const factory = vi.fn(() => material)

    expect(pool.acquire('glossy:map-1', factory)).toBe(material)
    expect(pool.acquire('glossy:map-1', factory)).toBe(material)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(pool.size()).toBe(1)
  })

  it('creates a separate material for each distinct key', () => {
    const pool = new MaterialPool<string, { dispose(): void }>()
    const first = { dispose: vi.fn() }
    const second = { dispose: vi.fn() }

    expect(pool.acquire('glossy:map-1', () => first)).toBe(first)
    expect(pool.acquire('glossy:map-2', () => second)).toBe(second)
    expect(pool.size()).toBe(2)
  })

  it('keeps nail materials separate by finish, map, and shader structure', () => {
    const pool = new MaterialPool<string, { dispose(): void }>()
    const mapA = { uuid: 'map-a' } as Texture
    const mapB = { uuid: 'map-b' } as Texture
    const sparkleA = { uuid: 'sparkle-a' } as Texture
    const sparkleB = { uuid: 'sparkle-b' } as Texture
    const materialA = { dispose: vi.fn() }
    const materialB = { dispose: vi.fn() }
    const materialC = { dispose: vi.fn() }
    const materialD = { dispose: vi.fn() }

    expect(pool.acquire(nailMaterialKey('glossy', mapA, null), () => materialA)).toBe(materialA)
    expect(pool.acquire(nailMaterialKey('glossy', mapB, null), () => materialB)).toBe(materialB)
    expect(pool.acquire(nailMaterialKey('glitter', mapA, sparkleA), () => materialC)).toBe(materialC)
    expect(pool.acquire(nailMaterialKey('glitter', mapA, sparkleB), () => materialD)).toBe(materialD)
    expect(pool.size()).toBe(4)
  })

  it('keeps a twice-acquired material until its final release', () => {
    const pool = new MaterialPool<string, { dispose(): void }>()
    const material = { dispose: vi.fn() }

    pool.acquire('glossy:map-1', () => material)
    pool.acquire('glossy:map-1', () => material)
    pool.release('glossy:map-1')

    expect(material.dispose).not.toHaveBeenCalled()
    expect(pool.size()).toBe(1)

    pool.release('glossy:map-1')

    expect(material.dispose).toHaveBeenCalledTimes(1)
    expect(pool.size()).toBe(0)
  })

  it('safely ignores a release for an unknown key', () => {
    const pool = new MaterialPool<string, { dispose(): void }>()

    expect(() => pool.release('missing')).not.toThrow()
    expect(pool.size()).toBe(0)
  })

  it('disposes each remaining material once', () => {
    const pool = new MaterialPool<string, { dispose(): void }>()
    const first = { dispose: vi.fn() }
    const second = { dispose: vi.fn() }

    pool.acquire('glossy:map-1', () => first)
    pool.acquire('matte:map-2', () => second)
    pool.acquire('matte:map-2', () => second)
    pool.disposeAll()

    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(second.dispose).toHaveBeenCalledTimes(1)
    expect(pool.size()).toBe(0)
  })
})
