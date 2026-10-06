import type { BookViewRow } from "../../book/bookView"

type OrderBookAsksProps = {
  rows: readonly BookViewRow[]
  isWaiting: boolean
  isGrouped?: boolean
}

export function OrderBookAsks({
  rows,
  isWaiting,
  isGrouped = false,
}: OrderBookAsksProps) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <table className="w-full table-fixed text-right text-sm tabular-nums">
        <caption className="border-b border-slate-700 pb-4 text-right text-base font-semibold text-rose-400">
          Asks
        </caption>
        <thead className="text-slate-300">
          <tr>
            <th
              scope="col"
              className="w-1/2 pt-4 pb-3 font-medium pr-3 text-left"
            >
              {isGrouped ? "Bucket quantity" : "Quantity"}{" "}
              <span className="sr-only">in BTC</span>
            </th>
            <th scope="col" className="w-1/2 pt-4 pb-3 font-medium pl-3">
              {isGrouped ? "Grouped price" : "Price"}{" "}
              <span className="sr-only">in GBP</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="relative py-2 wrap-anywhere pr-3 text-left">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 rounded-sm left-0 bg-rose-500/15"
                  style={{ width: `${row.quantityProportion * 100}%` }}
                />
                <span className="relative">{row.quantityLabel}</span>
              </td>
              <td className="relative py-2 wrap-anywhere pl-3">
                {row.priceLabel}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="py-10 text-center text-slate-400">
                {isWaiting ? "Waiting for data." : "No asks available."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
