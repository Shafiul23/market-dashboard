import { describe, expect, it } from 'vitest'
import {
  canonicalPrice,
  compareDecimals,
  parseDecimal,
  subtractDecimals,
} from './decimal'

describe('parseDecimal', () => {
  it('preserves a very small quantity exactly', () => {
    const quantity = '0.00000000000000000001'

    expect(parseDecimal(quantity).toFixed()).toBe(quantity)
  })

  it.each(['', 'not-a-number', 'NaN', 'Infinity'])(
    'rejects invalid input %j',
    (value) => {
      expect(() => parseDecimal(value)).toThrow()
    },
  )

  it('rejects numeric inputs at runtime as well as in TypeScript', () => {
    expect(() => {
      // @ts-expect-error Deliberately check the runtime string-only boundary.
      parseDecimal(0.1)
    }).toThrow()
  })
})

describe('canonicalPrice', () => {
  it('gives equivalent decimal spellings the same key', () => {
    expect(canonicalPrice('60000.0')).toBe('60000')
    expect(canonicalPrice('60000.00')).toBe('60000')
  })

  it('keeps close but distinct prices separate', () => {
    expect(canonicalPrice('60000.001')).toBe('60000.001')
    expect(canonicalPrice('60000.002')).toBe('60000.002')
  })

  it('preserves a price beyond JavaScript safe integer precision', () => {
    expect(canonicalPrice('9007199254740993.0100')).toBe('9007199254740993.01')
  })

  it('uses ordinary decimal notation even for tiny values', () => {
    expect(canonicalPrice('0.00000001')).toBe('0.00000001')
  })
})

describe('compareDecimals', () => {
  it.each([
    ['9', '10', -1],
    ['10', '9', 1],
    ['60000.0', '60000.00', 0],
    ['60000.001', '60000.002', -1],
    ['9007199254740993', '9007199254740992', 1],
  ] as const)('compares %s with %s as %i', (left, right, expected) => {
    expect(compareDecimals(left, right)).toBe(expected)
  })
})

describe('subtractDecimals', () => {
  it.each([
    ['60000.01', '60000.00', '0.01'],
    ['0.00000002', '0.00000001', '0.00000001'],
    ['9007199254740993.01', '9007199254740993.00', '0.01'],
    ['60000.00', '60000.0', '0'],
    ['60000.00', '60000.01', '-0.01'],
  ])('subtracts %s minus %s exactly', (left, right, expected) => {
    expect(subtractDecimals(left, right)).toBe(expected)
  })
})
