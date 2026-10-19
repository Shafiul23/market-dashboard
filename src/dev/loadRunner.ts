import type { BookFeedOptions, BookFeedState, FeedSocket } from "../feed/bookFeed"
import type { BenchmarkFixture } from "./benchmarkFixture"
import { REPLAY_TIME, UPDATE_INTERVAL_MS, WARMUP_UPDATES } from "./benchmarkFixture"

export function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  if (!sorted.length) return null
  return {
    samples: sorted.length,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1],
  }
}

export type LoadReport = {
  error: string | null
  correct: boolean
  deliveredUpdates: number
  committedUpdates: number
  outstandingUpdates: number
  snapshotMs: number
  latency: ReturnType<typeof summarize>
  processingLag: ReturnType<typeof summarize>
  messageHandling: ReturnType<typeof summarize>
}

// An in-memory transport: no WebSocket is constructed and send never touches a network.
export function createLoadRunner(fixture: BenchmarkFixture) {
  const timers: ReturnType<typeof setTimeout>[] = []
  const latencies: number[] = []
  const processingLags: number[] = []
  const handlingTimes: number[] = []
  let received = 0
  let committed = 0
  let origin: number | undefined
  let snapshotMs = 0
  let active = false
  let started = false
  let replayScheduled = false
  let resolve: ((report: LoadReport) => void) | undefined
  let finalState: BookFeedState | undefined
  const socket: FeedSocket = {
    readyState: 1, onopen: null, onmessage: null, onerror: null, onclose: null,
    send() {},
    close() {},
  }

  function schedule(work: () => void, delay: number) {
    timers.push(setTimeout(() => { if (active) work() }, Math.max(0, delay)))
  }
  function finish(error: string | null) {
    if (!active) return
    active = false
    timers.forEach(clearTimeout)
    if (origin !== undefined && performance.now() > origin + WARMUP_UPDATES * UPDATE_INTERVAL_MS) {
      // Backdate the start to the offered schedule, even if warm-up was overloaded.
      performance.mark("book-load:measurement-start", { startTime: origin + WARMUP_UPDATES * UPDATE_INTERVAL_MS })
      performance.mark("book-load:measurement-end")
      performance.measure("book-load:measurement", "book-load:measurement-start", "book-load:measurement-end")
    }
    // A separate task keeps correctness checks/report generation out of the last measured task.
    setTimeout(() => {
      const correct = committed === fixture.updates.length && finalState !== undefined &&
        (["bids", "asks"] as const).every((side) => {
          const actual = finalState!.book[side]
          return actual.size === fixture.expected[side].size &&
            [...fixture.expected[side]].every(([price, quantity]) =>
              actual.get(price)?.quantity === quantity && actual.get(price)?.price === price,
            )
        })
      resolve?.({
        error, correct, deliveredUpdates: received, committedUpdates: committed,
        outstandingUpdates: fixture.updates.length - committed, snapshotMs,
        latency: summarize(latencies), processingLag: summarize(processingLags),
        messageHandling: summarize(handlingTimes),
      })
    }, 0)
  }
  function deliver(raw: string) {
    socket.onmessage?.(new MessageEvent("message", { data: raw }))
  }
  const heartbeat = JSON.stringify({
    type: "heartbeat", product_id: "BTC-GBP", sequence: 1, last_trade_id: 1,
    time: new Date(REPLAY_TIME).toISOString(),
  })
  function replay() {
    origin = performance.now()
    fixture.updates.forEach((raw, i) => {
      const due = origin! + (i + 1) * UPDATE_INTERVAL_MS
      schedule(() => {
        if (document.hidden) return finish("Tab became hidden")
        received = i + 1
        const start = performance.now()
        deliver(raw)
        const end = performance.now()
        if (received > WARMUP_UPDATES) {
          processingLags.push(end - due)
          handlingTimes.push(end - start)
        }
      }, due - performance.now())
    })
    // Heartbeats keep the real watchdog active, including while the final update drains.
    function beat() {
      deliver(heartbeat)
      schedule(beat, 1000)
    }
    schedule(beat, 1000)
  }

  const options: Omit<BookFeedOptions, "onChange"> = {
    createSocket: () => socket,
    // A unique receipt timestamp identifies the latest update in each published book.
    now: () => REPLAY_TIME + received * UPDATE_INTERVAL_MS,
  }
  return {
    options,
    run() {
      if (started) throw new Error("Reload the benchmark page before another run")
      started = true
      active = true
      const promise = new Promise<LoadReport>((done) => { resolve = done })
      schedule(() => finish("Run exceeded 120 seconds"), 120_000)
      socket.onopen?.(new Event("open"))
      const start = performance.now()
      deliver(fixture.snapshot)
      snapshotMs = performance.now() - start
      deliver(heartbeat)
      return promise
    },
    // Called from a layout effect after the Dashboard's DOM mutations, not on receipt.
    commit(state: BookFeedState) {
      if (!active) return
      if (state.error) return finish(state.error)
      if (state.status !== "Live" || state.receivedAt === null) return
      finalState = state
      if (origin === undefined) {
        // Wait until the initial snapshot is rendered before beginning warm-up.
        if (!replayScheduled) {
          replayScheduled = true
          schedule(replay, 0)
        }
        return
      }
      const sequence = (state.receivedAt - REPLAY_TIME) / UPDATE_INTERVAL_MS
      const now = performance.now()
      for (let i = Math.max(committed + 1, WARMUP_UPDATES + 1); i <= sequence; i++) {
        latencies.push(now - (origin + i * UPDATE_INTERVAL_MS))
      }
      committed = Math.max(committed, sequence)
      if (committed === fixture.updates.length) finish(null)
    },
    cancel() { finish("Run cancelled") },
  }
}
