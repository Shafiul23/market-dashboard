type FeedStatusProps = {
  connectionLabel: string
}

export function FeedStatus({ connectionLabel }: FeedStatusProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="text-sm text-slate-300"
    >
      Connection: {connectionLabel}
    </p>
  )
}
