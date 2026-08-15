import { fileTypeFromBuffer } from 'file-type'

const ALLOWED_THUMBNAIL_TYPES = new Set(['image/webp'])
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024 // 2MB

export async function sniffThumbnailMime(data: Buffer): Promise<string> {
  const detected = await fileTypeFromBuffer(data)
  if (!detected || !ALLOWED_THUMBNAIL_TYPES.has(detected.mime)) {
    throw new Error(`ไฟล์ไม่ใช่ WebP ที่ถูกต้อง (ตรวจ magic bytes ได้: ${detected?.mime ?? 'ไม่รู้จัก'})`)
  }
  return detected.mime
}
