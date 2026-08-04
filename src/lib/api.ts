import { BACKEND_URL } from './constants'
import { supabase } from './supabase'
import type { ApiLotoComplet, ApiBilan, ApiStats, ApiTest } from './types'

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET as string

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
  const resp = await fetch(`${BACKEND_URL}?action=force-scrape`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json() as ApiLotoComplet
  // Populate the loto-complet cache with fresh data so subsequent calls don't re-fetch stale cache
  cache.set('loto-complet', { data, expires: Date.now() + TTL })
  return data
}

export async function checkTirageInDB(dateISO: string): Promise<boolean> {
  const { count } = await supabase
    .from('loto_all_tirages')
    .select('*', { count: 'exact', head: true })
    .eq('date_tirage', dateISO)
  return (count ?? 0) > 0
}

export interface ManualTirageInput {
  date: string
  nums: number[]
  chance: number
  nums2: number[]
  montant: number
}

export async function insertManualTirage(input: ManualTirageInput): Promise<ApiLotoComplet> {
  const resp = await fetch(`${BACKEND_URL}?action=manual-tirage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify(input),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`)
  invalidateCache()
  return data as ApiLotoComplet
}
