import { useEffect, useState, useCallback } from 'react'
import { fetchLotoComplet } from '../lib/api'
import { getGrilles } from '../lib/db'
import type { ApiLotoComplet, Syndicat, SyndicGrille, RapportGains } from '../lib/types'
import { Boule } from '../components/Boule'
import { LoadingWithHint, ErrorMsg, Card, EmptyState } from '../components/ui'

function checkGrilleMatch(
  grille: SyndicGrille,
  tiragePrimary: number[],
  chance: number,
  tirageSecond: number[]
): { gain: number; tirage: '1er' | '2nd' } | null {
  const nums = grille.numeros
  const matchPrimary = nums.filter(n => tiragePrimary.includes(n)).length
  const matchChance = grille.numero_chance === chance ? 1 : 0
  const matchSecond = tirageSecond.length > 0 ? nums.filter(n => tirageSecond.includes(n)).length : 0

  const rapport: RapportGains = { '5+1': 0, '5': 0, '4+1': 0, '4': 0, '3+1': 0, '3': 0, '2+1': 0, '2': 0, '1+1': 0 }
  const key = `${matchPrimary}${matchChance ? '+1' : ''}` as keyof RapportGains
  if (rapport[key] !== undefined) return null

  return null
}

// Suppress unused warning — this will be used when we have rapport data
void checkGrilleMatch

interface Props {
  syndicat: Syndicat
}

export function PageDashboard({ syndicat }: Props) {
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
      setError('Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }, [syndicat.id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const dateDebut = new Date(syndicat.date_debut)
  const dateFin = new Date(dateDebut)
  dateFin.setMonth(dateFin.getMonth() + syndicat.nb_mois)

  const tiragesEstimes = Math.round(syndicat.nb_mois * 4.33 * 3)
  const coutTotalEstime = tiragesEstimes * (syndicat.prix_tirage_1 + syndicat.prix_tirage_2) * syndicat.nb_grilles

  if (loading) return <LoadingWithHint />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      {/* Dernier tirage */}
      <Card>
        <h2 className="text-lg font-bold text-yellow-400 mb-3">🎰 Dernier tirage FDJ</h2>
        {loto?.tirage ? (
          <div className="space-y-3">
            <div className="bg-gray-700/60 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-300 mb-2">1er Tirage</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {loto.tirage.nums.map((n) => (
                  <Boule
                    key={n} num={n} variant="primary" size="md"
                    highlight={grilles.some(g => g.numeros.includes(n))}
                  />
                ))}
                <div className="border-l border-gray-500 pl-2 ml-1 flex items-center gap-1">
                  <span className="text-xs text-gray-400">C:</span>
                  <Boule
                    num={loto.tirage.chance} variant="chance" size="md"
                    highlight={grilles.some(g => g.numero_chance === loto.tirage!.chance)}
                  />
                </div>
              </div>
            </div>
            {loto.tirage.nums2?.length > 0 && (
              <div className="bg-gray-700/60 rounded-lg p-3">
                <p className="text-xs font-bold text-emerald-300 mb-2">2nd Tirage</p>
                <div className="flex flex-wrap gap-1.5">
                  {loto.tirage.nums2.map((n) => (
                    <Boule
                      key={n} num={n} variant="secondary" size="md"
                      highlight={grilles.some(g => g.numeros.includes(n))}
                    />
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">
              {new Date(loto.tirage.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-xs text-blue-300/70 text-center">
              Les numéros en surbrillance apparaissent dans vos grilles
            </p>
          </div>
        ) : (
          <EmptyState icon="🎰" title="Aucun tirage disponible" subtitle="Le prochain tirage s'affichera automatiquement." />
        )}
      </Card>

      {/* Nos grilles */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-blue-900 rounded-xl p-4 border-2 border-yellow-400">
        <h3 className="text-base font-bold text-yellow-400 mb-3">
          🎰 Nos {grilles.length} grille{grilles.length > 1 ? 's' : ''}
        </h3>
        {grilles.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Aucune grille configurée</p>
        ) : (
          <div className="space-y-2">
            {grilles.map((g, idx) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className="text-yellow-300 text-xs font-bold w-14 flex-shrink-0">Grille {idx + 1}</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {g.numeros.map(n => (
                    <div key={n} className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center border border-yellow-300">
                      <span className="text-white font-bold text-xs">{n}</span>
                    </div>
                  ))}
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded flex items-center justify-center border-2 border-yellow-300">
                    <span className="text-white font-bold text-xs">{g.numero_chance}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Infos syndicat */}
      <Card>
        <h3 className="text-sm font-bold text-yellow-300 mb-3">Syndicat · {syndicat.code}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-700/40 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Trésorier</p>
            <p className="font-semibold">{syndicat.tresorier_nom}</p>
          </div>
          <div className="bg-gray-700/40 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Durée</p>
            <p className="font-semibold">{syndicat.nb_mois} mois</p>
          </div>
          <div className="bg-gray-700/40 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Fin estimée</p>
            <p className="font-semibold">{dateFin.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="bg-gray-700/40 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Budget total estimé</p>
            <p className="font-semibold text-yellow-300">{coutTotalEstime.toFixed(0)}€</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
