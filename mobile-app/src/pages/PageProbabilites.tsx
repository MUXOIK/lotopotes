import { useEffect, useState, useCallback } from 'react'
import { fetchLotoComplet } from '../lib/api'
import { getGrilles } from '../lib/db'
import type { ApiLotoComplet, Syndicat, SyndicGrille } from '../lib/types'
import { LoadingWithHint, ErrorMsg, Card, EmptyState } from '../components/ui'
import { Boule } from '../components/Boule'

interface Props {
  syndicat: Syndicat
}

export function PageProbabilites({ syndicat }: Props) {
  const [loto, setLoto] = useState<ApiLotoComplet | null>(null)
  const [grilles, setGrilles] = useState<SyndicGrille[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [lotoData, grillesData] = await Promise.all([
        fetchLotoComplet(),
        getGrilles(syndicat.id),
      ])
      setLoto(lotoData)
      setGrilles(grillesData)
      setError(null)
    } catch {
      setError('Impossible de charger les statistiques.')
    } finally {
      setLoading(false)
    }
  }, [syndicat.id])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingWithHint />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  const historique = loto?.historique ?? []

  // Compute frequency of each number across all draws
  const freq: Record<number, number> = {}
  historique.forEach(t => {
    t.nums.forEach(n => { freq[n] = (freq[n] ?? 0) + 1 })
  })

  const allNums = grilles.flatMap(g => g.numeros)
  const uniqueNums = [...new Set(allNums)]

  const numStats = uniqueNums.map(n => ({
    num: n,
    count: freq[n] ?? 0,
    pct: historique.length > 0 ? (((freq[n] ?? 0) / historique.length) * 100).toFixed(1) : '0',
  })).sort((a, b) => b.count - a.count)

  // Hot numbers (top 10 overall in historique)
  const hotNums = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([n]) => parseInt(n))

  const coldNums = Object.entries(freq)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 10)
    .map(([n]) => parseInt(n))

  if (historique.length === 0) {
    return <EmptyState icon="🎯" title="Pas encore de données" subtitle="Les statistiques s'enrichiront avec les tirages FDJ." />
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-yellow-400">🎯 Statistiques</h2>
      <p className="text-xs text-gray-400">Basé sur {historique.length} tirages</p>

      {/* Fréquence des numéros de nos grilles */}
      <Card>
        <h3 className="text-sm font-bold text-yellow-300 mb-3">Fréquence de nos numéros</h3>
        {numStats.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune grille configurée.</p>
        ) : (
          <div className="space-y-2">
            {numStats.map(({ num, count, pct }) => (
              <div key={num} className="flex items-center gap-3">
                <Boule num={num} variant="primary" size="sm" />
                <div className="flex-1">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-16 text-right">{count}× ({pct}%)</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Numéros chauds */}
      <Card>
        <h3 className="text-sm font-bold text-red-300 mb-3">🔥 Numéros les plus sortis</h3>
        <div className="flex flex-wrap gap-1.5">
          {hotNums.map(n => <Boule key={n} num={n} variant="hot" size="sm" />)}
        </div>
      </Card>

      {/* Numéros froids */}
      <Card>
        <h3 className="text-sm font-bold text-blue-300 mb-3">❄️ Numéros les moins sortis</h3>
        <div className="flex flex-wrap gap-1.5">
          {coldNums.map(n => <Boule key={n} num={n} variant="cold" size="sm" />)}
        </div>
      </Card>

      {/* Rappel des grilles */}
      <Card>
        <h3 className="text-sm font-bold text-yellow-300 mb-3">Nos grilles</h3>
        <div className="space-y-2">
          {grilles.map((g, i) => (
            <div key={g.id} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 w-14">Grille {i + 1}</span>
              {g.numeros.map(n => (
                <Boule
                  key={n} num={n}
                  variant={hotNums.includes(n) ? 'hot' : coldNums.includes(n) ? 'cold' : 'primary'}
                  size="sm"
                />
              ))}
              <Boule num={g.numero_chance} variant="chance" size="sm" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
