import { expect, it } from "vitest"
import { applyChanges, createOrderBook } from "../book/orderBook"
import { decodeCoinbaseMessage } from "../feed/coinbase"
import { BENCHMARK_SCENARIOS, createBenchmarkFixture, REPLAY_TIME } from "./benchmarkFixture"

it.each(["baseline", "stress"] as const)("prepares a repeatable, valid %s replay", (scenario) => {
  const fixture = createBenchmarkFixture(scenario)
  expect(createBenchmarkFixture(scenario).updates).toEqual(fixture.updates)
  expect(fixture.updates).toHaveLength(700)
  const snapshot = decodeCoinbaseMessage(fixture.snapshot)
  if (snapshot?.type !== "snapshot") throw new Error("Expected snapshot")
  const { levelsPerSide, changesPerUpdate } = BENCHMARK_SCENARIOS[scenario]
  const book = createOrderBook(snapshot)
  for (const side of [snapshot.bids, snapshot.asks]) {
    expect(side).toHaveLength(levelsPerSide)
    expect(new Set(side.map(([price]) => price)).size).toBe(levelsPerSide)
    expect(side.some(([price]) => !price.endsWith(".00"))).toBe(true)
    expect(side.every(([, quantity]) => /^\d+\.\d{8}$/.test(quantity))).toBe(true)
    const prices = side.map(([price]) => Number(price))
    expect(prices).not.toEqual([...prices].sort((a, b) => a - b))
    expect(prices).not.toEqual([...prices].sort((a, b) => b - a))
  }
  expect(Math.max(...snapshot.bids.map(([price]) => Number(price))))
    .toBeLessThan(Math.min(...snapshot.asks.map(([price]) => Number(price))))

  for (const [i, raw] of fixture.updates.entries()) {
    const message = decodeCoinbaseMessage(raw)
    if (message?.type !== "l2update") throw new Error("Expected update")
    expect(Date.parse(message.time)).toBe(REPLAY_TIME + (i + 1) * 50)
    expect(message.changes).toHaveLength(changesPerUpdate)
    expect(message.changes.filter(([, , quantity]) => quantity === "0")).toHaveLength(changesPerUpdate / 10)
    applyChanges(book, message.changes)
    expect(book.bids.size).toBe(levelsPerSide)
    expect(book.asks.size).toBe(levelsPerSide)
  }
  for (const side of ["bids", "asks"] as const) {
    expect(Object.fromEntries([...book[side]].map(([key, level]) => [key, level.quantity])))
      .toEqual(Object.fromEntries(fixture.expected[side]))
  }
}, 30000)

it.each([10, 110, 5000, 10000])("uses an exact 10%% change count for load %i", (load) => {
  const fixture = createBenchmarkFixture(load)
  const snapshot = JSON.parse(fixture.snapshot)
  expect(snapshot.bids).toHaveLength(load)
  expect(snapshot.asks).toHaveLength(load)
  for (const raw of fixture.updates) expect(JSON.parse(raw).changes).toHaveLength(load / 10)
})

it.each([0, -10, 15, 100010, NaN, Infinity])("rejects unsupported load %s", (load) => {
  expect(() => createBenchmarkFixture(load)).toThrow(/multiple of 10/)
})

it("extends the snapshot to 100,000 unique levels per side with 10,000 changes per update", () => {
  const fixture = createBenchmarkFixture(100000)
  const snapshot = JSON.parse(fixture.snapshot)
  for (const side of [snapshot.bids, snapshot.asks]) {
    expect(side).toHaveLength(100000)
    expect(new Set(side.map(([price]: string[]) => price)).size).toBe(100000)
    expect(side.every(([price]: string[]) => Number(price) > 0)).toBe(true)
  }
  const maxBid = snapshot.bids.reduce((max: number, [price]: string[]) => Math.max(max, Number(price)), 0)
  const minAsk = snapshot.asks.reduce((min: number, [price]: string[]) => Math.min(min, Number(price)), Infinity)
  expect(maxBid).toBeLessThan(minAsk)
  expect(JSON.parse(fixture.updates[0]).changes).toHaveLength(10000)
  expect(JSON.parse(fixture.updates.at(-1)!).changes).toHaveLength(10000)
  const original = JSON.parse(createBenchmarkFixture("stress").snapshot)
  expect(snapshot.bids.slice(0, 10000)).toEqual(original.bids)
  expect(snapshot.asks.slice(0, 10000)).toEqual(original.asks)
}, 30000)
