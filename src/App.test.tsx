// @vitest-environment jsdom
import { StrictMode } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App"
import { unsortedSnapshot } from "./book/fixtures"
import { FakeSocket } from "./feed/fakeSocket"
import {
  heartbeatMessage,
  snapshotMessage,
  subscriptionsMessage,
  updateMessage,
} from "./feed/fixtures"

const fullSnapshot = { ...snapshotMessage, ...unsortedSnapshot }

function setup() {
  const sockets: FakeSocket[] = []
  // Only the transport is replaced: App, the hook, controller and decoder are real.
  vi.stubGlobal("WebSocket", class extends FakeSocket {
    constructor() {
      super()
      sockets.push(this)
    }
  })
  return { sockets, ...render(<StrictMode><App /></StrictMode>) }
}

function expectStatus(label: string) {
  expect(screen.getByRole("status").textContent).toBe(`Connection: ${label}`)
}

function rows(side: "Bids" | "Asks") {
  return within(screen.getByRole("table", { name: side }))
    .getAllByRole("row").slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))
}

function expectOverview(bid: string, ask: string, spread: string) {
  expect(within(screen.getByRole("region", { name: "Market overview" }))
    .getAllByRole("definition").map((value) => value.textContent))
    .toEqual([bid, ask, spread])
}

function startLive(sockets: FakeSocket[]) {
  fireEvent.click(screen.getByRole("button", { name: "Start order book" }))
  act(() => {
    sockets[0].open()
    sockets[0].message(fullSnapshot)
    sockets[0].message(heartbeatMessage)
  })
  expectStatus("Live")
}

