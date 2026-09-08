import { describe, expect, it } from "vitest"
import { demonstrationChanges, unsortedSnapshot } from "./fixtures"
import { applyChanges, createOrderBook, selectTopLevels } from "./orderBook"

describe("createOrderBook", () => {
  it("loads every level from both sides of a snapshot", () => {
    const book = createOrderBook(unsortedSnapshot)

    expect(book.bids.size).toBe(12)
    expect(book.asks.size).toBe(12)
    expect(book.bids.get("100")).toEqual({ price: "100", quantity: "1.00000000" })
    expect(book.asks.get("100.1")).toEqual({ price: "100.1", quantity: "1.00000000" })
  })

  it("uses one canonical key per price, independently on each side", () => {
    const book = createOrderBook({
      bids: [["100.0", "1.00000000"], ["100.00", "2.00000000"]],
      asks: [["100.00", "3.00000000"]],
    })

    expect(book.bids.size).toBe(1)
    expect(book.bids.get("100")?.quantity).toBe("2.00000000")
    expect(book.asks.size).toBe(1)
    expect(book.asks.get("100")?.quantity).toBe("3.00000000")
  })

  it("omits zero quantities without dropping small positive quantities", () => {
    const book = createOrderBook({
      bids: [["100", "0"], ["99", "0.00000000"], ["98", "0.00000001"]],
      asks: [["101", "0.0"], ["102", "2.00000000"]],
    })

    expect([...book.bids.values()]).toEqual([{ price: "98", quantity: "0.00000001" }])
    expect([...book.asks.values()]).toEqual([{ price: "102", quantity: "2.00000000" }])
  })

  it("uses the final total if an equivalent price appears again with zero quantity", () => {
    const book = createOrderBook({
      bids: [["100.0", "1"], ["100.00", "0"]],
      asks: [],
    })

    expect(book.bids.size).toBe(0)
  })

  it("replaces the whole book by loading a fresh snapshot", () => {
    let book = createOrderBook(unsortedSnapshot)
    const previousBook = book

    book = createOrderBook({ bids: [["200.00", "0.5"]], asks: [] })

    expect([...book.bids.values()]).toEqual([{ price: "200", quantity: "0.5" }])
    expect(book.asks.size).toBe(0)
    expect(previousBook.bids.size).toBe(12)
    expect(previousBook.asks.size).toBe(12)
  })
})

describe("applyChanges", () => {
  it("runs the insert, replace, and remove demonstration on both sides", () => {
    const book = createOrderBook(unsortedSnapshot)
    const initialTop = selectTopLevels(book)

    applyChanges(book, demonstrationChanges[0])

    expect(selectTopLevels(book).bids[0]).toEqual({ price: "100.01", quantity: "2.00000000" })
    expect(selectTopLevels(book).asks[0]).toEqual({ price: "100.09", quantity: "3.00000000" })
    expect(book.bids.size).toBe(13)
    expect(book.asks.size).toBe(13)

    applyChanges(book, demonstrationChanges[1])

    expect(book.bids.get("100.01")?.quantity).toBe("4.00000000")
    expect(book.asks.get("100.09")?.quantity).toBe("5.00000000")
    expect(book.bids.size).toBe(13)
    expect(book.asks.size).toBe(13)

    applyChanges(book, demonstrationChanges[2])

    expect(book.bids.has("100.01")).toBe(false)
    expect(book.asks.has("100.09")).toBe(false)
    expect(book.bids.size).toBe(12)
    expect(book.asks.size).toBe(12)
    expect(selectTopLevels(book)).toEqual(initialTop)
  })

  it("leaves the book unchanged for unknown deletions and empty batches", () => {
    const book = createOrderBook(unsortedSnapshot)
    const original = createOrderBook(unsortedSnapshot)

    applyChanges(book, [["buy", "90", "0"], ["sell", "110", "0.00000000"]])
    applyChanges(book, [])

    expect(book).toEqual(original)
  })

  it.each([
    { side: "buy", key: "bids", best: "100", deeper: "99.90", canonical: "99.9" },
    { side: "sell", key: "asks", best: "100.1", deeper: "100.20", canonical: "100.2" },
  ] as const)("updates an off-screen $side level before removal promotes it", ({ side, key, best, deeper, canonical }) => {
    const book = createOrderBook(unsortedSnapshot)
    const originalTop = selectTopLevels(book)[key]

    applyChanges(book, [[side, deeper, "7.00000000"]])

    expect(selectTopLevels(book)[key]).toEqual(originalTop)
    expect(book[key].get(canonical)?.quantity).toBe("7.00000000")

    applyChanges(book, [[side, best, "0.00000000"]])

    const top = selectTopLevels(book)[key]
    expect(book[key].has(best)).toBe(false)
    expect(book[key].size).toBe(11)
    expect(top).toHaveLength(10)
    expect(top.slice(0, 9)).toEqual(originalTop.slice(1))
    expect(top[9]).toEqual({ price: canonical, quantity: "7.00000000" })

    applyChanges(book, [[side, best, "2.00000000"]])

    expect(book[key].size).toBe(12)
    expect(selectTopLevels(book)[key]).toEqual([
      { price: best, quantity: "2.00000000" },
      ...originalTop.slice(1),
    ])
    expect(book[key].get(canonical)?.quantity).toBe("7.00000000")
  })

  it.each(["buy", "sell"] as const)("applies repeated %s replacements, removals, and refills in order", (side) => {
    const book = createOrderBook({ bids: [], asks: [] })
    const levels = side === "buy" ? book.bids : book.asks

    applyChanges(book, [
      [side, "100.0", "2"],
      [side, "100.00", "3"],
      [side, "100", "0.00000000"],
      [side, "100.000", "4"],
      [side, "100", "5"],
    ])

    expect([...levels.values()]).toEqual([{ price: "100", quantity: "5" }])

    applyChanges(book, [[side, "100.00", "5"], [side, "100.0", "5"]])

    expect([...levels.values()]).toEqual([{ price: "100", quantity: "5" }])

    applyChanges(book, [[side, "100", "6"], [side, "100.00", "0"]])

    expect(levels.size).toBe(0)
    expect(selectTopLevels(book)).toEqual({ bids: [], asks: [] })
  })

  it("keeps changes to the same price independent on each side", () => {
    const book = createOrderBook({ bids: [["100", "1"]], asks: [["100", "2"]] })

    applyChanges(book, [["buy", "100.00", "3"], ["sell", "100.0", "4"], ["buy", "100", "0"]])

    expect(book.bids.size).toBe(0)
    expect([...book.asks.values()]).toEqual([{ price: "100", quantity: "4" }])
  })

  it("preserves precise prices and tiny positive quantities when updating", () => {
    const book = createOrderBook({
      bids: [["9007199254740993.001", "1"]],
      asks: [],
    })

    applyChanges(book, [
      ["buy", "9007199254740993.0010", "0.00000000000000000001"],
      ["buy", "9007199254740993.002", "2"],
    ])

    expect(selectTopLevels(book).bids).toEqual([
      { price: "9007199254740993.002", quantity: "2" },
      { price: "9007199254740993.001", quantity: "0.00000000000000000001" },
    ])
    expect(book.bids.size).toBe(2)
  })
})

