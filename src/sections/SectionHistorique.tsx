import { useEffect, useState, useCallback } from 'react'
import { fetchStats } from '../lib/api'
import { GRILLES, CHANCES } from '../lib/constants'
import type { ApiStats, Tirage } from '../lib/types'
import { LoadingWithHint, ErrorMsg, Card, Badge, EmptyState } from '../components/ui'

interface LigneGagnante {
  date: string
  grille: number
  nums: number[]
  chance: number
  communs: number[]
  chanceGagnant: boolean
  gain: number
  tirage: '1er' | '2nd'
}

function buildLignesGagnantes(historique: Tirage[]): LigneGagnante[] {
  const lignes: LigneGagnante[] = []
  for (const t of historique) {
    if (!t.gains || t.gains <= 0) continue
    const rg = t.rapportGains ?? {}
    const rg2 = t.rapportGains2 ?? {}
    const date = new Date(t.date).toLocaleDateString('fr-FR')

    GRILLES.forEach((grille, idx) => {
      const n = t.nums.filter((x) => grille.includes(x)).length
      const c = CHANCES[idx] === t.chance
      let gain = 0
      if (n === 5 && c) gain = rg['5+1'] || 0
      else if (n === 5) gain = rg['5'] || 0
      else if (n === 4 && c) gain = rg['4+1'] || 0
      else if (n === 4) gain = rg['4'] || 0
      else if (n === 3 && c) gain = rg['3+1'] || 0
      else if (n === 3) gain = rg['3'] || 0
      else if (n === 2 && c) gain = rg['2+1'] || 0
      else if (n === 2) gain = rg['2'] || 0
      else if (n <= 1 && c) gain = rg['1+1'] || 0
      if (gain > 0) {
        const communs = t.nums.filter((x) => grille.includes(x))
        lignes.push({ date, grille: idx + 1, nums: grille, chance: CHANCES[idx], communs, chanceGagnant: c, gain, tirage: '1er' })
      }
    })

    if (t.nums2?.length === 5) {
      GRILLES.forEach((grille, idx) => {
        const n = t.nums2.filter((x) => grille.includes(x)).length
        let gain2 = 0
        if (n === 5) gain2 = rg2['5'] || 0
        else if (n === 4) gain2 = rg2['4'] || 0
        else if (n === 3) gain2 = rg2['3'] || 0
        else if (n === 2) gain2 = rg2['2'] || 0
        if (gain2 > 0) {
          const communs2 = t.nums2.filter((x) => grille.includes(x))
          lignes.push({ date, grille: idx + 1, nums: grille, chance: CHANCES[idx], communs: communs2, chanceGagnant: false, gain: gain2, tirage: '2nd' })
        }
      })
    }
  }
  return lignes
}

export function SectionHistorique() {
  const [data, setData] = useState<ApiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchStats()
      .then((d) => setData(d))
      .catch(() => setError("Erreur lors du chargement de l'historique."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingWithHint />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  const lignes = data?.historique ? buildLignesGagnantes(data.historique) : []
  const totalGains = lignes.reduce((s, l) => s + l.gain, 0)

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold text-yellow-400">🏆 HISTORIQUE DES GAINS</h2>
        <p className="text-gray-400 text-sm mt-1">
          Tirages gagnants — numéros communs en bleu, chance gagnant en jaune.
        </p>
      </div>

      {lignes.length === 0 ? (
        <EmptyState
          icon="🎰"
          title="Aucun gain pour le moment"
          subtitle="Les gains s'afficheront ici au fur et à mesure."
        />
      ) : (
        <>
          <div className="space-y-3">
            {lignes.map((l, i) => (
              <Card key={i}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className="text-yellow-300 font-bold text-sm">Grille {l.grille}</span>
                      <Badge color={l.tirage === '2nd' ? 'green' : 'blue'}>{l.tirage} tirage</Badge>
                      <span className="text-gray-400 text-xs">{l.date}</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {l.nums.join(' - ')} + <span className="text-yellow-400 font-bold">C{l.chance}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {l.communs.map((n) => (
                        <span key={n} className="bg-blue-700 text-white px-2 py-0.5 rounded text-xs font-bold">{n}</span>
                      ))}
                      {l.chanceGagnant && (
                        <span className="bg-yellow-500 text-gray-900 px-2 py-0.5 rounded text-xs font-bold">C{l.chance}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-green-400 font-bold text-lg whitespace-nowrap">{l.gain.toFixed(2)}€</div>
                </div>
              </Card>
            ))}
          </div>

          <div className="bg-green-900/50 rounded-xl p-4 border border-green-600 flex justify-between items-center">
            <span className="font-bold text-green-300">Total des gains</span>
            <span className="text-2xl font-bold text-green-300">{totalGains.toFixed(2)}€</span>
          </div>
        </>
      )}
    </div>
  )
}
