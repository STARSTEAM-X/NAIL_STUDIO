import { Link } from 'react-router-dom'
import { TEMPLATE_REPORT_REASONS } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States.tsx'
import { useModerationQueue } from '@/features/community/useTemplates.ts'
import { formatDateTime } from '@/lib/datetime.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'

const REASON_LABELS: Record<(typeof TEMPLATE_REPORT_REASONS)[number], string> = {
  spam: 'สแปม',
  inappropriate: 'เนื้อหาไม่เหมาะสม',
  copyright: 'ละเมิดลิขสิทธิ์',
  harassment: 'คุกคาม',
  other: 'อื่นๆ',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'รอตรวจสอบ',
  reviewed: 'ตรวจแล้ว',
  dismissed: 'ยกคำร้อง',
}

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'เผยแพร่',
  unlisted: 'ไม่แสดงในฟีด',
  hidden: 'ซ่อนแล้ว',
}

/**
 * คิวรายงานสำหรับผู้ดูแลระบบ
 *
 * GET /templates/moderation/reports มี requireAdmin อยู่แล้วแต่ไม่มีหน้าใดเรียก
 * รายงานที่ผู้ใช้ส่งเข้ามาจึงไม่มีใครเห็น
 */
export function ModerationPage() {
  usePageTitle('รายงานที่รอตรวจสอบ')
  const queue = useModerationQueue()
  const reports = queue.data ?? []
  const pendingCount = reports.filter((report) => report.status === 'pending').length

  return (
    <section className="page moderation-page">
      <header className="ap-header">
        <div>
          <p className="eyebrow">MODERATION</p>
          <h1>รายงานจากผู้ใช้</h1>
          <p className="muted">
            {queue.isPending ? 'กำลังโหลด…' : `รอตรวจสอบ ${pendingCount} จากทั้งหมด ${reports.length} รายการ`}
          </p>
        </div>
      </header>

      {queue.isPending && <ListSkeleton count={4} lines={3} />}

      {queue.error && (
        <ErrorState title="โหลดคิวรายงานไม่สำเร็จ" error={queue.error} onRetry={() => void queue.refetch()} />
      )}

      {!queue.isPending && !queue.error && reports.length === 0 && (
        <EmptyState icon="check" title="ไม่มีรายงานค้าง" description="ยังไม่มีผู้ใช้รายงานผลงานใดในระบบ" />
      )}

      {reports.length > 0 && (
        <ul className="moderation-list">
          {reports.map((report) => (
            <li key={report.id} className="ui-card moderation-item">
              <div className="moderation-head">
                <span className="ui-status ui-status-danger">{REASON_LABELS[report.reason]}</span>
                <span className={`ui-status ${report.status === 'pending' ? 'ui-status-pending' : 'ui-status-neutral'}`}>
                  {STATUS_LABELS[report.status] ?? report.status}
                </span>
                <time dateTime={report.createdAt}>{formatDateTime(report.createdAt)}</time>
              </div>

              {report.template ? (
                <div className="moderation-target">
                  <Link to={`/community/templates/${report.targetId}`}>
                    <Icon name="image" size={14} /> {report.template.name}
                  </Link>
                  <span className="ui-status ui-status-neutral">
                    {VISIBILITY_LABELS[report.template.visibility] ?? report.template.visibility}
                  </span>
                  <span className="moderation-count">ถูกรายงาน {report.template.reportCount} ครั้ง</span>
                </div>
              ) : (
                <p className="muted">ผลงานที่ถูกรายงานถูกลบไปแล้ว</p>
              )}

              {report.detail && <p className="moderation-detail">{report.detail}</p>}

              <p className="moderation-reporter">
                รายงานโดย <Link to={`/users/${report.reporter.id}`}>{report.reporter.displayName}</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
