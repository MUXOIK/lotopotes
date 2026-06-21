import { useEffect, useState, useCallback } from 'react'
import { fetchLotoComplet } from '../lib/api'
import { getGrilles } from '../lib/db'
import type { ApiLotoComplet, Syndicat, SyndicGrille, Tirage } from '../lib/types'
import { LoadingWithHint, ErrorMsg, Card, EmptyState } from '../components/ui'
import { Boule } from '../components/Boule'

function getMatchLabel(matchP: number, matchC: boolean): string {
  const key = `${matchP}${matchC ? '+1' : ''}`
  const labels: Record<string, string> = {
    '5+1': '🏆 JACKPOT!', '5': '🥇 5/5', '4+1': '🥈 4+C',
    '4': '4/5', '3+1': '3+C', '3': '3/5', '2+1': '2+C',
    '2': '2/5', '1+1': '1+C',
  }
  return labels[key] ?? ''
}

interface Props {
  syndicat: Syndicat
}

export function PageHistorique({ syndicat }: Props) {
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
      setError('Impossible de charger l\'historique.')
    } finally {
      setLoading(false)
    }
  }, [syndicat.id])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingWithHint />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  const historique = loto?.historique ?? []

  const getTirageGains = (tirage: Tirage): number => {
    let total = 0
    grilles.forEach(g => {
      const matchP = g.numeros.filter(n => tirage.nums.includes(n)).length
      const matchC = g.numero_chance === tirage.chance
      const rg = tirage.rapportGains
      if (matchP === 5 && matchC) total += rg['5+1']
      else if (matchP === 5) total += rg['5']
      else if (matchP === 4 && matchC) total += rg['4+1']
      else if (matchP === 4) total += rg['4']
      else if (matchP === 3 && matchC) total += rg['3+1']
      else if (matchP === 3) total += rg['3']
      else if (matchP === 2 && matchC) total += rg['2+1']
      else if (matchP === 2) total += rg['2']
      else if (matchP === 1 && matchC) total += rg['1+1']
    })
    return total
  }

  const getBestMatch = (tirage: Tirage) => {
    let best = { matchP: 0, matchC: false }
    grilles.forEach(g => {
      const matchP = g.numeros.filter(n => tirage.nums.includes(n)).length
      const matchC = g.numero_chance === tirage.chance
      if (matchP > best.matchP || (matchP === best.matchP && matchC && !best.matchC)) {
        best = { matchP, matchC }
      }
    })
    return best
  }

  if (historique.length === 0) {
    return <EmptyState icon="🏆" title="Aucun historique disponible" subtitle="L'historique des tirages FDJ apparaîtra ici." />
  }

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold text-yellow-400">🏆 Historique des tirages</h2>
      <p className="text-xs text-gray-400">{historique.length} tirage{historique.length > 1 ? 's' : ''} disponibles</p>

      {historique.map((tirage, idx) => {
        const gains = getTirageGains(tirage)
        const { matchP, matchC } = getBestMatch(tirage)
        const label = getMatchLabel(matchP, matchC)
        const isWin = gains > 0

        return (
          <Card key={idx} className={isWin ? 'bg-green-900/30 border-green-700/60' : ''}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-gray-400">
                {new Date(tirage.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <div className="flex items-center gap-2">
                {label && <span className="text-xs font-bold text-yellow-300">{label}</span>}
                {isWin && <span className="text-sm font-bold text-green-400">+{gains.toFixed(2)}€</span>}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {tirage.nums.map(n => (
                  <Boule
                    key={n} num={n} variant="primary" size="sm"
                    highlight={grilles.some(g => g.numeros.includes(n))}
                  />
                ))}
                <Boule
                  num={tirage.chance} variant="chance" size="sm"
                  highlight={grilles.some(g => g.numero_chance === tirage.chance)}
                />
              </div>
              {tirage.nums2?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tirage.nums2.map(n => (
                    <Boule
                      key={n} num={n} variant="secondary" size="sm"
                      highlight={grilles.some(g => g.numeros.includes(n))}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
