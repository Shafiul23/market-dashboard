import { canonicalPrice, compareDecimals } from "../lib/decimal"

export type SnapshotLevel = readonly [price: string, quantity: string]

export type BookChange = readonly [
  side: "buy" | "sell",
  price: string,
  quantity: string,
]

export type BookSnapshot = {
  bids: readonly SnapshotLevel[]
  asks: readonly SnapshotLevel[]
}

export type PriceLevel = {
  readonly price: string
  readonly quantity: string
}

export type OrderBook = {
  bids: Map<string, PriceLevel>
  asks: Map<string, PriceLevel>
}

export type ReadonlyOrderBook = {
  readonly bids: ReadonlyMap<string, PriceLevel>
  readonly asks: ReadonlyMap<string, PriceLevel>
}

const VISIBLE_LEVELS = 10

function applyLevel(
  levels: Map<string, PriceLevel>,
  price: string,
  quantity: string,
): void {
  const key = canonicalPrice(price)

  if (compareDecimals(quantity, "0") === 0) {
    levels.delete(key)
  } else {
    levels.set(key, { price: key, quantity })
  }
}

function loadSide(
  snapshotLevels: readonly SnapshotLevel[],
): Map<string, PriceLevel> {
  const levels = new Map<string, PriceLevel>()

  for (const [price, quantity] of snapshotLevels) {
    applyLevel(levels, price, quantity)
  }

  return levels
}

export function createOrderBook(snapshot: BookSnapshot): OrderBook {
  return {
    bids: loadSide(snapshot.bids),
    asks: loadSide(snapshot.asks),
  }
}

export function applyChanges(
  book: OrderBook,
  changes: readonly BookChange[],
): void {
  for (const [side, price, quantity] of changes) {
    applyLevel(side === "buy" ? book.bids : book.asks, price, quantity)
  }
}

function selectSideLevels(
  levels: ReadonlyMap<string, PriceLevel>,
  side: "bids" | "asks",
): PriceLevel[] {
  const selected: PriceLevel[] = []

  for (const level of levels.values()) {
    let index = -1
    for (let i = selected.length - 1; i >= 0; i--) {
      const comparison = compareDecimals(level.price, selected[i].price)

      if (
        (side === "bids" && comparison <= 0) ||
        (side === "asks" && comparison >= 0)
      ) {
        break
      }

      if (side === "bids" && comparison > 0) {
        index = i
      }

      if (comparison < 0) {
        index = i
      }
    }

    if (index === -1) {
      if (selected.length < VISIBLE_LEVELS) selected.push(level)
    } else {
      selected.splice(index, 0, level)
      if (selected.length > VISIBLE_LEVELS) selected.pop()
    }
  }

  return selected
}

export function selectTopLevels(book: ReadonlyOrderBook): {
  bids: PriceLevel[]
  asks: PriceLevel[]
} {
  return {
    bids: selectSideLevels(book.bids, "bids"),
    asks: selectSideLevels(book.asks, "asks"),
  }
}
