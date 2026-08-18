import type { Appointment, AppointmentProposal } from '@nail-studio/contracts'

type AppointmentStatus = Appointment['status']
type ProposalStatus = AppointmentProposal['status']
type ProposalActor = AppointmentProposal['proposedBy']

/**
 * ป้ายภาษาไทยของสถานะนัดหมาย
 *
 * เดิมหน้ารายการและหน้ารายละเอียดแสดงค่าดิบจาก API ตรงๆ ผู้ใช้จึงเห็น
 * "counter_offered" หรือ "no_show" ซึ่งอ่านไม่รู้เรื่องสำหรับคนที่ไม่ได้เขียนโค้ด
 */
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'รอร้านตอบรับ',
  counter_offered: 'ร้านเสนอเวลาใหม่',
  confirmed: 'ยืนยันแล้ว',
  declined: 'ร้านปฏิเสธ',
  cancelled: 'ยกเลิกแล้ว',
  completed: 'เสร็จสิ้น',
  no_show: 'ไม่มาตามนัด',
}

/** โทนสีของสถานะ — ใช้กับคลาส .ui-status-* */
export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, 'pending' | 'ok' | 'danger' | 'neutral' | 'info'> = {
  pending: 'pending',
  counter_offered: 'info',
  confirmed: 'ok',
  declined: 'danger',
  cancelled: 'danger',
  completed: 'neutral',
  no_show: 'danger',
}

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'รอการตอบรับ',
  accepted: 'ตกลงแล้ว',
  rejected: 'ถูกปฏิเสธ',
  superseded: 'มีข้อเสนอใหม่แทน',
}

export const PROPOSAL_ACTOR_LABELS: Record<ProposalActor, string> = {
  customer: 'ลูกค้า',
  shop: 'ร้าน',
}

/** สถานะที่ยังรอการตัดสินใจ — ใช้ตัดสินว่าปุ่มไหนควรแสดง */
export function isOpenStatus(status: AppointmentStatus): boolean {
  return status === 'pending' || status === 'counter_offered' || status === 'confirmed'
}
