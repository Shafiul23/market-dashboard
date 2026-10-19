import { expect, it } from "vitest"
import { failures, formatResults, summarizeTrace } from "./performance-report.mjs"

it("clips and merges main tasks, excluding worker tasks and nested function timings", () => {
  const event = (name, ts, dur, tid = 1) => ({ name, ts, dur, tid, pid: 2, ph: "X" })
  expect(summarizeTrace([
    event("book-load:measurement-start", 1000), event("book-load:measurement-end", 11000),
    event("RunTask", 0, 3000), event("RunTask", 2000, 3000),
    event("RunTask", 10000, 3000), event("RunTask", 12000, 3000),
    event("RunTask", 1000, 10000, 99), event("FunctionCall", 5000, 5000),
  ])).toEqual({ durationMs: 10, busyMsPerSecond: 500, longestTaskMs: 3 })
})

it("rejects missing markers or unsupported task events rather than reporting zero", () => {
  expect(() => summarizeTrace([])).toThrow(/markers/)
  expect(() => summarizeTrace([
    { name: "book-load:measurement-start", ts: 1, pid: 1, tid: 1 },
    { name: "book-load:measurement-end", ts: 2, pid: 1, tid: 1 },
  ])).toThrow(/tasks/)
})

const healthy = {
  error: null, correct: true, deliveredUpdates: 700, committedUpdates: 700, outstandingUpdates: 0,
  latency: { samples: 600, p95: 650, max: 1000 }, longestTaskMs: 100, busyMsPerSecond: 200, snapshotMs: 40,
}

it("requires complete, correct results and applies inclusive timing budgets", () => {
  expect(failures(healthy)).toEqual([])
  expect(failures({ ...healthy, longestTaskMs: 101 })).toEqual(["main-thread task over 100 ms"])
  expect(failures({ ...healthy, latency: { samples: 600, p95: 651, max: 1001 } })).toHaveLength(2)
  expect(failures({ ...healthy, correct: false })).toContain("final book did not match the fixture")
  expect(failures({ ...healthy, committedUpdates: 699, outstandingUpdates: 1 })).toContain("incomplete replay (1 updates outstanding)")
  expect(failures({ ...healthy, latency: null })).toContain("missing timing measurements")
  expect(failures({ ...healthy, error: "feed failed" })).toContain("feed failed")
})

it("does not hide a failing repetition behind a median", () => {
  const result = {
    id: "run", commit: "abc", environment: { browser: "123", repetitions: 3 },
    workloads: [{ scenario: "baseline", levelsPerSide: 1000, changesPerUpdate: 100 },
      { scenario: "stress", levelsPerSide: 10000, changesPerUpdate: 1000 }],
    runs: [
      ...[1, 2, 3].map((repetition) => ({ ...healthy, scenario: "baseline", repetition, file: `baseline-${repetition}` })),
      ...[90, 200, 90].map((longestTaskMs, i) => ({ ...healthy, scenario: "stress", repetition: i + 1, file: `stress-${i}`, longestTaskMs })),
    ],
  }
  const report = formatResults(result)
  expect(report).toContain("| baseline | PASS (3/3)")
  expect(report).toContain("| stress | INCONSISTENT (2/3) | 650.0 | 1000.0 | 200.0")
  expect(report).toContain("main-thread task over 100 ms")
})

it("reports the actual custom workload without default scenario rows", () => {
  const report = formatResults({
    id: "run", commit: "abc", environment: { browser: "123", repetitions: 1 },
    workloads: [{ scenario: "custom", levelsPerSide: 5000, changesPerUpdate: 500 }],
    runs: [{ ...healthy, scenario: "custom", repetition: 1, file: "custom-1" }],
  })
  expect(report).toContain("custom: 5,000 levels/side, 500 changes/message")
  expect(report).toContain("| custom | PASS (1/1)")
  expect(report).toContain("no CPU throttling")
  expect(report).not.toContain("| baseline |")
})

it("reports worst diagnostic timings across repetitions and leaves missing values visible", () => {
  const result = {
    id: "run", commit: "abc", environment: { browser: "123", repetitions: 3 },
    workloads: [{ scenario: "custom", levelsPerSide: 5000, changesPerUpdate: 500 }],
    runs: [
      { messageHandling: { p95: 8, max: 30 }, processingLag: { p95: 50, max: 90 } },
      { messageHandling: { p95: 12, max: 20 }, processingLag: { p95: 40, max: 100 } },
      { messageHandling: { p95: 9, max: 25 }, processingLag: { p95: 45, max: 95 } },
    ].map((diagnostics, i) => ({ ...healthy, ...diagnostics, scenario: "custom", repetition: i + 1, file: `custom-${i}` })),
  }
  expect(formatResults(result)).toContain("| custom | 12.0 | 30.0 | 50.0 | 100.0 |")
  expect(formatResults(result)).toContain("| custom | PASS (3/3)")
  result.runs[0].messageHandling = null
  expect(formatResults(result)).toContain("| custom | — | — | 50.0 | 100.0 |")
})
