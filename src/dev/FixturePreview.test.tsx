// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { expect, it } from "vitest"
import FixturePreview from "./FixturePreview"

it("switches static fixture rows between exact prices and grouped boundaries without changing headlines", () => {
  render(<FixturePreview />)
  const overview = within(
    screen.getByRole("region", { name: "Market overview" }),
  )
  const headlineValues = () =>
    overview.getAllByRole("definition").map((cell) => cell.textContent)
  const firstRow = (name: string) =>
    within(screen.getByRole("table", { name })).getAllByRole("row")[1]
  const exactBid = firstRow("Bids").textContent
  const exactAsk = firstRow("Asks").textContent

  expect(headlineValues()).toEqual(["65,000.25", "65,001.50", "1.25"])
  fireEvent.change(screen.getByLabelText("Grouping"), {
    target: { value: "10" },
  })

  expect(
    within(firstRow("Bids")).getByRole("cell", { name: "65,000.00" }),
  ).toBeTruthy()
  expect(
    within(firstRow("Asks")).getByRole("cell", { name: "65,010.00" }),
  ).toBeTruthy()
  expect(
    screen.getAllByRole("columnheader", { name: "Bucket price in GBP" }),
  ).toHaveLength(2)
  expect(headlineValues()).toEqual(["65,000.25", "65,001.50", "1.25"])

  fireEvent.change(screen.getByLabelText("Grouping"), { target: { value: "" } })

  expect(firstRow("Bids").textContent).toBe(exactBid)
  expect(firstRow("Asks").textContent).toBe(exactAsk)
  expect(headlineValues()).toEqual(["65,000.25", "65,001.50", "1.25"])
})

it("regroups stale data without changing its receipt or freshness", () => {
  render(<FixturePreview />)
  fireEvent.change(screen.getByLabelText("Fixture preview · Sample data"), {
    target: { value: "Stale" },
  })
  const receipt = screen.getByText(/^Last book update:/).textContent
  fireEvent.change(screen.getByLabelText("Grouping"), { target: { value: "100" } })

  const bidRows = within(screen.getByRole("table", { name: "Bids" })).getAllByRole("row")
  const askRows = within(screen.getByRole("table", { name: "Asks" })).getAllByRole("row")
  expect(bidRows).toHaveLength(3)
  expect(askRows).toHaveLength(2)
  expect(within(bidRows[1]).getByRole("cell", { name: "65,000.00" })).toBeTruthy()
  expect(within(bidRows[1]).getByRole("cell", { name: "2.00000000" })).toBeTruthy()
  expect(within(bidRows[2]).getByRole("cell", { name: "64,900.00" })).toBeTruthy()
  expect(within(bidRows[2]).getByRole("cell", { name: "1.25000000" })).toBeTruthy()
  expect(within(askRows[1]).getByRole("cell", { name: "65,100.00" })).toBeTruthy()
  expect(within(askRows[1]).getByRole("cell", { name: "3.50000000" })).toBeTruthy()
  expect(screen.getByText(/^Last book update:/).textContent).toBe(receipt)
  expect(screen.getByText(/^Stale data:/)).toBeTruthy()
})

it("applies a selection made while waiting when a book becomes available", () => {
  render(<FixturePreview />)
  const scenario = screen.getByLabelText("Fixture preview · Sample data")
  fireEvent.change(scenario, { target: { value: "Waiting" } })
  fireEvent.change(screen.getByLabelText("Grouping"), { target: { value: "1000" } })
  expect(screen.getAllByText("Waiting for data.")).toHaveLength(2)

  fireEvent.change(scenario, { target: { value: "Populated" } })
  expect(screen.getByText(/£1000 grouping/)).toBeTruthy()
  const askRows = within(screen.getByRole("table", { name: "Asks" })).getAllByRole("row")
  expect(askRows).toHaveLength(2)
  expect(within(askRows[1]).getByRole("cell", { name: "66,000.00" })).toBeTruthy()
  expect(within(askRows[1]).getByRole("cell", { name: "14.81481468" })).toBeTruthy()
})
