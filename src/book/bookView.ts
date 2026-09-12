import { parseDecimal, subtractDecimals } from "../lib/decimal"
import { formatDecimal, formatReceiptLabel, PLACEHOLDER } from "../lib/format"
import { selectTopLevels } from "./orderBook"
import type { OrderBook, PriceLevel } from "./orderBook"

export type BookViewRow = Readonly<{
  id: string
  price: string
  quantity: string
  priceLabel: string
  quantityLabel: string
}>

export type BookView = Readonly<{
  bids: readonly BookViewRow[]
  asks: readonly BookViewRow[]
  bestBid: string | null
  bestAsk: string | null
  spread: string | null
  bestBidLabel: string
  bestAskLabel: string
  spreadLabel: string
  receiptLabel: string
}>

function columnPrecision(values: readonly string[], minimum: number): number {
  return values.reduce((precision, value) => {
    const fraction = parseDecimal(value).toFixed().split(".")[1] ?? ""
    return Math.max(precision, fraction.length)
  }, minimum)
}

export function createBookView(
  book: OrderBook,
  receivedAt: number | null,
): BookView {
  const top = selectTopLevels(book)
  const levels = [...top.bids, ...top.asks]
  const pricePrecision = columnPrecision(
    levels.map((level) => level.price),
    2,
  )
  const quantityPrecision = columnPrecision(
    levels.map((level) => level.quantity),
    8,
  )

  function toRow(level: PriceLevel): BookViewRow {
    return {
      id: level.price,
      price: level.price,
      quantity: level.quantity,
      priceLabel: formatDecimal(level.price, pricePrecision),
      quantityLabel: formatDecimal(level.quantity, quantityPrecision),
    }
  }

  const bids = top.bids.map(toRow)
  const asks = top.asks.map(toRow)
  const bestBid = bids[0]?.price ?? null
  const bestAsk = asks[0]?.price ?? null
  const spread =
    bestBid === null || bestAsk === null
      ? null
      : subtractDecimals(bestAsk, bestBid)

  return {
    bids,
    asks,
    bestBid,
    bestAsk,
    spread,
    bestBidLabel: bids[0]?.priceLabel ?? PLACEHOLDER,
    bestAskLabel: asks[0]?.priceLabel ?? PLACEHOLDER,
    spreadLabel:
      spread === null ? PLACEHOLDER : formatDecimal(spread, pricePrecision),
    receiptLabel: formatReceiptLabel(receivedAt),
  }
}
