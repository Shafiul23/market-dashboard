// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { expect, it } from "vitest"
import FixturePreview from "./FixturePreview"

it("switches static fixture rows between exact prices and grouped boundaries without changing headlines", () => {
  render(<FixturePreview />)
  const overview = within(screen.getByRole("region", { name: "Market overview" }))
  const headlineValues = () => overview.getAllByRole("definition").map((cell) => cell.textContent)
  const firstRow = (name: string) => within(screen.getByRole("table", { name })).getAllByRole("row")[1]
  const exactBid = firstRow("Bids").textContent
  const exactAsk = firstRow("Asks").textContent

  expect(headlineValues()).toEqual(["65,000.25", "65,001.50", "1.25"])
  fireEvent.change(screen.getByLabelText("Grouping"), { target: { value: "5" } })

  expect(within(firstRow("Bids")).getByRole("cell", { name: "65,000.00" })).toBeTruthy()
  expect(within(firstRow("Asks")).getByRole("cell", { name: "65,005.00" })).toBeTruthy()
  expect(screen.getAllByRole("columnheader", { name: "Grouped price boundary in GBP" })).toHaveLength(2)
  expect(headlineValues()).toEqual(["65,000.25", "65,001.50", "1.25"])

  fireEvent.change(screen.getByLabelText("Grouping"), { target: { value: "" } })

  expect(firstRow("Bids").textContent).toBe(exactBid)
  expect(firstRow("Asks").textContent).toBe(exactAsk)
  expect(headlineValues()).toEqual(["65,000.25", "65,001.50", "1.25"])
})
