export type IconName =
  | 'alert'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-up-right'
  | 'bell'
  | 'brush'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'comment'
  | 'compass'
  | 'download'
  | 'eraser'
  | 'eye'
  | 'eye-off'
  | 'flame'
  | 'folder'
  | 'grid'
  | 'hand'
  | 'heart'
  | 'image'
  | 'keyboard'
  | 'layers'
  | 'logout'
  | 'nail'
  | 'palette'
  | 'pencil'
  | 'plus'
  | 'remix'
  | 'rows'
  | 'search'
  | 'share'
  | 'sliders'
  | 'sparkle'
  | 'tag'
  | 'trash'
  | 'undo'
  | 'redo'
  | 'user'
  | 'users'
  | 'wand'
  | 'x'
  | 'zoom-in'
  | 'zoom-out'

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
      {name === 'alert' && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v5M12 16h.01" />
        </>
      )}
      {name === 'arrow-left' && (
        <>
          <path d="M19 12H5" />
          <path d="m11 6-6 6 6 6" />
        </>
      )}
      {name === 'check' && <path d="m5 12.5 4.5 4.5L19 7.5" />}
      {name === 'chevron-down' && <path d="m6 9.5 6 6 6-6" />}
      {name === 'comment' && (
        <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.6-.35L5 20.5l1.1-3.2A6.4 6.4 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z" />
      )}
      {name === 'compass' && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m15.2 8.8-1.8 4.4-4.4 1.8 1.8-4.4 4.4-1.8Z" />
        </>
      )}
      {name === 'flame' && (
        <path d="M12 3s4.5 3.7 4.5 8a4.5 4.5 0 0 1-9 0c0-1.3.5-2.4 1.2-3.3.2 1.4 1 2.3 1.9 2.3 1 0 1.6-.9 1.4-2.4A9.6 9.6 0 0 0 12 3Zm0 18a6 6 0 0 0 6-6" />
      )}
      {name === 'grid' && (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.6" />
          <rect x="13" y="4" width="7" height="7" rx="1.6" />
          <rect x="4" y="13" width="7" height="7" rx="1.6" />
          <rect x="13" y="13" width="7" height="7" rx="1.6" />
        </>
      )}
      {name === 'heart' && (
        <path d="M12 20s-7.5-4.4-7.5-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.7C19.5 15.6 12 20 12 20Z" />
      )}
      {name === 'image' && (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m4.5 17 4.6-4.3L13 16l2.6-2.3 3.9 3.6" />
        </>
      )}
      {name === 'layers' && (
        <>
          <path d="m12 4 8 4.2-8 4.2-8-4.2L12 4Z" />
          <path d="m4 13 8 4.2 8-4.2" />
        </>
      )}
      {name === 'palette' && (
        <>
          <path d="M12 4a8 8 0 0 0 0 16c1.2 0 1.8-.8 1.8-1.6 0-1.4-1-1.7-1-2.8 0-.8.7-1.4 1.6-1.4H16a4 4 0 0 0 4-4c0-3.4-3.6-6.2-8-6.2Z" />
          <circle cx="9" cy="10" r="1" />
          <circle cx="13.5" cy="8.4" r="1" />
        </>
      )}
      {name === 'remix' && (
        <>
          <path d="M4 8h11a3.5 3.5 0 0 1 3.5 3.5V13" />
          <path d="m7 5-3 3 3 3" />
          <path d="M20 16H9a3.5 3.5 0 0 1-3.5-3.5V11" />
          <path d="m17 19 3-3-3-3" />
        </>
      )}
      {name === 'rows' && (
        <>
          <rect x="4" y="4.5" width="16" height="6" rx="1.8" />
          <rect x="4" y="13.5" width="16" height="6" rx="1.8" />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </>
      )}
      {name === 'share' && (
        <>
          <path d="M12 16V4" />
          <path d="m8 8 4-4 4 4" />
          <path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
        </>
      )}
      {name === 'sliders' && (
        <>
          <path d="M5 7h9M18 7h1M5 12h3M12 12h7M5 17h9M18 17h1" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="16" cy="17" r="2" />
        </>
      )}
      {name === 'tag' && (
        <>
          <path d="M4 11.4V5.5A1.5 1.5 0 0 1 5.5 4h5.9a2 2 0 0 1 1.4.6l6.5 6.5a2 2 0 0 1 0 2.8l-5.4 5.4a2 2 0 0 1-2.8 0l-6.5-6.5a2 2 0 0 1-.6-1.4Z" />
          <circle cx="8.5" cy="8.5" r="1.2" />
        </>
      )}
      {name === 'user' && (
        <>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
        </>
      )}
      {name === 'x' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'users' && (
        <>
          <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
          <circle cx="10" cy="8" r="3" />
          <path d="M16 7.2a3 3 0 0 1 0 5.6M18 15.4a3.5 3.5 0 0 1 2 3.1V20" />
        </>
      )}
      {name === 'hand' && (
        <>
          <path d="M18 11V6a2 2 0 0 0-4 0" />
          <path d="M14 10V4a2 2 0 0 0-4 0v2" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />
        </>
      )}
      {name === 'nail' && (
        <>
          <path d="M7.5 18.5V8a4.5 4.5 0 0 1 9 0v10.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z" />
          <path d="M8 11.5c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5" />
        </>
      )}
      {name === 'brush' && (
        <>
          <path d="M18.4 3.6a2.2 2.2 0 0 1 3.1 3.1l-9.4 9.4-4 .9.9-4 9.4-9.4Z" />
          <path d="M7.5 16.5c-.7 1.3-1.8 2.2-3.5 2.7.9 1.2 2.4 1.8 3.8 1.4 1.3-.4 2-1.7 1.7-3" />
        </>
      )}
      {name === 'pencil' && (
        <>
          <path d="M17 3.5a2.12 2.12 0 0 1 3 3L7.5 19l-4 1 1-4L17 3.5Z" />
          <path d="m14.5 6 3 3" />
        </>
      )}
      {name === 'eraser' && (
        <>
          <path d="m7 21-4.3-4.3a2 2 0 0 1 0-2.8l9.6-9.6a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L13 21" />
          <path d="M22 21H7" />
          <path d="m5.5 11.5 7 7" />
        </>
      )}
      {name === 'wand' && (
        <>
          <path d="m14.5 4.5 5 5L9 20a1.8 1.8 0 0 1-2.5 0L4 17.5a1.8 1.8 0 0 1 0-2.5L14.5 4.5Z" />
          <path d="m12.5 6.5 5 5" />
          <path d="M5 4v3M3.5 5.5h3M19 14v3M17.5 15.5h3" />
        </>
      )}
      {name === 'undo' && (
        <>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H8" />
        </>
      )}
      {name === 'redo' && (
        <>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H16" />
        </>
      )}
      {name === 'eye' && (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
      {name === 'eye-off' && (
        <>
          <path d="m4 4 16 16" />
          <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4" />
          <path d="M6.6 7.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      )}
      {name === 'download' && (
        <>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M4.5 17v1.5A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V17" />
        </>
      )}
      {name === 'arrow-up' && (
        <>
          <path d="M12 20V4" />
          <path d="m6 10 6-6 6 6" />
        </>
      )}
      {name === 'arrow-down' && (
        <>
          <path d="M12 4v16" />
          <path d="m6 14 6 6 6-6" />
        </>
      )}
      {name === 'zoom-in' && (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
          <path d="M11 8.5v5M8.5 11h5" />
        </>
      )}
      {name === 'zoom-out' && (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
          <path d="M8.5 11h5" />
        </>
      )}
      {name === 'keyboard' && (
        <>
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13.5h.01M17 13.5h.01M9.5 13.5h5" />
        </>
      )}
    </svg>
  )
}
