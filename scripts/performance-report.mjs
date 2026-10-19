// Chrome trace timestamps are microseconds. Only count the marked renderer thread.
export function summarizeTrace(events) {
  const start = events.find(
    (event) => event.name === "book-load:measurement-start",
  )
  const end = events.find((event) => event.name === "book-load:measurement-end")
  if (
    !start ||
    !end ||
    end.ts <= start.ts ||
    end.pid !== start.pid ||
    end.tid !== start.tid
  ) {
    throw new Error(
      "Missing or inconsistent measurement markers in Chrome trace",
    )
  }
  const tasks = events.filter(
    (event) =>
      event.pid === start.pid &&
      event.tid === start.tid &&
      event.ph === "X" &&
      (event.name === "RunTask" ||
        event.name === "ThreadControllerImpl::RunTask") &&
      event.ts < end.ts &&
      event.ts + event.dur > start.ts,
  )
  if (!tasks.length)
    throw new Error("Chrome trace has no supported main-thread tasks")
  const intervals = tasks
    .map((task) => [
      Math.max(start.ts, task.ts),
      Math.min(end.ts, task.ts + task.dur),
    ])
    .sort((a, b) => a[0] - b[0])
  let busy = 0
  let countedUntil = start.ts
  for (const [from, to] of intervals) {
    busy += Math.max(0, to - Math.max(from, countedUntil))
    countedUntil = Math.max(countedUntil, to)
  }
  return {
    durationMs: (end.ts - start.ts) / 1000,
    busyMsPerSecond: (busy / (end.ts - start.ts)) * 1000,
    longestTaskMs: Math.max(...tasks.map((task) => task.dur)) / 1000,
  }
}

export const BUDGETS = {
  latencyP95Ms: 650,
  latencyMaxMs: 1000,
  longestTaskMs: 100,
}

export function failures(run) {
  const reasons = []
  if (run.error) reasons.push(run.error)
  if (!run.correct) reasons.push("final book did not match the fixture")
  if (
    run.deliveredUpdates !== 700 ||
    run.committedUpdates !== 700 ||
    run.latency?.samples !== 600
  ) {
    reasons.push(
      `incomplete replay (${run.outstandingUpdates ?? "unknown"} updates outstanding)`,
    )
  }
  if (
    !run.latency ||
    !Number.isFinite(run.latency.p95) ||
    !Number.isFinite(run.latency.max) ||
    !Number.isFinite(run.longestTaskMs) ||
    !Number.isFinite(run.busyMsPerSecond)
  ) {
    reasons.push("missing timing measurements")
  }
  if (run.latency?.p95 > BUDGETS.latencyP95Ms)
    reasons.push("p95 update-to-commit over 650 ms")
  if (run.latency?.max > BUDGETS.latencyMaxMs)
    reasons.push("worst update-to-commit over 1,000 ms")
  if (run.longestTaskMs > BUDGETS.longestTaskMs)
    reasons.push("main-thread task over 100 ms")
  return reasons
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export function formatResults(result) {
  const explanations = []
  const diagnosticRows = []
  const rows = result.workloads.map(({ scenario }) => {
    const runs = result.runs.filter((run) => run.scenario === scenario)
    const passed = runs.filter((run) => failures(run).length === 0).length
    const verdict =
      passed === runs.length && runs.length > 0
        ? "PASS"
        : passed === 0
          ? "FAIL"
          : "INCONSISTENT"
    const cell = (select, aggregate = Math.max) => {
      const values = runs.map(select)
      return values.length && values.every(Number.isFinite)
        ? aggregate(...values).toFixed(1)
        : "—"
    }
    diagnosticRows.push(
      `| ${scenario} | ${[
        cell((run) => run.messageHandling?.p95),
        cell((run) => run.messageHandling?.max),
        cell((run) => run.processingLag?.p95),
        cell((run) => run.processingLag?.max),
      ].join(" | ")} |`,
    )
    const reasons = [...new Set(runs.flatMap(failures))]
    if (reasons.length)
      explanations.push(`- **${scenario}:** ${reasons.join("; ")}.`)
    return `| ${scenario} | ${verdict} (${passed}/${runs.length}) | ${[
      cell((run) => run.latency?.p95),
      cell((run) => run.latency?.max),
      cell((run) => run.longestTaskMs),
      cell(
        (run) => run.busyMsPerSecond,
        (...values) => median(values),
      ),
      cell(
        (run) => run.snapshotMs,
        (...values) => median(values),
      ),
    ].join(" | ")} |`
  })
  return [
    "# App benchmark",
    "",
    `Commit ${result.commit}${result.dirty ? " (uncommitted changes)" : ""} · Chrome ${result.environment.browser} · ${result.environment.cpu} · ${result.environment.platform}`,
    "Production build, full Dashboard and real feed scheduler, offline input, no CPU throttling, £10 grouping, 1440 × 1000.",
    result.workloads
      .map(
        ({ scenario, levelsPerSide, changesPerUpdate }) =>
          `${scenario}: ${levelsPerSide.toLocaleString("en-GB")} levels/side, ${changesPerUpdate.toLocaleString("en-GB")} changes/message.`,
      )
      .join(" "),
    `${result.environment.repetitions} run(s) per scenario; 1 initial snapshot, 100 warm-up + 600 measured updates at 20/sec. About 5 + 30 seconds per run; backlog extends it.`,
    "",
    "| Scenario | Result | Update → commit p95, ms | Worst update → commit, ms | Longest task, ms | Main busy, ms/sec | Initial snapshot, ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "PASS requires all updates committed, the final full book matching the fixture, no errors, p95 ≤ 650 ms, worst latency ≤ 1,000 ms and longest task ≤ 100 ms. These are project budgets, not universal browser thresholds.",
    ...explanations,
    "",
    "Update → commit includes queueing, processing and the intended publication wait, ending at DOM commit (not paint). p95 means 95% of updates were at or below that latency. The table uses the worst p95/max/task across repetitions; busy and snapshot use medians. Result shows passing repetitions.",
    "Main busy is main-thread task time per elapsed second (1,000 = fully occupied); lower leaves more headroom. Initial snapshot measures decode + validation + book construction, separately from steady state. Neither has a pass threshold.",
    "",
    "| Scenario | Message handling p95, ms | Message handling max, ms | Processing lag p95, ms | Processing lag max, ms |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...diagnosticRows,
    "",
    "Message handling measures synchronous handling of each update message, including decoding, validation and working-book updates. Processing lag measures intended arrival through handler completion, including delayed delivery. Updates in the real application come in every 50 ms so update handling must be comfortably within this window. Neither includes waiting for publication or React commit. Each column uses the worst value across repetitions. Missing measurements are shown as —.",
    "",
    `Raw results and diagnostic timings: [results.json](${result.id}/results.json). Chrome traces: ${result.runs.map((run) => `[${run.scenario} ${run.repetition}](${result.id}/${run.file}.json.gz)`).join(", ")}.`,
    "No previous-run comparison. This checks final book contents, not every intermediate view; retain the application's correctness tests. Main-thread timing excludes worker CPU and does not measure interaction latency or final paint.",
    "",
  ].join("\n")
}
