import type { BookChange, BookSnapshot } from "../book/orderBook"
import snapshotRaw from "./benchmarkSnapshot.json?raw"

export const BENCHMARK_SCENARIOS = {
  baseline: { levelsPerSide: 1000, changesPerUpdate: 100 },
  stress: { levelsPerSide: 10000, changesPerUpdate: 1000 },
} as const
export type Scenario = keyof typeof BENCHMARK_SCENARIOS
export const WARMUP_UPDATES = 100
export const MEASURED_UPDATES = 600
export const UPDATE_INTERVAL_MS = 50
export const REPLAY_TIME = Date.UTC(2026, 0, 1)

// Called before timing. Prices/quantities are static; only the update order is seeded.
export function createBenchmarkFixture(scenario: Scenario | number) {
  if (typeof scenario === "number" &&
      (!Number.isInteger(scenario) || scenario < 10 || scenario > 100000 || scenario % 10 !== 0)) {
    throw new Error("Load must be a multiple of 10 between 10 and 100000")
  }
  const settings = typeof scenario === "number"
    ? { levelsPerSide: scenario, changesPerUpdate: scenario / 10 }
    : BENCHMARK_SCENARIOS[scenario]
  const source: BookSnapshot = JSON.parse(snapshotRaw)
  const bids = source.bids.slice(0, settings.levelsPerSide)
  const asks = source.asks.slice(0, settings.levelsPerSide)
  // Extend beyond the checked-in depth before timing, preserving all existing levels.
  // One-penny steps away from the spread keep prices positive and unique up to 100,000.
  for (const [levels, direction] of [[bids, -1], [asks, 1]] as const) {
    const sourceLength = levels.length
    const prices = levels.map(([price]) => Math.round(Number(price) * 100))
    let edge = direction === -1 ? Math.min(...prices) : Math.max(...prices)
    while (levels.length < settings.levelsPerSide) {
      edge += direction
      const quantity = levels[(levels.length - sourceLength) % sourceLength][1]
      levels.push([(edge / 100).toFixed(2), quantity])
    }
  }
  const expected = {
    bids: new Map(bids.map(([price, quantity]) => [String(Number(price)), quantity])),
    asks: new Map(asks.map(([price, quantity]) => [String(Number(price)), quantity])),
  }
  let seed = 42
  function index(length: number) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return Math.floor(seed / 2 ** 32 * length)
  }
  const updates = Array.from({ length: WARMUP_UPDATES + MEASURED_UPDATES }, (_, update) => {
    const changes: BookChange[] = []
    for (let i = 0; i < settings.changesPerUpdate; i++) {
      const side = index(2) === 0 ? "buy" : "sell"
      const levels = side === "buy" ? bids : asks
      const [price] = levels[index(levels.length)]
      const quantity = levels[index(levels.length)][1]
      // Delete/reinsert pairs exercise both paths while keeping depth fixed.
      if (i % 10 === 0 && i + 1 < settings.changesPerUpdate) {
        changes.push([side, price, "0"])
        i++
      }
      changes.push([side, price, quantity])
      expected[side === "buy" ? "bids" : "asks"].set(String(Number(price)), quantity)
    }
    return JSON.stringify({
      type: "l2update", product_id: "BTC-GBP",
      time: new Date(REPLAY_TIME + (update + 1) * UPDATE_INTERVAL_MS).toISOString(), changes,
    })
  })
  const snapshot = JSON.stringify({ type: "snapshot", product_id: "BTC-GBP", bids, asks })
  return { snapshot, updates, expected }
}

export type BenchmarkFixture = ReturnType<typeof createBenchmarkFixture>
