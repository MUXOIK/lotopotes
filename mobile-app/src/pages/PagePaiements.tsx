import { useEffect, useState, useCallback } from 'react'
import { getPaiements, getVirements, getParticipants, createPaiement, toggleVirement } from '../lib/db'
import type { Syndicat, SyndicPaiement, SyndicVirement, SyndicParticipant } from '../lib/types'
import { Spinner, ErrorMsg, Card, EmptyState, Button } from '../components/ui'

interface Props {
  syndicat: Syndicat
  isAdmin: boolean
}

export function PagePaiements({ syndicat, isAdmin }: Props) {
  const [paiements, setPaiements] = useState<SyndicPaiement[]>([])
  const [virements, setVirements] = useState<SyndicVirement[]>([])
  const [participants, setParticipants] = useState<SyndicParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formMontant, setFormMontant] = useState('')
  const [formNote, setFormNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, v, parts] = await Promise.all([
        getPaiements(syndicat.id),
        getVirements(syndicat.id),
        getParticipants(syndicat.id),
      ])
      setPaiements(p)
      setVirements(v)
      setParticipants(parts)
      setError(null)
    } catch {
      setError('Impossible de charger les paiements.')
    } finally {
      setLoading(false)
    }
  }, [syndicat.id])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    const montant = parseFloat(formMontant)
    if (isNaN(montant) || montant <= 0) return
    setSaving(true)
    try {
      await createPaiement(syndicat.id, montant, participants, formNote || 'Distribution syndicat')
      setFormMontant('')
      setFormNote('')
      setShowForm(false)
      await load()
    } catch {
      setError('Erreur lors de la création du paiement.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (v: SyndicVirement) => {
    await toggleVirement(v.id, !v.effectue)
    await load()
  }

  if (loading) return <Spinner />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  const totalVerse = paiements.reduce((s, p) => s + p.montant, 0)
  const vRemaining = virements.filter(v => !v.effectue).length

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-yellow-400">💳 Paiements</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-900/40 rounded-xl p-4 border border-green-700/50">
          <p className="text-xs text-gray-300 mb-1">Total distribué</p>
          <p className="text-2xl font-bold text-green-400">{totalVerse.toFixed(2)}€</p>
        </div>
        <div className="bg-amber-900/40 rounded-xl p-4 border border-amber-700/50">
          <p className="text-xs text-gray-300 mb-1">Virements en attente</p>
          <p className="text-2xl font-bold text-amber-400">{vRemaining}</p>
        </div>
      </div>

      {/* Admin: créer distribution */}
      {isAdmin && (
        <Card>
          {showForm ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-yellow-300">Nouvelle distribution</h3>
              <input
                type="number"
                value={formMontant}
                onChange={e => setFormMontant(e.target.value)}
                placeholder="Montant total (€)"
                step="0.01"
                min="0.01"
                className="w-full p-3 rounded-xl bg-gray-900 border-2 border-gray-600 text-white focus:border-yellow-400 outline-none transition-colors"
              />
              <input
                type="text"
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                placeholder="Note (optionnel)"
                className="w-full p-3 rounded-xl bg-gray-900 border-2 border-gray-600 text-white focus:border-yellow-400 outline-none transition-colors"
              />
              {formMontant && parseFloat(formMontant) > 0 && participants.length > 0 && (
                <p className="text-xs text-blue-300">
                  Soit {(parseFloat(formMontant) / participants.length).toFixed(2)}€ par participant
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Annuler</Button>
                <Button onClick={handleCreate} disabled={saving} className="flex-1">
                  {saving ? '⏳...' : '✓ Créer'}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowForm(true)}>
              + Enregistrer une distribution
            </Button>
          )}
        </Card>
      )}

      {/* Liste des paiements */}
      {paiements.length === 0 ? (
        <EmptyState icon="💳" title="Aucune distribution" subtitle="Le trésorier enregistre les distributions ici." />
      ) : (
        paiements.map(p => {
          const pv = virements.filter(v => v.paiement_id === p.id)
          const done = pv.filter(v => v.effectue).length
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-white">{p.note}</p>
                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-400">{p.montant.toFixed(2)}€</p>
                  <p className="text-xs text-gray-400">{p.montant_par_personne.toFixed(2)}€ / pers.</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 mb-2">{done}/{pv.length} virements effectués</div>
              <div className="space-y-1">
                {pv.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-1 border-b border-gray-700/50 last:border-0">
                    <span className={`text-sm ${v.effectue ? 'text-green-400' : 'text-gray-300'}`}>{v.participant_nom}</span>
                    {isAdmin ? (
                      <button
                        onClick={() => handleToggle(v)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          v.effectue
                            ? 'bg-green-800/60 text-green-300 hover:bg-green-800'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {v.effectue ? '✓ Viré' : 'En attente'}
                      </button>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded ${v.effectue ? 'bg-green-800/60 text-green-300' : 'bg-gray-700 text-gray-500'}`}>
                        {v.effectue ? '✓' : '...'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
