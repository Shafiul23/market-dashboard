import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { BookView } from "../book/bookView"
import { OrderBook } from "../components/organisms/OrderBook"
import { markdownReport, runSynthetic } from "./loadRunner"
import type { LoadReport } from "./loadRunner"

export default function LoadPreview() {
  const [depth, setDepth] = useState(1000)
  const [grouping, setGrouping] = useState<string | null>("10")
  const [changes, setChanges] = useState("20")
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<BookView | null>(null)
  const [report, setReport] = useState<LoadReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function start() {
    const run = new AbortController()
    controller.current = run
    setRunning(true)
    setReport(null)
    setError(null)
    try {
      const result = await runSynthetic(
        depth,
        grouping,
        (next) => {
          flushSync(() => setView(next))
        },
        run.signal,
        changes === "depth" ? depth : Number(changes),
      )
      if (!run.signal.aborted) setReport(result)
    } catch (cause) {
      if (!run.signal.aborted) setError(String(cause))
    } finally {
      if (!run.signal.aborted) setRunning(false)
    }
  }

  return (
    <main className="min-h-screen space-y-6 bg-slate-950 p-6 text-sm text-slate-100">
      <h1 className="text-xl font-semibold">
        Synthetic performance experiment
      </h1>
      <p>
        No exchange connection. Choose book depth and update size separately.
        The seeded workload uses the current production algorithms.
      </p>
      <p>
        20 scheduled updates/sec; publish every ten updates (500 ms target).
        Each run has five warm-up windows and 30 measured windows (300 updates).
        Allow about 18 seconds, longer under heavy load. Keep this tab visible.
      </p>
      <fieldset
        disabled={running}
        className="flex flex-wrap items-center gap-4"
      >
        <label>
          Levels per side{" "}
          <select
            className="bg-slate-800 p-2"
            value={depth}
            onChange={(event) => setDepth(Number(event.target.value))}
          >
            <option value={1000}>1,000</option>
            <option value={10000}>10,000</option>
          </select>
        </label>
        <label>
          Changes per update{" "}
          <select className="bg-slate-800 p-2" value={changes} onChange={(event) => setChanges(event.target.value)}>
            <option value="20">20</option>
            <option value="depth">Same as depth</option>
          </select>
        </label>
        <label>
          Grouping{" "}
          <select
            className="bg-slate-800 p-2"
            value={grouping ?? ""}
            onChange={(event) => setGrouping(event.target.value || null)}
          >
            <option value="">Off</option>
            {["10", "100", "1000"].map((value) => (
              <option key={value} value={value}>
                £{value}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded border border-slate-500 p-2" onClick={start}>
          Start synthetic run
        </button>
      </fieldset>
      {running && (
        <button
          className="rounded border border-slate-500 p-2"
          onClick={() => {
            controller.current?.abort()
            setRunning(false)
          }}
        >
          Stop run
        </button>
      )}
      <p role="status">
        {running ? "Running…" : report ? "Completed" : "Ready"}
      </p>
      {error && <p role="alert">{error}</p>}
      {report && (
        <label className="block">
          Copyable Markdown report
          <textarea
            aria-label="Markdown report"
            className="mt-3 h-96 w-full bg-slate-900 p-3 font-mono text-xs"
            readOnly
            value={markdownReport(report)}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      {view && (
        <fieldset disabled className="pointer-events-none">
          <legend className="mb-2">Measured order book preview</legend>
          <OrderBook
            view={view}
            isWaiting={false}
            onGroupingChange={() => {}}
          />
        </fieldset>
      )}
    </main>
  )
}
