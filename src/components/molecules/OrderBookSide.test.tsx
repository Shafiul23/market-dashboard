// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { createBookView } from "../../book/bookView"
import { applyChanges, createOrderBook } from "../../book/orderBook"
import { OrderBookSide } from "./OrderBookSide"

describe("OrderBookSide quantity bars", () => {
  it.each(["bids", "asks"] as const)(
    "keeps %s values accessible and row identity stable when bars resize",
    (side) => {
      const book = createOrderBook({
        bids: [["100", "1"]],
        asks: [["101", "1"]],
      })
      const view = createBookView(book, null)
      const { rerender } = render(
        <OrderBookSide side={side} rows={view[side]} isWaiting={false} />,
      )
      const table = screen.getByRole("table", {
        name: side === "bids" ? "Bids" : "Asks",
      })
      const row = within(table).getAllByRole("row")[1]
      const cell = within(row).getByRole("cell", { name: "1.00000000" })
      const bar = cell.querySelector('[aria-hidden="true"]') as HTMLElement

      expect(bar.style.width).toBe("100%")
      expect(bar.textContent).toBe("")
      expect(table.querySelector('[aria-live], [role="progressbar"]')).toBeNull()

      applyChanges(book, [[side === "bids" ? "sell" : "buy", "102", "2"]])
      rerender(
        <OrderBookSide
          side={side}
          rows={createBookView(book, null)[side]}
          isWaiting={false}
        />,
      )

      expect(within(table).getAllByRole("row")[1]).toBe(row)
      expect(within(row).getByRole("cell", { name: "1.00000000" })).toBe(cell)
      expect(bar.style.width).toBe("50%")
      expect(
        within(row).getAllByRole("cell").map((value) => value.textContent),
      ).toEqual(side === "bids"
        ? [view[side][0].priceLabel, view[side][0].quantityLabel]
        : [view[side][0].quantityLabel, view[side][0].priceLabel])
    },
  )

  it.each([true, false])(
    "keeps empty-state rows free of bars (waiting: %s)",
    (isWaiting) => {
      const { container } = render(
        <OrderBookSide side="bids" rows={[]} isWaiting={isWaiting} />,
      )

      expect(screen.getByRole("cell", {
        name: isWaiting ? "Waiting for data." : "No bids available.",
      })).toBeTruthy()
      expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
    },
  )
})
