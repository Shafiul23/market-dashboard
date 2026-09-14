// Coinbase Exchange wire-format examples
// https://docs.cdp.coinbase.com/exchange/websocket-feed/channels
export const snapshotMessage = {
  type: "snapshot",
  product_id: "BTC-USD",
  bids: [["100.00", "1.50000000"]],
  asks: [["101.00", "2.00000000"]],
}

export const updateMessage = {
  type: "l2update",
  product_id: "BTC-USD",
  time: "2026-09-14T12:00:00.123456Z",
  changes: [
    ["buy", "100.00", "3.00000000"],
    ["sell", "101.00", "0.00000000"],
  ],
}

export const heartbeatMessage = {
  type: "heartbeat",
  product_id: "BTC-USD",
  sequence: 123,
  last_trade_id: 456,
  time: "2026-09-14T12:00:01Z",
}

export const subscriptionsMessage = {
  type: "subscriptions",
  channels: [
    { name: "level2_batch", product_ids: ["BTC-USD"] },
    { name: "heartbeat", product_ids: ["BTC-USD"] },
  ],
}

export const errorMessage = {
  type: "error",
  message: "Failed to subscribe",
}
