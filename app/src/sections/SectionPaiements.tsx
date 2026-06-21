import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Paiement } from '../lib/types'
import { Spinner, ErrorMsg, Card } from '../components/ui'

export function SectionPaiements() {
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('paiements')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError('Erreur lors du chargement des paiements.')
    } else {
      setPaiements(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const total = paiements.reduce((s, p) => s + p.montant, 0)

  if (loading) return <Spinner />
  if (error) return <ErrorMsg message={error} />

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold text-yellow-400">💳 PAIEMENTS</h2>
        <p className="text-gray-400 text-sm mt-1">Journal des distributions effectuées par l'administrateur.</p>
      </div>

      {paiements.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">💳</p>
          <p className="text-gray-400">Aucun paiement enregistré.</p>
          <p className="text-gray-500 text-sm mt-2">Les distributions seront listées ici au fur et à mesure.</p>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paiements.map((p) => (
              <Card key={p.id} className="flex justify-between items-center gap-3">
                <div>
                  <div className="text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="text-sm text-gray-300 mt-0.5">{p.note}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-400">{p.montant.toFixed(2)}€</div>
                  <div className="text-xs text-gray-400">soit {p.montant_par_personne.toFixed(2)}€/pers.</div>
                </div>
              </Card>
            ))}
          </div>

          <div className="bg-green-900/50 rounded-xl p-4 border border-green-600 flex justify-between items-center">
            <span className="font-bold text-green-300">Total distribué</span>
            <span className="text-2xl font-bold text-green-300">{total.toFixed(2)}€</span>
          </div>
        </>
      )}
    </div>
  )
}
