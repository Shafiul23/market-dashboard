import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import { parseArgs } from "node:util"
import { resolve, join } from "node:path"
import { gzipSync } from "node:zlib"
import { chromium } from "playwright-core"
import { build, preview } from "vite"
import {
  BUDGETS,
  failures,
  formatResults,
  summarizeTrace,
} from "./performance-report.mjs"

const { values } = parseArgs({
  options: { repeat: { type: "string" }, load: { type: "string" } },
})
if (values.repeat !== undefined && !["1", "3"].includes(values.repeat)) {
  throw new Error("--repeat must be 1 or 3")
}
const load = values.load === undefined ? undefined : Number(values.load)
if (
  load !== undefined &&
  (!Number.isInteger(load) || load < 10 || load > 100000 || load % 10 !== 0)
) {
  throw new Error(
    "--load must be a multiple of 10 between 10 and 100000",
  )
}
const repetitions = Number(values.repeat ?? 1)
const workloads =
  load === undefined
    ? [
        { scenario: "baseline", levelsPerSide: 1000, changesPerUpdate: 100 },
        { scenario: "stress", levelsPerSide: 10000, changesPerUpdate: 1000 },
      ]
    : [{ scenario: "custom", levelsPerSide: load, changesPerUpdate: load / 10 }]
const directory = resolve("output/playwright/profile")
const id = new Date().toISOString().replaceAll(":", "-")
const runDirectory = join(directory, id)
await mkdir(runDirectory, { recursive: true })
const temporary = await mkdtemp(join(os.tmpdir(), "market-profile-"))
let server
let browser
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim()
const result = {
  id,
  commit: git(["rev-parse", "--short", "HEAD"]),
  dirty: Boolean(git(["status", "--porcelain"])),
  environment: {
    protocol: 2,
    browser: "",
    cpu: os.cpus()[0]?.model,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuSlowdown: 1,
    repetitions,
  },
  budgets: BUDGETS,
  workloads,
  runs: [],
}
try {
  const outDir = join(temporary, "dist")
  await build({
    cacheDir: join(temporary, "cache"),
    logLevel: "warn",
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: { input: resolve("fixtures.html") },
    },
  })
  server = await preview({
    build: { outDir },
    preview: { host: "127.0.0.1", port: 0, open: false },
  })
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "")
  browser = await chromium.launch({ channel: "chrome", headless: true })
  result.environment.browser = browser.version()
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    const orderedWorkloads =
      repetition % 2 ? workloads : [...workloads].reverse()
    for (const { scenario } of orderedWorkloads) {
      console.log(`Benchmarking ${scenario}, run ${repetition}/${repetitions}…`)
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        serviceWorkers: "block",
      })
      const errors = []
      await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === origin)
          return route.continue()
        errors.push(`Blocked external request: ${route.request().url()}`)
        return route.abort()
      })
      await context.routeWebSocket("**/*", (socket) => {
        errors.push(`Unexpected WebSocket: ${socket.url()}`)
        socket.close()
      })
      const page = await context.newPage()
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto(
        `${origin}/fixtures.html?load=${load ?? ""}&scenario=${scenario}`,
      )
      await page.getByLabel("Grouping", { exact: true }).selectOption("10")
      const cdp = await context.newCDPSession(page)
      const events = []
      cdp.on("Tracing.dataCollected", ({ value }) => events.push(...value))
      await cdp.send("Tracing.start", {
        categories:
          "toplevel,devtools.timeline,blink.user_timing,v8.execute,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler",
        transferMode: "ReportEvents",
      })
      let report = {}
      try {
        await page
          .getByRole("button", { name: "Start benchmark", exact: true })
          .click()
        await page
          .getByLabel("Benchmark result", { exact: true })
          .waitFor({ timeout: 125_000 })
        report = JSON.parse(
          await page
            .getByLabel("Benchmark result", { exact: true })
            .inputValue(),
        )
      } catch (error) {
        errors.push(error.message)
      }
      const complete = new Promise((resolve) =>
        cdp.once("Tracing.tracingComplete", resolve),
      )
      await cdp.send("Tracing.end")
      await complete
      const file = `${scenario}-r${repetition}`
      await writeFile(
        join(runDirectory, `${file}.json.gz`),
        gzipSync(JSON.stringify({ traceEvents: events })),
      )
      let trace = {}
      try {
        trace = summarizeTrace(events)
      } catch (error) {
        errors.push(error.message)
      }
      const run = { scenario, repetition, file, ...report, ...trace }
      if (errors.length)
        run.error = [report.error, ...errors].filter(Boolean).join("; ")
      result.runs.push(run)
      await writeFile(
        join(runDirectory, "results.json"),
        JSON.stringify(result, null, 2) + "\n",
      )
      await context.close()
    }
  }
  const markdown = formatResults(result)
  await writeFile(join(directory, `${id}.md`), markdown)
  await writeFile(join(directory, "latest.md"), markdown)
  await writeFile(
    join(directory, "latest.json"),
    JSON.stringify(result, null, 2) + "\n",
  )
  console.log(`\n${markdown}\nSaved: ${join(directory, "latest.md")}`)
  if (result.runs.some((run) => failures(run).length)) process.exitCode = 1
} finally {
  await browser?.close()
  if (server)
    await new Promise((resolve, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : resolve())),
    )
  await rm(temporary, { recursive: true, force: true })
}
