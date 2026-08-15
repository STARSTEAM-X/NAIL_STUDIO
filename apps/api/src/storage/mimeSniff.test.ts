import { describe, expect, it } from 'vitest'
import { MAX_THUMBNAIL_BYTES, sniffThumbnailMime } from './mimeSniff.ts'

// RIFF....WEBPVP8L... — the minimal byte sequence file-type needs to recognize
// a lossless WebP container. Body bytes after the header are irrelevant to detection.
const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x1a, 0x00, 0x00, 0x00, // chunk size (arbitrary, not validated by file-type)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
  0x56, 0x50, 0x38, 0x4c, // "VP8L"
  0x0d, 0x00, 0x00, 0x00, // VP8L chunk size
  0x2f, 0x00, 0x00, 0x00, 0x10, 0x88, 0x88, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
])

describe('sniffThumbnailMime', () => {
  it('accepts a genuine WebP buffer and returns image/webp', async () => {
    await expect(sniffThumbnailMime(VALID_WEBP)).resolves.toBe('image/webp')
  })

  it('rejects a PNG file even if the caller claims it is WebP', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await expect(sniffThumbnailMime(png)).rejects.toThrow(/ไม่ใช่ WebP/)
  })

  it('rejects an empty buffer', async () => {
    await expect(sniffThumbnailMime(Buffer.alloc(0))).rejects.toThrow(/ไม่ใช่ WebP/)
  })

  it('MAX_THUMBNAIL_BYTES is 2MB', () => {
    expect(MAX_THUMBNAIL_BYTES).toBe(2 * 1024 * 1024)
  })
})
