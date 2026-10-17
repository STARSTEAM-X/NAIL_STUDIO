import type { Nail } from '@nail-studio/contracts'

/**
 * น้ำหนักของ morph target ทุกตัวสำหรับทรง/ความยาวที่เลือก — เรียงตาม targetNames
 *
 * ทรงกับความยาวมาจาก shape key คนละชุดที่บวกกันได้ (ไม่ใช่ทางแยกที่ต้องเลือกอย่างใด
 * อย่างหนึ่ง) เพราะ `hand.glb` ถูกสร้างให้ delta ของ morph เป็นเวกเตอร์ที่บวกกันตรง ๆ
 * (ดูสเปก D-A2) — `round`/`medium` เป็นทรงฐาน ไม่มี target ของตัวเอง จึงไม่เปิดอะไรเลย
 *
 * แยกเป็น pure function (ไม่พึ่ง three) เพื่อให้ภาพตัวอย่างของ MCP ใช้กฎเดียวกับ
 * โมเดลในเว็บ — MCP import ไฟล์นี้ด้วย node ตรง ๆ จึงห้าม import อะไรที่ไม่ใช่ type
 */
export function nailMorphWeights(
  targetNames: readonly string[],
  shape: Nail['shape'],
  length: Nail['length'],
): number[] {
  return targetNames.map((name) =>
    (shape !== 'round' && name === shape) || (length !== 'medium' && name === length) ? 1 : 0)
}
