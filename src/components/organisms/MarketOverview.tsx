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
      <dl className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: "Best bid", value: view.bestBidLabel },
          { label: "Best ask", value: view.bestAskLabel },
          { label: "Spread", value: view.spreadLabel },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-5"
          >
            <dt className="text-sm text-slate-300">{label} / GBP</dt>
            <dd className="mt-3 text-right text-3xl font-medium tabular-nums wrap-anywhere">
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
