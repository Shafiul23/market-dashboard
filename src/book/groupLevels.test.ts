import { describe, expect, it } from "vitest"
import { parseDecimal } from "../lib/decimal"
import { groupLevels, groupSideLevels } from "./groupLevels"
import { applyChanges, createOrderBook } from "./orderBook"
import type { PriceLevel, SnapshotLevel } from "./orderBook"

function total(levels: Iterable<PriceLevel>): string {
  let quantity = parseDecimal("0")
  for (const level of levels) quantity = quantity.plus(level.quantity)
  return quantity.toFixed()
}

describe("groupLevels", () => {
  it("keeps exact boundaries and rounds fractional bids down and asks up", () => {
    const book = createOrderBook({
      bids: [["101.01", "0.1"], ["102", "0.2"], ["101.99", "0.2"]],
      asks: [["102.01", "0.1"], ["102", "0.2"], ["103.99", "0.2"]],
    })

    expect(groupLevels(book, "2")).toEqual({
      bids: [
        { id: "bids:2:102", price: "102", quantity: "0.2" },
        { id: "bids:2:100", price: "100", quantity: "0.3" },
      ],
      asks: [
        { id: "asks:2:102", price: "102", quantity: "0.2" },
        { id: "asks:2:104", price: "104", quantity: "0.3" },
      ],
    })
  })

  it.each(["1", "2", "3", "10", "100", "100000000000000000000"])(
    "accepts the whole-pound interval %s", (interval) => {
      expect(groupLevels(createOrderBook({ bids: [], asks: [] }), interval))
        .toEqual({ bids: [], asks: [] })
    },
  )

  it("canonicalises bucket identity and distinguishes sides and intervals", () => {
    const book = createOrderBook({ bids: [["100.00", "1"]], asks: [["100", "2"]] })
    const grouped = groupLevels(book, "1")

    expect(groupLevels(book, "1.00")).toEqual(grouped)
    expect(grouped.bids[0].id).toBe("bids:1:100")
    expect(grouped.asks[0].id).toBe("asks:1:100")
    expect(groupLevels(book, "2").bids[0].id).toBe("bids:2:100")
  })

  it.each(["bids", "asks"] as const)("handles an empty %s side", (side) => {
    const book = createOrderBook({ bids: [["99.5", "1"]], asks: [["100.5", "2"]] })
    book[side].clear()
    const grouped = groupLevels(book, "1")

    expect(grouped[side]).toEqual([])
    expect(grouped[side === "bids" ? "asks" : "bids"]).toHaveLength(1)
  })

  it("preserves large prices, large quantities and tiny quantities exactly", () => {
    const levels: SnapshotLevel[] = [
      ["9007199254740993.01", "9007199254740993.1"],
      ["9007199254740993.99", "0.0000000000000000000000001"],
    ]
    const grouped = groupLevels(createOrderBook({ bids: levels, asks: levels }), "1")

    expect(grouped.bids[0].price).toBe("9007199254740993")
    expect(grouped.asks[0].price).toBe("9007199254740994")
    expect(grouped.bids[0].quantity).toBe("9007199254740993.1000000000000000000000001")
    expect(grouped.asks[0].quantity).toBe(grouped.bids[0].quantity)
  })

  it("does not round a price just below a boundary onto that boundary", () => {
    const levels: SnapshotLevel[] = [["0.9999999999999999999999999", "1"]]
    const grouped = groupLevels(createOrderBook({ bids: levels, asks: levels }), "1")

    expect(grouped.bids[0].price).toBe("0")
    expect(grouped.asks[0].price).toBe("1")
  })

  it("includes depth beyond the raw top ten before selecting ten buckets", () => {
    const book = createOrderBook({
      bids: Array.from({ length: 120 }, (_, i) => [`${101 - Math.floor(i / 10)}.${99 - i % 10}`, "0.1"]),
      asks: Array.from({ length: 120 }, (_, i) => [`${100 + Math.floor(i / 10)}.${10 + i % 10}`, "0.2"]),
    })
    const grouped = groupLevels(book, "2")

    // Raw levels 11–20 join the best bucket on each side.
    expect(grouped.bids[0]).toMatchObject({ price: "100", quantity: "2" })
    expect(grouped.asks[0]).toMatchObject({ price: "102", quantity: "4" })
    const pounds = groupLevels(book, "1")
    expect(pounds.bids.map((bucket) => bucket.price)).toEqual([
      "101", "100", "99", "98", "97", "96", "95", "94", "93", "92",
    ])
    expect(pounds.asks.map((bucket) => bucket.price)).toEqual([
      "101", "102", "103", "104", "105", "106", "107", "108", "109", "110",
    ])
    expect(pounds.bids[9].quantity).toBe("1")
    expect(pounds.asks[9].quantity).toBe("2")

    for (const side of ["bids", "asks"] as const) {
      const all = groupSideLevels(book[side], side, "1")
      expect(all).toHaveLength(12)
      expect(total(all)).toBe(total(book[side].values()))
      for (const interval of ["2", "3", "100"]) {
        expect(total(groupSideLevels(book[side], side, interval)))
          .toBe(total(book[side].values()))
      }
    }
  })

  it("recomputes replacements and removes a bucket after its last level is deleted", () => {
    const book = createOrderBook({
      bids: [["100.1", "0.1"], ["100.9", "0.2"]],
      asks: [["101.1", "0.1"], ["101.9", "0.2"]],
    })
    const before = groupLevels(book, "1")
    applyChanges(book, [["buy", "100.1", "0.4"], ["sell", "101.1", "0.4"]])
    expect(groupLevels(book, "1").bids[0].quantity).toBe("0.6")
    expect(groupLevels(book, "1").asks[0].quantity).toBe("0.6")
    applyChanges(book, [["buy", "100.1", "0"], ["sell", "101.1", "0"]])
    expect(groupLevels(book, "1").bids[0].quantity).toBe("0.2")
    expect(groupLevels(book, "1").asks[0].quantity).toBe("0.2")
    applyChanges(book, [["buy", "100.9", "0"], ["sell", "101.9", "0"]])
    expect(groupLevels(book, "1")).toEqual({ bids: [], asks: [] })
    expect(before.bids[0].quantity).toBe("0.3")
    expect(before.asks[0].quantity).toBe("0.3")
  })

  it("preserves the raw book, quantities and map insertion order", () => {
    const snapshot = {
      bids: [["99.99", "0.1000"], ["100.01", "0.2000"]],
      asks: [["102.99", "0.3000"], ["101.01", "0.4000"]],
    } as const
    const book = createOrderBook(snapshot)
    const original = createOrderBook(snapshot)
    groupLevels(book, "1")

    expect(book).toEqual(original)
    expect([...book.bids]).toEqual([...original.bids])
    expect([...book.asks]).toEqual([...original.asks])
  })
})
