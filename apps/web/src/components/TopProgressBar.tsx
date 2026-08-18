import { useIsFetching, useIsMutating } from '@tanstack/react-query'

export function TopProgressBar() {
  const busy = useIsFetching() + useIsMutating()
  if (busy === 0) return null
  return <div className="top-progress" role="presentation"><span /></div>
}
