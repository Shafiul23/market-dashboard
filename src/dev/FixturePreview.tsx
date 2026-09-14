import { useState } from "react"
import App from "../App"
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

const snapshots: Record<string, BookSnapshot> = {
  Populated: populated,
  Waiting: { bids: [], asks: [] },
  "Short book": {
    bids: populated.bids.slice(0, 2),
    asks: populated.asks.slice(0, 3),
  },
  Stale: populated,
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
      <App
        view={view}
        connectionLabel={
          isWaiting ? "Connecting" : isStale ? "Reconnecting" : "Connected"
        }
        isStale={isStale}
      />
    </>
  )
}