describe("selectTopLevels", () => {
  it("selects ten bids descending and ten asks ascending from an unsorted snapshot", () => {
    const book = createOrderBook(unsortedSnapshot)
    const top = selectTopLevels(book)

    expect(top.bids.map((level) => level.price)).toEqual([
      "100", "99.99", "99.98", "99.97", "99.96",
      "99.95", "99.94", "99.93", "99.92", "99.91",
    ])
    expect(top.asks.map((level) => level.price)).toEqual([
      "100.1", "100.11", "100.12", "100.13", "100.14",
      "100.15", "100.16", "100.17", "100.18", "100.19",
    ])
  })

  it("leaves deeper levels and the maps' insertion order intact", () => {
    const book = createOrderBook(unsortedSnapshot)
    const originalBids = [...book.bids.values()]
    const originalAsks = [...book.asks.values()]

    selectTopLevels(book)

    expect([...book.bids.values()]).toEqual(originalBids)
    expect([...book.asks.values()]).toEqual(originalAsks)
    expect(book.bids.has("99.9")).toBe(true)
    expect(book.bids.has("99.89")).toBe(true)
    expect(book.asks.has("100.2")).toBe(true)
    expect(book.asks.has("100.21")).toBe(true)
  })

  it("returns empty arrays for an empty snapshot", () => {
    expect(selectTopLevels(createOrderBook({ bids: [], asks: [] }))).toEqual({
      bids: [],
      asks: [],
    })
  })

  it("returns only available levels when either side has fewer than ten", () => {
    const book = createOrderBook({
      bids: [["100", "1"]],
      asks: [["102", "3"], ["101", "2"]],
    })

    expect(selectTopLevels(book)).toEqual({
      bids: [{ price: "100", quantity: "1" }],
      asks: [{ price: "101", quantity: "2" }, { price: "102", quantity: "3" }],
    })
  })

  it("handles an empty side independently of the other side", () => {
    const book = createOrderBook({ bids: [], asks: [["101", "2"]] })

    expect(selectTopLevels(book)).toEqual({
      bids: [],
      asks: [{ price: "101", quantity: "2" }],
    })
  })

  it("preserves and orders distinct prices beyond floating-point precision", () => {
    const book = createOrderBook({
      bids: [
        ["9007199254740993.001", "0.00000000000000000001"],
        ["9007199254740993.002", "2"],
      ],
      asks: [
        ["9007199254740994.002", "3"],
        ["9007199254740994.001", "4"],
      ],
    })

    expect(selectTopLevels(book)).toEqual({
      bids: [
        { price: "9007199254740993.002", quantity: "2" },
        { price: "9007199254740993.001", quantity: "0.00000000000000000001" },
      ],
      asks: [
        { price: "9007199254740994.001", quantity: "4" },
        { price: "9007199254740994.002", quantity: "3" },
      ],
    })
  })
})
