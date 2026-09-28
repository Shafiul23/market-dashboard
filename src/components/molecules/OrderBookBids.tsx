import type { BookViewRow } from "../../book/bookView"

type OrderBookBidsProps = {
  rows: readonly BookViewRow[]
  isWaiting: boolean
}

export function OrderBookBids({ rows, isWaiting }: OrderBookBidsProps) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <table className="w-full table-fixed text-right text-sm tabular-nums">
        <caption className="border-b border-slate-700 pb-4 text-left text-base font-semibold text-emerald-400">
          Bids
        </caption>
        <thead className="text-slate-300">
          <tr>
            <th
              scope="col"
              className="w-1/2 pt-4 pb-3 font-medium pr-3 text-left"
            >
              Price<span className="sr-only"> in GBP</span>
            </th>
            <th scope="col" className="w-1/2 pt-4 pb-3 font-medium pl-3">
              Quantity<span className="sr-only"> in BTC</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="relative py-2 wrap-anywhere pr-3 text-left">
                {row.priceLabel}
              </td>
              <td className="relative py-2 wrap-anywhere pl-3">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 rounded-sm right-0 bg-emerald-500/15"
                  style={{ width: `${row.quantityProportion * 100}%` }}
                />
                <span className="relative">{row.quantityLabel}</span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="py-10 text-center text-slate-400">
                {isWaiting ? "Waiting for data." : "No bids available."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
