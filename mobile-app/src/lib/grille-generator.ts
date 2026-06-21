import { LOTO_MAX_NUM, LOTO_MAX_CHANCE, LOTO_NUMS_PER_GRILLE } from './constants'

/**
 * Generates a smart random loto grid:
 * - No duplicate numbers
 * - No 3+ consecutive numbers
 * - Balanced odd/even (2-3 or 3-2)
 * - Spread across low/mid/high ranges
 * - Avoids repeating a combination already in existingGrids
 */
export function generateGrille(
  existingGrids: Array<{ numeros: number[]; numero_chance: number }>
): { numeros: number[]; numero_chance: number } {
  const existingKeys = new Set(existingGrids.map(g => [...g.numeros].sort((a, b) => a - b).join('-')))
  let attempts = 0

  while (attempts < 1000) {
    attempts++
    const nums = pickNums()
    if (!nums) continue

    const key = [...nums].sort((a, b) => a - b).join('-')
    if (existingKeys.has(key)) continue

    const chance = Math.floor(Math.random() * LOTO_MAX_CHANCE) + 1
    return { numeros: nums.sort((a, b) => a - b), numero_chance: chance }
  }

  // Fallback: pure random if constraints can't be met
  const nums = new Set<number>()
  while (nums.size < LOTO_NUMS_PER_GRILLE) {
    nums.add(Math.floor(Math.random() * LOTO_MAX_NUM) + 1)
  }
  return {
    numeros: [...nums].sort((a, b) => a - b),
    numero_chance: Math.floor(Math.random() * LOTO_MAX_CHANCE) + 1,
  }
}

function pickNums(): number[] | null {
  const pool = Array.from({ length: LOTO_MAX_NUM }, (_, i) => i + 1)
  shuffle(pool)

  // Pick numbers with spread: one from each of 5 ranges (1-9, 10-19, 20-29, 30-39, 40-49)
  // but with some randomness — not always strictly one per zone
  const nums: number[] = []
  const candidates = pool.slice(0, 30) // take first 30 shuffled
  candidates.sort((a, b) => a - b)

  // Try to pick ensuring no 3 consecutive and balanced odd/even
  let maxTries = 200
  while (maxTries-- > 0) {
    const selected = randomSample(pool, LOTO_NUMS_PER_GRILLE)
    selected.sort((a, b) => a - b)

    if (hasThreeConsecutive(selected)) continue
    if (!isBalancedOddEven(selected)) continue
    if (!hasGoodSpread(selected)) continue

    return selected
  }

  return null
}

function hasThreeConsecutive(nums: number[]): boolean {
  const sorted = [...nums].sort((a, b) => a - b)
  for (let i = 0; i < sorted.length - 2; i++) {
    if (sorted[i + 1] === sorted[i] + 1 && sorted[i + 2] === sorted[i] + 2) {
      return true
    }
  }
  return false
}

function isBalancedOddEven(nums: number[]): boolean {
  const odds = nums.filter(n => n % 2 !== 0).length
  // Accept 2-3 or 3-2 split
  return odds >= 2 && odds <= 3
}

function hasGoodSpread(nums: number[]): boolean {
  const sorted = [...nums].sort((a, b) => a - b)
  // Ensure numbers don't all cluster in the same range
  const range = sorted[sorted.length - 1] - sorted[0]
  return range >= 20
}

function randomSample(arr: number[], n: number): number[] {
  const copy = [...arr]
  shuffle(copy)
  return copy.slice(0, n)
}

function shuffle(arr: number[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
