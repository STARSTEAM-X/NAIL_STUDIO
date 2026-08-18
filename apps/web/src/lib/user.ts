import type { PublicUser } from '@nail-studio/contracts'

/**
 * ป้ายบทบาทผู้ใช้ — แหล่งความจริงเดียวของทั้งแอป
 *
 * ก่อนหน้านี้ตารางนี้ถูกคัดลอกไว้สามที่ (ProfilePage, PublicProfilePage, EditorProfileDropdown)
 * การเพิ่มบทบาทใหม่จึงต้องไล่แก้ทุกที่และมักลืมที่ใดที่หนึ่งเสมอ
 */
export const ROLE_LABELS: Record<PublicUser['role'], string> = {
  user: 'ผู้ใช้งานทั่วไป',
  shop: 'ร้านทำเล็บ',
  admin: 'ผู้ดูแลระบบ',
}

/** ป้ายบทบาทแบบสั้นสำหรับพื้นที่แคบ เช่น เมนูโปรไฟล์ */
export const ROLE_SHORT_LABELS: Record<PublicUser['role'], string> = {
  user: 'ผู้ใช้งาน',
  shop: 'ร้านทำเล็บ',
  admin: 'ผู้ดูแลระบบ',
}

/** ตัวอักษรย่อสำหรับอวาตาร์ — รองรับทั้งชื่อเดี่ยวและชื่อ-นามสกุล */
export function getInitials(displayName: string | undefined | null): string {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length > 1) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() || 'NS'
}

/**
 * สีอวาตาร์ต้องคงที่ต่อผู้ใช้หนึ่งคน ไม่ใช่สุ่มใหม่ทุกครั้งที่ re-render
 * จึงคำนวณจาก hash ของ id แทนการสุ่ม
 */
export function avatarGradient(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360
  }
  return `linear-gradient(145deg, hsl(${hash} 45% 32%), hsl(${(hash + 28) % 360} 58% 62%))`
}

export function isShop(user: PublicUser | null | undefined): boolean {
  return user?.role === 'shop'
}

export function isAdmin(user: PublicUser | null | undefined): boolean {
  return user?.role === 'admin'
}
