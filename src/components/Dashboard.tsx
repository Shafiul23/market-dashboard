import type { BookView } from "../book/bookView"
import { DataFreshness } from "./atoms/DataFreshness"
import { OrderBookToggle } from "./atoms/OrderBookToggle"
import { ReceiptTime } from "./atoms/ReceiptTime"
import { MarketHeader } from "./organisms/MarketHeader"
import { MarketOverview } from "./organisms/MarketOverview"
import { OrderBook } from "./organisms/OrderBook"
import { PLACEHOLDER } from "../lib/format"

type DashboardProps = {
  view: BookView
  connectionLabel: string
  error?: string | null
  isStale: boolean
  enabled?: boolean
  onToggle?: () => void
}

export function Dashboard({
  view,
  connectionLabel,
  error,
  isStale,
  enabled = false,
  onToggle,
}: DashboardProps) {
  const isWaiting =
    view.receiptLabel === PLACEHOLDER &&
    view.bids.length === 0 &&
    view.asks.length === 0

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <MarketHeader connectionLabel={connectionLabel} error={error} />

        {onToggle && <OrderBookToggle enabled={enabled} onClick={onToggle} />}

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
