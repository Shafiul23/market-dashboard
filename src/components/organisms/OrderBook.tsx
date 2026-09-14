import type { BookView } from "../../book/bookView"
import { OrderBookSide } from "../molecules/OrderBookSide"

type OrderBookProps = {
  view: Pick<BookView, "bids" | "asks">
  isWaiting: boolean
}

export function OrderBook({ view, isWaiting }: OrderBookProps) {
  return (
    <section aria-labelledby="book-heading" aria-describedby="data-freshness">
      <h2 id="book-heading" className="text-lg font-semibold">
        Order book
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Prices in GBP · Quantities in BTC · 10 levels per side
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <OrderBookSide side="bids" rows={view.bids} isWaiting={isWaiting} />
        <OrderBookSide side="asks" rows={view.asks} isWaiting={isWaiting} />
      </div>
    </section>
  )
}
