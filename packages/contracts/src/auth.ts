import { z } from 'zod'

export const USER_ROLES = ['user', 'shop', 'admin'] as const

/**
 * เกณฑ์รหัสผ่าน: เน้น "ยาว" มากกว่า "ต้องมีอักขระพิเศษ"
 *
 * ข้อกำหนดที่บังคับให้ผสมตัวพิมพ์ใหญ่/สัญลักษณ์ ทำให้คนตั้งรหัสแบบ "Password1!"
 * ซึ่งเดาง่ายกว่าวลียาว ๆ ที่จำได้ — ตามคำแนะนำปัจจุบันของ NIST และ OWASP
 * ความยาวขั้นต่ำ 12 ตัวอักษร และกันไม่ให้ยาวเกินจนเป็นช่องทาง DoS ที่ชั้น hash
 */
export const passwordSchema = z
  .string()
  .min(12, 'รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร')
  .max(128, 'รหัสผ่านยาวเกินไป')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('รูปแบบอีเมลไม่ถูกต้อง')
  .max(254)

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'กรุณาระบุชื่อที่แสดง').max(60),
  role: z.enum(['user', 'shop']).default('user'),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(128),
})

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'กรุณาระบุชื่อที่แสดง').max(60),
})

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
  createdAt: z.string(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type PublicUser = z.infer<typeof publicUserSchema>
