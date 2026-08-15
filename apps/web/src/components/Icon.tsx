export type IconName =
  | 'arrow-up-right'
  | 'bell'
  | 'calendar'
  | 'clock'
  | 'folder'
  | 'logout'
  | 'plus'
  | 'sparkle'
  | 'trash'
  | 'users'

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
}

/** A small, shared line-icon set so navigation and actions use one visual language. */
export function Icon({ name, size = 18, strokeWidth = 1.8, className }: IconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      {...common}
    >
      {name === 'arrow-up-right' && (
        <>
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </>
      )}
      {name === 'bell' && (
        <>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </>
      )}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      )}
      {name === 'folder' && (
        <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 18H6a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
      )}
      {name === 'logout' && (
        <>
          <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10" />
          <path d="m14 8 4 4-4 4M18 12H9" />
        </>
      )}
      {name === 'plus' && <path d="M12 5v14M5 12h14" />}
      {name === 'sparkle' && (
        <>
          <path d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Z" />
          <path d="m19 16 .55 2.45L22 19l-2.45.55L19 22l-.55-2.45L16 19l2.45-.55L19 16Z" />
        </>
      )}
      {name === 'trash' && (
        <>
          <path d="M4.5 7h15M10 4h4l1 3H9l1-3ZM7 7l.8 12h8.4L17 7M10 11v5M14 11v5" />
        </>
      )}
      {name === 'users' && (
        <>
          <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
          <circle cx="10" cy="8" r="3" />
          <path d="M16 7.2a3 3 0 0 1 0 5.6M18 15.4a3.5 3.5 0 0 1 2 3.1V20" />
        </>
      )}
    </svg>
  )
}
