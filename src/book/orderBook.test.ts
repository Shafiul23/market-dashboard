import { describe, expect, it } from "vitest"
import { unsortedSnapshot } from "./fixtures"
import { createOrderBook, selectTopLevels } from "./orderBook"

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
