import { randomBytes } from 'node:crypto'
import {
  API_TOKEN_PREFIX,
  MAX_API_TOKENS_PER_USER,
  type ApiTokenSummary,
  type CreatedApiToken,
  type PublicUser,
} from '@nail-studio/contracts'
import { AppError } from '../errors/AppError.ts'
import { hashSessionToken } from '../auth/session.ts'
import { toPublicUser } from '../auth/repository.ts'
import * as repository from './repository.ts'

type TokenRow = Awaited<ReturnType<typeof repository.createToken>>

function toSummary(row: TokenRow): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  }
}

export async function create(userId: string, name: string, expiresInDays: number | null): Promise<CreatedApiToken> {
  if (await repository.countActiveTokens(userId) >= MAX_API_TOKENS_PER_USER) {
    throw AppError.conflict(`มี token ได้สูงสุด ${MAX_API_TOKENS_PER_USER} อัน กรุณายกเลิกอันที่ไม่ใช้ก่อน`)
  }
  // 256 บิตสุ่ม เหมือน session token — เก็บแค่ SHA-256 ลงฐานข้อมูล
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  const row = await repository.createToken({
    userId,
    name,
    prefix: token.slice(0, API_TOKEN_PREFIX.length + 6),
    tokenHash: hashSessionToken(token),
    expiresAt: expiresInDays === null ? null : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
  })
  return { ...toSummary(row), token }
}

export async function list(userId: string): Promise<ApiTokenSummary[]> {
  return (await repository.listTokens(userId)).map(toSummary)
}

export async function revoke(userId: string, id: string): Promise<void> {
  if (await repository.revokeToken(userId, id) === 0) throw AppError.notFound('ไม่พบ token นี้')
}

/** ตรวจ token จาก header Authorization — คืน null ถ้าใช้ไม่ได้ (ไม่มี/ยกเลิก/หมดอายุ) */
export async function resolveToken(token: string): Promise<{ user: PublicUser; tokenId: string } | null> {
  if (!token.startsWith(API_TOKEN_PREFIX)) return null
  const row = await repository.findTokenByHash(hashSessionToken(token))
  if (!row || row.revokedAt) return null
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null
  // บันทึกเวลาใช้ล่าสุดแบบไม่รอ — ล้มก็ไม่ควรทำให้คำขอของผู้ใช้ล้มตาม
  repository.touchToken(row.id).catch(() => undefined)
  return { user: toPublicUser(row.user), tokenId: row.id }
}
