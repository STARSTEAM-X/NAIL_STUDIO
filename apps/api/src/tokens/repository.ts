import { prisma } from '../db.ts'

export function countActiveTokens(userId: string, now: Date = new Date()) {
  return prisma.apiToken.count({
    where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  })
}

export function createToken(input: {
  userId: string
  name: string
  prefix: string
  tokenHash: Uint8Array<ArrayBuffer>
  expiresAt: Date | null
}) {
  return prisma.apiToken.create({ data: input })
}

export function listTokens(userId: string) {
  return prisma.apiToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

/** ดึง token พร้อมผู้ใช้ในคิวรีเดียว (เหมือน findSessionByTokenHash) */
export function findTokenByHash(tokenHash: Uint8Array<ArrayBuffer>) {
  return prisma.apiToken.findUnique({ where: { tokenHash }, include: { user: true } })
}

/** ยกเลิกเฉพาะ token ของเจ้าของ — คืนจำนวนแถวที่เปลี่ยน (0 = ไม่ใช่ของผู้ใช้นี้/ไม่มี) */
export async function revokeToken(userId: string, id: string): Promise<number> {
  const result = await prisma.apiToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}

export function touchToken(id: string) {
  return prisma.apiToken.update({ where: { id }, data: { lastUsedAt: new Date() } })
}
