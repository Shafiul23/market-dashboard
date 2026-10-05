import type { RefObject } from "react"
import { FullscreenToggle } from "../atoms/FullscreenToggle"
import { FeedStatus } from "../atoms/FeedStatus"
import { OrderBookToggle } from "../atoms/OrderBookToggle"

type MarketHeaderProps = {
  connectionLabel: string
  heartbeatCount: number
  error?: string | null
  enabled?: boolean
  onToggle?: () => void
  fullscreenTargetRef?: RefObject<HTMLElement | null>
}

export function MarketHeader({
  connectionLabel,
  heartbeatCount,
  error,
  enabled = false,
  onToggle,
  fullscreenTargetRef,
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
        {(onToggle || fullscreenTargetRef) && (
          <div className="mt-4 flex flex-wrap gap-3">
            {onToggle && <OrderBookToggle enabled={enabled} onClick={onToggle} />}
            {fullscreenTargetRef && (
              <FullscreenToggle targetRef={fullscreenTargetRef} />
            )}
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
