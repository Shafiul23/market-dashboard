import { describe, expect, it } from "vitest"
import { formatDecimal, formatReceiptLabel } from "./format"

describe("formatDecimal", () => {
  it.each([
    ["60000", 2, "60,000.00"],
    ["1234567.8", 2, "1,234,567.80"],
    ["9007199254740993.001", 2, "9,007,199,254,740,993.001"],
    ["0.00000000000000000001", 8, "0.00000000000000000001"],
    ["1e-9", 8, "0.000000001"],
    ["1.23000", 2, "1.23"],
    ["1.2345", 2, "1.2345"],
    ["-12345.678", 2, "-12,345.678"],
    ["-0.001", 2, "-0.001"],
    ["0", 8, "0.00000000"],
    ["1000", 0, "1,000"],
  ] as const)("formats %s with at least %i decimal places", (value, precision, expected) => {
    expect(formatDecimal(value, precision)).toBe(expected)
  })
})

describe("formatReceiptLabel", () => {
  it("uses the supplied receipt timestamp and an explicit UTC timezone", () => {
    expect(formatReceiptLabel(Date.parse("2026-09-09T15:32:08.123+01:00")))
      .toBe("Received 2026-09-09 14:32:08.123 UTC")
  })

  it("uses a placeholder before any update has been received", () => {
    expect(formatReceiptLabel(null)).toBe("—")
  })

  it("treats epoch zero as a timestamp, not a missing value", () => {
    expect(formatReceiptLabel(0)).toBe("Received 1970-01-01 00:00:00.000 UTC")
  })
})
