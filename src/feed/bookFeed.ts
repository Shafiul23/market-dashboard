import { createBookView } from "../book/bookView"
import type { BookView } from "../book/bookView"
import { applyChanges, createOrderBook } from "../book/orderBook"
import type { OrderBook } from "../book/orderBook"
import { COINBASE_PRODUCT, decodeCoinbaseMessage } from "./coinbase"

const COINBASE_URL = "wss://ws-feed.exchange.coinbase.com"

export type FeedSocket = {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send(data: string): void
  close(): void
}

export type BookFeedState = Readonly<{
  status: "Connecting" | "Synchronising" | "Live" | "Failed"
  view: BookView
  receivedAt: number | null
  error: string | null
}>

type BookFeedOptions = {
  onChange: (state: BookFeedState) => void
  createSocket?: (url: string) => FeedSocket
  now?: () => number
}

export function createBookFeed({
  onChange,
  createSocket = (url) => new WebSocket(url),
  now = Date.now,
}: BookFeedOptions): () => void {
  let socket: FeedSocket | undefined
  let disposed = false
  let opened = false
  let book: OrderBook | null = null
  let heartbeatReady = false
  let state: BookFeedState = {
    status: "Connecting",
    view: createBookView(createOrderBook({ bids: [], asks: [] }), null),
    receivedAt: null,
    error: null,
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    if (!socket) return

    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    if (socket.readyState < 2) socket.close()
  }

  function fail(error: unknown): void {
    if (disposed) return
    dispose()
    state = {
      ...state,
      status: "Failed",
      error: error instanceof Error ? error.message : String(error),
    }
    onChange(state)
  }

  onChange(state)
  try {
    socket = createSocket(COINBASE_URL)
  } catch (error) {
    fail(error)
    return dispose
  }

  socket.onopen = () => {
    if (disposed || opened) return
    opened = true
    try {
      socket.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: [COINBASE_PRODUCT],
          channels: ["level2_batch", "heartbeat"],
        }),
      )
    } catch (error) {
      fail(error)
      return
    }
    state = { ...state, status: "Synchronising" }
    onChange(state)
  }

  socket.onmessage = (event) => {
    if (disposed || !opened) return
    try {
      if (typeof event.data !== "string") {
        throw new Error("Expected a Coinbase text message")
      }
      const message = decodeCoinbaseMessage(event.data)
      if (!message || message.type === "subscriptions") return

      switch (message.type) {
        case "snapshot": {
          const receivedAt = now()
          book = createOrderBook(message)
          state = {
            ...state,
            view: createBookView(book, receivedAt),
            receivedAt,
          }
          break
        }
        case "l2update": {
          if (!book) {
            throw new Error(
              "Synchronisation failed: update received before snapshot",
            )
          }
          const receivedAt = now()
          applyChanges(book, message.changes)
          state = {
            ...state,
            view: createBookView(book, receivedAt),
            receivedAt,
          }
          break
        }
        case "heartbeat":
          heartbeatReady = true
          break
      }
      state = {
        ...state,
        status: book !== null && heartbeatReady ? "Live" : "Synchronising",
      }
    } catch (error) {
      fail(error)
      return
    }
    onChange(state)
  }

  socket.onerror = () => fail(new Error("Coinbase socket error"))
  socket.onclose = (event) =>
    fail(
      new Error(
        `Coinbase socket closed (${event.code})${event.reason ? `: ${event.reason}` : ""}`,
      ),
    )

  return dispose
}
