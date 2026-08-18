import type { ReactNode } from 'react'
import { ApiRequestError } from '@/api/client.ts'
import { Icon, type IconName } from '@/components/Icon.tsx'

/** โครงกระดูกของโพสต์ในฟีด — โครงเดียวกับ PostCard เพื่อไม่ให้เลย์เอาต์กระโดดตอนโหลดเสร็จ */
export function PostCardSkeleton() {
  return (
    <article className="nc-card nc-post nc-skeleton" aria-hidden="true">
      <div className="nc-post-head">
        <span className="nc-skel nc-skel-avatar" />
        <div className="nc-skel-lines">
          <span className="nc-skel nc-skel-line" style={{ width: '38%' }} />
          <span className="nc-skel nc-skel-line" style={{ width: '22%' }} />
        </div>
      </div>
      <div className="nc-post-body">
        <span className="nc-skel nc-skel-line" style={{ width: '80%' }} />
        <span className="nc-skel nc-skel-line" style={{ width: '55%' }} />
      </div>
      <span className="nc-skel nc-skel-media" />
      <div className="nc-post-actions">
        <span className="nc-skel nc-skel-pill" />
        <span className="nc-skel nc-skel-pill" />
        <span className="nc-skel nc-skel-pill" />
      </div>
    </article>
  )
}

/** โครงกระดูกของการ์ดในโหมดเรียกดูแบบกริด */
export function TemplateCardSkeleton() {
  return (
    <article className="nc-card nc-tile nc-skeleton" aria-hidden="true">
      <span className="nc-skel nc-skel-media nc-skel-media-tile" />
      <div className="nc-tile-body">
        <span className="nc-skel nc-skel-line" style={{ width: '70%' }} />
        <span className="nc-skel nc-skel-line" style={{ width: '45%' }} />
        <span className="nc-skel nc-skel-line" style={{ width: '60%' }} />
      </div>
    </article>
  )
}

export function FeedSkeletonList({ count = 3, variant = 'post' }: { count?: number; variant?: 'post' | 'tile' }) {
  return (
    <div className={variant === 'post' ? 'nc-feed-list' : 'nc-tile-grid'} role="status" aria-label="กำลังโหลดเนื้อหา">
      {Array.from({ length: count }, (_, index) =>
        variant === 'post' ? <PostCardSkeleton key={index} /> : <TemplateCardSkeleton key={index} />,
      )}
      <span className="nc-visually-hidden">กำลังโหลดเนื้อหาจากชุมชน…</span>
    </div>
  )
}


/** แถบโครงกระดูกทั่วไป — ใช้ประกอบ skeleton ของหน้าใดก็ได้ */
export function SkeletonLine({ width = '100%', height }: { width?: string; height?: string }) {
  return <span className="nc-skel nc-skel-line" style={{ width, ...(height ? { height } : {}) }} />
}

/** โครงกระดูกของการ์ดทั่วไป เช่น การ์ดงานออกแบบหรือการ์ดนัดหมาย */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ui-card ui-skeleton-card" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine key={index} width={`${90 - index * 18}%`} />
      ))}
    </div>
  )
}

/** รายการโครงกระดูกสำหรับหน้าที่แสดงเป็นลิสต์ */
export function ListSkeleton({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <div className="ui-skeleton-list" role="status" aria-label="กำลังโหลดข้อมูล">
      {Array.from({ length: count }, (_, index) => <CardSkeleton key={index} lines={lines} />)}
      <span className="nc-visually-hidden">กำลังโหลดข้อมูล…</span>
    </div>
  )
}

interface StatePanelProps {
  icon?: IconName | undefined
  title: string
  description?: string | undefined
  children?: ReactNode | undefined
}

/** สถานะว่าง — ใช้ทั้งฟีดว่าง ผลค้นหาไม่พบ และคอมเมนต์ยังไม่มี */
export function EmptyState({ icon = 'sparkle', title, description, children }: StatePanelProps) {
  return (
    <div className="nc-state" role="status">
      <span className="nc-state-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children && <div className="nc-state-actions">{children}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string | undefined
  error: unknown
  onRetry?: () => void | undefined
  retryLabel?: string | undefined
}

/** สถานะผิดพลาดพร้อมปุ่มลองใหม่ — แสดงข้อความจาก API เมื่อมี เพื่อให้ผู้ใช้รู้สาเหตุจริง */
export function ErrorState({ title = 'โหลดข้อมูลไม่สำเร็จ', error, onRetry, retryLabel = 'ลองใหม่อีกครั้ง' }: ErrorStateProps) {
  const detail =
    error instanceof ApiRequestError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'

  return (
    <div className="nc-state nc-state-error" role="alert">
      <span className="nc-state-icon" aria-hidden="true"><Icon name="alert" size={22} /></span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {onRetry && (
        <div className="nc-state-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry}>{retryLabel}</button>
        </div>
      )}
    </div>
  )
}
