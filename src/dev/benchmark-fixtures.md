# App benchmark

Run `npm run perf` with Node.js 24 and Google Chrome installed. It builds a
production benchmark page, runs the two default scenarios once each without CPU throttling,
and prints a short report. Allow roughly 75 seconds, longer if the app falls
behind. Use `npm run perf -- --repeat 3` for three repetitions each (about four
minutes) when you want to check consistency across runs.

| Setting                    |  Baseline |    Stress |
| -------------------------- | --------: | --------: |
| Initial levels per side    |     1,000 |    10,000 |
| Changes per update message |       100 |     1,000 |
| Initial snapshots          |         1 |         1 |
| Warm-up / measured updates | 100 / 600 | 100 / 600 |
| Update cadence             |     50 ms |     50 ms |

Both scenarios use £10 grouping and a 1440 × 1000 viewport. Their order alternates
between repetitions. Each starts in a fresh browser context. All exchange
connections and external requests are blocked. There is no comparison with
previous runs. A budget failure returns exit code 1 after saving the report.

## Fixed input

`benchmarkSnapshot.json` is the checked-in synthetic book. It was prepared once
based off a live snapshot's best prices and eight-decimal quantities.
Its prices have two decimal places and synthetic 2–100 pence gaps. Each block of
1,000 levels is shuffled; baseline uses the first block on each side. It is not
a recording or a claim about typical market activity. The unused `liveSnapshot.json`
has been removed. There is no fixture generator command or disk cache.

Before timing, `benchmarkFixture.ts` prepares all raw JSON messages using seed 42.
Each ten changes contains eight quantity replacements and a delete/reinsert pair
at the same price. Both sides receive updates, depth stays fixed and the spread
cannot cross. Messages and expected final quantities are prepared before the run;
their generation, initial file loading and final verification are excluded from
the measured workload. The application still parses and validates each raw message.

## What runs and what is measured

An in-memory transport feeds `createBookFeed`, through `useOrderBook`, into the
real Dashboard. The normal publication timer and React scheduling are used,
without forced synchronous commits. There is no WebSocket connection. Synthetic
heartbeats keep the real watchdog active. Receipt timestamps encode the latest
update sequence so each committed book can be attributed to the input it includes.

The initial snapshot is timed separately (decode, validation and book creation).
After its DOM commit, updates are scheduled at absolute 50 ms offsets: five
seconds of warm-up and thirty seconds of measured input. Late input keeps its
original deadline; it is not dropped or slowed to match the consumer. Main-thread
measurement starts at the scheduled end of warm-up, including any warm-up backlog,
and ends when the last update reaches a DOM commit. A run times out after 120 seconds.

- **Update → commit:** from intended arrival to the first DOM commit incorporating
  that update. Coalesced updates each count, even if a later change overwrote a
  value. p95 means 95% of measured updates were no slower. Pass: p95 ≤ 650 ms and
  maximum ≤ 1,000 ms, allowing for the intentional 500 ms publication wait.
- **Longest task:** worst uninterrupted main-thread task overlapping measurement.
  Pass: ≤ 100 ms. This is a project budget, not a browser standard.
- **Main busy:** main-thread task time per elapsed second. 1,000 ms/sec means fully
  occupied. Diagnostic only; lower leaves more headroom.
- **Completion/correctness:** every update must reach a committed book, its final
  full contents must match independently accumulated fixture quantities, and the
  run must have no errors. This does not verify every intermediate view.

The report uses the worst p95, maximum and task across repetitions, and medians
for busy time and snapshot processing. PASS requires all repetitions to pass;
mixed outcomes are INCONSISTENT. These workloads remain calibration candidates.
Keep their data and budgets fixed when assessing subsequent optimisations.

## Adjusting the benchmark

Run a single custom workload with:

```sh
npm run perf -- --load 5000
npm run perf -- --load 5000 --repeat 3
```

