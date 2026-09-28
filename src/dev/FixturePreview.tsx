import { useState } from "react"
import { Dashboard } from "../components/Dashboard"
import { createBookView } from "../book/bookView"
import { createOrderBook } from "../book/orderBook"
import type { BookSnapshot } from "../book/orderBook"

const populated: BookSnapshot = {
  bids: Array.from({ length: 12 }, (_, index) => [
    `${65000 - index}.25`,
    "0.12345678",
  ]),
  asks: Array.from({ length: 12 }, (_, index) => [
    `${65001 + index}.50`,
    "1.23456789",
  ]),
}

const unequal: BookSnapshot = {
  bids: [
    ["65000.25", "2"],
    ["64999.25", "1"],
    ["64998.25", "0.25"],
  ],
  asks: [
    ["65001.50", "1"],
    ["65002.50", "0.5"],
    ["65003.50", "2"],
  ],
}

const snapshots: Record<string, BookSnapshot> = {
  Populated: populated,
  Waiting: { bids: [], asks: [] },
  "Short book": {
    bids: unequal.bids.slice(0, 2),
    asks: unequal.asks.slice(0, 3),
  },
  Stale: unequal,
  "Unequal quantities": unequal,
  "Extreme quantities": {
    bids: [
      ["65000.25", "0.00000000000000000001"],
      ["64999.25", "1000000"],
    ],
    asks: [["65001.50", "1000000"], ["65002.50", "1"]],
  },
  "Empty bids": { bids: [], asks: populated.asks },
  "Larger values": {
    bids: [["100000.25", "12.34567890"]],
    asks: [["100001.50", "123.45678901"]],
  },
}

export default function FixturePreview() {
  const [scenario, setScenario] = useState("Populated")
  const isWaiting = scenario === "Waiting"
  const isStale = scenario === "Stale"
  const view = createBookView(
    createOrderBook(snapshots[scenario]),
    isWaiting ? null : Date.parse("2026-09-09T14:32:08.123Z"),
  )

  return (
    <>
      <div className="border-b border-slate-700 bg-slate-900 p-4 text-sm text-slate-100">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <label htmlFor="fixture">Fixture preview · Sample data</label>
          <select
            id="fixture"
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            className="rounded border border-slate-600 bg-slate-950 py-1"
          >
            {Object.keys(snapshots).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <Dashboard
        view={view}
        connectionLabel={
          isWaiting ? "Connecting" : isStale ? "Reconnecting" : "Live"
        }
        isStale={isStale}
      />
    </>
  )
}
