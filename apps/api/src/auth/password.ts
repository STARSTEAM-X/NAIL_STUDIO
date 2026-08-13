import { hash, verify } from '@node-rs/argon2'

/**
 * พารามิเตอร์ตามคำแนะนำของ OWASP สำหรับ Argon2id
 *
 * memoryCost 19 MiB ต่อการ hash หนึ่งครั้ง — เป็นเหตุผลที่ต้องมี rate limit
 * ที่ /auth/* ด้วยเรื่องทรัพยากร ไม่ใช่แค่กัน brute force:
 * 100 คำขอพร้อมกัน = 1.9 GB RAM (algorithms.md A-15)
 *
 * ต้องวัดเวลาจริงบนเครื่องที่จะ deploy แล้วปรับให้ได้ราว 100 ms (งานใน Slice 8)
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS)
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTIONS)
  } catch {
    // digest ที่เสียหายหรือรูปแบบไม่ถูกต้องต้องถือว่า "ไม่ผ่าน"
    // ไม่ใช่ปล่อย error ขึ้นไปจนกลายเป็น 500 ซึ่งบอกผู้โจมตีว่าบัญชีนี้มีอยู่จริง
    return false
  }
}
