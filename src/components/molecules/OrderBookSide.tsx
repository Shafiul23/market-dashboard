import type { BookViewRow } from "../../book/bookView"

type OrderBookSideProps = {
  side: "bids" | "asks"
  rows: readonly BookViewRow[]
  isWaiting: boolean
}

export function OrderBookSide({ side, rows, isWaiting }: OrderBookSideProps) {
  const label = side === "bids" ? "Bids" : "Asks"
  const columns = side === "bids" ? ["price", "quantity"] : ["quantity", "price"]

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
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`w-1/2 pt-4 pb-3 font-medium ${index === 0 ? "pr-3" : "pl-3"}`}
              >
                {column === "price" ? "Price" : "Quantity"}
                <span className="sr-only">{column === "price" ? " in GBP" : " in BTC"}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column, index) => (
                <td
                  key={column}
                  className={`relative py-2 wrap-anywhere ${index === 0 ? "pr-3" : "pl-3"}`}
                >
                  {column === "quantity" ? (
                    <>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-1 rounded-sm ${side === "bids" ? "right-0 bg-emerald-500/15" : "left-0 bg-rose-500/15"}`}
                        style={{ width: `${row.quantityProportion * 100}%` }}
                      />
                      <span className="relative">{row.quantityLabel}</span>
                    </>
                  ) : row.priceLabel}
                </td>
              ))}
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
