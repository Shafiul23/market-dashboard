import { createBookView } from "../book/bookView"
import type { BookView } from "../book/bookView"
import { applyChanges, createOrderBook } from "../book/orderBook"
import type { OrderBook } from "../book/orderBook"
import { COINBASE_PRODUCT, decodeCoinbaseMessage } from "./coinbase"

const COINBASE_URL = "wss://ws-feed.exchange.coinbase.com"
const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000
const HEALTHY_SESSION_MS = 30_000

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
  status: "Connecting" | "Synchronising" | "Live" | "Reconnecting"
  view: BookView
  isStale: boolean
  receivedAt: number | null
  error: string | null
}>

type BookFeedOptions = {
  onChange: (state: BookFeedState) => void
  createSocket?: (url: string) => FeedSocket
  now?: () => number
  random?: () => number
}

export function createBookFeed({
  onChange,
  createSocket = (url) => new WebSocket(url),
  now = Date.now,
  random = Math.random,
}: BookFeedOptions): () => void {
  let socket: FeedSocket | undefined
  let disposed = false
  let attemptId = 0
  let retryCeiling = INITIAL_RETRY_MS
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let healthyTimer: ReturnType<typeof setTimeout> | undefined
  let state: BookFeedState = {
    status: "Connecting",
    view: createBookView(createOrderBook({ bids: [], asks: [] }), null),
    isStale: true,
    receivedAt: null,
    error: null,
  }

  function closeSocket(): void {
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    if (socket.readyState < 2) socket.close()
    socket = undefined
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    attemptId++
    clearTimeout(retryTimer)
    clearTimeout(healthyTimer)
    closeSocket()
  }

  function connect(): void {
    if (disposed) return
    const id = ++attemptId
    let opened = false
    let book: OrderBook | null = null
    let heartbeatReady = false
    const isCurrent = () => !disposed && id === attemptId

    function fail(error: unknown): void {
      if (!isCurrent()) return
      attemptId++
      clearTimeout(healthyTimer)
      closeSocket()
      state = {
        ...state,
        status: "Reconnecting",
        isStale: true,
        error: error instanceof Error ? error.message : String(error),
      }
      const delay = retryCeiling * (0.5 + random() * 0.5)
      retryCeiling = Math.min(retryCeiling * 2, MAX_RETRY_MS)
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        connect()
      }, delay)
      onChange(state)
    }

    state = { ...state, status: "Connecting" }
    onChange(state)
    if (!isCurrent()) return
    try {
      socket = createSocket(COINBASE_URL)
    } catch (error) {
      fail(error)
      return
    }

    const attemptSocket = socket
    attemptSocket.onopen = () => {
      if (!isCurrent() || opened) return
      opened = true
      try {
        attemptSocket.send(
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

    attemptSocket.onmessage = (event) => {
      if (!isCurrent() || !opened) return
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
        const live = book !== null && heartbeatReady
        if (live && state.status !== "Live") {
          healthyTimer = setTimeout(() => {
            if (isCurrent()) retryCeiling = INITIAL_RETRY_MS
          }, HEALTHY_SESSION_MS)
        }
        state = {
          ...state,
          status: live ? "Live" : "Synchronising",
          isStale: !live,
          error: live ? null : state.error,
        }
      } catch (error) {
        fail(error)
        return
      }
      onChange(state)
    }

    attemptSocket.onerror = () => fail(new Error("Coinbase socket error"))
    attemptSocket.onclose = (event) =>
      fail(
        new Error(
          `Coinbase socket closed (${event.code})${event.reason ? `: ${event.reason}` : ""}`,
        ),
      )
  }

  connect()
  return dispose
}
