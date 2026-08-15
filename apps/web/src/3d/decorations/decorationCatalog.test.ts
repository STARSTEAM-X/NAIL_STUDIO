import { describe, expect, it } from 'vitest'
import { BufferGeometry } from 'three'
import { catalogEntry, DECORATION_CATALOG } from './decorationCatalog.ts'

describe('decorationCatalog', () => {
  it('has at least one entry with a unique id, label, and positive default scale', () => {
    expect(DECORATION_CATALOG.length).toBeGreaterThanOrEqual(30)
    const ids = new Set(DECORATION_CATALOG.map((entry) => entry.id))
    expect(ids.size).toBe(DECORATION_CATALOG.length)
    for (const entry of DECORATION_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.defaultColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(entry.metalness).toBeGreaterThanOrEqual(0)
      expect(entry.metalness).toBeLessThanOrEqual(1)
      expect(entry.roughness).toBeGreaterThanOrEqual(0)
      expect(entry.roughness).toBeLessThanOrEqual(1)
      expect(entry.defaultScale).toBeGreaterThan(0)
      // ต้องเล็กพอที่จะไม่ใหญ่กว่าเล็บตอน scale สูงสุด (1.0) — เคยตั้งค่าผิดมาแล้วครั้งหนึ่ง
      expect(entry.defaultScale).toBeLessThan(0.01)
    }
  })

  it('covers every catalog category with multiple authored assets', () => {
    const counts = new Map<string, number>()
    for (const entry of DECORATION_CATALOG) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1)
    expect(counts.size).toBe(5)
    for (const count of counts.values()) expect(count).toBeGreaterThanOrEqual(3)
  })

  it('geometry() returns a fresh BufferGeometry instance each call', () => {
    for (const entry of DECORATION_CATALOG) {
      const first = entry.geometry()
      const second = entry.geometry()
      expect(first).toBeInstanceOf(BufferGeometry)
      expect(first).not.toBe(second)
      first.dispose()
      second.dispose()
    }
  })

  it('catalogEntry finds an existing id and returns undefined for an unknown one', () => {
    const known = DECORATION_CATALOG[0]!
    expect(catalogEntry(known.id)).toBe(known)
    expect(catalogEntry('does-not-exist')).toBeUndefined()
  })
})
