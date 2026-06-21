import { useState } from 'react'
import type { OnboardingData } from '../lib/types'
import { MAX_PARTICIPANTS, MAX_GRILLES, MIN_PARTICIPANTS, MIN_GRILLES, LOTO_MAX_NUM, LOTO_MAX_CHANCE, LOTO_NUMS_PER_GRILLE } from '../lib/constants'
import { generateGrille } from '../lib/grille-generator'
import { createSyndicat } from '../lib/db'
import { Card, Button, Input } from '../components/ui'
import { Boule } from '../components/Boule'

const EMPTY_DATA: OnboardingData = {
  nom: '',
  tresorier_nom: '',
  nb_mois: 12,
  date_debut: new Date().toISOString().split('T')[0],
  prix_tirage_1: 2.20,
  prix_tirage_2: 0.80,
  participants: ['', ''],
  grilles: [],
}

type Step = 1 | 2 | 3 | 4 | 5

interface Props {
  onComplete: (syndicatId: string, syndicatCode: string) => void
  onCancel: () => void
}

export function PageOnboarding({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<OnboardingData>({ ...EMPTY_DATA })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData(prev => ({ ...prev, [key]: value }))
  }

  const updateParticipant = (idx: number, value: string) => {
    const next = [...data.participants]
    next[idx] = value
    updateField('participants', next)
  }

  const addParticipant = () => {
    if (data.participants.length < MAX_PARTICIPANTS) {
      updateField('participants', [...data.participants, ''])
    }
  }

  const removeParticipant = (idx: number) => {
    if (data.participants.length > MIN_PARTICIPANTS) {
      updateField('participants', data.participants.filter((_, i) => i !== idx))
    }
  }

  const addGrille = () => {
    if (data.grilles.length < MAX_GRILLES) {
      const g = generateGrille(data.grilles)
      updateField('grilles', [...data.grilles, g])
    }
  }

  const removeGrille = (idx: number) => {
    if (data.grilles.length > MIN_GRILLES) {
      updateField('grilles', data.grilles.filter((_, i) => i !== idx))
    }
  }

  const regenerateGrille = (idx: number) => {
    const others = data.grilles.filter((_, i) => i !== idx)
    const g = generateGrille(others)
    const next = [...data.grilles]
    next[idx] = g
    updateField('grilles', next)
  }

  const updateGrilleNum = (grilleIdx: number, numIdx: number, val: string) => {
    const num = parseInt(val)
    if (isNaN(num) || num < 1 || num > LOTO_MAX_NUM) return
    const next = data.grilles.map((g, i) => {
      if (i !== grilleIdx) return g
      const nums = [...g.numeros]
      nums[numIdx] = num
      return { ...g, numeros: nums }
    })
    updateField('grilles', next)
  }

  const updateGrilleChance = (grilleIdx: number, val: string) => {
    const num = parseInt(val)
    if (isNaN(num) || num < 1 || num > LOTO_MAX_CHANCE) return
    const next = data.grilles.map((g, i) =>
      i !== grilleIdx ? g : { ...g, numero_chance: num }
    )
    updateField('grilles', next)
  }

  const canNext = (): boolean => {
    if (step === 1) return data.nom.trim().length >= 2 && data.tresorier_nom.trim().length >= 2 && data.nb_mois >= 1 && !!data.date_debut
    if (step === 2) return data.prix_tirage_1 > 0 && data.prix_tirage_2 >= 0
    if (step === 3) {
      const filled = data.participants.filter(p => p.trim().length >= 2)
      return filled.length >= MIN_PARTICIPANTS
    }
    if (step === 4) return data.grilles.length >= MIN_GRILLES
    return true
  }

  const next = () => {
    if (step === 3) {
      updateField('participants', data.participants.filter(p => p.trim().length >= 2))
    }
    setStep((s) => (s < 5 ? (s + 1) as Step : s))
  }

  const prev = () => setStep((s) => (s > 1 ? (s - 1) as Step : s))

  const handleCreate = async () => {
    setSaving(true)
    setError(null)
    try {
      const syndicat = await createSyndicat(data)
      onComplete(syndicat.id, syndicat.code)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const cotisationParPersonne = () => {
    const filled = data.participants.filter(p => p.trim().length >= 2)
    const nbGrilles = data.grilles.length || 1
    const coutParTirage = (data.prix_tirage_1 + data.prix_tirage_2) * nbGrilles
    const tiragesParAn = Math.round(data.nb_mois * 4.33 * 3) // ~3 tirages/semaine
    const total = coutParTirage * tiragesParAn
    return filled.length > 0 ? (total / filled.length).toFixed(2) : '—'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 p-4 border-b border-yellow-500/30">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition text-xl">←</button>
          <div>
            <h1 className="text-base font-bold text-yellow-400">Créer un syndicat</h1>
            <p className="text-xs text-blue-300/70">Étape {step} / 5</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-4">

        {/* STEP 1: Infos générales */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-xl font-bold text-yellow-400">Informations générales</h2>
            <Input
              label="Nom du syndicat"
              value={data.nom}
              onChange={v => updateField('nom', v)}
              placeholder="Ex: LES POTES MILLIONNAIRES"
            />
            <Input
              label="Nom du trésorier"
              value={data.tresorier_nom}
              onChange={v => updateField('tresorier_nom', v)}
              placeholder="Prénom Nom"
            />
            <Input
              label="Date de début"
              value={data.date_debut}
              onChange={v => updateField('date_debut', v)}
              type="date"
            />
            <Input
              label="Durée (en mois)"
              value={data.nb_mois}
              onChange={v => updateField('nb_mois', Math.max(1, parseInt(v) || 1))}
              type="number"
              min={1}
              max={36}
            />
          </div>
        )}

        {/* STEP 2: Prix */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-xl font-bold text-yellow-400">Prix des tirages</h2>
            <p className="text-sm text-gray-400">Ces prix s'appliquent par grille à chaque tirage.</p>
            <Input
              label="Prix 1er tirage (€ par grille)"
              value={data.prix_tirage_1}
              onChange={v => updateField('prix_tirage_1', parseFloat(v) || 0)}
              type="number"
              min={0.1}
              step={0.10}
            />
            <Input
              label="Prix 2ème tirage (€ par grille)"
              value={data.prix_tirage_2}
              onChange={v => updateField('prix_tirage_2', parseFloat(v) || 0)}
              type="number"
              min={0}
              step={0.10}
            />
            <Card className="bg-blue-900/40 border-blue-700/60">
              <p className="text-xs text-blue-300 font-semibold mb-1">Estimation du coût</p>
              <p className="text-sm text-white">
                Coût par tirage (pour {data.grilles.length || 1} grille{data.grilles.length > 1 ? 's' : ''}) :{' '}
                <strong className="text-yellow-300">
                  {((data.prix_tirage_1 + data.prix_tirage_2) * (data.grilles.length || 1)).toFixed(2)}€
                </strong>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Cotisation estimée / participant : <strong className="text-yellow-300">{cotisationParPersonne()}€</strong>
              </p>
            </Card>
          </div>
        )}

        {/* STEP 3: Participants */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-yellow-400">Participants</h2>
              <span className="text-sm text-gray-400">{data.participants.filter(p => p.trim()).length} / {MAX_PARTICIPANTS}</span>
            </div>
            <p className="text-sm text-gray-400">Les participants sont fixes pour toute la durée du syndicat (max {MAX_PARTICIPANTS}).</p>
            <div className="space-y-2">
              {data.participants.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-500 w-5 text-right">{idx + 1}.</span>
                  <input
                    type="text"
                    value={p}
                    onChange={e => updateParticipant(idx, e.target.value)}
                    placeholder={`Participant ${idx + 1}`}
                    className="flex-1 p-2.5 rounded-xl bg-gray-900 border border-gray-600 text-white text-sm focus:border-yellow-400 outline-none transition-colors"
                  />
                  {data.participants.length > MIN_PARTICIPANTS && (
                    <button
                      onClick={() => removeParticipant(idx)}
                      className="text-red-400 hover:text-red-300 transition text-lg w-8 flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {data.participants.length < MAX_PARTICIPANTS && (
              <button
                onClick={addParticipant}
                className="w-full p-2.5 rounded-xl border-2 border-dashed border-gray-600 text-gray-400 hover:border-yellow-500 hover:text-yellow-400 transition text-sm font-semibold"
              >
                + Ajouter un participant
              </button>
            )}
          </div>
        )}

        {/* STEP 4: Grilles */}
        {step === 4 && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-yellow-400">Grilles de jeu</h2>
              <span className="text-sm text-gray-400">{data.grilles.length} / {MAX_GRILLES}</span>
            </div>
            <p className="text-sm text-gray-400">
              Saisissez ou générez jusqu'à {MAX_GRILLES} grilles. Elles seront rejouées à chaque tirage.
            </p>

            {data.grilles.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-gray-800/40 rounded-xl border border-dashed border-gray-600">
                <p className="text-4xl mb-2">🎰</p>
                <p className="text-sm">Générez ou saisissez vos premières grilles</p>
              </div>
            )}

            {data.grilles.map((g, gIdx) => (
              <Card key={gIdx}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-yellow-300">Grille {gIdx + 1}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => regenerateGrille(gIdx)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition px-2 py-1 rounded border border-blue-700 hover:border-blue-500"
                    >
                      Régénérer
                    </button>
                    {data.grilles.length > MIN_GRILLES && (
                      <button
                        onClick={() => removeGrille(gIdx)}
                        className="text-xs text-red-400 hover:text-red-300 transition px-2 py-1 rounded border border-red-800 hover:border-red-600"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from({ length: LOTO_NUMS_PER_GRILLE }).map((_, nIdx) => (
                    <input
                      key={nIdx}
                      type="number"
                      min={1}
                      max={LOTO_MAX_NUM}
                      value={g.numeros[nIdx] ?? ''}
                      onChange={e => updateGrilleNum(gIdx, nIdx, e.target.value)}
                      className="w-12 h-12 text-center rounded-full bg-blue-800 border-2 border-yellow-400 text-white font-bold text-sm focus:border-yellow-200 outline-none transition-colors"
                    />
                  ))}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">C:</span>
                    <input
                      type="number"
                      min={1}
                      max={LOTO_MAX_CHANCE}
                      value={g.numero_chance}
                      onChange={e => updateGrilleChance(gIdx, e.target.value)}
                      className="w-12 h-12 text-center rounded-full bg-yellow-700 border-2 border-yellow-300 text-white font-bold text-sm focus:border-yellow-100 outline-none transition-colors"
                    />
                  </div>
                </div>
              </Card>
            ))}

            <div className="flex gap-3">
              {data.grilles.length < MAX_GRILLES && (
                <>
                  <button
                    onClick={addGrille}
                    className="flex-1 p-3 rounded-xl bg-gradient-to-r from-blue-800 to-blue-700 text-white font-semibold hover:opacity-90 active:scale-95 transition-all text-sm"
                  >
                    ✨ Générer une grille
                  </button>
                  <button
                    onClick={() => updateField('grilles', [...data.grilles, { numeros: [1, 2, 3, 4, 5], numero_chance: 1 }])}
                    className="flex-1 p-3 rounded-xl border-2 border-dashed border-gray-600 text-gray-400 hover:border-gray-500 text-sm transition-colors"
                  >
                    + Saisir manuellement
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: Récapitulatif */}
        {step === 5 && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-xl font-bold text-yellow-400">Récapitulatif</h2>

            <Card>
              <h3 className="text-sm font-bold text-yellow-300 mb-3">Syndicat</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Nom</span><span className="font-semibold">{data.nom}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Trésorier</span><span>{data.tresorier_nom}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Début</span><span>{new Date(data.date_debut).toLocaleDateString('fr-FR')}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Durée</span><span>{data.nb_mois} mois</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Prix 1er tirage</span><span>{data.prix_tirage_1.toFixed(2)}€ / grille</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Prix 2ème tirage</span><span>{data.prix_tirage_2.toFixed(2)}€ / grille</span></div>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-yellow-300 mb-3">{data.participants.length} participants</h3>
              <div className="flex flex-wrap gap-1">
                {data.participants.map((p, i) => (
                  <span key={i} className="bg-gray-700 px-2 py-1 rounded text-xs">{p}</span>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-yellow-300 mb-3">{data.grilles.length} grille{data.grilles.length > 1 ? 's' : ''}</h3>
              <div className="space-y-2">
                {data.grilles.map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-500 w-14">Grille {i + 1}</span>
                    {g.numeros.map(n => <Boule key={n} num={n} variant="primary" size="sm" />)}
                    <Boule num={g.numero_chance} variant="chance" size="sm" />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-green-900/40 border-green-700/60">
              <p className="text-sm text-green-300 font-bold">Cotisation estimée par participant</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{cotisationParPersonne()}€</p>
              <p className="text-xs text-gray-400 mt-1">Pour {data.nb_mois} mois (~{Math.round(data.nb_mois * 4.33 * 3)} tirages)</p>
            </Card>

            {error && (
              <div className="bg-red-950/60 border border-red-700/60 rounded-xl p-4 text-sm text-red-300">
                ⚠️ {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="p-4 border-t border-gray-800 flex gap-3 max-w-lg mx-auto w-full">
        {step > 1 && (
          <Button variant="secondary" onClick={prev} className="flex-1">
            ← Retour
          </Button>
        )}
        {step < 5 ? (
          <Button onClick={next} disabled={!canNext()} className="flex-1">
            Suivant →
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving} className="flex-1">
            {saving ? '⏳ Création...' : '🎲 Créer le syndicat'}
          </Button>
        )}
      </div>
    </div>
  )
}
