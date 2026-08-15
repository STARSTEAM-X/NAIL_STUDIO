import { describe, expect, it } from 'vitest'
import { BufferGeometry } from 'three'
import { catalogEntry, DECORATION_CATALOG } from './decorationCatalog.ts'

describe('decorationCatalog', () => {
  it('has at least one entry with a unique id, label, and positive default scale', () => {
    expect(DECORATION_CATALOG.length).toBeGreaterThan(0)
    const ids = new Set(DECORATION_CATALOG.map((entry) => entry.id))
    expect(ids.size).toBe(DECORATION_CATALOG.length)
    for (const entry of DECORATION_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.defaultScale).toBeGreaterThan(0)
      // ต้องเล็กพอที่จะไม่ใหญ่กว่าเล็บตอน scale สูงสุด (1.0) — เคยตั้งค่าผิดมาแล้วครั้งหนึ่ง
      expect(entry.defaultScale).toBeLessThan(0.01)
    }
  })

  it('geometry() returns a fresh BufferGeometry instance each call', () => {
    const entry = DECORATION_CATALOG[0]!
    const first = entry.geometry()
    const second = entry.geometry()
    expect(first).toBeInstanceOf(BufferGeometry)
    expect(first).not.toBe(second)
  })

  it('catalogEntry finds an existing id and returns undefined for an unknown one', () => {
    const known = DECORATION_CATALOG[0]!
    expect(catalogEntry(known.id)).toBe(known)
    expect(catalogEntry('does-not-exist')).toBeUndefined()
  })
})
