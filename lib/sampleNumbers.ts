import { Brand, Category, BRAND_PREFIXES } from './types'

const counters: Record<string, number> = {}

export function getNextSampleNumber(brand: Brand, category: Category): string {
  const prefix = BRAND_PREFIXES[brand]
  const catCode = category.charAt(0).toUpperCase()
  const key = `${prefix}${catCode}`

  if (!counters[key]) {
    counters[key] = 200
  }
  const num = counters[key]
  counters[key]++
  return `${key}${num}`
}
