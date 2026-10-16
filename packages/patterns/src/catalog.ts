/**
 * ข้อมูลอ้างอิงที่ AI ต้องรู้ แต่อยู่ในโค้ดฝั่งเว็บที่ผูกกับ three.js (import ตรงไม่ได้)
 *
 * - DECORATIONS: ต้องตรงกับ apps/web/src/3d/decorations/decorationCatalog.ts —
 *   apps/mcp มีเทสที่อ่านไฟล์นั้นแล้วเทียบ id ทุกตัว ถ้าเว็บเพิ่ม/ลบชิ้น เทสจะเตือน
 * - PALETTES: ยกจาก apps/web/src/3d/generation/composer.ts
 */

export interface DecorationInfo {
  id: string
  label: string
  category: 'gemstone' | 'metal' | 'pearl' | 'motif' | 'ribbon'
}

export const DECORATIONS: readonly DecorationInfo[] = [
  { id: 'gem-diamond', label: 'เพชรทรงเหลี่ยม', category: 'gemstone' },
  { id: 'gem-round', label: 'เพชรกลม', category: 'gemstone' },
  { id: 'gem-princess', label: 'เพชรสี่เหลี่ยม', category: 'gemstone' },
  { id: 'gem-cushion', label: 'เพชรคุชชั่น', category: 'gemstone' },
  { id: 'gem-emerald', label: 'มรกต', category: 'gemstone' },
  { id: 'gem-sapphire', label: 'แซฟไฟร์', category: 'gemstone' },
  { id: 'gem-ruby', label: 'ทับทิม', category: 'gemstone' },
  { id: 'gem-crystal', label: 'คริสตัลยอดแหลม', category: 'gemstone' },
  { id: 'metal-hoop', label: 'ห่วงกลม', category: 'metal' },
  { id: 'metal-double-hoop', label: 'ห่วงคู่', category: 'metal' },
  { id: 'metal-square-hoop', label: 'ห่วงเหลี่ยม', category: 'metal' },
  { id: 'metal-bar', label: 'แท่งทอง', category: 'metal' },
  { id: 'metal-bar-double', label: 'แท่งคู่', category: 'metal' },
  { id: 'metal-stud', label: 'หมุดเงิน', category: 'metal' },
  { id: 'metal-knot', label: 'ปมโลหะ', category: 'metal' },
  { id: 'pearl-single', label: 'ไข่มุกเดี่ยว', category: 'pearl' },
  { id: 'pearl-cabochon', label: 'ไข่มุกรี', category: 'pearl' },
  { id: 'pearl-drop', label: 'ไข่มุกหยดน้ำ', category: 'pearl' },
  { id: 'motif-heart', label: 'หัวใจ', category: 'motif' },
  { id: 'motif-star', label: 'ดาวห้าแฉก', category: 'motif' },
  { id: 'motif-moon', label: 'พระจันทร์เสี้ยว', category: 'motif' },
  { id: 'motif-bolt', label: 'สายฟ้า', category: 'motif' },
  { id: 'motif-leaf', label: 'ใบไม้', category: 'motif' },
  { id: 'motif-butterfly', label: 'ผีเสื้อ', category: 'motif' },
  { id: 'motif-crown', label: 'มงกุฎ', category: 'motif' },
  { id: 'motif-flower', label: 'ดอกไม้', category: 'motif' },
  { id: 'motif-orbit', label: 'วงแหวนซ้อน', category: 'motif' },
  { id: 'ribbon-bow', label: 'โบว์', category: 'ribbon' },
  { id: 'ribbon-knot', label: 'ริบบิ้นปม', category: 'ribbon' },
  { id: 'ribbon-wave', label: 'ริบบิ้นคลื่น', category: 'ribbon' },
  { id: 'ribbon-loop', label: 'ริบบิ้นห่วง', category: 'ribbon' },
]

export const PALETTES: Readonly<Record<string, readonly string[]>> = {
  'pal-nude-rose': ['#E0A884', '#E8B7A8', '#D98C9A', '#D4AF37'],
  'pal-berry-night': ['#B3122E', '#A96478', '#1D1D2C', '#F8F6F2'],
  'pal-sage-sky': ['#A7B59A', '#3D7EA6', '#F8F6F2'],
  'pal-sunset-coral': ['#E26D5A', '#E98B4A', '#F3D56B'],
  'pal-lavender-milk': ['#A58CBD', '#F3C7CF', '#F8F6F2'],
  'pal-mocha-gold': ['#9A6A53', '#7A4B3A', '#E5C07B'],
  'pal-monochrome-ink': ['#1A1A1A', '#2E3540', '#5A6472', '#F8F6F2'],
  'pal-clear-gold': ['#FFFDF8', '#C8A24A', '#E5C07B', '#1A1A1A'],
}

/** กฎจากการทดสอบบนโมเดลจริง — ใส่ไว้ใน description ของ tool และ resource ให้ AI เห็นเสมอ */
export const DESIGN_RULES = `ระบบพิกัด: u 0–1 แนวขวาง, v = 0 ปลายเล็บ → v = 1 โคนเล็บ (ทุกนิ้วเหมือนกัน)
พื้นที่มองเห็นจริง u 0.2–0.8, v 0.05–0.95 — ลายที่ชิดขอบเกินไปจะหาย
แสงใน editor ทำให้สีอ่อนลง: สีพื้นควรอิ่ม/เข้มกว่ารูปต้นฉบับเล็กน้อย (นู้ดใช้ราว #dfaaa2 ไม่ใช่ #f1d4cf)
สีอ่อนบนพื้นสีอ่อนแทบมองไม่เห็น — วางลายสีอ่อนบนชั้นสีรอง (เช่น gradient) ก่อน
editor แสดงมือขวาเป็นค่าเริ่มต้น — ลายเด่นควรอยู่มือขวา (คีย์ชื่อนิ้วใช้ทั้งสองมือ, มือซ้ายถูก mirror ให้)
ไล่สีใช้ gradient / french soft:true จะเนียนกว่าแถบเดี่ยว
ลายหนาแน่น (glitter, tortoise) ใช้ได้ไม่เกิน ~2 ลายต่อเล็บ (เพดาน 6 เลเยอร์ × 500 stroke)`
