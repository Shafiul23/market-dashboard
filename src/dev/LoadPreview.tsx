import { useEffect, useLayoutEffect, useState } from "react"
import { Dashboard } from "../components/Dashboard"
import { useOrderBook } from "../hooks/useOrderBook"
import { createBenchmarkFixture } from "./benchmarkFixture"
import type { Scenario } from "./benchmarkFixture"
import { createLoadRunner } from "./loadRunner"
import type { LoadReport } from "./loadRunner"

export default function LoadPreview() {
  const params = new URLSearchParams(location.search)
  const load = params.get("load")
  const scenario: Scenario = params.get("scenario") === "stress" ? "stress" : "baseline"
  const [runner] = useState(() => createLoadRunner(createBenchmarkFixture(load ? Number(load) : scenario)))
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<LoadReport | null>(null)
  const feed = useOrderBook(running, runner.options)
  useLayoutEffect(() => { runner.commit(feed) }, [runner, feed])
  useEffect(() => {
    if (!running) return
    let mounted = true
    runner.run().then((result) => {
      if (mounted) {
        setReport(result)
        setRunning(false)
      }
    })
    return () => {
      mounted = false
      runner.cancel()
    }
  }, [runner, running])

  return (
    <>
      <div className="space-y-3 border-b border-divider bg-surface p-4 text-sm text-primary">
        <p>Offline benchmark · {load ? `${load} levels/side, ${Number(load) / 10} changes/update` : scenario} · select £10 grouping before starting.</p>
        <button
          className="rounded border border-control px-3 py-1"
          disabled={running || report !== null}
          onClick={() => setRunning(true)}
        >
          Start benchmark
        </button>
        <p>{running ? "Running…" : report ? "Complete — reload to run again." : "Ready"}</p>
        {report && (
          <textarea aria-label="Benchmark result" className="h-64 w-full font-mono" readOnly value={JSON.stringify(report, null, 2)} />
        )}
      </div>
      <Dashboard
        book={feed.book} receivedAt={feed.receivedAt} connectionLabel={feed.status}
        heartbeatCount={feed.heartbeatCount} error={feed.error} isStale={feed.isStale}
        enabled={running}
      />
    </>
  )
}
