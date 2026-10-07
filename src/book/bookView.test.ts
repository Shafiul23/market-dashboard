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

  it.each(["bids", "asks"] as const)(
    "scales both sides by the largest visible quantity on %s",
    (side) => {
      const opposite = side === "bids" ? "asks" : "bids"
      const book = createOrderBook({
        bids: [["100", "1"]],
        asks: [["101", "1"]],
      })
      applyChanges(book, [[side === "bids" ? "buy" : "sell", "99", "2"]])
      const view = createBookView(book, null)

      expect(
        view[side].find((row) => row.quantity === "2")?.quantityProportion,
      ).toBe(1)
      expect(
        view[side].find((row) => row.quantity === "1")?.quantityProportion,
      ).toBe(0.5)
      expect(view[opposite][0].quantityProportion).toBe(0.5)
    },
  )

  it("ignores quantities outside the visible top ten on either side", () => {
    const book = createOrderBook(unsortedSnapshot)
    applyChanges(book, [
      ["buy", "99.89", "1000"],
      ["sell", "100.21", "2000"],
    ])
    const view = createBookView(book, null)

    for (const row of [...view.bids, ...view.asks]) {
      expect(row.quantityProportion).toBe(1)
    }
  })

  it.each([
    ["0.00000000000000000002", "0.00000000000000000001", 0.5],
    ["2e-400", "1e-400", 0.5],
    ["2e400", "1e400", 0.5],
    ["3", "1", 1 / 3],
  ])(
    "divides exact quantities %s and %s before numeric conversion",
    (maximum, quantity, expected) => {
      const view = createBookView(
        createOrderBook({
          bids: [["100", maximum]],
          asks: [["101", quantity]],
        }),
        null,
      )

      expect(view.bids[0].quantityProportion).toBe(1)
      expect(view.asks[0].quantityProportion).toBe(expected)
      expect(view.asks[0].quantity).toBe(quantity)
    },
  )

  it("returns zero proportions when the visible maximum is zero", () => {
    const book = {
      bids: new Map([["100", { price: "100", quantity: "0" }]]),
      asks: new Map([["101", { price: "101", quantity: "0.00" }]]),
    }
    const view = createBookView(book, null)

    expect(view.bids[0].quantityProportion).toBe(0)
    expect(view.asks[0].quantityProportion).toBe(0)
  })

  it("rescales an unchanged quantity when the opposite maximum changes", () => {
    const book = createOrderBook({
      bids: [["100.00", "1.00"]],
      asks: [["101", "2"]],
    })
    const previous = createBookView(book, null)

    applyChanges(book, [["sell", "101", "4"]])
    const view = createBookView(book, null)

    expect(previous.bids[0].quantityProportion).toBe(0.5)
    expect(view.bids[0]).toEqual({
      ...previous.bids[0],
      quantityProportion: 0.25,
    })
    expect(view.asks[0].quantityProportion).toBe(1)
    expect([...book.bids.keys()]).toEqual(["100"])
    expect([...book.asks.keys()]).toEqual(["101"])
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
      expect(view.bids.map((row) => row.quantityProportion)).toEqual(
        book.bids.size ? [1] : [],
      )
      expect(view.asks.map((row) => row.quantityProportion)).toEqual(
        book.asks.size ? [1] : [],
      )
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

describe("grouped createBookView", () => {
  const snapshot = {
    bids: [["99.5", "1"], ["100.991", "0.1"], ["100.5", "0.2"]],
    asks: [["102.5", "0.5"], ["101.001", "0.2"], ["101.5", "0.4"]],
  } as const

  it("orders bucket boundaries while keeping exact headline values and labels", () => {
    const book = createOrderBook(snapshot)
    const raw = createBookView(book, receivedAt)
    const view = createBookView(book, receivedAt, "1.00")

    expect(view.groupingInterval).toBe("1")
    expect(view.bids.map((row) => row.price)).toEqual(["100", "99"])
    expect(view.asks.map((row) => row.price)).toEqual(["102", "103"])
    expect(view.bids.map((row) => row.id)).toEqual(["bids:1:100", "bids:1:99"])
    expect(view.asks.map((row) => row.id)).toEqual(["asks:1:102", "asks:1:103"])
    expect(view.bestBid).toBe("100.991")
    expect(view.bestAsk).toBe("101.001")
    expect(view.spread).toBe("0.01")
    expect(view.bestBidLabel).toBe(raw.bestBidLabel)
    expect(view.bestAskLabel).toBe(raw.bestAskLabel)
    expect(view.spreadLabel).toBe(raw.spreadLabel)
    expect(view.spreadLabel).toBe("0.010")
    expect(view.receiptLabel).toBe(raw.receiptLabel)
  })

  it("uses shared display precision and scales bars from bucket totals on both sides", () => {
    const view = createBookView(createOrderBook(snapshot), null, "1")

    expect(view.bids.map((row) => row.priceLabel)).toEqual(["100.00", "99.00"])
    expect(view.asks.map((row) => row.priceLabel)).toEqual(["102.00", "103.00"])
    expect(view.bids.map((row) => row.quantityLabel)).toEqual(["0.30000000", "1.00000000"])
    expect(view.asks.map((row) => row.quantityLabel)).toEqual(["0.60000000", "0.50000000"])
    expect(view.bids.map((row) => row.quantityProportion)).toEqual([0.3, 1])
    expect(view.asks.map((row) => row.quantityProportion)).toEqual([0.6, 0.5])
  })

  it("includes deeper raw levels in visible buckets and excludes hidden buckets from bar scaling", () => {
    const book = createOrderBook({
      bids: Array.from({ length: 120 }, (_, i) => [`${100 - Math.floor(i / 10)}.${99 - i % 10}`, "0.1"]),
      asks: Array.from({ length: 120 }, (_, i) => [`${101 + Math.floor(i / 10)}.${10 + i % 10}`, "0.2"]),
    })
    applyChanges(book, [["buy", "89.99", "1000"], ["sell", "112.1", "2000"]])
    const view = createBookView(book, null, "1")

    expect(view.bids.map((row) => row.price)).toEqual([
      "100", "99", "98", "97", "96", "95", "94", "93", "92", "91",
    ])
    expect(view.asks.map((row) => row.price)).toEqual([
      "102", "103", "104", "105", "106", "107", "108", "109", "110", "111",
    ])
    expect(view.bids.every((row) => row.quantity === "1" && row.quantityProportion === 0.5)).toBe(true)
    expect(view.asks.every((row) => row.quantity === "2" && row.quantityProportion === 1)).toBe(true)
  })

  it("preserves tiny aggregated quantities with consistent column precision", () => {
    const view = createBookView(createOrderBook({
      bids: [["100.1", "0.00000000000000000001"], ["100.2", "0.00000000000000000001"]],
      asks: [["101.1", "0.00000000000000000001"]],
    }), null, "1")

    expect(view.bids[0].quantityLabel).toBe("0.00000000000000000002")
    expect(view.asks[0].quantityLabel).toBe("0.00000000000000000001")
    expect(view.bids[0].quantityProportion).toBe(1)
    expect(view.asks[0].quantityProportion).toBe(0.5)
  })

  it.each(["bids", "asks", "both"] as const)("handles short sides and empty %s", (empty) => {
    const book = createOrderBook({
      bids: empty === "bids" || empty === "both" ? [] : [["100.25", "1"]],
      asks: empty === "asks" || empty === "both" ? [] : [["101.25", "1"]],
    })
    const view = createBookView(book, null, "5")

    expect(view.bids.map((row) => row.price)).toEqual(book.bids.size ? ["100"] : [])
    expect(view.asks.map((row) => row.price)).toEqual(book.asks.size ? ["105"] : [])
    expect(view.bestBid).toBe(book.bids.size ? "100.25" : null)
    expect(view.bestAsk).toBe(book.asks.size ? "101.25" : null)
    expect(view.bestBidLabel).toBe(book.bids.size ? "100.25" : "—")
    expect(view.bestAskLabel).toBe(book.asks.size ? "101.25" : "—")
    expect(view.spread).toBeNull()
    expect(view.spreadLabel).toBe("—")
    expect(view.receiptLabel).toBe("—")
    for (const row of [...view.bids, ...view.asks]) {
      expect(row.quantityProportion).toBe(1)
    }
  })

  it("toggles grouping and intervals without mutating the book or earlier views", () => {
    const book = createOrderBook(snapshot)
    const original = createOrderBook(snapshot)
    const raw = createBookView(book, receivedAt)
    const grouped = createBookView(book, receivedAt, "1")
    const wider = createBookView(book, receivedAt, "5")

    expect(raw.groupingInterval).toBeNull()
    expect(wider.bids[0].id).toBe("bids:5:100")
    expect(wider.asks[0].price).toBe("105")
    expect(createBookView(book, receivedAt, null)).toEqual(raw)
    expect(createBookView(book, receivedAt, "1")).toEqual(grouped)
    expect(book).toEqual(original)

    applyChanges(book, [["buy", "100.991", "0"], ["sell", "101.001", "0"]])
    const next = createBookView(book, receivedAt + 1, "1")

    expect(next.bestBid).toBe("100.5")
    expect(next.bestAsk).toBe("101.5")
    expect(next.spread).toBe("1")
    expect(next.bids[0].quantity).toBe("0.2")
    expect(next.asks[0].quantity).toBe("0.4")
    expect(next.bids[0].id).toBe(grouped.bids[0].id)
    expect(next.asks[0].id).toBe(grouped.asks[0].id)
    expect(grouped.bestBid).toBe("100.991")
    expect(grouped.spread).toBe("0.01")
    expect(grouped.bids[0].quantity).toBe("0.3")
    expect(grouped.asks[0].quantity).toBe("0.6")
  })
})
