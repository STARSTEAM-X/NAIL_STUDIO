export const ORIGIN_LABELS: Record<string, string> = {
  original: 'ต้นฉบับ',
  ai: 'AI',
  remix: 'รีมิกซ์',
}

export function getInitials(displayName: string | undefined): string {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length > 1) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() || 'NS'
}
