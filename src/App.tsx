import { createBookView } from "./book/bookView"
import type { BookView } from "./book/bookView"
import { createOrderBook } from "./book/orderBook"
import { DataFreshness } from "./components/atoms/DataFreshness"
import { ReceiptTime } from "./components/atoms/ReceiptTime"
import { MarketHeader } from "./components/organisms/MarketHeader"
import { MarketOverview } from "./components/organisms/MarketOverview"
import { OrderBook } from "./components/organisms/OrderBook"
import { PLACEHOLDER } from "./lib/format"

const waitingView = createBookView(
  createOrderBook({ bids: [], asks: [] }),
  null,
)

type AppProps = {
  view?: BookView
  connectionLabel?: string
  isStale?: boolean
}

function App({
  view = waitingView,
  connectionLabel = "Not connected",
  isStale = false,
}: AppProps) {
  const isWaiting =
    view.receiptLabel === PLACEHOLDER &&
    view.bids.length === 0 &&
    view.asks.length === 0

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <MarketHeader connectionLabel={connectionLabel} />

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

export default App
