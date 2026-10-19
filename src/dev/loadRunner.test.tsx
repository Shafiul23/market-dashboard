// @vitest-environment jsdom
import { expect, it, vi } from "vitest"
import { initialBookFeedState } from "../feed/bookFeed"
import { REPLAY_TIME } from "./benchmarkFixture"
import { createLoadRunner, summarize } from "./loadRunner"

// Exercise measurement bookkeeping only: no feed controller or WebSocket connection.
function setup() {
  vi.useFakeTimers()
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
  const runner = createLoadRunner({
    snapshot: "snapshot", updates: Array.from({ length: 700 }, (_, i) => String(i)),
    expected: { bids: new Map(), asks: new Map() },
  })
  const socket = runner.options.createSocket!("")
  const state = () => ({
    ...initialBookFeedState, status: "Live" as const, isStale: false,
    receivedAt: runner.options.now!(),
  })
  socket.onmessage = ({ data }) => {
    if (data === "snapshot") runner.commit(state())
  }
  return { runner, state }
}

it("accounts for every coalesced update from its intended arrival to commit", async () => {
  const { runner, state } = setup()
  const mark = vi.spyOn(performance, "mark")
  const pending = runner.run()
  await vi.advanceTimersByTimeAsync(35600)
  expect(state().receivedAt).toBe(REPLAY_TIME + 35000)
  runner.commit(state())
  await vi.advanceTimersByTimeAsync(1)
  const report = await pending
  expect(report).toMatchObject({
    error: null, correct: true, deliveredUpdates: 700, committedUpdates: 700,
    outstandingUpdates: 0, latency: { samples: 600, p95: 29050, max: 30550 },
    messageHandling: { samples: 600 },
  })
  expect(mark).toHaveBeenCalledWith("book-load:measurement-start", { startTime: 5000 })
  expect(vi.getTimerCount()).toBe(0)
})

it("does not call an incomplete replay successful just because processing finished", async () => {
  const { runner } = setup()
  const pending = runner.run()
  await vi.advanceTimersByTimeAsync(120001)
  expect(await pending).toMatchObject({
    error: "Run exceeded 120 seconds", correct: false, deliveredUpdates: 700,
    committedUpdates: 0, outstandingUpdates: 700, latency: null,
  })
  expect(vi.getTimerCount()).toBe(0)
})

it("checks book contents after the final commit and cancels pending input", async () => {
  const { runner, state } = setup()
  const pending = runner.run()
  await vi.advanceTimersByTimeAsync(35000)
  runner.commit({ ...state(), book: { bids: new Map([["1", { price: "1", quantity: "2" }]]), asks: new Map() } })
  await vi.advanceTimersByTimeAsync(1)
  expect(await pending).toMatchObject({ correct: false, outstandingUpdates: 0 })
  expect(() => runner.run()).toThrow(/Reload/)
  const other = setup()
  const cancelled = other.runner.run()
  other.runner.cancel()
  await vi.advanceTimersByTimeAsync(1)
  expect(await cancelled).toMatchObject({ error: "Run cancelled", correct: false })
  expect(vi.getTimerCount()).toBe(0)
})

it("uses nearest-rank percentiles and leaves missing data unavailable", () => {
  const samples = [9, 1, 3, 2, 4]
  expect(summarize(samples)).toEqual({ samples: 5, p95: 9, max: 9 })
  expect(samples).toEqual([9, 1, 3, 2, 4])
  expect(summarize([])).toBeNull()
})
