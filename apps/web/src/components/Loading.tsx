export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="spinner" aria-hidden="true" style={{ width: size, height: size }} />
}

export function LoadingScreen({ label, brand = true }: { label: string; brand?: boolean }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <Spinner size={32} />
      {brand && <p className="loading-wordmark">NAIL STUDIO <span>3D</span></p>}
      <p className="loading-label">{label}</p>
    </div>
  )
}

export function InlineLoading({ label }: { label: string }) {
  return (
    <p className="inline-loading" role="status">
      <span className="inline-loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>{label}</span>
    </p>
  )
}

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string | number
  className?: string
}

export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  const classes = ['skeleton', className].filter(Boolean).join(' ')
  return <span className={classes} aria-hidden="true" style={{ width, height, borderRadius: radius }} />
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="skeleton-text" aria-hidden="true">
      {Array.from({ length: Math.max(0, lines) }, (_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? 'skeleton-text-short' : ''} />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <article className="skeleton-card" aria-hidden="true">
      <Skeleton className="skeleton-card-media" />
      <div className="skeleton-card-body">
        <SkeletonText lines={2} />
      </div>
    </article>
  )
}

export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  const classes = ['skeleton-grid', className].filter(Boolean).join(' ')
  return (
    <div className={classes} role="status" aria-label="กำลังโหลด…" aria-busy="true">
      {Array.from({ length: Math.max(0, count) }, (_, index) => <SkeletonCard key={index} />)}
    </div>
  )
}
