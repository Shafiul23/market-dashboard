import { FeedStatus } from "../atoms/FeedStatus"
import { OrderBookToggle } from "../atoms/OrderBookToggle"

type MarketHeaderProps = {
  connectionLabel: string
  heartbeatCount: number
  error?: string | null
  enabled?: boolean
  onToggle?: () => void
}

export function MarketHeader({
  connectionLabel,
  heartbeatCount,
  error,
  enabled = false,
  onToggle,
}: MarketHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-300">
          Coinbase · Market dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          BTC-GBP
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Bitcoin / British Pound
        </p>
        {onToggle && (
          <div className="mt-4">
            <OrderBookToggle enabled={enabled} onClick={onToggle} />
          </div>
        )}
      </div>
      <FeedStatus
        connectionLabel={connectionLabel}
        heartbeatCount={heartbeatCount}
        error={error}
      />
    </header>
  )
}
