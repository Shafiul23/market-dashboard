import { createBookView } from "../book/bookView"
import type { BookView } from "../book/bookView"
import { applyChanges, createOrderBook } from "../book/orderBook"
import type { OrderBook } from "../book/orderBook"
import { COINBASE_PRODUCT, decodeCoinbaseMessage } from "./coinbase"
import { browserLifecycle } from "./browserLifecycle"
import type { FeedLifecycle } from "./browserLifecycle"

const COINBASE_URL = "wss://ws-feed.exchange.coinbase.com"
const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000
const HEALTHY_SESSION_MS = 30_000
const CONNECTION_TIMEOUT_MS = 10_000
const SYNCHRONISATION_TIMEOUT_MS = 10_000
const HEARTBEAT_TIMEOUT_MS = 5000

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
  // Wall time labels book receipts; monotonic time measures health deadlines.
  now?: () => number
  monotonicNow?: () => number
  random?: () => number
  lifecycle?: FeedLifecycle
}

export function createBookFeed({
  onChange,
  createSocket = (url) => new WebSocket(url),
  now = Date.now,
  monotonicNow = () => performance.now(),
  random = Math.random,
  lifecycle = browserLifecycle,
}: BookFeedOptions): () => void {
  let socket: FeedSocket | undefined
  let disposed = false
  let attemptId = 0
  let retryCeiling = INITIAL_RETRY_MS
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let healthyTimer: ReturnType<typeof setTimeout> | undefined
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined
  let online = lifecycle.isOnline()
  let interrupt: ((error: Error) => void) | undefined
  let checkHealth: (() => boolean) | undefined
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
    clearTimeout(watchdogTimer)
    unsubscribe()
    closeSocket()
  }

  function connect(): void {
    if (disposed || !online) return
    const id = ++attemptId
    let opened = false
    let book: OrderBook | null = null
    let heartbeatReady = false
    let bookReceivedAt: number | null = null
    let phaseDeadline = monotonicNow() + CONNECTION_TIMEOUT_MS
    let heartbeatDeadline = Infinity
    const isCurrent = () => !disposed && id === attemptId

    function fail(error: unknown): void {
      if (!isCurrent()) return
      attemptId++
      clearTimeout(healthyTimer)
      clearTimeout(watchdogTimer)
      interrupt = undefined
      checkHealth = undefined
      closeSocket()
      state = {
        ...state,
        status: "Reconnecting",
        isStale: true,
        error: error instanceof Error ? error.message : String(error),
      }
      if (online) {
        const delay = retryCeiling * (0.5 + random() * 0.5)
        retryCeiling = Math.min(retryCeiling * 2, MAX_RETRY_MS)
        retryTimer = setTimeout(() => {
          retryTimer = undefined
          connect()
        }, delay)
      }
      onChange(state)
    }

    // Timers can be suspended in a background tab. Check elapsed time again
    // before accepting events, so a late heartbeat cannot revive an old book.
    function healthy(): boolean {
      if (!isCurrent()) return false
      const time = monotonicNow()
      if (time >= phaseDeadline) {
        fail(new Error(
          opened ? "Coinbase synchronisation timed out" : "Coinbase connection timed out",
        ))
        return false
      }
      if (time >= heartbeatDeadline) {
        fail(new Error("Coinbase heartbeat timed out"))
        return false
      }
      return true
    }

    function watch(): void {
      clearTimeout(watchdogTimer)
      watchdogTimer = setTimeout(() => {
        if (healthy()) watch()
      }, Math.max(0, Math.min(phaseDeadline, heartbeatDeadline) - monotonicNow()))
    }

    interrupt = fail
    checkHealth = healthy
    watch()
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
      if (!isCurrent() || opened || !healthy()) return
      opened = true
      phaseDeadline = monotonicNow() + SYNCHRONISATION_TIMEOUT_MS
      heartbeatDeadline = monotonicNow() + HEARTBEAT_TIMEOUT_MS
      watch()
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
      if (!isCurrent() || !opened || !healthy()) return
      try {
        if (typeof event.data !== "string") {
          throw new Error("Expected a Coinbase text message")
        }
        const message = decodeCoinbaseMessage(event.data)
        if (!message || message.type === "subscriptions") return

        switch (message.type) {
          case "snapshot": {
            bookReceivedAt = now()
            book = createOrderBook(message)
            break
          }
          case "l2update": {
            if (!book) {
              throw new Error(
                "Synchronisation failed: update received before snapshot",
              )
            }
            bookReceivedAt = now()
            applyChanges(book, message.changes)
            break
          }
          case "heartbeat":
            heartbeatReady = true
            heartbeatDeadline = monotonicNow() + HEARTBEAT_TIMEOUT_MS
            break
        }
        const live = book !== null && heartbeatReady
        if (live && state.status !== "Live") {
          phaseDeadline = Infinity
          healthyTimer = setTimeout(() => {
            if (healthy()) retryCeiling = INITIAL_RETRY_MS
          }, HEALTHY_SESSION_MS)
        }
        // Keep the published book until this attempt has both readiness signals.
        if (live && (message.type !== "heartbeat" || state.status !== "Live")) {
          state = {
            ...state,
            view: createBookView(book!, bookReceivedAt),
            receivedAt: bookReceivedAt,
          }
        }
        watch()
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

  function offline(): void {
    if (disposed || !online) return
    online = false
    clearTimeout(retryTimer)
    retryTimer = undefined
    const error = new Error("Browser is offline")
    if (interrupt) interrupt(error)
    else {
      state = {
        ...state,
        status: "Reconnecting",
        isStale: true,
        error: error.message,
      }
      onChange(state)
    }
  }

  const unsubscribe = lifecycle.subscribe({
    offline,
    online: () => {
      if (disposed) return
      if (online) {
        checkHealth?.()
        return
      }
      online = true
      connect()
    },
    visible: () => {
      if (!disposed) checkHealth?.()
    },
  })
  if (online) connect()
  else {
    state = { ...state, status: "Reconnecting", error: "Browser is offline" }
    onChange(state)
  }
  return dispose
}
