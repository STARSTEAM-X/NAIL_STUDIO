import { designDocumentSchema, type DesignDocument } from '@nail-studio/contracts'

/** ตรวจ schema ก่อนแปลง เพื่อไม่ให้ไฟล์งานที่เสียหลุดออกจากระบบโดยเงียบ ๆ */
export function exportProjectJson(document: DesignDocument): string {
  return JSON.stringify(designDocumentSchema.parse(document), null, 2)
}
