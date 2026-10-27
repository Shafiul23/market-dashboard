import type { BookView } from "../../book/bookView"
import { PLACEHOLDER } from "../../lib/format"

type MarketOverviewProps = {
  view: Pick<BookView, "bestBidLabel" | "bestAskLabel" | "spreadLabel">
  isWaiting: boolean
}

export function MarketOverview({ view, isWaiting }: MarketOverviewProps) {
  return (
    <section
      aria-labelledby="overview-heading"
      aria-describedby="data-freshness"
    >
      <h2 id="overview-heading" className="text-lg font-semibold">
        Market overview
      </h2>
      <dl className="mt-4 grid md:grid-cols-3 md:gap-3">
        {[
          { label: "Best bid", value: view.bestBidLabel },
          { label: "Best ask", value: view.bestAskLabel },
          { label: "Spread", value: view.spreadLabel },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-4 border-b border-divider py-3 last:border-b-0 md:block md:rounded-lg md:border md:bg-surface md:p-5 md:last:border-b"
          >
            <dt className="text-sm text-secondary">{label} / GBP</dt>
            <dd className="min-w-0 text-right text-xl font-medium tabular-nums wrap-anywhere md:mt-3 md:text-3xl">
              {value === PLACEHOLDER ? (
                <>
                  <span aria-hidden="true">{PLACEHOLDER}</span>
                  <span className="sr-only">
                    {isWaiting ? "Waiting for data" : "Unavailable"}
                  </span>
                </>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
