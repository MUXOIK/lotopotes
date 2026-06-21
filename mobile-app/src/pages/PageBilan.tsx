import { useEffect, useState, useCallback } from 'react'
import { fetchLotoComplet } from '../lib/api'
import { getGrilles, getParticipants } from '../lib/db'
import type { ApiLotoComplet, Syndicat, SyndicGrille, SyndicParticipant, Tirage } from '../lib/types'
import { LoadingWithHint, ErrorMsg, Card, EmptyState } from '../components/ui'
import { Boule } from '../components/Boule'

interface GrilleResult {
  grille: SyndicGrille
  matchPrimary: number
  matchChance: boolean
  matchSecond: number
  gain: number
}

function calcGrilleResult(grille: SyndicGrille, tirage: Tirage): GrilleResult {
  const matchPrimary = grille.numeros.filter(n => tirage.nums.includes(n)).length
  const matchChance = grille.numero_chance === tirage.chance
  const matchSecond = tirage.nums2?.length > 0 ? grille.numeros.filter(n => tirage.nums2.includes(n)).length : 0

  let gain = 0
  const rg = tirage.rapportGains
  if (matchPrimary === 5 && matchChance) gain = rg['5+1']
  else if (matchPrimary === 5) gain = rg['5']
  else if (matchPrimary === 4 && matchChance) gain = rg['4+1']
  else if (matchPrimary === 4) gain = rg['4']
  else if (matchPrimary === 3 && matchChance) gain = rg['3+1']
  else if (matchPrimary === 3) gain = rg['3']
  else if (matchPrimary === 2 && matchChance) gain = rg['2+1']
  else if (matchPrimary === 2) gain = rg['2']
  else if (matchPrimary === 1 && matchChance) gain = rg['1+1']

  const rg2 = tirage.rapportGains2
  if (tirage.nums2?.length > 0) {
    if (matchSecond === 5) gain += rg2['5']
    else if (matchSecond === 4) gain += rg2['4']
    else if (matchSecond === 3) gain += rg2['3']
    else if (matchSecond === 2) gain += rg2['2']
  }

  return { grille, matchPrimary, matchChance, matchSecond, gain }
}

interface Props {
  syndicat: Syndicat
}

export function PageBilan({ syndicat }: Props) {
  const [loto, setLoto] = useState<ApiLotoComplet | null>(null)
  const [grilles, setGrilles] = useState<SyndicGrille[]>([])
  const [participants, setParticipants] = useState<SyndicParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [lotoData, grillesData, participantsData] = await Promise.all([
        fetchLotoComplet(),
        getGrilles(syndicat.id),
        getParticipants(syndicat.id),
      ])
      setLoto(lotoData)
      setGrilles(grillesData)
      setParticipants(participantsData)
      setError(null)
    } catch {
      setError('Impossible de charger le bilan.')
    } finally {
      setLoading(false)
    }
  }, [syndicat.id])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingWithHint />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  const historique = loto?.historique ?? []
  const nbParticipants = participants.length || 1
  const tiragesEstimes = Math.round(syndicat.nb_mois * 4.33 * 3)
  const coutTirage = (syndicat.prix_tirage_1 + syndicat.prix_tirage_2) * syndicat.nb_grilles
  const cotisationTotale = coutTirage * tiragesEstimes
  const cotisationParPersonne = cotisationTotale / nbParticipants

  // Calculate total gains from historique
  let gainsTotal = 0
  let tiragesGagnants = 0
  historique.forEach(t => {
    grilles.forEach(g => {
      const r = calcGrilleResult(g, t)
      if (r.gain > 0) {
        gainsTotal += r.gain
        tiragesGagnants++
      }
    })
  })

  const roi = cotisationTotale > 0 ? ((gainsTotal / cotisationTotale) * 100).toFixed(1) : '0.0'
  const gainParParticipant = (gainsTotal / nbParticipants).toFixed(2)

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold text-yellow-400">📊 Bilan du syndicat</h2>

      <Card className="bg-green-900/40 border-green-700/60">
        <p className="text-sm text-green-300 font-bold mb-1">Gains totaux remportés</p>
        <p className="text-3xl font-bold text-green-400">{gainsTotal.toFixed(2)}€</p>
        <p className="text-xs text-gray-400 mt-1">Sur {historique.length} tirages analysés</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-yellow-900/40 rounded-xl p-4 border border-yellow-700/50">
          <p className="text-xs text-gray-300 mb-1">Tirages gagnants</p>
          <p className="text-2xl font-bold text-yellow-300">{tiragesGagnants}</p>
        </div>
        <div className="bg-blue-900/40 rounded-xl p-4 border border-blue-700/50">
          <p className="text-xs text-gray-300 mb-1">ROI estimé</p>
          <p className="text-2xl font-bold text-blue-300">{roi}%</p>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-600/50">
          <p className="text-xs text-gray-300 mb-1">Gain / participant</p>
          <p className="text-2xl font-bold text-gray-200">{gainParParticipant}€</p>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-600/50">
          <p className="text-xs text-gray-300 mb-1">Cotisation / personne</p>
          <p className="text-2xl font-bold text-gray-200">{cotisationParPersonne.toFixed(2)}€</p>
        </div>
      </div>

      <Card>
        <h3 className="text-sm font-bold text-yellow-300 mb-3">Budget prévisionnel ({syndicat.nb_mois} mois)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Tirages estimés</span>
            <span>{tiragesEstimes}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Coût / tirage ({syndicat.nb_grilles} grille{syndicat.nb_grilles > 1 ? 's' : ''})</span>
            <span>{coutTirage.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between border-t border-gray-700 pt-2">
            <span className="text-gray-400">Budget total</span>
            <strong className="text-yellow-300">{cotisationTotale.toFixed(2)}€</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Par participant ({nbParticipants} pers.)</span>
            <strong className="text-yellow-300">{cotisationParPersonne.toFixed(2)}€</strong>
          </div>
        </div>
      </Card>

      {historique.length === 0 && (
        <EmptyState icon="📊" title="Pas encore de tirages" subtitle="Le bilan s'enrichira avec les tirages FDJ." />
      )}
    </div>
  )
}
