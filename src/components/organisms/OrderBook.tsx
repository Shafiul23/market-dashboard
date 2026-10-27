import type { BookView } from "../../book/bookView"
import { GroupingControl } from "../atoms/GroupingControl"
import { OrderBookAsks } from "../molecules/OrderBookAsks"
import { OrderBookBids } from "../molecules/OrderBookBids"

type OrderBookProps = {
  view: Pick<BookView, "bids" | "asks" | "groupingInterval">
  isWaiting: boolean
  onGroupingChange: (interval: string | null) => void
}

export function OrderBook({
  view,
  isWaiting,
  onGroupingChange,
}: OrderBookProps) {
  const isGrouped = view.groupingInterval !== null
  return (
    <section aria-labelledby="book-heading" aria-describedby="data-freshness">
      <h2 id="book-heading" className="text-lg font-semibold">
        Order book
      </h2>
      <div className="mt-3 flex flex-col items-start justify-between gap-3 md:flex-row md:flex-wrap md:items-center">
        <p className="text-sm text-muted">
          Prices in GBP · Quantities in BTC ·{" "}
          {isGrouped
            ? `Up to 10 buckets per side · £${view.groupingInterval} grouping`
            : "10 levels per side"}
        </p>
        <div className="md:ml-auto">
          <GroupingControl
            interval={view.groupingInterval}
            onChange={onGroupingChange}
          />
        </div>
      </div>
      {isGrouped && (
        <p className="mt-1 text-sm text-muted">
          Grouped price boundaries: bids rounded down, asks rounded up.{" "}
          Boundaries are not executable quotes. Best bid, best ask and spread
          use exact prices.
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <OrderBookBids
          rows={view.bids}
          isWaiting={isWaiting}
          isGrouped={isGrouped}
        />
        <OrderBookAsks
          rows={view.asks}
          isWaiting={isWaiting}
          isGrouped={isGrouped}
        />
      </div>
    </section>
  )
}
