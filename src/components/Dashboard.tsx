import { useMemo, useRef, useState } from "react"
import { createBookView } from "../book/bookView"
import type { ReadonlyOrderBook } from "../book/orderBook"
import { DataFreshness } from "./atoms/DataFreshness"
import { ReceiptTime } from "./atoms/ReceiptTime"
import { MarketHeader } from "./organisms/MarketHeader"
import { MarketOverview } from "./organisms/MarketOverview"
import { OrderBook } from "./organisms/OrderBook"

type DashboardProps = {
  book: ReadonlyOrderBook
  receivedAt: number | null
  connectionLabel: string
  heartbeatCount?: number
  error?: string | null
  isStale: boolean
  enabled?: boolean
  onToggle?: () => void
}

export function Dashboard({
  book,
  receivedAt,
  connectionLabel,
  heartbeatCount = 0,
  error,
  isStale,
  enabled = false,
  onToggle,
}: DashboardProps) {
  const dashboardRef = useRef<HTMLElement>(null)
  const [groupingInterval, setGroupingInterval] = useState<string | null>(null)
  const view = useMemo(
    () => createBookView(book, receivedAt, groupingInterval),
    [book, receivedAt, groupingInterval],
  )

  const isWaiting = receivedAt === null

  return (
    <main
      ref={dashboardRef}
      className="group min-h-screen overflow-y-auto bg-background px-4 py-8 text-primary sm:px-6 sm:py-12 [&:fullscreen]:h-screen"
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

        <OrderBook
          view={view}
          isWaiting={isWaiting}
          onGroupingChange={setGroupingInterval}
        />

        <footer className="border-t border-divider pt-4 text-sm text-muted">
          <ReceiptTime label={view.receiptLabel} />
        </footer>
      </div>
    </main>
  )
}
