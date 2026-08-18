import { Link } from 'react-router-dom'
import type { Appointment } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { formatAppointmentTime, formatDuration } from '@/lib/datetime.ts'
import { AppointmentStatusBadge } from './AppointmentStatusBadge.tsx'

/** การ์ดนัดหมายหนึ่งรายการในลิสต์ */
export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  return (
    <li>
      <Link to={`/appointments/${appointment.id}`} className="ap-card">
        <div className="ap-card-head">
          <strong>{appointment.shopName}</strong>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <p className="ap-card-service">{appointment.serviceName ?? 'บริการที่กำหนดเอง'}</p>
        <div className="ap-card-meta">
          <span>
            <Icon name="calendar" size={14} />
            {appointment.agreedStartAt ? formatAppointmentTime(appointment.agreedStartAt) : 'ยังไม่ได้ตกลงเวลา'}
          </span>
          <span>
            <Icon name="clock" size={14} />
            {formatDuration(appointment.durationMinutes)}
          </span>
        </div>
      </Link>
    </li>
  )
}
