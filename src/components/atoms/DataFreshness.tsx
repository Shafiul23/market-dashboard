type DataFreshnessProps = {
  isStale: boolean
  isWaiting: boolean
}

export function DataFreshness({ isStale, isWaiting }: DataFreshnessProps) {
  return (
    <p
      id="data-freshness"
      className={`rounded-lg border p-4 text-sm ${
        isStale
          ? "border-amber-700 bg-amber-950 text-amber-200"
          : "border-slate-800 text-slate-300"
      }`}
    >
      {isStale
        ? "Stale data: market overview and both order book tables may be out of date."
        : isWaiting
          ? "Waiting for market data."
          : "Live data: market overview and both order book tables are up to date."}
    </p>
  )
}