`--load` sets levels per side; changes per update are exactly 10% of that value.
For example, 5,000 levels per side produces 500 changes per message, still at
20 messages/sec. This is a controlled synthetic ratio, not a validated estimate
of typical market activity. Without `--load`, the baseline/stress table above
still applies. `--repeat` accepts 1 or 3, and flags can appear in either order.
Reports and saved JSON record the selected workload. CPU throttling is disabled
for both default and custom runs.

Loads must be multiples of 10 between 10 and 100,000 inclusive. The checked-in
snapshot contains 10,000 levels per side. Larger loads extend it before timing:
new bids step down from the lowest bid in one-penny increments, and new asks step
up from the highest ask. Quantities cycle through the original side's quantities.
Existing levels are preserved; generated levels are unique and stay outside the
spread. The 100,000 limit is a supported workload cap, not the snapshot size.
Loads that are multiples of 100 preserve the exact eight
replacements plus delete/reinsert pair per ten changes. Other accepted loads have
a partial final block; a delete is only emitted if its reinsert fits in the message.

For a capacity experiment, increase `--load` with budgets and machine settings
fixed, then repeat near the failure boundary. Record the highest consistently
passing load and the next failing load. This increases depth and message size
together, so it measures capacity along that particular workload ratio; it does
not isolate which variable causes failure. Keep the same load for before/after
comparisons of code changes.

Other settings still live in source:

| Setting           | Where to edit                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default scenarios | `BENCHMARK_SCENARIOS` in [`benchmarkFixture.ts`](./benchmarkFixture.ts) and `workloads` in [`scripts/profile.mjs`](../../scripts/profile.mjs); keep them aligned. |
| Message rate      | `UPDATE_INTERVAL_MS` in `benchmarkFixture.ts`: 50 means 20 messages/sec, 25 means 40 messages/sec. With fixed counts, this also changes run duration.             |
| Run length        | `WARMUP_UPDATES` and `MEASURED_UPDATES` in `benchmarkFixture.ts`.                                                                                                 |
| Pass/fail budgets | `BUDGETS` in [`scripts/performance-report.mjs`](../../scripts/performance-report.mjs); also update its failure messages and report text.                          |

If changing cadence or counts in source, update the fixed duration/cadence text in
`formatResults` and the expectations in `benchmarkFixture.test.ts`. For count
changes, also update `failures()` in `scripts/performance-report.mjs` (currently
700 delivered/committed updates and 600 latency samples) and its tests. Longer
runs may require increasing both the 120-second timeout in `loadRunner.ts` and
the 125-second browser wait in `scripts/profile.mjs`. None of these edits are
needed when using `--load`.

CPU throttling is separate from `PUBLICATION_INTERVAL_MS` in
[`src/feed/bookFeed.ts`](../feed/bookFeed.ts), currently 500 ms. That interval
controls production UI publication behaviour and remains unchanged; the latency
budgets allow for its intentional wait.

## Output and limits

`output/playwright/profile/latest.md` is the readable report. Each timestamped
directory also retains `results.json` and compressed Chrome traces. The report also shows p95 and maximum message-handling time and processing lag,
using the worst value across repetitions. Message handling covers synchronous
update handling; processing lag runs from intended arrival through handler
completion, including delayed delivery. Neither includes the publication wait or
React commit, and neither has a pass threshold. JSON additionally includes
delivery/commit counts and outstanding updates. Traces expose parsing and
view-building costs without adding timers throughout production code.

DOM commit is not paint or interaction latency. Main-thread timing excludes worker
CPU and includes measurement overhead; the longest overlapping task uses its full
duration. This is a synthetic, finite replay, not network latency or a long-running
memory test. Keep the machine idle and use the same browser/power settings when
interpreting results. Keep numerical/UI correctness tests alongside the benchmark.

For manual inspection, open `/fixtures.html?load&scenario=baseline` (or `stress`),
or `/fixtures.html?load=5000` for a custom load. Choose £10 grouping, select
**No throttling** in DevTools, and click Start benchmark.
Select the `book-load:measurement` span in a Chrome Performance recording.
