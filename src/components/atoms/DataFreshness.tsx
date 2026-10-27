type DataFreshnessProps = {
  isStale: boolean
  isWaiting: boolean
}

export function DataFreshness({ isStale, isWaiting }: DataFreshnessProps) {
  return (
    <p id="data-freshness">
      {isWaiting ? "Data: Waiting" : isStale ? "Data: Stale" : "Data: Live"}
    </p>
  )
}
