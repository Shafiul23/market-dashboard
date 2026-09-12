import { describe, expect, it } from "vitest"
import { createBookView } from "./bookView"
import { unsortedSnapshot } from "./fixtures"
import { applyChanges, createOrderBook, selectTopLevels } from "./orderBook"

const receivedAt = Date.parse("2026-09-09T14:32:08.123Z")

describe("createBookView", () => {
  it("contains the sorted top ten and derives headlines from their first rows", () => {
    const book = createOrderBook(unsortedSnapshot)
    const view = createBookView(book, receivedAt)
    const top = selectTopLevels(book)
    // console.log(JSON.stringify(view))

    for (const side of ["bids", "asks"] as const) {
      expect(view[side]).toHaveLength(10)
      expect(
        view[side].map(({ price, quantity }) => ({ price, quantity })),
      ).toEqual(top[side])
    }
    expect(view.bestBid).toBe(view.bids[0].price)
    expect(view.bestAsk).toBe(view.asks[0].price)
    expect(view.bestBidLabel).toBe(view.bids[0].priceLabel)
    expect(view.bestAskLabel).toBe(view.asks[0].priceLabel)
    expect(view.spread).toBe("0.1")
    expect(view.spreadLabel).toBe("0.10")
    expect(view.receiptLabel).toBe("Received 2026-09-09 14:32:08.123 UTC")
  })

  it.each([
    ["buy", "100", "99.99", "100.1"],
    ["sell", "100.1", "100", "100.11"],
  ] as const)(
    "recomputes headlines and spread after removing the best %s level",
    (side, price, bestBid, bestAsk) => {
      const book = createOrderBook(unsortedSnapshot)
      const previous = createBookView(book, receivedAt)

      applyChanges(book, [[side, price, "0"]])
      const view = createBookView(book, receivedAt + 1)

      expect(view.bestBid).toBe(bestBid)
      expect(view.bestAsk).toBe(bestAsk)
      expect(view.bestBid).toBe(view.bids[0].price)
      expect(view.bestAsk).toBe(view.asks[0].price)
      expect(view.bestBidLabel).toBe(view.bids[0].priceLabel)
      expect(view.bestAskLabel).toBe(view.asks[0].priceLabel)
      expect(view.spread).toBe("0.11")
      expect(view.spreadLabel).toBe("0.11")
      expect(previous.spread).toBe("0.1")
    },
  )

  it.each(["bids", "asks", "both"] as const)(
    "uses placeholders when %s are empty",
    (empty) => {
      const book = createOrderBook({
        bids: empty === "bids" || empty === "both" ? [] : [["100", "1"]],
        asks: empty === "asks" || empty === "both" ? [] : [["101", "1"]],
      })
      const view = createBookView(book, null)

      expect(view.bestBid).toBe(book.bids.size ? "100" : null)
      expect(view.bestAsk).toBe(book.asks.size ? "101" : null)
      expect(view.bestBidLabel).toBe(book.bids.size ? "100.00" : "—")
      expect(view.bestAskLabel).toBe(book.asks.size ? "101.00" : "—")
      expect(view.spread).toBeNull()
      expect(view.spreadLabel).toBe("—")
      expect(view.receiptLabel).toBe("—")
    },
  )

  it.each([
    ["9007199254740993.001", "9007199254740993.002", "0.001", "0.001"],
    ["100.001", "100.001", "0", "0.000"],
    ["100.002", "100.001", "-0.001", "-0.001"],
  ])(
    "calculates the exact spread for bid %s and ask %s",
    (bid, ask, spread, label) => {
      const view = createBookView(
        createOrderBook({ bids: [[bid, "1"]], asks: [[ask, "1"]] }),
        null,
      )

      expect(view.spread).toBe(spread)
      expect(view.spreadLabel).toBe(label)
    },
  )

  it("retains distinct exact prices and tiny quantities with shared column precision", () => {
    const book = createOrderBook({
      bids: [
        ["60000.001", "0.00000000000000000001"],
        ["60000.002", "1234.5"],
      ],
      asks: [["60001", "2"]],
    })
    const view = createBookView(book, null)

    expect(view.bids.map((row) => row.id)).toEqual(["60000.002", "60000.001"])
    expect(view.bids.map((row) => row.priceLabel)).toEqual([
      "60,000.002",
      "60,000.001",
    ])
    expect(view.asks[0].priceLabel).toBe("60,001.000")
    expect(view.bids[0].quantityLabel).toBe("1,234.50000000000000000000")
    expect(view.bids[1].quantityLabel).toBe("0.00000000000000000001")
    expect(view.asks[0].quantityLabel).toBe("2.00000000000000000000")

    applyChanges(book, [["sell", "60000.9999", "1"]])
    const next = createBookView(book, null)

    expect(next.bids[0].priceLabel).toBe("60,000.0020")
    expect(next.bids[0].id).toBe(view.bids[0].id)
  })

  it("returns independent copies without mutating the source book", () => {
    const book = createOrderBook(unsortedSnapshot)
    const original = createOrderBook(unsortedSnapshot)
    const view = createBookView(book, receivedAt)

    expect(book).toEqual(original)
    for (const side of ["bids", "asks"] as const) {
      for (const row of view[side]) {
        expect(row).not.toBe(book[side].get(row.id))
      }
    }

    applyChanges(book, [
      ["buy", "100", "7"],
      ["sell", "100.1", "0"],
    ])

    expect(view.bids[0].quantity).toBe("1.00000000")
    expect(view.asks[0].price).toBe("100.1")
    expect(view.spread).toBe("0.1")
  })
})
