import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { NB_PARTICIPANTS } from '../lib/constants'
import type { Paiement } from '../lib/types'
import { Spinner, ErrorMsg, Card, EmptyState } from '../components/ui'

interface PaiementWithCount extends Paiement {
  virementsEffectues: number
}

export function SectionPaiements() {
  const [paiements, setPaiements] = useState<PaiementWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: paiementsData, error: pErr } = await supabase
      .from('paiements')
      .select('*')
      .order('created_at', { ascending: false })

    if (pErr || !paiementsData) {
      setError('Erreur lors du chargement des paiements.')
      setLoading(false)
      return
    }

    // Load virement counts per paiement
    const ids = paiementsData.map((p: Paiement) => p.id)
    const { data: virementsData } = ids.length > 0
      ? await supabase
          .from('virements')
          .select('paiement_id')
          .in('paiement_id', ids)
          .eq('effectue', true)
      : { data: [] }

    const countMap: Record<string, number> = {}
    ;(virementsData ?? []).forEach((v: { paiement_id: string }) => {
      countMap[v.paiement_id] = (countMap[v.paiement_id] ?? 0) + 1
    })

    setPaiements(
      paiementsData.map((p: Paiement) => ({
        ...p,
        virementsEffectues: countMap[p.id] ?? 0,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const total = paiements.reduce((s, p) => s + Number(p.montant), 0)

  if (loading) return <Spinner />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold text-yellow-400">💳 PAIEMENTS</h2>
        <p className="text-gray-400 text-sm mt-1">Journal des distributions de l'administrateur.</p>
      </div>

      {paiements.length === 0 ? (
        <EmptyState
          icon="💳"
          title="Aucun paiement enregistré"
          subtitle="Les distributions seront listées ici au fur et à mesure."
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {paiements.map((p) => (
              <Card key={p.id} className="flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="text-sm text-gray-300 mt-0.5 truncate">{p.note}</div>
                  <div className="text-xs mt-1">
                    <span className={p.virementsEffectues === NB_PARTICIPANTS ? 'text-green-500' : 'text-yellow-500'}>
                      {p.virementsEffectues}/{NB_PARTICIPANTS} virements effectués
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold text-green-400">{Number(p.montant).toFixed(2)}€</div>
                  <div className="text-xs text-gray-400">
                    {Number(p.montant_par_personne).toFixed(2)}€/pers.
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="bg-green-950/60 rounded-xl p-4 border border-green-700/50 flex justify-between items-center">
            <div>
              <p className="font-bold text-green-300">Total distribué</p>
              <p className="text-xs text-green-500 mt-0.5">{paiements.length} paiement{paiements.length > 1 ? 's' : ''}</p>
            </div>
            <span className="text-2xl font-bold text-green-300">{total.toFixed(2)}€</span>
          </div>
        </>
      )}
    </div>
  )
}
