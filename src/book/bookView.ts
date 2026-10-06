import { parseDecimal, subtractDecimals } from "../lib/decimal"
import { formatDecimal, formatReceiptLabel, PLACEHOLDER } from "../lib/format"
import { groupLevels } from "./groupLevels"
import type { PriceBucket } from "./groupLevels"
import { selectTopLevels } from "./orderBook"
import type { OrderBook, PriceLevel } from "./orderBook"

export type BookViewRow = Readonly<{
  id: string
  price: string
  quantity: string
  priceLabel: string
  quantityLabel: string
  quantityProportion: number
}>

export type BookView = Readonly<{
  groupingInterval: string | null
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
  groupingInterval: string | null = null,
): BookView {
  const top = selectTopLevels(book)
  const displayed = groupingInterval === null ? top : groupLevels(book, groupingInterval)
  const levels = [...displayed.bids, ...displayed.asks]
  const maximumQuantity = levels.reduce((maximum, level) => {
    const quantity = parseDecimal(level.quantity)
    return quantity.gt(maximum) ? quantity : maximum
  }, parseDecimal("0"))
  const pricePrecision = columnPrecision(
    levels.map((level) => level.price),
    2,
  )
  const headlinePrecision = groupingInterval === null
    ? pricePrecision
    : columnPrecision([...top.bids, ...top.asks].map((level) => level.price), 2)
  const quantityPrecision = columnPrecision(
    levels.map((level) => level.quantity),
    8,
  )

  function toRow(level: PriceLevel | PriceBucket): BookViewRow {
    return {
      id: "id" in level ? level.id : level.price,
      price: level.price,
      quantity: level.quantity,
      priceLabel: formatDecimal(level.price, pricePrecision),
      quantityLabel: formatDecimal(level.quantity, quantityPrecision),
      quantityProportion: maximumQuantity.eq("0")
        ? 0
        : Number(parseDecimal(level.quantity).div(maximumQuantity).toString()),
    }
  }

  const bids = displayed.bids.map(toRow)
  const asks = displayed.asks.map(toRow)
  const bestBid = top.bids[0]?.price ?? null
  const bestAsk = top.asks[0]?.price ?? null
  const spread =
    bestBid === null || bestAsk === null
      ? null
      : subtractDecimals(bestAsk, bestBid)

  return {
    groupingInterval: groupingInterval === null ? null : parseDecimal(groupingInterval).toFixed(),
    bids,
    asks,
    bestBid,
    bestAsk,
    spread,
    bestBidLabel: bestBid === null ? PLACEHOLDER : formatDecimal(bestBid, headlinePrecision),
    bestAskLabel: bestAsk === null ? PLACEHOLDER : formatDecimal(bestAsk, headlinePrecision),
    spreadLabel:
      spread === null ? PLACEHOLDER : formatDecimal(spread, headlinePrecision),
    receiptLabel: formatReceiptLabel(receivedAt),
  }
}
