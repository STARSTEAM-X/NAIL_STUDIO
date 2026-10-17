/**
 * ข้อมูลอ้างอิงที่ AI ต้องรู้ แต่อยู่ในโค้ดฝั่งเว็บที่ผูกกับ three.js (import ตรงไม่ได้)
 *
 * - DECORATIONS: ต้องตรงกับ apps/web/src/3d/decorations/decorationCatalog.ts —
 *   apps/mcp มีเทสที่อ่านไฟล์นั้นแล้วเทียบ id ทุกตัว ถ้าเว็บเพิ่ม/ลบชิ้น เทสจะเตือน
 *   ส่วน worldRadius/defaultColor (ใช้วาดภาพตัวอย่าง) ถูกเทียบกับ geometry จริงใน
 *   apps/web/src/3d/decorations/decorationCatalog.test.ts
 * - PALETTES: ยกจาก apps/web/src/3d/generation/composer.ts
 */

export interface DecorationInfo {
  id: string
  label: string
  category: 'gemstone' | 'metal' | 'pearl' | 'motif' | 'ribbon'
  /** รัศมีทรงกลมที่ครอบชิ้นนี้ในหน่วยโลกเมื่อ scale = 1 (= boundingSphere × defaultScale ในเว็บ) */
  worldRadius: number
  defaultColor: string
}

export const DECORATIONS: readonly DecorationInfo[] = [
  { id: 'gem-diamond', label: 'เพชรทรงเหลี่ยม', category: 'gemstone', worldRadius: 0.0016, defaultColor: '#eaf7ff' },
  { id: 'gem-round', label: 'เพชรกลม', category: 'gemstone', worldRadius: 0.00145, defaultColor: '#d9ecff' },
  { id: 'gem-marquise', label: 'เพชรทรงเรือ', category: 'gemstone', worldRadius: 0.00167, defaultColor: '#eaf7ff' },
  { id: 'gem-chaton', label: 'เพชรกลมเจียระไน', category: 'gemstone', worldRadius: 0.000993, defaultColor: '#eaf7ff' },
  { id: 'metal-bead', label: 'ลูกปัดโลหะ', category: 'metal', worldRadius: 0.0006, defaultColor: '#d4af37' },
  { id: 'gem-princess', label: 'เพชรสี่เหลี่ยม', category: 'gemstone', worldRadius: 0.00127, defaultColor: '#f4fbff' },
  { id: 'gem-cushion', label: 'เพชรคุชชั่น', category: 'gemstone', worldRadius: 0.00132, defaultColor: '#f6d9ff' },
  { id: 'gem-emerald', label: 'มรกต', category: 'gemstone', worldRadius: 0.00122, defaultColor: '#49bf8a' },
  { id: 'gem-sapphire', label: 'แซฟไฟร์', category: 'gemstone', worldRadius: 0.00115, defaultColor: '#3e75df' },
  { id: 'gem-ruby', label: 'ทับทิม', category: 'gemstone', worldRadius: 0.00157, defaultColor: '#d64a62' },
  { id: 'gem-crystal', label: 'คริสตัลยอดแหลม', category: 'gemstone', worldRadius: 0.00149, defaultColor: '#b9f2ff' },
  { id: 'metal-hoop', label: 'ห่วงกลม', category: 'metal', worldRadius: 0.00095, defaultColor: '#d4af37' },
  { id: 'metal-double-hoop', label: 'ห่วงคู่', category: 'metal', worldRadius: 0.00103, defaultColor: '#d98f82' },
  { id: 'metal-square-hoop', label: 'ห่วงเหลี่ยม', category: 'metal', worldRadius: 0.00105, defaultColor: '#d8dde5' },
  { id: 'metal-bar', label: 'แท่งทอง', category: 'metal', worldRadius: 0.000909, defaultColor: '#d4af37' },
  { id: 'metal-bar-double', label: 'แท่งคู่', category: 'metal', worldRadius: 0.000764, defaultColor: '#d8dde5' },
  { id: 'metal-stud', label: 'หมุดเงิน', category: 'metal', worldRadius: 0.00072, defaultColor: '#d8dde5' },
  { id: 'metal-knot', label: 'ปมโลหะ', category: 'metal', worldRadius: 0.00078, defaultColor: '#d98f82' },
  { id: 'pearl-single', label: 'ไข่มุกเดี่ยว', category: 'pearl', worldRadius: 0.000986, defaultColor: '#fff4e8' },
  { id: 'pearl-cabochon', label: 'ไข่มุกรี', category: 'pearl', worldRadius: 0.000871, defaultColor: '#f4e2ce' },
  { id: 'pearl-drop', label: 'ไข่มุกหยดน้ำ', category: 'pearl', worldRadius: 0.00113, defaultColor: '#fff1da' },
  { id: 'motif-heart', label: 'หัวใจ', category: 'motif', worldRadius: 0.000901, defaultColor: '#e85d75' },
  { id: 'motif-star', label: 'ดาวห้าแฉก', category: 'motif', worldRadius: 0.000907, defaultColor: '#d4af37' },
  { id: 'motif-moon', label: 'พระจันทร์เสี้ยว', category: 'motif', worldRadius: 0.000883, defaultColor: '#f3d57a' },
  { id: 'motif-bolt', label: 'สายฟ้า', category: 'motif', worldRadius: 0.000898, defaultColor: '#f4c84f' },
  { id: 'motif-leaf', label: 'ใบไม้', category: 'motif', worldRadius: 0.000808, defaultColor: '#69b889' },
  { id: 'motif-butterfly', label: 'ผีเสื้อ', category: 'motif', worldRadius: 0.00079, defaultColor: '#bb7be8' },
  { id: 'motif-crown', label: 'มงกุฎ', category: 'motif', worldRadius: 0.000947, defaultColor: '#d4af37' },
  { id: 'motif-flower', label: 'ดอกไม้', category: 'motif', worldRadius: 0.00084, defaultColor: '#f28fa6' },
  { id: 'motif-orbit', label: 'วงแหวนซ้อน', category: 'motif', worldRadius: 0.000952, defaultColor: '#9aa8bb' },
  { id: 'ribbon-bow', label: 'โบว์', category: 'ribbon', worldRadius: 0.000876, defaultColor: '#e9799a' },
  { id: 'ribbon-knot', label: 'ริบบิ้นปม', category: 'ribbon', worldRadius: 0.000793, defaultColor: '#e8a0bc' },
  { id: 'ribbon-wave', label: 'ริบบิ้นคลื่น', category: 'ribbon', worldRadius: 0.000877, defaultColor: '#c982d8' },
  { id: 'ribbon-loop', label: 'ริบบิ้นห่วง', category: 'ribbon', worldRadius: 0.000852, defaultColor: '#e48aab' },
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
