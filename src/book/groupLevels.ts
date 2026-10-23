import type Big from "big.js"
import { compareParsedDecimals, parseDecimal } from "../lib/decimal"
import type { PriceLevel, ReadonlyOrderBook } from "./orderBook"

type BucketTotal = {
  price: string
  parsedPrice: Big
  quantity: Big
}

const VISIBLE_BUCKETS = 10

export type PriceBucket = PriceLevel & {
  readonly id: string
}

export function groupSideLevels(
  levels: ReadonlyMap<string, PriceLevel>,
  side: "bids" | "asks",
  interval: string,
  limit = Infinity,
): PriceBucket[] {
  const step = parseDecimal(interval)
  const intervalKey = step.toFixed()
  const buckets = new Map<string, BucketTotal>()

  for (const level of levels.values()) {
    const price = parseDecimal(level.price)
    const remainder = price.mod(step)
    const boundary =
      side === "asks" && !remainder.eq("0")
        ? price.minus(remainder).plus(step)
        : price.minus(remainder)
    const key = boundary.toFixed()
    const existing = buckets.get(key)
    if (existing) {
      existing.quantity = existing.quantity.plus(level.quantity)
    } else {
      buckets.set(key, {
        price: key,
        parsedPrice: boundary,
        quantity: parseDecimal(level.quantity),
      })
    }
  }

  const candidates = [...buckets.values()]
  const count = Math.min(limit, candidates.length)

  function compareBuckets(left: BucketTotal, right: BucketTotal): number {
    return side === "bids"
      ? compareParsedDecimals(right.parsedPrice, left.parsedPrice)
      : compareParsedDecimals(left.parsedPrice, right.parsedPrice)
  }

  if (count === candidates.length) {
    candidates.sort(compareBuckets)
  } else {
    // Select the next best bucket into each of the first `count` positions.
    // The remaining buckets do not need to be sorted.
    for (let position = 0; position < count; position++) {
      let best = position
      for (let index = position + 1; index < candidates.length; index++) {
        if (compareBuckets(candidates[index], candidates[best]) < 0) {
          best = index
        }
      }
      const displaced = candidates[position]
      candidates[position] = candidates[best]
      candidates[best] = displaced
    }
  }

  const result: PriceBucket[] = []
  for (let index = 0; index < count; index++) {
    const bucket = candidates[index]
    result.push({
      id: `${side}:${intervalKey}:${bucket.price}`,
      price: bucket.price,
      quantity: bucket.quantity.toFixed(),
    })
  }
  return result
}

export function groupLevels(
  book: ReadonlyOrderBook,
  interval: string,
): {
  bids: PriceBucket[]
  asks: PriceBucket[]
} {
  return {
    bids: groupSideLevels(book.bids, "bids", interval, VISIBLE_BUCKETS),
    asks: groupSideLevels(book.asks, "asks", interval, VISIBLE_BUCKETS),
  }
}
