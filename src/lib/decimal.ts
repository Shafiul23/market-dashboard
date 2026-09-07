import Big from "big.js"

const Decimal = Big()
Decimal.strict = true

export function parseDecimal(value: string): Big {
  return new Decimal(value)
}

export function canonicalPrice(value: string): string {
  return parseDecimal(value).toFixed()
}

export function compareDecimals(left: string, right: string): -1 | 0 | 1 {
  return parseDecimal(left).cmp(parseDecimal(right))
}

export function subtractDecimals(left: string, right: string): string {
  return parseDecimal(left).minus(parseDecimal(right)).toFixed()
}
