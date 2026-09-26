import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBookFeed } from "./bookFeed"
import type { BookFeedState } from "./bookFeed"
import type { FeedLifecycle } from "./browserLifecycle"
import { FakeSocket } from "./fakeSocket"
import {
  errorMessage,
  heartbeatMessage,
  snapshotMessage,
  subscriptionsMessage,
  updateMessage,
} from "./fixtures"

// Enable to print the data flow during the traced tests below.
const LOG_DATA_FLOW = false

function logFlow(...args: unknown[]) {
  if (LOG_DATA_FLOW) console.log(...args)
}

function setup(trace = false, random = vi.fn(() => 0), initiallyOnline = true, initiallyVisible = true) {
  const sockets: FakeSocket[] = []
  const createSocket = vi.fn(() => {
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket
  })
  const now = vi.fn(() => 1000)
  const monotonicNow = vi.fn(() => performance.now())
  let events!: Parameters<FeedLifecycle["subscribe"]>[0]
  const unsubscribe = vi.fn()
  const lifecycle: FeedLifecycle = {
    isOnline: () => initiallyOnline,
    isVisible: () => initiallyVisible,
    subscribe: (handlers) => {
      events = handlers
      return unsubscribe
    },
  }
  const onChange = vi.fn<(state: BookFeedState) => void>((state) => {
    if (!trace) return
    logFlow(
      "[controller → consumer]",
      JSON.stringify({
        status: state.status,
        receivedAt: state.receivedAt,
        bids: state.view.bids.map(({ price, quantity }) => [price, quantity]),
        asks: state.view.asks.map(({ price, quantity }) => [price, quantity]),
        error: state.error,
      }),
    )
  })
  const dispose = createBookFeed({
    createSocket,
    now,
    monotonicNow,
    random,
    onChange,
    lifecycle,
  })
  const socket = sockets[0]
  if (trace) {
    socket.send.mockImplementation((data) => {
      logFlow("[controller → fake socket: send]", data)
    })
  }
  const latest = () => onChange.mock.calls.at(-1)![0]
  return {
    socket,
    sockets,
    createSocket,
    now,
    monotonicNow,
    random,
    onChange,
    dispose,
    latest,
    events,
    unsubscribe,
  }
}

