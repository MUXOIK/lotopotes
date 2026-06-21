import { useEffect, useState, useCallback } from 'react'
import { fetchLotoComplet } from '../lib/api'
import { GRILLES, CHANCES, COTISATION_TOTALE } from '../lib/constants'
import type { ApiLotoComplet } from '../lib/types'
import { Boule } from '../components/Boule'
import { LoadingWithHint, ErrorMsg, Card, EmptyState } from '../components/ui'
import { Confetti } from '../components/Confetti'

export function SectionAccueil() {
  const [data, setData] = useState<ApiLotoComplet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await fetchLotoComplet()
      setData(result)
      setError(null)
    } catch (e) {
      setError('Impossible de contacter le serveur. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  const gainsTotal = data
    ? (Object.values(data.distribution).reduce((s, d) => s + d.gains, 0) + (data.cagnotte ?? 0))
    : 0
  const roi = ((gainsTotal / COTISATION_TOTALE) * 100).toFixed(1)
  const gainDuTirage = data?.tirage?.gainTotal ?? 0
  const grillesGagnantes = data?.tirage?.gainsDetails ?? []
  const showGain = gainDuTirage > 0 && data?.tirage?.date
    ? new Date(data.tirage.date) >= new Date('2026-06-01')
    : false

  return (
    <div className="space-y-4">
      {showGain && <Confetti />}

      {/* Bannière victoire */}
      {showGain && (
        <div className="bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl p-4 border-2 border-yellow-300 text-center animate-pulse-once">
          <div className="text-3xl mb-1">🎉🏆🎉</div>
          <div className="text-xl font-bold text-gray-900">ON A GAGNÉ !</div>
          <div className="text-sm text-gray-900 mt-1">
            {grillesGagnantes.map((g, i) => (
              <span key={i}>{i > 0 && ' | '}Grille {g.grille} ({g.tirage}) → <strong>{g.gain.toFixed(2)}€</strong></span>
            ))}
          </div>
          <div className="text-lg font-bold text-gray-900 mt-2">Total : {gainDuTirage.toFixed(2)}€ 🎰</div>
        </div>
      )}

      {/* Derniers tirages */}
      <Card>
        <h2 className="text-xl font-bold text-yellow-400 mb-3">🎰 DERNIERS TIRAGES FDJ</h2>
        {loading ? (
          <LoadingWithHint />
        ) : error ? (
          <ErrorMsg message={error} onRetry={load} />
        ) : data?.tirage ? (
          <div className="space-y-3">
            <div className="bg-gray-700/60 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-300 mb-2">1er Tirage</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.tirage.nums.map((n) => (
                  <Boule key={n} num={n} variant="primary" size="md" />
                ))}
                <div className="border-l border-gray-500 pl-2 ml-1 flex items-center gap-1">
                  <span className="text-xs text-gray-400">Chance:</span>
                  <Boule num={data.tirage.chance} variant="chance" size="md" />
                </div>
              </div>
            </div>

            {data.tirage.nums2?.length > 0 && (
              <div className="bg-gray-700/60 rounded-lg p-3">
                <p className="text-xs font-bold text-emerald-300 mb-2">2nd Tirage</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.tirage.nums2.map((n) => (
                    <Boule key={n} num={n} variant="secondary" size="md" />
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              Tirage du {new Date(data.tirage.date).toLocaleDateString('fr-FR')} à {new Date(data.tirage.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ) : (
          <EmptyState icon="🎰" title="Aucun tirage disponible" subtitle="Le prochain tirage s'affichera automatiquement." />
        )}
      </Card>

      {/* Synthèse financière */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 rounded-xl p-4 border-2 border-yellow-500">
          <h3 className="text-sm font-bold text-yellow-200 mb-1">💰 Gains</h3>
          <p className="text-2xl font-bold text-yellow-300">{gainsTotal.toFixed(2)}€</p>
          <p className="text-xs text-gray-400 mt-1">Depuis le 1er juin 2026</p>
        </div>
        <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-xl p-4 border-2 border-red-500">
          <h3 className="text-sm font-bold text-red-200 mb-1">💳 Solde Net</h3>
          <p className="text-2xl font-bold text-red-300">{(gainsTotal - COTISATION_TOTALE).toFixed(2)}€</p>
          <p className="text-xs text-gray-400 mt-1">ROI: <span className="text-yellow-300">{roi}%</span></p>
        </div>
      </div>

      {/* Les 5 grilles */}
      <div className="bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900 rounded-xl p-4 border-2 border-yellow-400">
        <h3 className="text-lg font-bold text-yellow-400 mb-1">🎰 NOS 5 GRILLES</h3>
        <p className="text-xs text-yellow-200/70 mb-3">5 numéros principaux + <span className="bg-yellow-600 px-1 rounded">N° Chance</span></p>
        <div className="space-y-2">
          {GRILLES.map((grille, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-yellow-300 text-xs font-bold w-14 flex-shrink-0">Grille {idx + 1}</span>
              <div className="flex items-center gap-1 flex-wrap">
                {grille.map((n) => (
                  <div key={n} className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center border border-yellow-300">
                    <span className="text-white font-bold text-xs">{n}</span>
                  </div>
                ))}
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded flex items-center justify-center border-2 border-yellow-300">
                  <span className="text-white font-bold text-xs">{CHANCES[idx]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
