type FeedStatusProps = {
  connectionLabel: string
  error?: string | null
}

export function FeedStatus({ connectionLabel, error }: FeedStatusProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="min-w-0 text-sm text-slate-300 sm:max-w-sm"
    >
      <p>Connection: {connectionLabel}</p>
      {error && <p className="mt-1 wrap-anywhere text-amber-200">{error}</p>}
    </div>
  )
}
