import { useRef } from "react"
import type { BookView } from "../book/bookView"
import { DataFreshness } from "./atoms/DataFreshness"
import { ReceiptTime } from "./atoms/ReceiptTime"
import { MarketHeader } from "./organisms/MarketHeader"
import { MarketOverview } from "./organisms/MarketOverview"
import { OrderBook } from "./organisms/OrderBook"
import { PLACEHOLDER } from "../lib/format"

type DashboardProps = {
  view: BookView
  connectionLabel: string
  heartbeatCount?: number
  error?: string | null
  isStale: boolean
  enabled?: boolean
  onToggle?: () => void
}

export function Dashboard({
  view,
  connectionLabel,
  heartbeatCount = 0,
  error,
  isStale,
  enabled = false,
  onToggle,
}: DashboardProps) {
  const dashboardRef = useRef<HTMLElement>(null)

  const isWaiting =
    view.receiptLabel === PLACEHOLDER &&
    view.bids.length === 0 &&
    view.asks.length === 0

  return (
    <main
      ref={dashboardRef}
      className="group min-h-screen overflow-y-auto bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-12 [&:fullscreen]:h-screen"
    >
      <div className="mx-auto max-w-5xl space-y-8 group-[:fullscreen]:max-w-none">
        <MarketHeader
          connectionLabel={connectionLabel}
          heartbeatCount={heartbeatCount}
          error={error}
          onToggle={onToggle}
          enabled={enabled}
          fullscreenTargetRef={dashboardRef}
        />

        <DataFreshness isStale={isStale} isWaiting={isWaiting} />

        <MarketOverview view={view} isWaiting={isWaiting} />

        <OrderBook view={view} isWaiting={isWaiting} />

        <footer className="border-t border-slate-800 pt-4 text-sm text-slate-400">
          <ReceiptTime label={view.receiptLabel} />
        </footer>
      </div>
    </main>
  )
}
