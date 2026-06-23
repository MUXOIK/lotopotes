import { useEffect, useState, useCallback } from 'react'
import { fetchStats } from '../lib/api'
import type { ApiStats, Tirage } from '../lib/types'
import { LoadingWithHint, ErrorMsg, Card, EmptyState } from '../components/ui'

function buildStats(tirages: Tirage[]) {
  const freqNums: Record<number, number> = {}
  for (let i = 1; i <= 49; i++) freqNums[i] = 0
  const freqChance: Record<number, number> = {}
  for (let i = 1; i <= 10; i++) freqChance[i] = 0

  tirages.forEach((t) => {
    t.nums.forEach((n) => { freqNums[n] = (freqNums[n] ?? 0) + 1 })
    if (t.chance >= 1 && t.chance <= 10) freqChance[t.chance]++
  })

  const paires: Record<string, number> = {}
  const triplets: Record<string, number> = {}
  const parities: Record<string, number> = { p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 }

  tirages.forEach((t) => {
    const nums = [...t.nums].sort((a, b) => a - b)
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) {
        const k = `${nums[i]}-${nums[j]}`
        paires[k] = (paires[k] || 0) + 1
      }
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++)
        for (let k = j + 1; k < nums.length; k++) {
          const key = `${nums[i]}-${nums[j]}-${nums[k]}`
          triplets[key] = (triplets[key] || 0) + 1
        }
    const pairs = t.nums.filter((n) => n % 2 === 0).length
    parities[`p${pairs}`]++
  })

  return { freqNums, freqChance, paires, triplets, parities }
}

