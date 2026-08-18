import type { Appointment } from '@nail-studio/contracts'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '../labels.ts'

/** ป้ายสถานะนัดหมาย — ภาษาไทยพร้อมสีที่สื่อความหมาย */
export function AppointmentStatusBadge({ status }: { status: Appointment['status'] }) {
  return (
    <span className={`ui-status ui-status-${APPOINTMENT_STATUS_TONES[status]}`}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  )
}
