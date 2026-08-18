interface CommunityIconProps {
  filled?: boolean
}

const commonSvgProps = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export function HeartIcon({ filled = false }: CommunityIconProps) {
  return (
    <svg {...commonSvgProps} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 20.2-7.3-7.1A4.6 4.6 0 0 1 11 6.4L12 7.5l1-1.1a4.6 4.6 0 0 1 6.3 6.7L12 20.2Z" />
    </svg>
  )
}

export function CommentIcon() {
  return (
    <svg {...commonSvgProps}>
      <path d="M4.5 5.5h15v10h-8l-4.5 3v-3h-2.5v-10Z" />
    </svg>
  )
}

export function ShareIcon() {
  return (
    <svg {...commonSvgProps}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

export function RemixIcon() {
  return (
    <svg {...commonSvgProps}>
      <path d="M7 7h9a4 4 0 0 1 4 4v1" />
      <path d="m17 4 3 3-3 3" />
      <path d="M17 17H8a4 4 0 0 1-4-4v-1" />
      <path d="m7 20-3-3 3-3" />
    </svg>
  )
}
