// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { applyChanges, createOrderBook } from "../book/orderBook"
import LoadPreview from "./LoadPreview"
import * as runner from "./loadRunner"

it("keeps inputs repeatable, batch counts exact and book depth stable", () => {
  for (const depth of [1000, 10000]) {
    const snapshot = runner.syntheticSnapshot(depth)
    expect(snapshot).toEqual(runner.syntheticSnapshot(depth))
    const book = createOrderBook(snapshot)
    for (const count of [1, 11, 20, depth]) {
      const changes = runner.syntheticChanges(depth, 7, count)
      expect(changes).toHaveLength(count)
      applyChanges(book, changes)
    }
    expect(book.bids.size).toBe(depth)
    expect(book.asks.size).toBe(depth)
  }
})

it("summarizes every sample using nearest-rank percentiles without mutating input", () => {
  const samples = [9, 1, 3, 2, 4]
  expect(runner.summarize(samples)).toEqual({
    calls: 5,
    median: 3,
    p95: 9,
    max: 9,
  })
  expect(samples).toEqual([9, 1, 3, 2, 4])
})

it.each([
  [1000, 20],
  [10000, 10000],
])(
  "paces %i levels with %i changes per update",
  async (depth, changes) => {
    vi.useFakeTimers()
    const socket = vi.fn(() => {
      throw new Error("Unexpected socket")
    })
    vi.stubGlobal("WebSocket", socket)
    const renderView = vi.fn()
    const pending = runner.runSynthetic(
      depth,
      "100",
      renderView,
      new AbortController().signal,
      changes,
    )
    await vi.runAllTimersAsync()
    const reports = (await pending)!
    expect(renderView).toHaveBeenCalledTimes(35)
    expect(reports.map((report) => report.depth)).toEqual([depth])
    for (const report of reports) {
      expect(report.changesPerBatch).toBe(changes)
      expect(report.updates).toBe(300)
      expect(report.updatesPerSecond).toBeCloseTo(20)
      expect(report.elapsedMs).toBe(15000)
      expect(report.maxDelayMs).toBe(0)
      expect(report.rows.slice(0, 2).every((row) => row.calls === 300)).toBe(
        true,
      )
      expect(report.rows.slice(2).every((row) => row.calls === 30)).toBe(true)
      expect(report.rows).toHaveLength(8)
      expect(
        report.rows.find((row) => row.operation === "Publication interval"),
      ).toMatchObject({ calls: 30, median: 500 })
    }
    expect(runner.markdownReport(reports)).toContain("Publication interval")
    expect(socket).not.toHaveBeenCalled()
  },
  60000,
)

it("reports scheduling backlog when rendering exceeds a publication interval", async () => {
  vi.useFakeTimers()
  let now = 0
  vi.spyOn(performance, "now").mockImplementation(() => Date.now() + now)
  const pending = runner.runSynthetic(
    1000,
    null,
    () => {
      now += 600
    },
    new AbortController().signal,
  )
  await vi.runAllTimersAsync()
  const reports = (await pending)!
  expect(reports[0].maxDelayMs).toBeGreaterThan(500)
  expect(reports[0].updatesPerSecond).toBeLessThan(20)
  expect(
    reports[0].rows.find(
      (row) => row.operation === "Work per ten updates + publication",
    )!.median,
  ).toBeGreaterThanOrEqual(600)
}, 60000)

it("completes, restarts and cancels from the page without reporting partial results", async () => {
  vi.useFakeTimers()
  vi.spyOn(runner, "runSynthetic").mockImplementation(
    async (_depth, _grouping, _render, signal) => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return signal.aborted ? null : []
    },
  )
  const { unmount } = render(<LoadPreview />)
  expect(screen.queryByRole("checkbox")).toBeNull()
  expect(screen.getAllByRole("combobox")).toHaveLength(3)
  const start = () =>
    fireEvent.click(screen.getByRole("button", { name: "Start synthetic run" }))
  fireEvent.change(screen.getByLabelText("Levels per side"), {
    target: { value: "10000" },
  })
  start()
  expect(runner.runSynthetic).toHaveBeenLastCalledWith(
    10000,
    "10",
    expect.any(Function),
    expect.any(AbortSignal),
    20,
  )
  expect(
    (screen.getByLabelText("Levels per side") as HTMLSelectElement).matches(
      ":disabled",
    ),
  ).toBe(true)
  await act(() => vi.runAllTimersAsync())
  expect(screen.getByRole("status").textContent).toBe("Completed")
  expect(screen.getByLabelText("Markdown report")).toBeTruthy()
  start()
  fireEvent.click(screen.getByRole("button", { name: "Stop run" }))
  await act(() => vi.runAllTimersAsync())
  expect(screen.queryByLabelText("Markdown report")).toBeNull()
  expect(screen.getByRole("status").textContent).toBe("Ready")
  start()
  unmount()
  await act(() => vi.runAllTimersAsync())
  expect(vi.getTimerCount()).toBe(0)
})
