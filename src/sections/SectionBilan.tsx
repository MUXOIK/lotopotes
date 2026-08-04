import { useEffect, useState, useCallback } from 'react'
import { fetchBilan } from '../lib/api'
import { COTISATION_TOTALE, NB_PARTICIPANTS } from '../lib/constants'
import type { ApiBilan } from '../lib/types'
import { LoadingWithHint, ErrorMsg, Card } from '../components/ui'

interface KpiProps {
  label: string
  value: string
  color: string
  bg: string
  border: string
}

function KpiCard({ label, value, color, bg, border }: KpiProps) {
  return (
    <div className={`${bg} rounded-xl p-4 border ${border}`}>
      <p className="text-xs text-gray-300 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

export function SectionBilan() {
  const [data, setData] = useState<ApiBilan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchBilan()
      .then((d) => setData(d))
      .catch(() => setError('Erreur lors du chargement du bilan.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingWithHint />
  if (error) return <ErrorMsg message={error} onRetry={load} />
  if (!data?.success) return <ErrorMsg message="Données indisponibles." onRetry={load} />

  const gains = data.gainsTotal ?? 0
  const cagnotte = data.cagnotte ?? 0
  const tirages = data.tiragesEffectues ?? 0
  const distribue = Math.max(0, gains - cagnotte)
  const roi = gains > 0 ? ((gains / COTISATION_TOTALE) * 100).toFixed(1) : '0.0'
  const gainMoyen = tirages > 0 ? (gains / tirages).toFixed(2) : '0.00'
  const gainParPart = (gains / NB_PARTICIPANTS).toFixed(2)
  const partiesGagnees = data.partiesGagnees ?? 0
  const grillesGagnees = data.grillesGagnees ?? 0

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold text-yellow-400">📊 BILAN DU SYNDICAT</h2>

      <Card className="bg-green-900/40 border-green-700/60">
        <p className="text-sm text-green-300 font-bold mb-1">💸 Gain déjà distribué depuis le 1er juin</p>
        <p className="text-3xl font-bold text-green-400">{distribue.toFixed(2)}€</p>
        <p className="text-xs text-gray-400 mt-1">Montant total versé aux {NB_PARTICIPANTS} participants</p>
      </Card>

      <Card className="bg-blue-900/40 border-blue-700/60">
        <p className="text-sm text-blue-300 font-bold mb-1">🏆 Gain total annuel remporté</p>
        <p className="text-3xl font-bold text-blue-300">{gains.toFixed(2)}€</p>
        <p className="text-xs text-gray-400 mt-1">
          Dont <span className="text-yellow-300 font-bold">{cagnotte.toFixed(2)}€</span> en attente (cagnotte)
        </p>
      </Card>

      <Card className="bg-red-900/40 border-red-700/60">
        <p className="text-sm text-red-300 font-bold mb-1">💳 Solde actuel du syndicat</p>
        <p className="text-3xl font-bold text-red-300">{(gains - COTISATION_TOTALE).toFixed(2)}€</p>
        <p className="text-xs text-gray-400 mt-1">Gains totaux − Cotisation (13 × 180€ = 2 340€)</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Tirages joués" value={String(tirages)} color="text-purple-300" bg="bg-purple-900/40" border="border-purple-700/50" />
        <KpiCard label="ROI" value={roi + '%'} color="text-yellow-300" bg="bg-yellow-900/40" border="border-yellow-700/50" />
        <KpiCard label="Gain moyen / tirage" value={gainMoyen + '€'} color="text-gray-200" bg="bg-gray-800/60" border="border-gray-600/50" />
        <KpiCard label="Gain par participant" value={gainParPart + '€'} color="text-gray-200" bg="bg-gray-800/60" border="border-gray-600/50" />
        <KpiCard label="Parties gagnées" value={String(partiesGagnees)} color="text-green-300" bg="bg-green-900/40" border="border-green-700/50" />
        <KpiCard label="Grilles gagnées" value={String(grillesGagnees)} color="text-blue-300" bg="bg-blue-900/40" border="border-blue-700/50" />
      </div>
    </div>
  )
}
