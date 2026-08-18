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