export function SectionProbabilites() {
  const [data, setData] = useState<ApiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchStats()
      .then((d) => setData(d))
      .catch(() => setError('Erreur lors du chargement des statistiques.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingWithHint />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  const tirages = data?.historique ?? []
  const nb = tirages.length

  if (nb === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-yellow-400">🎯 PROBABILITÉS & STATS</h2>
        <EmptyState
          icon="🎲"
          title="Pas encore assez de données"
          subtitle="Les statistiques s'enrichiront à partir du 1er juin 2026."
        />
      </div>
    )
  }

  const { freqNums, freqChance, paires, triplets, parities } = buildStats(tirages)
  const sortedNums = Object.entries(freqNums).sort((a, b) => Number(b[1]) - Number(a[1]))
  const maxFreq = sortedNums[0]?.[1] ?? 1
  const top5paires = Object.entries(paires).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const top5triplets = Object.entries(triplets).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const pariteLabels = ['0P 5I', '1P 4I', '2P 3I', '3P 2I', '4P 1I', '5P 0I']

  const moyPairs = (tirages.reduce((s, t) => s + t.nums.filter((n) => n % 2 === 0).length, 0) / nb).toFixed(1)
  const attendu = (nb * 5) / 49

  const sortedByDate = [...tirages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const retards: { n: number; absence: number }[] = []
  for (let n = 1; n <= 49; n++) {
    const idx = sortedByDate.findIndex((t) => t.nums.includes(n))
    retards.push({ n, absence: idx === -1 ? nb : idx })
  }
  retards.sort((a, b) => b.absence - a.absence)
  const top5retardataires = retards.slice(0, 5)

  let sousRepresente = 1
  let sousRepresenteFreq = nb
  for (let n = 1; n <= 49; n++) {
    if (freqNums[n] < sousRepresenteFreq) { sousRepresenteFreq = freqNums[n]; sousRepresente = n }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-yellow-400">🎯 PROBABILITÉS & STATS</h2>
        <p className="text-gray-400 text-xs mt-1">Calculées sur {nb} tirage{nb > 1 ? 's' : ''} — mise à jour automatique.</p>
      </div>

      <Card>
        <h3 className="text-base font-bold text-yellow-300 mb-3">🔢 Fréquence d'apparition (1–49)</h3>
        <p className="text-xs text-gray-400 mb-3">Nombre de fois que chaque numéro est sorti.</p>
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {sortedNums.map(([n, f]) => (
            <div key={n} className="flex items-center gap-2">
              <span className="w-6 text-right text-xs text-gray-400">{n}</span>
              <div className="flex-1 bg-gray-700 rounded h-4">
                <div
                  className="h-4 rounded bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500"
                  style={{ width: `${maxFreq > 0 ? Math.round((Number(f) / maxFreq) * 100) : 0}%` }}
                />
              </div>
              <span className="w-16 text-xs text-yellow-400">{f}x ({nb > 0 ? ((Number(f) / nb) * 100).toFixed(1) : 0}%)</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-yellow-300 mb-3">⭐ Fréquence N° Chance (1–10)</h3>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(freqChance).map(([n, f]) => (
            <div key={n} className="text-center bg-gray-700/50 rounded-lg p-2">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-1">{n}</div>
              <div className="text-xs text-yellow-400 font-bold">{f}x</div>
              <div className="text-xs text-gray-500">{nb > 0 ? ((f / nb) * 100).toFixed(0) : 0}%</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-yellow-300 mb-3">👥 Paires les plus fréquentes</h3>
        {top5paires.length > 0 ? (
          <div className="space-y-2">
            {top5paires.map(([p, f], i) => (
              <div key={p} className="flex justify-between items-center px-3 py-2 bg-gray-700/50 rounded-lg">
                <span className="text-gray-400 text-xs">#{i + 1}</span>
                <span className="text-blue-300 font-bold">{p}</span>
                <span className="text-yellow-400 text-sm">{f} fois</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Pas encore assez de tirages.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-base font-bold text-yellow-300 mb-3">🔺 Triplets les plus fréquents</h3>
        {top5triplets.length > 0 ? (
          <div className="space-y-2">
            {top5triplets.map(([t, f], i) => (
              <div key={t} className="flex justify-between items-center px-3 py-2 bg-gray-700/50 rounded-lg">
                <span className="text-gray-400 text-xs">#{i + 1}</span>
                <span className="text-green-300 font-bold">{t}</span>
                <span className="text-yellow-400 text-sm">{f} fois</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Pas encore assez de tirages.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-base font-bold text-yellow-300 mb-3">⚖️ Répartition Pair / Impair</h3>
        <div className="space-y-2">
          {Object.entries(parities).map(([k, v], i) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-gray-400 text-xs w-14">{pariteLabels[i]}</span>
              <div className="flex-1 bg-gray-700 rounded h-3">
                <div
                  className="h-3 rounded bg-purple-600"
                  style={{ width: `${nb > 0 ? (v / nb) * 100 : 0}%` }}
                />
              </div>
              <span className="text-yellow-400 text-xs w-6">{v}x</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-red-900/40 border-red-700">
          <h3 className="text-sm font-bold text-red-300 mb-2">🔥 Les 5 plus sortis</h3>
          <div className="flex flex-wrap gap-1.5">
            {sortedNums.slice(0, 5).map(([n]) => (
              <div key={n} className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center font-bold text-sm text-white">{n}</div>
            ))}
          </div>
        </Card>
        <Card className="bg-blue-900/40 border-blue-700">
          <h3 className="text-sm font-bold text-blue-300 mb-2">❄️ Les 5 moins sortis</h3>
          <div className="flex flex-wrap gap-1.5">
            {[...sortedNums].reverse().slice(0, 5).map(([n]) => (
              <div key={n} className="w-9 h-9 bg-blue-700 rounded-full flex items-center justify-center font-bold text-sm text-white">{n}</div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="bg-orange-900/40 border-orange-700">
        <h3 className="text-sm font-bold text-orange-300 mb-2">⏳ Top 5 retardataires (absents depuis le plus de tirages)</h3>
        <div className="flex flex-wrap gap-2">
          {top5retardataires.map(({ n, absence }) => (
            <div key={n} className="flex flex-col items-center">
              <div className="w-9 h-9 bg-orange-600 rounded-full flex items-center justify-center font-bold text-sm text-white">{n}</div>
              <span className="text-xs text-orange-300 mt-0.5">{absence}t</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-yellow-300 mb-3">📈 KPI du syndicat</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Tirages analysés', String(nb), '#a78bfa'],
            ['Moy. pairs/tirage', `${moyPairs}/5`, '#34d399'],
            ['Sous-représenté', `N°${sousRepresente} — ${sousRepresenteFreq}x (att. ${attendu.toFixed(1)})`, '#60a5fa'],
            ['Fréq. attendue/num', `${attendu.toFixed(1)}x / an`, '#fbbf24'],
          ].map(([label, val, color]) => (
            <div key={label} className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <div className="text-base font-bold leading-tight" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
