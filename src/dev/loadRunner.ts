import { createBookView } from "../book/bookView"
import type { BookView } from "../book/bookView"
import { applyChanges, createOrderBook } from "../book/orderBook"
import type { BookChange, SnapshotLevel } from "../book/orderBook"
import { COINBASE_PRODUCT, decodeCoinbaseMessage } from "../feed/coinbase"

const WARMUP = 5
const SAMPLES = 30
const UPDATE_MS = 50
const UPDATES_PER_PUBLICATION = 10
const RECEIVED_AT = Date.UTC(2026, 0, 1)

export function syntheticSnapshot(depth: number) {
  const slots = Array.from({ length: depth }, (_, index) => index)
  let seed = 42
  for (let i = slots.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    const slot = slots[i]
    slots[i] = slots[j]
    slots[j] = slot
  }
  return {
    bids: slots.map((slot): SnapshotLevel => [String(65000 - slot), "1"]),
    asks: slots.map((slot): SnapshotLevel => [String(65001 + slot), "1"]),
  }
}

export function syntheticChanges(
  depth: number,
  update: number,
  count = depth,
): BookChange[] {
  const changes: BookChange[] = []
  for (let i = 0; i < count; i++) {
    const slot = (update * 101 + i * 37) % depth
    const side = i % 2 === 0 ? "buy" : "sell"
    const price = String(side === "buy" ? 65000 - slot : 65001 + slot)
    if (i % 10 === 0 && i + 1 < count) {
      changes.push([side, price, "0"])
      i++
    }
    changes.push([side, price, String(2 + (update % 17))])
  }
  return changes
}

export function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    calls: sorted.length,
    median: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1],
  }
}

export async function runSynthetic(
  depth: number,
  grouping: string | null,
  render: (view: BookView) => void,
  signal: AbortSignal,
  changesPerBatch = depth,
) {
  if (depth !== 1000 && depth !== 10000)
    throw new Error("Choose 1,000 or 10,000 levels per side")
  if (
    !Number.isInteger(changesPerBatch) ||
    changesPerBatch < 1 ||
    changesPerBatch > depth
  ) {
    throw new Error("Changes per update must be an integer between 1 and depth")
  }
  const samples = new Map<string, number[]>()
  let recording = false
  function record(name: string, duration: number) {
    if (!recording) return
    const values = samples.get(name) ?? []
    values.push(duration)
    samples.set(name, values)
  }
  function measure<T>(name: string, work: () => T): T {
    const start = performance.now()
    const result = work()
    record(name, performance.now() - start)
    return result
  }
  const book = createOrderBook(syntheticSnapshot(depth))
  const started = performance.now()
  let measuredStart = started
  let due = started
  let maxDelayMs = 0
  let firstDelivery = 0
  let lastDelivery = 0
  let previousPublication = 0

  for (let window = 0; window < WARMUP + SAMPLES; window++) {
    recording = window >= WARMUP
    if (window === WARMUP) measuredStart = performance.now()
    const windowStart = performance.now()
    let workMs = 0
    for (let batch = 0; batch < UPDATES_PER_PUBLICATION; batch++) {
      const raw = JSON.stringify({
        type: "l2update",
        product_id: COINBASE_PRODUCT,
        time: new Date(RECEIVED_AT).toISOString(),
        changes: syntheticChanges(
          depth,
          window * UPDATES_PER_PUBLICATION + batch,
          changesPerBatch,
        ),
      })
      due += UPDATE_MS
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, due - performance.now())),
      )
      if (signal.aborted) return null
      if (document.hidden)
        throw new Error(
          "Keep the tab visible and rerun; background timers distort the cadence.",
        )
      const delivered = performance.now()
      if (recording) {
        if (window === WARMUP && batch === 0) firstDelivery = delivered
        lastDelivery = delivered
        maxDelayMs = Math.max(maxDelayMs, delivered - due)
      }
      const workStart = performance.now()
      const message = measure("Decode one update batch", () =>
        decodeCoinbaseMessage(raw),
      )
      if (message?.type !== "l2update")
        throw new Error("Invalid synthetic update")
      measure("Apply one update batch", () =>
        applyChanges(book, message.changes),
      )
      workMs += performance.now() - workStart
    }
    const workStart = performance.now()
    const published = measure("Copy book for publication", () => ({
      bids: new Map(book.bids),
      asks: new Map(book.asks),
    }))
    const view = measure("Build book view (inclusive)", () =>
      createBookView(published, RECEIVED_AT, grouping),
    )
    measure("Order book React + DOM commit", () => render(view))
    workMs += performance.now() - workStart
    record("Work per ten updates + publication", workMs)
    record(
      "Elapsed per ten updates + publication",
      performance.now() - windowStart,
    )
    const publication = performance.now()
    if (previousPublication)
      record("Publication interval", publication - previousPublication)
    previousPublication = publication
  }
  const elapsedMs = performance.now() - measuredStart

  const rows = [...samples].map(([operation, values]) => ({
    operation,
    ...summarize(values),
  }))
  return [
    {
      depth,
      changesPerBatch,
      grouping,
      updates: SAMPLES * UPDATES_PER_PUBLICATION,
      updatesPerSecond:
        ((SAMPLES * UPDATES_PER_PUBLICATION - 1) * 1000) /
        (lastDelivery - firstDelivery),
      elapsedMs,
      maxDelayMs,
      rows,
    },
  ]
}

export type LoadReport = NonNullable<Awaited<ReturnType<typeof runSynthetic>>>

export function markdownReport(reports: LoadReport) {
  return [
    "Synthetic workload: 20 scheduled updates/sec, publication every ten updates (500 ms target). Fixed seeded shuffle. Development build, Strict Mode off.",
    "Five warm-up publication windows discarded; 30 measured windows (300 updates) per scenario. Both book sides are included.",
    ...reports.flatMap((report) => [
      "",
      `${report.depth} levels/side; ${report.changesPerBatch} changes/update (both sides combined); display grouping ${report.grouping ?? "off"}.`,
      `Observed delivery: ${report.updatesPerSecond.toFixed(2)} updates/sec; max lateness ${report.maxDelayMs.toFixed(3)} ms; measured paced phase ${report.elapsedMs.toFixed(1)} ms.`,
      "",
      "| Operation | Samples | Median ms | p95 ms | Max ms |",
      "| --- | ---: | ---: | ---: | ---: |",
      ...report.rows.map(
        (row) =>
          `| ${row.operation} | ${row.calls} | ${row.median.toFixed(3)} | ${row.p95.toFixed(3)} | ${row.max.toFixed(3)} |`,
      ),
    ]),
    "",
    "Work per ten updates sums decode/apply and one copy/view/render, including timing overhead; elapsed also includes waiting and fixture generation. Work includes the individual operations above it; do not add all rows.",
    "React + DOM commit uses flushSync, includes wrapper overhead, excludes layout/paint and the rest of Dashboard. This driver is not the real feed scheduler or a live latency measurement. Late updates remain queued, with no drops.",
    "Record browser, machine and CPU throttling. Repeat runs; scheduling, JIT and garbage collection can affect results.",
  ].join("\n")
}
