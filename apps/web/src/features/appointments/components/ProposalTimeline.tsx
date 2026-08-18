import type { AppointmentProposal } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { formatAppointmentTime, formatDuration, formatRelativeTime } from '@/lib/datetime.ts'
import { PROPOSAL_ACTOR_LABELS, PROPOSAL_STATUS_LABELS } from '../labels.ts'

const STATUS_TONES: Record<AppointmentProposal['status'], string> = {
  pending: 'ui-status-pending',
  accepted: 'ui-status-ok',
  rejected: 'ui-status-danger',
  superseded: 'ui-status-neutral',
}

/**
 * ไทม์ไลน์การต่อรองเวลา
 *
 * เรียงจากใหม่ไปเก่าเพื่อให้ข้อเสนอล่าสุด — ซึ่งเป็นสิ่งที่ต้องตัดสินใจ — อยู่บนสุดเสมอ
 */
export function ProposalTimeline({ proposals }: { proposals: AppointmentProposal[] }) {
  if (proposals.length === 0) {
    return <p className="muted">ยังไม่มีข้อเสนอเวลา</p>
  }

  const ordered = [...proposals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <ol className="ap-timeline">
      {ordered.map((proposal) => (
        <li key={proposal.id} className={proposal.status === 'pending' ? 'ap-timeline-active' : ''}>
          <span className="ap-timeline-dot" aria-hidden="true" />
          <div className="ap-timeline-body">
            <div className="ap-timeline-head">
              <strong>{PROPOSAL_ACTOR_LABELS[proposal.proposedBy]}เสนอ</strong>
              <span className={`ui-status ${STATUS_TONES[proposal.status]}`}>
                {PROPOSAL_STATUS_LABELS[proposal.status]}
              </span>
            </div>
            <p className="ap-timeline-time">
              <Icon name="calendar" size={14} />
              {formatAppointmentTime(proposal.proposedStartAt)} · {formatDuration(proposal.durationMinutes)}
            </p>
            {proposal.message && <p className="ap-timeline-message">{proposal.message}</p>}
            <time dateTime={proposal.createdAt}>{formatRelativeTime(proposal.createdAt)}</time>
          </div>
        </li>
      ))}
    </ol>
  )
}
