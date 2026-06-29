import { BACKEND_URL } from './constants'
import type { ApiLotoComplet, ApiBilan, ApiStats, ApiTest } from './types'

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET as string
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-writes`

interface CacheEntry { data: unknown; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL = 55_000

async function apiFetch<T>(action: string, opts?: RequestInit): Promise<T> {
  const now = Date.now()
  const hit = cache.get(action)
  if (hit && hit.expires > now) return hit.data as T

  const resp = await fetch(`${BACKEND_URL}?action=${action}`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      ...((opts?.headers ?? {}) as Record<string, string>),
    },
    ...opts,
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json() as T
  cache.set(action, { data, expires: now + TTL })
  return data
}

export function invalidateCache() {
  cache.clear()
}

export async function fetchLotoComplet(): Promise<ApiLotoComplet> {
  return apiFetch<ApiLotoComplet>('loto-complet')
}

export async function fetchBilan(): Promise<ApiBilan> {
  return apiFetch<ApiBilan>('bilan')
}

export async function fetchStats(): Promise<ApiStats> {
  return apiFetch<ApiStats>('stats')
}

export async function fetchTest(): Promise<ApiTest> {
  return apiFetch<ApiTest>('test')
}

export async function fetchForceScrape(): Promise<ApiLotoComplet> {
  invalidateCache()
  const resp = await fetch(`${BACKEND_URL}?action=force-scrape`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json() as Promise<ApiLotoComplet>
}

export async function fetchScrapeHistory(): Promise<{ success: boolean; fixed: number; results: Record<string, string> }> {
  invalidateCache()
  const resp = await fetch(`${BACKEND_URL}?action=scrape-history`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

export async function postTirageManuel(payload: {
  date: string
  nums: number[]
  chance: number
  nums2?: number[]
}): Promise<{ success: boolean; gain: number; gainsDetails: { grille: number; tirage: string; gain: number }[] }> {
  invalidateCache()
  const resp = await fetch(`${ADMIN_API_URL}?action=upsert_tirage_manual`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify(payload),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`)
  return data
}

