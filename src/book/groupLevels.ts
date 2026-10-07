import { compareDecimals, parseDecimal } from "../lib/decimal"
import type { OrderBook, PriceLevel } from "./orderBook"

const VISIBLE_BUCKETS = 10

export type PriceBucket = PriceLevel & {
  readonly id: string
}

export function groupSideLevels(
  levels: ReadonlyMap<string, PriceLevel>,
  side: "bids" | "asks",
  interval: string,
): PriceBucket[] {
  const step = parseDecimal(interval)
  const buckets = new Map<string, PriceBucket>()

  for (const level of levels.values()) {
    const price = parseDecimal(level.price)
    const remainder = price.mod(step)
    const boundary =
      side === "asks" && !remainder.eq("0")
        ? price.minus(remainder).plus(step)
        : price.minus(remainder)
    const key = boundary.toFixed()
    const quantity = parseDecimal(buckets.get(key)?.quantity ?? "0")
      .plus(parseDecimal(level.quantity))
      .toFixed()

    buckets.set(key, {
      id: `${side}:${step.toFixed()}:${key}`,
      price: key,
      quantity,
    })
  }

  // todo: assess sorting during profiling
  // replace with a heap that manages the top 10 (or top VISIBLE_BUCKETS) and measure differences
  return [...buckets.values()].sort((left, right) =>
    side === "bids"
      ? compareDecimals(right.price, left.price)
      : compareDecimals(left.price, right.price),
  )
}

export function groupLevels(
  book: OrderBook,
  interval: string,
): {
  bids: PriceBucket[]
  asks: PriceBucket[]
} {
  return {
    bids: groupSideLevels(book.bids, "bids", interval).slice(
      0,
      VISIBLE_BUCKETS,
    ),
    asks: groupSideLevels(book.asks, "asks", interval).slice(
      0,
      VISIBLE_BUCKETS,
    ),
  }
}
