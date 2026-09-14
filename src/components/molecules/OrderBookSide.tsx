import type { BookViewRow } from "../../book/bookView"

type OrderBookSideProps = {
  side: "bids" | "asks"
  rows: readonly BookViewRow[]
  isWaiting: boolean
}

export function OrderBookSide({ side, rows, isWaiting }: OrderBookSideProps) {
  const label = side === "bids" ? "Bids" : "Asks"

  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <table className="w-full table-fixed text-right text-sm tabular-nums">
        <caption
          className={`border-b border-slate-700 pb-4 text-left text-base font-semibold ${side === "bids" ? "text-emerald-400" : "text-rose-400"}`}
        >
          {label}
        </caption>
        <thead className="text-slate-300">
          <tr>
            <th scope="col" className="w-1/2 pt-4 pb-3 pr-3 font-medium">
              Price <span className="sr-only"> in GBP</span>
            </th>
            <th scope="col" className="w-1/2 pt-4 pb-3 pl-3 font-medium">
              Quantity <span className="sr-only"> in BTC</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-2 pr-3 wrap-anywhere">{row.priceLabel}</td>
              <td className="py-2 pl-3 wrap-anywhere">{row.quantityLabel}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="py-10 text-center text-slate-400">
                {isWaiting ? "Waiting for data." : `No ${side} available.`}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
