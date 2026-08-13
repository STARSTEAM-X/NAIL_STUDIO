import type { LoginInput, PublicUser, RegisterInput } from '@nail-studio/contracts'
import { AppError } from '../errors/AppError.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { createSessionToken, hashSessionToken, sessionExpiry } from './session.ts'
import * as repository from './repository.ts'

export interface IssuedSession {
  user: PublicUser
  token: string
  expiresAt: Date
}

/**
 * ค่า hash ของรหัสผ่านหลอก ใช้เผาเวลาให้เท่ากับกรณีที่บัญชีมีอยู่จริง
 *
 * ถ้าไม่ทำ การ login ด้วยอีเมลที่ไม่มีในระบบจะตอบเร็วกว่าอีเมลที่มีอยู่จริงอย่างชัดเจน
 * (เพราะไม่ได้เรียก Argon2 เลย) ผู้โจมตีจึงไล่หาได้ว่าอีเมลไหนสมัครไว้แล้ว
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$T7cIYYiZDPBsBnQmDLNvBcS8kV3lWtIVIvKtEkhaGkQ'

export async function register(input: RegisterInput, userAgent: string | null): Promise<IssuedSession> {
  const existing = await repository.findUserByEmail(input.email)
  if (existing) {
    throw AppError.conflict('อีเมลนี้ถูกใช้สมัครไปแล้ว')
  }

  const passwordHash = await hashPassword(input.password)
  const user = await repository.createUser({
    email: input.email,
    passwordHash,
    displayName: input.displayName,
    role: input.role,
  })

  return issueSession(user, userAgent)
}

export async function login(input: LoginInput, userAgent: string | null): Promise<IssuedSession> {
  const user = await repository.findUserByEmail(input.email)
  const digest = user?.passwordHash ?? DUMMY_HASH
  const ok = await verifyPassword(digest, input.password)

  // ข้อความเดียวกันทั้งกรณีอีเมลผิดและรหัสผ่านผิด — ไม่บอกใบ้ว่าบัญชีมีอยู่จริงหรือไม่
  if (!user || !ok) {
    throw AppError.unauthenticated('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }

  return issueSession(user, userAgent)
}

async function issueSession(
  user: repository.UserRow & { passwordHash?: string },
  userAgent: string | null,
): Promise<IssuedSession> {
  const token = createSessionToken()
  const expiresAt = sessionExpiry()
  await repository.createSession({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent,
  })
  return { user: repository.toPublicUser(user), token, expiresAt }
}

export async function logout(sessionId: string): Promise<void> {
  await repository.deleteSession(sessionId).catch(() => {
    // ลบ session ที่ถูกลบไปแล้วไม่ใช่ข้อผิดพลาด — ผลลัพธ์ที่ผู้ใช้ต้องการคือ "ออกจากระบบ"
    // ซึ่งเป็นจริงอยู่แล้ว จึงทำให้ endpoint นี้เป็น idempotent
  })
}

export interface ResolvedSession {
  user: PublicUser
  sessionId: string
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const session = await repository.findSessionByTokenHash(hashSessionToken(token))
  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await repository.deleteSession(session.id).catch(() => undefined)
    return null
  }

  return { user: repository.toPublicUser(session.user), sessionId: session.id }
}
