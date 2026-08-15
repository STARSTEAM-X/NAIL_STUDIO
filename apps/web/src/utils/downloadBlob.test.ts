import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, sanitizeFilename } from './downloadBlob.ts'

afterEach(() => vi.unstubAllGlobals())

describe('downloadBlob', () => {
  it('creates, clicks, and cleans up a temporary download link', () => {
    const anchor = { href: '', download: '', click: vi.fn() }
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:download')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild },
    })

    downloadBlob(new Blob(['design']), 'my-design.png')

    expect(anchor.href).toBe('blob:download')
    expect(anchor.download).toBe('my-design.png')
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download')
  })
})

describe('sanitizeFilename', () => {
  it('removes filesystem-reserved characters', () => {
    expect(sanitizeFilename(' nail:/\\*?\"<>| studio ')).toBe('nail studio')
  })

  it('uses a safe fallback when nothing remains', () => {
    expect(sanitizeFilename(' /:*?\"<>| ')).toBe('nail-studio-design')
  })

  it('preserves Thai characters', () => {
    expect(sanitizeFilename('เล็บสวย')).toBe('เล็บสวย')
  })
})
