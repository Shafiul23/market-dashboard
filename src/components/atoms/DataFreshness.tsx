type DataFreshnessProps = {
  isStale: boolean
  isWaiting: boolean
}

export function DataFreshness({ isStale, isWaiting }: DataFreshnessProps) {
  return (
    <p
      id="data-freshness"
      className={`rounded-lg border p-4 text-sm ${
        isStale && !isWaiting
          ? "border-warning bg-accent-subtle"
          : "border-divider text-secondary"
      }`}
    >
      {isWaiting
        ? "Waiting for market data."
        : isStale
          ? "Stale data: market overview and both order book tables may be out of date."
          : "Live data: market overview and both order book tables are up to date."}
    </p>
  )
}
