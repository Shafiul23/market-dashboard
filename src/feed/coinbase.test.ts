import { describe, expect, it } from "vitest"
import { applyChanges, createOrderBook } from "../book/orderBook"
import { decodeCoinbaseMessage } from "./coinbase"
import {
  errorMessage,
  heartbeatMessage,
  snapshotMessage,
  subscriptionsMessage,
  updateMessage,
} from "./fixtures"

function decode(value: unknown) {
  return decodeCoinbaseMessage(JSON.stringify(value))
}

describe("decodeCoinbaseMessage", () => {
  it.each([
    snapshotMessage,
    updateMessage,
    heartbeatMessage,
    subscriptionsMessage,
  ])("recognises a valid $type message", (message) =>
    expect(decode(message)).toEqual(message),
  )

  it("passes snapshots and replacement/deletion updates to the book", () => {
    const snapshot = decode(snapshotMessage)
    const update = decode(updateMessage)
    if (snapshot?.type !== "snapshot" || update?.type !== "l2update") {
      throw new Error("Expected book messages")
    }

    const book = createOrderBook(snapshot)
    applyChanges(book, update.changes)

    expect([...book.bids.values()]).toEqual([
      { price: "100", quantity: "3.00000000" },
    ])
    expect(book.asks.size).toBe(0)
  })

  it("preserves decimal precision and spelling", () => {
    const changes = [["buy", "9007199254740993.0010", "0.00000000000000000001"]]
    expect(decode({ ...updateMessage, changes })).toEqual({
      ...updateMessage,
      changes,
    })
  })

  it("accepts empty books, change batches, and subscription lists", () => {
    for (const message of [
      { ...snapshotMessage, bids: [], asks: [] },
      { ...updateMessage, changes: [] },
      { ...subscriptionsMessage, channels: [] },
    ]) {
      expect(decode(message)).toEqual(message)
    }
  })

  it.each(["", "{", "undefined", '{"type":"snapshot",}'])(
    "rejects malformed JSON %j",
    (raw) => {
      expect(() => decodeCoinbaseMessage(raw)).toThrow("Invalid Coinbase JSON")
    },
  )

  it.each(
    [
      null,
      [],
      1,
      "snapshot",
      {},
      { type: null },
      { type: 1 },
      { type: "" },
    ].map((value) => ({ value })),
  )("rejects an invalid message envelope $value", ({ value }) =>
    expect(() => decode(value)).toThrow("Invalid Coinbase message"),
  )

  it("ignores unsupported message types without inspecting their payload", () => {
    expect(
      decode({ type: "ticker", product_id: "BTC-USD", price: null }),
    ).toBeNull()
    expect(decode({ type: "future-message" })).toBeNull()
  })

  it.each(["snapshot", "l2update", "heartbeat"])(
    "ignores %s data for another product",
    (type) => {
      expect(decode({ type, product_id: "ETH-USD" })).toBeNull()
    },
  )

  it.each([undefined, null, 123, ""])(
    "rejects a missing or invalid product %j",
    (product_id) => {
      for (const message of [
        snapshotMessage,
        updateMessage,
        heartbeatMessage,
      ]) {
        expect(() => decode({ ...message, product_id })).toThrow("product_id")
      }
    },
  )

  it("allows additional fields on recognised messages", () => {
    for (const message of [
      snapshotMessage,
      updateMessage,
      heartbeatMessage,
      subscriptionsMessage,
    ]) {
      expect(decode({ ...message, future_field: { anything: true } })).toEqual(
        message,
      )
    }
  })

  it.each(
    [null, {}, "levels", [["100"]], [["100", "1", "extra"]], [null]].map(
      (levels) => ({ levels }),
    ),
  )("rejects malformed snapshot arrays or tuples $levels", ({ levels }) => {
    expect(() => decode({ ...snapshotMessage, bids: levels })).toThrow(
      "snapshot",
    )
    expect(() => decode({ ...snapshotMessage, asks: levels })).toThrow(
      "snapshot",
    )
  })

  it.each(
    [
      null,
      {},
      "changes",
      [null],
      [["buy", "100"]],
      [["buy", "100", "1", "extra"]],
    ].map((changes) => ({ changes })),
  )("rejects malformed change arrays or tuples $changes", ({ changes }) =>
    expect(() => decode({ ...updateMessage, changes })).toThrow("l2update"),
  )

  it.each(["bid", "ask", "BUY", "", null, 0])(
    "rejects invalid side %j",
    (side) => {
      expect(() =>
        decode({ ...updateMessage, changes: [[side, "100", "1"]] }),
      ).toThrow("l2update")
    },
  )

  it.each([
    "",
    "abc",
    "NaN",
    "Infinity",
    "1e3",
    "+1",
    "-1",
    "-0",
    " 1",
    "1 ",
    ".5",
    "1.",
    "1.2.3",
    1,
    null,
  ])("rejects invalid decimal %j in prices and quantities", (value) => {
    for (const level of [
      [value, "1"],
      ["100", value],
    ]) {
      expect(() => decode({ ...snapshotMessage, bids: [level] })).toThrow(
        "snapshot",
      )
      expect(() => decode({ ...snapshotMessage, asks: [level] })).toThrow(
        "snapshot",
      )
      expect(() =>
        decode({ ...updateMessage, changes: [["buy", ...level]] }),
      ).toThrow("l2update")
    }
  })

  it.each(["0", "0.00000000"])(
    "rejects zero price %s but accepts zero quantity",
    (zero) => {
      expect(() => decode({ ...snapshotMessage, bids: [[zero, "1"]] })).toThrow(
        "snapshot",
      )
      expect(() =>
        decode({ ...updateMessage, changes: [["buy", zero, "1"]] }),
      ).toThrow("l2update")
      const snapshot = { ...snapshotMessage, bids: [["100", zero]] }
      const update = { ...updateMessage, changes: [["buy", "100", zero]] }
      expect(decode(snapshot)).toEqual(snapshot)
      expect(decode(update)).toEqual(update)
    },
  )

  it.each([undefined, null, "", "not-a-time", "2026-99-14T12:00:00Z", 123])(
    "rejects missing or invalid timestamp %j",
    (time) => {
      expect(() => decode({ ...updateMessage, time })).toThrow("l2update")
      expect(() => decode({ ...heartbeatMessage, time })).toThrow("heartbeat")
    },
  )

  it.each([undefined, null, "1", -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid heartbeat counter %j",
    (value) => {
      expect(() => decode({ ...heartbeatMessage, sequence: value })).toThrow(
        "heartbeat",
      )
      expect(() =>
        decode({ ...heartbeatMessage, last_trade_id: value }),
      ).toThrow("heartbeat")
    },
  )

  it.each(
    [
      undefined,
      null,
      {},
      [null],
      [{}],
      [{ name: "heartbeat", product_ids: "BTC-USD" }],
      [{ name: "", product_ids: [] }],
      [{ name: "heartbeat", product_ids: [123] }],
    ].map((channels) => ({ channels })),
  )("rejects malformed acknowledgements $channels", ({ channels }) =>
    expect(() => decode({ ...subscriptionsMessage, channels })).toThrow(
      "subscriptions",
    ),
  )

  it("surfaces exchange errors even without a product ID", () => {
    expect(() => decode(errorMessage)).toThrow(
      "Coinbase error: Failed to subscribe",
    )
  })

  it.each([undefined, null, "", 123])(
    "rejects a malformed exchange error %j",
    (message) => {
      expect(() => decode({ ...errorMessage, message })).toThrow(
        "Invalid Coinbase error message",
      )
    },
  )

  it("rejects the entire batch before a valid first change can mutate the book", () => {
    const book = createOrderBook({ bids: [["100", "1"]], asks: [["101", "2"]] })
    const original = createOrderBook({
      bids: [["100", "1"]],
      asks: [["101", "2"]],
    })

    expect(() => {
      const message = decode({
        ...updateMessage,
        changes: [
          ["buy", "100", "5"],
          ["sell", "101", "-3"],
        ],
      })
      if (message?.type === "l2update") applyChanges(book, message.changes)
    }).toThrow("l2update")

    expect(book).toEqual(original)
  })

  it("rejects a snapshot with valid bids but a later invalid ask", () => {
    expect(() =>
      decode({
        ...snapshotMessage,
        asks: [
          ["101", "2"],
          ["102", "-1"],
        ],
      }),
    ).toThrow("snapshot")
  })
})