describe("createBookFeed", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it.each(["connecting", "synchronising", "live", "retry"])(
    "suspends while %s and resumes with a fresh snapshot and heartbeat",
    (phase) => {
      const { socket, sockets, events, latest, onChange, dispose } = setup()
      if (phase === "synchronising" || phase === "live") socket.open()
      if (phase === "live") {
        socket.message(snapshotMessage)
        socket.message(heartbeatMessage)
        socket.message(updateMessage)
      }
      const lateMessage = socket.onmessage!
      if (phase === "retry") socket.error()
      const previous = latest()
      events.hidden()
      expect(latest()).toMatchObject({ status: "Suspended", isStale: true })
      expect(latest().view).toBe(previous.view)
      expect(socket.close).toHaveBeenCalledTimes(1)
      expect([socket.onopen, socket.onmessage, socket.onerror, socket.onclose])
        .toEqual([null, null, null, null])
      expect(vi.getTimerCount()).toBe(0)
      const count = onChange.mock.calls.length
      events.hidden()
      events.online()
      lateMessage(new MessageEvent("message", { data: JSON.stringify(snapshotMessage) }))
      vi.advanceTimersByTime(60_000)
      expect(onChange).toHaveBeenCalledTimes(count)
      expect(sockets).toHaveLength(1)

      events.visible()
      events.visible()
      expect(sockets).toHaveLength(2)
      expect(latest().status).toBe("Connecting")
      sockets[1].open()
      sockets[1].message(heartbeatMessage)
      expect(latest().isStale).toBe(true)
      expect(latest().view).toBe(previous.view)
      sockets[1].message({ ...snapshotMessage, bids: [["99", "4"]], asks: [] })
      expect(latest()).toMatchObject({ status: "Live", isStale: false, error: null })
      expect(latest().view.bids.map(({ price }) => price)).toEqual(["99"])
      dispose()
    },
  )

  it.each(["online first", "visible first"])(
    "requires both network and visibility to resume (%s)",
    (order) => {
      const { events, sockets, latest, dispose } = setup()
      events.hidden()
      events.offline()
      if (order === "online first") events.online()
      else events.visible()
      expect(sockets).toHaveLength(1)
      expect(vi.getTimerCount()).toBe(0)
      if (order === "online first") events.visible()
      else events.online()
      expect(sockets).toHaveLength(2)
      expect(latest().status).toBe("Connecting")
      dispose()
    },
  )

  it("starts suspended when hidden and cannot resume after disposal", () => {
    const { events, sockets, latest, dispose } = setup(false, vi.fn(() => 0), true, false)
    expect(latest().status).toBe("Suspended")
    expect(sockets).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    events.online()
    expect(sockets).toHaveLength(0)
    events.visible()
    expect(sockets).toHaveLength(1)
    events.hidden()
    dispose()
    events.visible()
    events.online()
    expect(sockets).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("starts Connecting and sends exactly one subscription on open", () => {
    const { socket, createSocket, onChange, latest } = setup()
    expect(createSocket).toHaveBeenCalledExactlyOnceWith(
      "wss://ws-feed.exchange.coinbase.com",
    )
    expect(latest()).toMatchObject({
      status: "Connecting",
      receivedAt: null,
      isStale: true,
      error: null,
      view: { bids: [], asks: [] },
    })
    expect(socket.send).not.toHaveBeenCalled()

    socket.open()
    socket.open()
    expect(socket.send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
      type: "subscribe",
      product_ids: ["BTC-GBP"],
      channels: ["level2_batch", "heartbeat"],
    })
    expect(onChange.mock.calls.map(([state]) => state.status)).toEqual([
      "Connecting",
      "Synchronising",
    ])

    socket.message(subscriptionsMessage)
    expect(latest().status).toBe("Synchronising")
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it.each([
    [snapshotMessage, heartbeatMessage],
    [heartbeatMessage, snapshotMessage],
  ])(
    "requires both snapshot and heartbeat, in either order (%j first)",
    (first, second) => {
      const { socket, latest } = setup()
      socket.open()
      socket.message(first)
      expect(latest()).toMatchObject({ status: "Synchronising", isStale: true })
      socket.message(second)
      expect(latest()).toMatchObject({ status: "Live", isStale: false })
    },
  )

  it("records local snapshot/update receipt times without refreshing them for heartbeats", () => {
    logFlow("[test] Start an offline attempt with a fake socket and clock")
    const { socket, now, latest, dispose } = setup(true)
    logFlow("[fake socket → controller] open event")
    socket.open()
    logFlow(
      "[fake socket → controller] subscriptions acknowledgement (no state change)",
    )
    socket.message(subscriptionsMessage)
    logFlow("[fake socket → controller] heartbeat before snapshot")
    socket.message(heartbeatMessage)
    expect(latest().receivedAt).toBeNull()
    expect(now).not.toHaveBeenCalled()

    logFlow(
      "[fake socket → controller] snapshot:",
      JSON.stringify(snapshotMessage),
    )
    socket.message(snapshotMessage)
    const snapshotState = latest()
    expect(snapshotState.receivedAt).toBe(1000)
    expect(snapshotState.view.bids[0]).toMatchObject({
      price: "100",
      quantity: "1.50000000",
    })

    now.mockReturnValue(2000)
    logFlow(
      "[fake socket → controller] update at local time 2000:",
      JSON.stringify(updateMessage),
    )
    socket.message(updateMessage)
    vi.advanceTimersByTime(100)
    const updatedState = latest()
    expect(updatedState.receivedAt).toBe(2000)
    expect(updatedState.view.bids[0]).toMatchObject({
      price: "100",
      quantity: "3.00000000",
    })
    expect(updatedState.view.asks).toEqual([])
    expect(snapshotState.view.bids[0].quantity).toBe("1.50000000")
    expect(snapshotState.view.asks).toHaveLength(1)

    now.mockReturnValue(3000)
    logFlow(
      "[fake socket → controller] two heartbeats at local time 3000; receivedAt should stay 2000",
    )
    socket.message(heartbeatMessage)
    socket.message(heartbeatMessage)
    expect(latest()).toEqual({
      ...updatedState,
      heartbeatCount: updatedState.heartbeatCount + 2,
    })
    expect(latest().view).toBe(updatedState.view)
    expect(now).toHaveBeenCalledTimes(2)
    dispose()
    logFlow(
      "[test] Disposed; fake socket close calls:",
      socket.close.mock.calls.length,
    )
  })

  it("applies updates while waiting for the first heartbeat", () => {
    const { socket, latest } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(updateMessage)
    expect(latest().view.bids).toEqual([])
    expect(latest().status).toBe("Synchronising")
    socket.message(heartbeatMessage)
    expect(latest().view.bids[0].quantity).toBe("3.00000000")
  })

  it("replaces the entire book on a fresh snapshot", () => {
    const { socket, now, latest } = setup()
    socket.open()
    socket.message(heartbeatMessage)
    socket.message(snapshotMessage)
    socket.message(updateMessage)
    now.mockReturnValue(2000)
    socket.message({ ...snapshotMessage, bids: [["99", "4"]], asks: [] })
    vi.advanceTimersByTime(100)
    expect(latest().view.bids.map(({ price }) => price)).toEqual(["99"])
    expect(latest().view.asks).toEqual([])
    expect(latest().receivedAt).toBe(2000)
  })

  it("treats an empty snapshot as ready and timestamps empty updates", () => {
    const { socket, now, latest } = setup()
    socket.open()
    socket.message({ ...snapshotMessage, bids: [], asks: [] })
    socket.message(heartbeatMessage)
    expect(latest().status).toBe("Live")
    now.mockReturnValue(2000)
    socket.message({ ...updateMessage, changes: [] })
    vi.advanceTimersByTime(100)
    expect(latest().receivedAt).toBe(2000)
  })

  it("coalesces bursts across the full book into bounded, consistent views", () => {
    const { socket, latest, onChange, now } = setup()
    socket.open()
    socket.message(heartbeatMessage)
    socket.message({
      ...snapshotMessage,
      bids: Array.from({ length: 40 }, (_, i) => [String(100 - i), "1"]),
      asks: Array.from({ length: 40 }, (_, i) => [String(101 + i), "1"]),
    })
    const initial = latest()
    onChange.mockClear()

    for (let i = 0; i < 40; i++) {
      now.mockReturnValue(2000 + i)
      socket.message({
        ...updateMessage,
        changes: [
          ["buy", String(100 - i), String(i + 2)],
          ["sell", String(101 + i), String(i + 3)],
        ],
      })
      vi.advanceTimersByTime(1)
    }
    vi.advanceTimersByTime(59)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(latest().receivedAt).toBe(2039)
    expect(latest().view.bids.map(({ price, quantity }) => [price, quantity]))
      .toEqual(Array.from({ length: 10 }, (_, i) => [String(100 - i), String(i + 2)]))
    expect(latest().view.asks.map(({ price, quantity }) => [price, quantity]))
      .toEqual(Array.from({ length: 10 }, (_, i) => [String(101 + i), String(i + 3)]))

    for (let i = 0; i < 30; i++) {
      now.mockReturnValue(3000 + i)
      socket.message({
        ...updateMessage,
        changes: [
          ["buy", String(100 - i), "0"],
          ["sell", String(101 + i), "0"],
        ],
      })
      vi.advanceTimersByTime(2)
    }
    vi.advanceTimersByTime(39)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(latest().receivedAt).toBe(3029)
    expect(latest().view.bids.map(({ price, quantity }) => [price, quantity]))
      .toEqual(Array.from({ length: 10 }, (_, i) => [String(70 - i), String(i + 32)]))
    expect(latest().view.asks.map(({ price, quantity }) => [price, quantity]))
      .toEqual(Array.from({ length: 10 }, (_, i) => [String(131 + i), String(i + 33)]))

    for (const [state] of onChange.mock.calls) {
      const { view } = state
      expect(view.bestBid).toBe(view.bids[0].price)
      expect(view.bestAsk).toBe(view.asks[0].price)
      expect(view.bestBidLabel).toBe(view.bids[0].priceLabel)
      expect(view.bestAskLabel).toBe(view.asks[0].priceLabel)
    }
    expect(onChange.mock.calls[0][0].view.spreadLabel).toBe("1.00")
    expect(latest().view.spreadLabel).toBe("61.00")
    expect(initial.view.bids[0].quantity).toBe("1")
    expect(initial.view.asks[0].quantity).toBe("1")
    vi.advanceTimersByTime(1000)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("dirties repeated quantities and publishes the latest receipt without delaying the flush", () => {
    const { socket, latest, onChange, now } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    const previous = latest()
    onChange.mockClear()
    const repeated = {
      ...updateMessage,
      changes: [["buy", "100.00", "1.50000000"]],
    }
    now.mockReturnValue(2000)
    socket.message(repeated)
    const timers = vi.getTimerCount()
    vi.advanceTimersByTime(90)
    now.mockReturnValue(3000)
    socket.message(repeated)
    socket.message(heartbeatMessage)
    expect(vi.getTimerCount()).toBe(timers)
    vi.advanceTimersByTime(9)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(latest().view).toBe(previous.view)
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(latest().receivedAt).toBe(3000)
    expect(latest().view.receiptLabel).not.toBe(previous.view.receiptLabel)
    expect(latest().view.bids).toEqual(previous.view.bids)
    expect(latest().view.asks).toEqual(previous.view.asks)
    expect(vi.getTimerCount()).toBe(timers - 1)
  })

  it.each(["error", "close", "offline", "invalid", "dispose"])(
    "cancels a pending publication immediately on %s",
    (event) => {
      const { socket, latest, onChange, now, events, dispose } = setup()
      socket.open()
      socket.message(snapshotMessage)
      socket.message(heartbeatMessage)
      const previous = latest()
      now.mockReturnValue(2000)
      socket.message(updateMessage)
      vi.advanceTimersByTime(50)
      onChange.mockClear()
      if (event === "error") socket.error()
      else if (event === "close") socket.serverClose()
      else if (event === "offline") events.offline()
      else if (event === "invalid") socket.message(errorMessage)
      else dispose()

      if (event === "dispose") {
        expect(onChange).not.toHaveBeenCalled()
      } else {
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(latest()).toMatchObject({
          status: "Reconnecting",
          isStale: true,
          receivedAt: previous.receivedAt,
        })
        expect(latest().view).toBe(previous.view)
      }
      const count = onChange.mock.calls.length
      expect(vi.getTimerCount()).toBe(event === "offline" || event === "dispose" ? 0 : 1)
      vi.advanceTimersByTime(100)
      expect(onChange).toHaveBeenCalledTimes(count)
    },
  )

  it("checks health before a delayed flush after timer suspension", () => {
    const { socket, latest, onChange, monotonicNow } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    const previous = latest()
    socket.message(updateMessage)
    onChange.mockClear()
    monotonicNow.mockReturnValue(performance.now() + 5000)
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      isStale: true,
      receivedAt: previous.receivedAt,
      error: "Coinbase heartbeat timed out",
    })
    expect(latest().view).toBe(previous.view)
    expect(vi.getTimerCount()).toBe(1)
  })

  it("publishes heartbeat expiry between flushes without publishing the pending book", () => {
    const { socket, latest, onChange } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    const previous = latest()
    vi.advanceTimersByTime(4950)
    socket.message(updateMessage)
    onChange.mockClear()
    vi.advanceTimersByTime(49)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      isStale: true,
      error: "Coinbase heartbeat timed out",
    })
    expect(latest().view).toBe(previous.view)
    vi.advanceTimersByTime(50)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
  })

  it.each([false, true])(
    "fails on a pre-snapshot update (heartbeat received: %s)",
    (heartbeatFirst) => {
      logFlow(
        "[test] Offline pre-snapshot failure; heartbeat first:",
        heartbeatFirst,
      )
      const { socket, now, latest, onChange, createSocket } = setup(true)
      logFlow("[fake socket → controller] open event")
      socket.open()
      if (heartbeatFirst) {
        logFlow("[fake socket → controller] heartbeat")
        socket.message(heartbeatMessage)
      }
      const queuedMessage = socket.onmessage!
      logFlow(
        "[fake socket → controller] update before any snapshot:",
        JSON.stringify(updateMessage),
      )
      socket.message(updateMessage)
      expect(latest()).toMatchObject({
        status: "Reconnecting",
        error: "Synchronisation failed: update received before snapshot",
        receivedAt: null,
        view: { bids: [], asks: [] },
      })
      expect(now).not.toHaveBeenCalled()
      expect(socket.close).toHaveBeenCalledTimes(1)
      const count = onChange.mock.calls.length
      logFlow(
        "[test] Invoke a captured message handler after failure; no consumer callback should follow",
      )
      queuedMessage(
        new MessageEvent("message", { data: JSON.stringify(snapshotMessage) }),
      )
      expect(onChange).toHaveBeenCalledTimes(count)
      expect(createSocket).toHaveBeenCalledTimes(1)
    },
  )

  it("ignores unrelated messages without changing readiness or receipt time", () => {
    const { socket, onChange, now, latest } = setup()
    socket.open()
    for (const message of [snapshotMessage, updateMessage, heartbeatMessage]) {
      socket.message({ ...message, product_id: "ETH-GBP" })
    }
    socket.message({ type: "ticker" })
    socket.message(subscriptionsMessage)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(now).not.toHaveBeenCalled()
    expect(latest().status).toBe("Synchronising")
  })

  it.each([
    [JSON.stringify(errorMessage), "Coinbase error: Failed to subscribe"],
    ["{", "Invalid Coinbase JSON"],
    [
      JSON.stringify({ ...updateMessage, changes: [["buy", "100", "-1"]] }),
      "Invalid Coinbase l2update changes or time",
    ],
    [new ArrayBuffer(0), "Expected a Coinbase text message"],
  ])("ends the attempt on rejected input %j", (data, error) => {
    const { socket, latest } = setup()
    socket.open()
    socket.message(snapshotMessage)
    const previous = latest()
    socket.onmessage!(new MessageEvent("message", { data }))
    expect(latest()).toEqual({ ...previous, status: "Reconnecting", error })
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(socket.onmessage).toBeNull()
  })

  it.each([false, true])("handles socket errors (open: %s) once", (open) => {
    const { socket, latest, onChange } = setup()
    if (open) socket.open()
    const queuedClose = socket.onclose!
    socket.error()
    expect(latest().error).toBe("Coinbase socket error")
    expect(latest().status).toBe("Reconnecting")
    const count = onChange.mock.calls.length
    queuedClose({ code: 1006, reason: "" } as CloseEvent)
    expect(onChange).toHaveBeenCalledTimes(count)
    expect(socket.close).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])(
    "handles unexpected close without closing again (open: %s)",
    (open) => {
      const { socket, latest } = setup()
      if (open) socket.open()
      socket.serverClose(1001, "Going away")
      expect(latest()).toMatchObject({
        status: "Reconnecting",
        error: "Coinbase socket closed (1001): Going away",
      })
      expect(socket.close).not.toHaveBeenCalled()
      expect(socket.onclose).toBeNull()
    },
  )

  it("handles socket construction failure", () => {
    const onChange = vi.fn()
    const dispose = createBookFeed({
      onChange,
      createSocket: () => {
        throw new Error("Cannot create socket")
      },
    })
    expect(onChange.mock.calls.map(([state]) => state.status)).toEqual([
      "Connecting",
      "Reconnecting",
    ])
    expect(onChange.mock.calls[1][0].error).toBe("Cannot create socket")
    expect(() => {
      dispose()
      dispose()
    }).not.toThrow()
  })

  it("handles subscription send failure", () => {
    const { socket, onChange, latest } = setup()
    socket.send.mockImplementation(() => {
      throw new Error("Cannot send")
    })
    socket.open()
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      error: "Cannot send",
    })
    expect(onChange.mock.calls.map(([state]) => state.status)).toEqual([
      "Connecting",
      "Reconnecting",
    ])
    expect(socket.close).toHaveBeenCalledTimes(1)
  })

  it.each([
    { random: 0, delays: [500, 1000, 2000, 4000, 8000, 15_000, 15_000] },
    { random: 0.998, delays: [999, 1998, 3996, 7992, 15_984, 29_970, 29_970] },
  ])(
    "increases retry delays and continues at the cap (jitter $random)",
    ({ random, delays }) => {
      const { sockets, createSocket, latest } = setup(
        false,
        vi.fn(() => random),
      )
      for (const delay of delays) {
        const count = sockets.length
        sockets.at(-1)!.error()
        expect(latest().status).toBe("Reconnecting")
        expect(vi.getTimerCount()).toBe(1)
        vi.advanceTimersByTime(delay - 1)
        expect(createSocket).toHaveBeenCalledTimes(count)
        vi.advanceTimersByTime(1)
        expect(createSocket).toHaveBeenCalledTimes(count + 1)
        expect(latest().status).toBe("Connecting")
      }
    },
  )

  it.each([
    [0, 500],
    [0.5, 750],
    [0.998, 999],
  ])("uses controlled jitter %s for a %s ms first retry", (value, delay) => {
    const random = vi.fn(() => value)
    const { socket, createSocket } = setup(false, random)
    socket.error()
    expect(random).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(delay - 1)
    expect(createSocket).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(createSocket).toHaveBeenCalledTimes(2)
  })

  it("schedules one retry when error is followed by a queued close", () => {
    const { socket, createSocket, random, onChange } = setup()
    const queuedClose = socket.onclose!
    socket.error()
    const count = onChange.mock.calls.length
    queuedClose({ code: 1006, reason: "" } as CloseEvent)
    expect(onChange).toHaveBeenCalledTimes(count)
    expect(random).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(500)
    expect(createSocket).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)
  })

  it.each(["construction", "send", "close", "message"])(
    "retries after a %s failure",
    (failure) => {
      const { socket, sockets, createSocket, latest } = setup()
      if (failure === "construction") {
        createSocket.mockImplementationOnce(() => {
          throw new Error("Cannot create socket")
        })
        socket.error()
        vi.advanceTimersByTime(500)
      } else if (failure === "send") {
        socket.send.mockImplementationOnce(() => {
          throw new Error("Cannot send")
        })
        socket.open()
      } else if (failure === "close") {
        socket.serverClose()
      } else {
        socket.open()
        socket.message(errorMessage)
      }
      expect(latest()).toMatchObject({ status: "Reconnecting", isStale: true })
      vi.advanceTimersByTime(failure === "construction" ? 1000 : 500)
      const replacement = sockets.at(-1)!
      expect(replacement).not.toBe(socket)
      replacement.open()
      expect(replacement.send).toHaveBeenCalledTimes(1)
      replacement.message(snapshotMessage)
      replacement.message(heartbeatMessage)
      expect(latest()).toMatchObject({
        status: "Live",
        isStale: false,
        error: null,
      })
    },
  )

  it.each(["snapshot", "heartbeat"])(
    "retains a stale view, replaces old levels, and needs both readiness signals (%s first)",
    (first) => {
      const { socket, sockets, now, latest } = setup()
      socket.open()
      socket.message(snapshotMessage)
      socket.message(heartbeatMessage)
      const previous = latest()
      socket.error()
      expect(latest()).toEqual({
        ...previous,
        status: "Reconnecting",
        isStale: true,
        error: "Coinbase socket error",
      })
      expect(latest().view).toBe(previous.view)
      vi.advanceTimersByTime(500)
      const replacement = sockets[1]
      replacement.open()
      expect(latest().view).toBe(previous.view)
      expect(latest().receivedAt).toBe(previous.receivedAt)

      now.mockReturnValue(2000)
      const freshSnapshot = {
        ...snapshotMessage,
        bids: [["99", "4"]],
        asks: [],
      }
      replacement.message(
        first === "snapshot" ? freshSnapshot : heartbeatMessage,
      )
      expect(latest()).toMatchObject({ status: "Synchronising", isStale: true })
      expect(latest().view).toBe(previous.view)
      expect(latest().receivedAt).toBe(previous.receivedAt)
      replacement.message(
        first === "snapshot" ? heartbeatMessage : freshSnapshot,
      )
      expect(latest()).toMatchObject({
        status: "Live",
        isStale: false,
        receivedAt: 2000,
        error: null,
      })
      expect(latest().view.bids.map(({ price }) => price)).toEqual(["99"])
      expect(latest().view.asks).toEqual([])
      expect(previous.view.bids[0].price).toBe("100")
    },
  )

  it("rejects updates before the replacement snapshot even with an old published book", () => {
    const { socket, sockets, latest } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    const previousView = latest().view
    socket.error()
    vi.advanceTimersByTime(500)
    sockets[1].open()
    sockets[1].message(heartbeatMessage)
    sockets[1].message(updateMessage)
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      isStale: true,
      error: "Synchronisation failed: update received before snapshot",
    })
    expect(latest().view).toBe(previousView)
  })

  it("ignores all captured old-socket callbacks during retry wait and after recovery", () => {
    const { socket, sockets, onChange, now, latest } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    const { onopen, onmessage, onerror, onclose } = socket
    socket.error()
    function deliverOldEvents() {
      const count = onChange.mock.calls.length
      const receipts = now.mock.calls.length
      const timers = vi.getTimerCount()
      onopen!(new Event("open"))
      for (const message of [
        snapshotMessage,
        updateMessage,
        heartbeatMessage,
        errorMessage,
      ]) {
        onmessage!(
          new MessageEvent("message", { data: JSON.stringify(message) }),
        )
      }
      onerror!(new Event("error"))
      onclose!({ code: 1006, reason: "" } as CloseEvent)
      expect(onChange).toHaveBeenCalledTimes(count)
      expect(now).toHaveBeenCalledTimes(receipts)
      expect(vi.getTimerCount()).toBe(timers)
      expect(socket.send).toHaveBeenCalledTimes(1)
    }
    deliverOldEvents()
    vi.advanceTimersByTime(500)
    sockets[1].open()
    deliverOldEvents()
    sockets[1].message(snapshotMessage)
    expect(latest().isStale).toBe(true)
    sockets[1].message(heartbeatMessage)
    deliverOldEvents()
    expect(latest()).toMatchObject({ status: "Live", isStale: false })
    expect(sockets[1].close).not.toHaveBeenCalled()
  })

  it("resets backoff only after 30 uninterrupted seconds Live", () => {
    const { socket, sockets, createSocket } = setup()
    socket.error()
    vi.advanceTimersByTime(500)
    const second = sockets[1]
    second.open()
    second.message(snapshotMessage)
    vi.advanceTimersByTime(4000)
    second.message(heartbeatMessage)
    for (let secondElapsed = 0; secondElapsed < 29; secondElapsed++) {
      vi.advanceTimersByTime(1000)
      second.message(heartbeatMessage)
    }
    vi.advanceTimersByTime(999)
    second.error()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(999)
    expect(createSocket).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    const third = sockets[2]
    third.open()
    third.message(heartbeatMessage)
    vi.advanceTimersByTime(4000)
    third.message(heartbeatMessage)
    third.message(snapshotMessage)
    for (let secondElapsed = 0; secondElapsed < 30; secondElapsed++) {
      vi.advanceTimersByTime(1000)
      third.message(heartbeatMessage)
      third.message(updateMessage)
    }
    third.error()
    vi.advanceTimersByTime(499)
    expect(createSocket).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(1)
    expect(createSocket).toHaveBeenCalledTimes(4)
  })

  it("keeps a quiet market Live on heartbeats without changing the book receipt time", () => {
    const { socket, latest, onChange } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    const previous = latest()
    const count = onChange.mock.calls.length
    for (let seconds = 0; seconds < 40; seconds++) {
      vi.advanceTimersByTime(1000)
      socket.message(heartbeatMessage)
    }
    expect(latest()).toEqual({
      ...previous,
      heartbeatCount: previous.heartbeatCount + 40,
    })
    expect(latest().view).toBe(previous.view)
    expect(onChange).toHaveBeenCalledTimes(count + 40)
    expect(socket.close).not.toHaveBeenCalled()
  })

  it("recovers from missing heartbeats despite an open socket and ongoing book updates", () => {
    const { socket, latest, sockets } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    for (let seconds = 0; seconds < 4; seconds++) {
      vi.advanceTimersByTime(1000)
      socket.message(updateMessage)
      socket.message({ ...heartbeatMessage, product_id: "ETH-GBP" })
      socket.message(subscriptionsMessage)
    }
    vi.advanceTimersByTime(999)
    const previous = latest()
    expect(socket.readyState).toBe(1)
    expect(latest().status).toBe("Live")
    vi.advanceTimersByTime(1)
    expect(latest()).toEqual({
      ...previous,
      status: "Reconnecting",
      isStale: true,
      error: "Coinbase heartbeat timed out",
    })
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(500)
    sockets[1].open()
    sockets[1].message(heartbeatMessage)
    expect(latest()).toMatchObject({ status: "Synchronising", isStale: true })
    expect(latest().view).toBe(previous.view)
    sockets[1].message(snapshotMessage)
    expect(latest().status).toBe("Live")
  })

  it("times out a socket that never opens and ignores its late open", () => {
    const { socket, latest, sockets } = setup()
    const lateOpen = socket.onopen!
    vi.advanceTimersByTime(9999)
    expect(latest().status).toBe("Connecting")
    vi.advanceTimersByTime(1)
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      error: "Coinbase connection timed out",
    })
    lateOpen(new Event("open"))
    expect(socket.send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(sockets).toHaveLength(2)
  })

  it("starts the synchronisation deadline on open and requires a snapshot despite heartbeats", () => {
    const { socket, latest } = setup()
    vi.advanceTimersByTime(9000)
    socket.open()
    for (let seconds = 0; seconds < 9; seconds++) {
      vi.advanceTimersByTime(1000)
      socket.message(heartbeatMessage)
    }
    expect(latest().status).toBe("Synchronising")
    vi.advanceTimersByTime(1000)
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      error: "Coinbase synchronisation timed out",
    })
  })

  it("requires the first heartbeat even when a snapshot arrives", () => {
    const { socket, latest } = setup()
    socket.open()
    socket.message(snapshotMessage)
    vi.advanceTimersByTime(5000)
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      error: "Coinbase heartbeat timed out",
    })
  })

  it.each(["connecting", "synchronising", "live", "retry"])(
    "pauses recovery offline while %s and handles repeated browser events once",
    (phase) => {
      const { socket, sockets, events, latest, onChange, createSocket } =
        setup()
      if (phase === "synchronising" || phase === "live") socket.open()
      if (phase === "live") {
        socket.message(snapshotMessage)
        socket.message(heartbeatMessage)
      }
      if (phase === "retry") socket.error()
      const previous = latest()
      events.offline()
      expect(latest()).toMatchObject({
        status: "Reconnecting",
        isStale: true,
        error: "Browser is offline",
      })
      expect(latest().view).toBe(previous.view)
      const count = onChange.mock.calls.length
      events.offline()
      events.visible()
      expect(onChange).toHaveBeenCalledTimes(count)
      expect(vi.getTimerCount()).toBe(0)
      vi.advanceTimersByTime(60_000)
      expect(createSocket).toHaveBeenCalledTimes(1)
      events.online()
      events.online()
      events.visible()
      expect(createSocket).toHaveBeenCalledTimes(2)
      expect(latest()).toMatchObject({ status: "Connecting", isStale: true })
      const replacement = sockets[1]
      replacement.open()
      replacement.message(heartbeatMessage)
      events.online()
      events.visible()
      expect(latest()).toMatchObject({ status: "Synchronising", isStale: true })
      expect(latest().view).toBe(previous.view)
      replacement.message(snapshotMessage)
      expect(latest()).toMatchObject({ status: "Live", isStale: false })
    },
  )

  it("waits for online when created offline", () => {
    const { createSocket, events, latest, dispose, unsubscribe } = setup(
      false,
      vi.fn(() => 0),
      false,
    )
    expect(latest()).toMatchObject({
      status: "Reconnecting",
      error: "Browser is offline",
    })
    expect(createSocket).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    events.offline()
    events.visible()
    events.online()
    events.online()
    expect(createSocket).toHaveBeenCalledTimes(1)
    dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it.each(["visible", "heartbeat", "update", "online"])(
    "detects silence after timer suspension on %s without reviving the old book",
    (event) => {
      const { socket, latest, monotonicNow, events } = setup()
      socket.open()
      socket.message(snapshotMessage)
      socket.message(heartbeatMessage)
      const previous = latest()
      monotonicNow.mockReturnValue(performance.now() + 5000)
      if (event === "visible") events.visible()
      else if (event === "online") events.online()
      else
        socket.message(event === "heartbeat" ? heartbeatMessage : updateMessage)
      expect(latest()).toMatchObject({
        status: "Reconnecting",
        isStale: true,
        error: "Coinbase heartbeat timed out",
      })
      expect(latest().view).toBe(previous.view)
      expect(vi.getTimerCount()).toBe(1)
    },
  )

  it.each([false, true])(
    "checks an expired phase deadline on visibility return (open: %s)",
    (open) => {
      const { socket, monotonicNow, latest, events } = setup()
      if (open) socket.open()
      monotonicNow.mockReturnValue(performance.now() + 10_000)
      events.visible()
      expect(latest()).toMatchObject({
        status: "Reconnecting",
        error: open
          ? "Coinbase synchronisation timed out"
          : "Coinbase connection timed out",
      })
    },
  )

  it("does not reconnect on visibility return while heartbeats are fresh or wall time changes", () => {
    const { socket, events, latest, now, createSocket } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    for (const wallTime of [1_000_000, -1_000_000]) {
      now.mockReturnValue(wallTime)
      vi.setSystemTime(wallTime)
      vi.advanceTimersByTime(1000)
      events.visible()
      socket.message(heartbeatMessage)
      expect(latest()).toMatchObject({ status: "Live", receivedAt: 1000 })
    }
    expect(createSocket).toHaveBeenCalledTimes(1)
  })

  it("keeps the last usable book if a staged replacement fails", () => {
    const { socket, sockets, latest } = setup()
    socket.open()
    socket.message(snapshotMessage)
    socket.message(heartbeatMessage)
    const previous = latest()
    socket.error()
    vi.advanceTimersByTime(500)
    sockets[1].open()
    sockets[1].message({ ...snapshotMessage, bids: [["99", "4"]], asks: [] })
    sockets[1].message(updateMessage)
    vi.advanceTimersByTime(5000)
    expect(latest()).toMatchObject({ status: "Reconnecting", isStale: true })
    expect(latest().view).toBe(previous.view)
    expect(latest().receivedAt).toBe(previous.receivedAt)
  })

  it("cancels recovery when disposed during a retry wait", () => {
    const { socket, createSocket, onChange, dispose } = setup()
    socket.error()
    const count = onChange.mock.calls.length
    expect(vi.getTimerCount()).toBe(1)
    dispose()
    dispose()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(createSocket).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(count)
    expect(socket.close).toHaveBeenCalledTimes(1)
  })

  it.each(["connecting", "open", "live"])(
    "disposes silently while %s and rejects captured callbacks",
    (phase) => {
      const { socket, dispose, onChange, now, events, unsubscribe } = setup()
      if (phase !== "connecting") socket.open()
      if (phase === "live") {
        socket.message(snapshotMessage)
        socket.message(heartbeatMessage)
      }
      const { onopen, onmessage, onerror, onclose } = socket
      const count = onChange.mock.calls.length
      const sends = socket.send.mock.calls.length
      const receipts = now.mock.calls.length
      dispose()
      dispose()
      expect(unsubscribe).toHaveBeenCalledTimes(1)
      expect(socket.close).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
      expect([
        socket.onopen,
        socket.onmessage,
        socket.onerror,
        socket.onclose,
      ]).toEqual([null, null, null, null])

      return Promise.resolve().then(() => {
        events.offline()
        events.online()
        events.visible()
        onopen!(new Event("open"))
        for (const message of [
          snapshotMessage,
          updateMessage,
          heartbeatMessage,
          errorMessage,
        ]) {
          onmessage!(
            new MessageEvent("message", { data: JSON.stringify(message) }),
          )
        }
        onerror!(new Event("error"))
        onclose!({ code: 1006, reason: "" } as CloseEvent)
        expect(onChange).toHaveBeenCalledTimes(count)
        expect(socket.send).toHaveBeenCalledTimes(sends)
        expect(now).toHaveBeenCalledTimes(receipts)
        expect(socket.close).toHaveBeenCalledTimes(1)
      })
    },
  )
})
