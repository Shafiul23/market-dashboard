import type { BookChange, BookSnapshot, SnapshotLevel } from "../book/orderBook"
import { compareDecimals } from "../lib/decimal"

export const COINBASE_PRODUCT = "BTC-GBP"

type SubscriptionChannel = {
  name: string
  product_ids: string[]
}

export type CoinbaseMessage =
  | (BookSnapshot & { type: "snapshot"; product_id: string })
  | {
      type: "l2update"
      product_id: string
      changes: BookChange[]
      time: string
    }
  | {
      type: "heartbeat"
      product_id: string
      sequence: number
      last_trade_id: number
      time: string
    }
  | { type: "subscriptions"; channels: SubscriptionChannel[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isQuantity(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]+(?:\.[0-9]+)?$/.test(value)
}

function isPrice(value: unknown): value is string {
  return isQuantity(value) && compareDecimals(value, "0") > 0
}

function isSnapshotLevel(value: unknown): value is SnapshotLevel {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isPrice(value[0]) &&
    isQuantity(value[1])
  )
}

function isBookChange(value: unknown): value is BookChange {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    (value[0] === "buy" || value[0] === "sell") &&
    isPrice(value[1]) &&
    isQuantity(value[2])
  )
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

function isCounter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isSubscriptionChannel(value: unknown): value is SubscriptionChannel {
  return (
    isRecord(value) &&
    isNonemptyString(value.name) &&
    Array.isArray(value.product_ids) &&
    value.product_ids.every(isNonemptyString)
  )
}

export function decodeCoinbaseMessage(raw: string): CoinbaseMessage | null {
  let message: unknown
  try {
    message = JSON.parse(raw)
  } catch {
    throw new Error("Invalid Coinbase JSON")
  }

  if (!isRecord(message) || !isNonemptyString(message.type)) {
    throw new Error("Invalid Coinbase message: expected an object with a type")
  }

  if (message.type === "error") {
    if (!isNonemptyString(message.message)) {
      throw new Error("Invalid Coinbase error message")
    }
    throw new Error(`Coinbase error: ${message.message}`)
  }

  if (message.type === "subscriptions") {
    if (
      !Array.isArray(message.channels) ||
      !message.channels.every(isSubscriptionChannel)
    ) {
      throw new Error("Invalid Coinbase subscriptions message")
    }
    return { type: "subscriptions", channels: message.channels }
  }

  if (
    message.type !== "snapshot" &&
    message.type !== "l2update" &&
    message.type !== "heartbeat"
  ) {
    return null
  }

  if (!isNonemptyString(message.product_id)) {
    throw new Error(
      `Invalid Coinbase ${message.type}: missing or invalid product_id`,
    )
  }
  if (message.product_id !== COINBASE_PRODUCT) return null

  switch (message.type) {
    case "snapshot": {
      if (
        !Array.isArray(message.bids) ||
        !message.bids.every(isSnapshotLevel) ||
        !Array.isArray(message.asks) ||
        !message.asks.every(isSnapshotLevel)
      ) {
        throw new Error("Invalid Coinbase snapshot levels")
      }
      return {
        type: "snapshot",
        product_id: message.product_id,
        bids: message.bids,
        asks: message.asks,
      }
    }
    case "l2update": {
      if (
        !Array.isArray(message.changes) ||
        !message.changes.every(isBookChange) ||
        !isTimestamp(message.time)
      ) {
        throw new Error("Invalid Coinbase l2update changes or time")
      }
      return {
        type: "l2update",
        product_id: message.product_id,
        changes: message.changes,
        time: message.time,
      }
    }
    case "heartbeat": {
      if (
        !isCounter(message.sequence) ||
        !isCounter(message.last_trade_id) ||
        !isTimestamp(message.time)
      ) {
        throw new Error("Invalid Coinbase heartbeat counters or time")
      }
      return {
        type: "heartbeat",
        product_id: message.product_id,
        sequence: message.sequence,
        last_trade_id: message.last_trade_id,
        time: message.time,
      }
    }
  }
}
