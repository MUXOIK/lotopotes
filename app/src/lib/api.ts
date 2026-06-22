import { BACKEND_URL } from './constants'
import type { ApiLotoComplet, ApiBilan, ApiStats, ApiTest } from './types'

function cleanJsonKeys(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(cleanJsonKeys)
  const cleaned: Record<string, unknown> = {}
  for (const key in obj as Record<string, unknown>) {
    cleaned[key.trim()] = cleanJsonKeys((obj as Record<string, unknown>)[key])
  }
  return cleaned
}

interface CacheEntry { data: unknown; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL = 55_000

async function apiFetch<T>(path: string): Promise<T> {
  const now = Date.now()
  const hit = cache.get(path)
  if (hit && hit.expires > now) return hit.data as T

  const resp = await fetch(`${BACKEND_URL}${path}`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const raw = await resp.json()
  const data = cleanJsonKeys(raw) as T
  cache.set(path, { data, expires: now + TTL })
  return data
}

export function invalidateCache() {
  cache.clear()
}

export async function fetchLotoComplet(): Promise<ApiLotoComplet> {
  return apiFetch<ApiLotoComplet>('/api/loto-complet')
}

export async function fetchBilan(): Promise<ApiBilan> {
  return apiFetch<ApiBilan>('/api/bilan')
}

export async function fetchStats(): Promise<ApiStats> {
  return apiFetch<ApiStats>('/api/stats')
}

export async function fetchTest(): Promise<ApiTest> {
  return apiFetch<ApiTest>('/api/test')
}

export async function fetchForceScrape(): Promise<ApiLotoComplet> {
  invalidateCache()
  return apiFetch<ApiLotoComplet>('/api/force-scrape')
}
