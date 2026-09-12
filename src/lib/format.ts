import { parseDecimal } from "./decimal"

export const PLACEHOLDER = "—"

export function formatDecimal(value: string, minimumDecimals: number): string {
  const [integer, fraction = ""] = parseDecimal(value).toFixed().split(".")
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const paddedFraction = fraction.padEnd(minimumDecimals, "0")

  return paddedFraction ? `${groupedInteger}.${paddedFraction}` : groupedInteger
}

export function formatReceiptLabel(receivedAt: number | null): string {
  if (receivedAt === null) return PLACEHOLDER

  return `Received ${new Date(receivedAt).toISOString().replace("T", " ").replace("Z", " UTC")}`
}
