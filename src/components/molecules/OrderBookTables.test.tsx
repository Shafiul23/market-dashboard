// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { createBookView } from "../../book/bookView"
import { applyChanges, createOrderBook } from "../../book/orderBook"
import { OrderBook } from "../organisms/OrderBook"
import { OrderBookAsks } from "./OrderBookAsks"
import { OrderBookBids } from "./OrderBookBids"

describe("Order book quantity bars", () => {
  it("labels grouped boundaries and bucket quantities, restoring raw labels when grouping is off", () => {
    const book = createOrderBook({
      bids: [["100.25", "1"]],
      asks: [["101.25", "2"]],
    })
    const { rerender } = render(
      <OrderBook view={createBookView(book, null, "5")} isWaiting={false} />,
    )

    expect(
      screen.getByText(/Up to 10 buckets per side · £5 grouping/),
    ).toBeTruthy()
    expect(
      screen.getByText(/Boundaries are not executable quotes/),
    ).toBeTruthy()
    expect(
      screen.getAllByRole("columnheader", { name: "Bucket price in GBP" }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole("columnheader", { name: "Bucket quantity in BTC" }),
    ).toHaveLength(2)

    rerender(<OrderBook view={createBookView(book, null)} isWaiting={false} />)

    expect(
      screen.queryByText(/Boundaries are not executable quotes/),
    ).toBeNull()
    expect(
      screen.getAllByRole("columnheader", { name: "Price in GBP" }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole("columnheader", { name: "Quantity in BTC" }),
    ).toHaveLength(2)
  })

  it.each(["bids", "asks"] as const)(
    "keeps %s values accessible and row identity stable when bars resize",
    (side) => {
      const Component = side === "bids" ? OrderBookBids : OrderBookAsks
      const book = createOrderBook({
        bids: [["100", "1"]],
        asks: [["101", "1"]],
      })
      const view = createBookView(book, null)
      const { rerender } = render(
        <Component rows={view[side]} isWaiting={false} />,
      )
      const table = screen.getByRole("table", {
        name: side === "bids" ? "Bids" : "Asks",
      })
      expect(
        within(table).getByRole("columnheader", { name: "Price in GBP" }),
      ).toBeTruthy()
      expect(
        within(table).getByRole("columnheader", { name: "Quantity in BTC" }),
      ).toBeTruthy()
      const row = within(table).getAllByRole("row")[1]
      const cell = within(row).getByRole("cell", { name: "1.00000000" })
      const bar = cell.querySelector('[aria-hidden="true"]') as HTMLElement

      expect(bar.style.width).toBe("100%")
      expect(bar.textContent).toBe("")
      expect(
        table.querySelector('[aria-live], [role="progressbar"]'),
      ).toBeNull()

      applyChanges(book, [[side === "bids" ? "sell" : "buy", "102", "2"]])
      rerender(
        <Component rows={createBookView(book, null)[side]} isWaiting={false} />,
      )

      expect(within(table).getAllByRole("row")[1]).toBe(row)
      expect(within(row).getByRole("cell", { name: "1.00000000" })).toBe(cell)
      expect(bar.style.width).toBe("50%")
      expect(
        within(row)
          .getAllByRole("cell")
          .map((value) => value.textContent),
      ).toEqual(
        side === "bids"
          ? [view[side][0].priceLabel, view[side][0].quantityLabel]
          : [view[side][0].quantityLabel, view[side][0].priceLabel],
      )
    },
  )

  it.each([true, false])(
    "keeps empty-state rows free of bars (waiting: %s)",
    (isWaiting) => {
      const { container } = render(
        <OrderBookBids rows={[]} isWaiting={isWaiting} />,
      )

      expect(
        screen.getByRole("cell", {
          name: isWaiting ? "Waiting for data." : "No bids available.",
        }),
      ).toBeTruthy()
      expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
    },
  )
})
