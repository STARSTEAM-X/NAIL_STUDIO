import type { PublicUser } from '@nail-studio/contracts'
import { prisma } from '../db.ts'

/** แปลงแถวในฐานข้อมูลเป็นรูปแบบที่ส่งออกได้ — ตัด passwordHash ทิ้งที่นี่ที่เดียว */
export interface UserRow {
  id: string
  email: string
  displayName: string
  role: 'user' | 'shop' | 'admin'
  createdAt: Date
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  }
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export function createUser(input: {
  email: string
  passwordHash: string
  displayName: string
  role: 'user' | 'shop'
}) {
  return prisma.user.create({ data: input })
}

export function createSession(input: {
  userId: string
  tokenHash: Uint8Array<ArrayBuffer>
  expiresAt: Date
  userAgent: string | null
}) {
  return prisma.session.create({ data: input })
}

/** ดึง session พร้อมผู้ใช้ในคิวรีเดียว — กัน N+1 ตั้งแต่ต้น (DB-05) */
export function findSessionByTokenHash(tokenHash: Uint8Array<ArrayBuffer>) {
  return prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
}

export function deleteSession(id: string) {
  return prisma.session.delete({ where: { id } })
}

export function touchSession(id: string) {
  return prisma.session.update({ where: { id }, data: { lastSeenAt: new Date() } })
}

export function deleteExpiredSessions(now: Date = new Date()) {
  return prisma.session.deleteMany({ where: { expiresAt: { lt: now } } })
}