describe("dashboard acceptance flows", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z"))
    vi.spyOn(Math, "random").mockReturnValue(0)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  })

  it("shows loading until a snapshot and heartbeat make the sorted book usable", () => {
    const { sockets } = setup()
    expect(sockets).toHaveLength(0)
    expectStatus("Stopped")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("BTC-GBP")
    expect(screen.getByText("Coinbase · Market dashboard")).toBeTruthy()
    expectOverview("—Waiting for data", "—Waiting for data", "—Waiting for data")
    expect(screen.getAllByText("Waiting for data.")).toHaveLength(2)
    expect(screen.getByText("Last book update: Waiting for data.")).toBeTruthy()
    for (const side of ["Bids", "Asks"]) {
      const table = within(screen.getByRole("table", { name: side }))
      expect(table.getByRole("columnheader", { name: "Price in GBP" })).toBeTruthy()
      expect(table.getByRole("columnheader", { name: "Quantity in BTC" })).toBeTruthy()
    }

    fireEvent.click(screen.getByRole("button", { name: "Start order book" }))
    expectStatus("Connecting")
    expect(sockets).toHaveLength(1)
    act(() => sockets[0].open())
    expectStatus("Synchronising")
    act(() => sockets[0].message(subscriptionsMessage))
    expectStatus("Synchronising")
    act(() => sockets[0].message(fullSnapshot))
    expectStatus("Synchronising")
    expect(screen.getByText("Waiting for market data.")).toBeTruthy()
    expect(screen.getAllByText("Waiting for data.")).toHaveLength(2)

    act(() => sockets[0].message(heartbeatMessage))
    expectStatus("Live")
    expect(screen.getByText(/^Live data:/)).toBeTruthy()
    expectOverview("100.00", "100.10", "0.10")
    expect(rows("Bids")).toEqual([
      "100.00", "99.99", "99.98", "99.97", "99.96",
      "99.95", "99.94", "99.93", "99.92", "99.91",
    ].map((price) => [price, "1.00000000"]))
    expect(rows("Asks")).toEqual([
      "100.10", "100.11", "100.12", "100.13", "100.14",
      "100.15", "100.16", "100.17", "100.18", "100.19",
    ].map((price) => [price, "1.00000000"]))
    expect(screen.getByText("Last book update: Received 2026-09-14 12:00:00.000 UTC")).toBeTruthy()

    const receipt = screen.getByText(/^Last book update:/).textContent
    act(() => {
      vi.advanceTimersByTime(1000)
      sockets[0].message(heartbeatMessage)
    })
    expect(screen.getByText(/^Last book update:/).textContent).toBe(receipt)
    expectStatus("Live")
  })

  it("adds, replaces and removes levels, promoting retained depth without announcing prices", () => {
    const { sockets, container } = setup()
    startLive(sockets)
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.getAttribute("aria-atomic")).toBe("true")
    expect([...container.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')])
      .toEqual([status])
    const announcements = new MutationObserver(() => {})
    announcements.observe(status, { subtree: true, childList: true, characterData: true })

    const steps = [
      { change: ["buy", "100.05", "2.00000000"], bid: "100.05", ask: "100.10", spread: "0.05", quantity: "2.00000000" },
      { change: ["buy", "100.05", "0.25000000"], bid: "100.05", ask: "100.10", spread: "0.05", quantity: "0.25000000" },
      { change: ["buy", "100.05", "0"], bid: "100.00", ask: "100.10", spread: "0.10", quantity: "1.00000000" },
      { change: ["buy", "100.00", "0"], bid: "99.99", ask: "100.10", spread: "0.11", quantity: "1.00000000" },
      { change: ["sell", "100.10", "0"], bid: "99.99", ask: "100.11", spread: "0.12", quantity: "1.00000000" },
    ]
    for (const { change, bid, ask, spread, quantity } of steps) {
      act(() => {
        sockets[0].message({ ...updateMessage, changes: [change] })
        vi.advanceTimersByTime(100)
      })
      expectOverview(bid, ask, spread)
      expect(rows("Bids")[0]).toEqual([bid, quantity])
      expect(rows("Asks")[0]).toEqual([ask, "1.00000000"])
      expect(rows("Bids")).toHaveLength(10)
      expect(rows("Asks")).toHaveLength(10)
      expect(screen.getByRole("status")).toBe(status)
      expect(announcements.takeRecords()).toHaveLength(0)
    }
    announcements.disconnect()
    expect(rows("Bids").at(-1)).toEqual(["99.90", "1.00000000"])
    expect(rows("Asks").at(-1)).toEqual(["100.20", "1.00000000"])
    expect(screen.getByText("Last book update: Received 2026-09-14 12:00:00.400 UTC")).toBeTruthy()
  })

  it.each(["socket close", "offline", "heartbeat timeout"])(
    "keeps stale values after %s until recovery supplies a new snapshot",
    (interruption) => {
      const { sockets } = setup()
      startLive(sockets)
      const status = screen.getByRole("status")
      const previousBids = rows("Bids")
      const previousAsks = rows("Asks")
      const receipt = screen.getByText(/^Last book update:/).textContent
      act(() => {
        if (interruption === "socket close") sockets[0].serverClose()
        else if (interruption === "offline") window.dispatchEvent(new Event("offline"))
        else vi.advanceTimersByTime(5000)
      })
      expectStatus("Reconnecting")
      expect(screen.getByRole("status")).toBe(status)
      expect(sockets[0].readyState).toBeGreaterThanOrEqual(2)
      const stale = screen.getByText(/^Stale data:/)
      for (const name of ["Market overview", "Order book"]) {
        expect(screen.getByRole("region", { name }).getAttribute("aria-describedby"))
          .toBe(stale.id)
      }
      expectOverview("100.00", "100.10", "0.10")
      expect(rows("Bids")).toEqual(previousBids)
      expect(rows("Asks")).toEqual(previousAsks)
      expect(screen.getByText(/^Last book update:/).textContent).toBe(receipt)

      act(() => {
        if (interruption === "offline") {
          vi.advanceTimersByTime(30_000)
          expect(sockets).toHaveLength(1)
          window.dispatchEvent(new Event("online"))
        } else vi.advanceTimersByTime(500)
      })
      expectStatus("Connecting")
      expect(sockets).toHaveLength(2)
      act(() => sockets[1].open())
      expectStatus("Synchronising")
      act(() => sockets[1].message(heartbeatMessage))
      expectStatus("Synchronising")
      expect(screen.getByText(/^Stale data:/)).toBeTruthy()
      expect(rows("Bids")).toEqual(previousBids)
      expect(rows("Asks")).toEqual(previousAsks)
      expect(screen.getByText(/^Last book update:/).textContent).toBe(receipt)

      act(() => sockets[1].message({
        ...snapshotMessage, bids: [["98", "4"]], asks: [["102", "5"]],
      }))
      expectStatus("Live")
      expect(screen.getByRole("status")).toBe(status)
      expect(screen.getByText(/^Live data:/)).toBeTruthy()
      expectOverview("98.00", "102.00", "4.00")
      expect(rows("Bids")).toEqual([["98.00", "4.00000000"]])
      expect(rows("Asks")).toEqual([["102.00", "5.00000000"]])
      expect(screen.getByText(/^Last book update:/).textContent).not.toBe(receipt)
    },
  )

  it("replaces a live snapshot completely and describes an empty side as unavailable", () => {
    const { sockets } = setup()
    startLive(sockets)
    act(() => {
      sockets[0].message({ ...snapshotMessage, bids: [], asks: [["105", "2"]] })
      vi.advanceTimersByTime(100)
    })
    expectStatus("Live")
    expectOverview("—Unavailable", "105.00", "—Unavailable")
    expect(rows("Bids")).toEqual([["No bids available."]])
    expect(rows("Asks")).toEqual([["105.00", "2.00000000"]])
    expect(screen.queryByText("Waiting for market data.")).toBeNull()
  })

  it("stops updates and recovery when the user stops the book or leaves the page", () => {
    const { sockets, unmount } = setup()
    startLive(sockets)
    act(() => sockets[0].message(updateMessage))
    fireEvent.click(screen.getByRole("button", { name: "Stop order book" }))
    expectStatus("Stopped")
    expect(screen.getByText(/^Stale data:/)).toBeTruthy()
    expectOverview("100.00", "100.10", "0.10")
    expect(sockets[0].close).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(30_000))
    expect(sockets).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Start order book" }))
    expectStatus("Connecting")
    expect(sockets).toHaveLength(2)
    act(() => sockets[1].error())
    expectStatus("Reconnecting")
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    act(() => {
      window.dispatchEvent(new Event("offline"))
      window.dispatchEvent(new Event("online"))
      vi.advanceTimersByTime(30_000)
    })
    expect(sockets).toHaveLength(2)
  })
})
