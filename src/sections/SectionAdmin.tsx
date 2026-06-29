import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTest, fetchBilan, fetchForceScrape, fetchScrapeHistory, postTirageManuel, invalidateCache } from '../lib/api'
import { PARTICIPANTS, ADMIN_PASSWORD, NB_PARTICIPANTS, GRILLES, CHANCES } from '../lib/constants'
import type { Paiement, Virement } from '../lib/types'
import { Spinner, Card } from '../components/ui'

const ADMIN_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-writes`
const ADMIN_SECRET  = import.meta.env.VITE_ADMIN_SECRET as string

async function adminFetch(action: string, body?: unknown) {
  const resp = await fetch(`${ADMIN_API_URL}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`)
  return data
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState(false)

  const check = () => {
    if (pwd.trim().toUpperCase() === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_ok', '1')
      onLogin()
    } else {
      setErr(true)
      setTimeout(() => setErr(false), 3000)
    }
  }

  return (
    <Card className="max-w-sm mx-auto text-center">
      <h2 className="text-2xl font-bold text-yellow-400 mb-2">🔐 Espace Admin</h2>
      <p className="text-gray-400 text-sm mb-6">Réservé à l'administrateur du syndicat</p>
      <input
        type="password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        placeholder="Mot de passe..."
        className="w-full p-3 rounded-lg bg-gray-700 border-2 border-gray-600 text-white text-center mb-3 focus:border-yellow-400 outline-none"
        autoFocus
      />
      <button
        onClick={check}
        className="w-full p-3 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold text-base hover:opacity-90 transition"
      >
        🔓 Connexion
      </button>
      {err && <p className="text-red-400 text-sm mt-2">Mot de passe incorrect</p>}
    </Card>
  )
}

function ServerStatus({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <div className="rounded-xl bg-orange-900/30 border border-orange-700 p-4 text-center">
      <p className="text-2xl mb-2">😴</p>
      <p className="text-orange-300 font-bold text-sm mb-1">Serveur en veille</p>
      <p className="text-gray-400 text-xs mb-4">
        Le serveur se met en veille après 15 min d'inactivité.<br />
        Le réveil prend environ 30 secondes.
      </p>
      <button
        onClick={onRetry}
        disabled={loading}
        className="w-full p-3 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-sm transition"
      >
        {loading ? '⏳ Connexion en cours...' : '🔄 Réessayer la connexion'}
      </button>
    </div>
  )
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [montant, setMontant] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [latestPaiement, setLatestPaiement] = useState<Paiement | null>(null)
  const [virements, setVirements] = useState<Record<string, Virement>>({})

  const [sysLoading, setSysLoading] = useState(true)
  const [sysOffline, setSysOffline] = useState(false)
  const [sysInfo, setSysInfo] = useState<string | null>(null)

  const [checkLoading, setCheckLoading] = useState(false)
  const [checkOffline, setCheckOffline] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [histMsg, setHistMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Manual entry state
  const todayStr = new Date().toISOString().split('T')[0]
  const [manDate, setManDate] = useState(todayStr)
  const [manNums, setManNums] = useState<string[]>(['', '', '', '', ''])
  const [manChance, setManChance] = useState('')
  const [manHas2nd, setManHas2nd] = useState(false)
  const [manNums2, setManNums2] = useState<string[]>(['', '', '', '', ''])
  const [manLoading, setManLoading] = useState(false)
  const [manMsg, setManMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadLatestPaiementAndVirements = useCallback(async () => {
    const { data: paiements } = await supabase
      .from('paiements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!paiements || paiements.length === 0) {
      setLatestPaiement(null)
      setVirements({})
      return
    }

    const paiement = paiements[0] as Paiement
    setLatestPaiement(paiement)

    const { data: virementsData } = await supabase
      .from('virements')
      .select('*')
      .eq('paiement_id', paiement.id)

    if (virementsData) {
      const map: Record<string, Virement> = {}
      virementsData.forEach((v: Virement) => { map[v.participant_nom] = v })
      setVirements(map)
    }
  }, [])

  const loadSysInfo = async () => {
    setSysLoading(true)
    setSysOffline(false)
    setSysInfo(null)
    try {
      const [test, bilan] = await Promise.all([fetchTest(), fetchBilan()])
      setSysInfo(
        `Serveur: ${test.ok ? '✅ En ligne' : '❌ Hors ligne'} | Tirages joués: ${bilan.tiragesEffectues} | Tirages gagnants: ${test.allGains} | Cagnotte: ${test.cagnotte}€`
      )
    } catch {
      setSysOffline(true)
    } finally {
      setSysLoading(false)
    }
  }

  useEffect(() => {
    loadLatestPaiementAndVirements()
    loadSysInfo()
  }, [loadLatestPaiementAndVirements])

  const checkServeur = async () => {
    setCheckLoading(true)
    setCheckResult(null)
    setCheckOffline(false)
    try {
      const [test, bilan] = await Promise.all([fetchTest(), fetchBilan()])
      setCheckResult(
        test.ok
          ? `✅ Serveur OK — ${bilan.tiragesEffectues} tirages joués, ${test.allGains} gagnants, cagnotte ${test.cagnotte}€`
          : '❌ Serveur indisponible'
      )
    } catch {
      setCheckOffline(true)
    } finally {
      setCheckLoading(false)
    }
  }

  const forceScrape = async () => {
    setScrapeLoading(true)
    setScrapeMsg(null)
    try {
      const result = await fetchForceScrape()
      invalidateCache()
      const gain = result.tirage?.gainTotal ?? 0
      setScrapeMsg({
        ok: result.success,
        text: result.success
          ? `✅ Scrape OK — tirage du ${new Date(result.tirage?.date ?? '').toLocaleDateString('fr-FR')} — gain: ${gain.toFixed(2)}€`
          : `⚠️ Scrape partiel${result.error ? ': ' + result.error : ''}`,
      })
      await loadSysInfo()
    } catch (e) {
      setScrapeMsg({ ok: false, text: `❌ ${(e as Error).message}` })
    } finally {
      setScrapeLoading(false)
      setTimeout(() => setScrapeMsg(null), 8000)
    }
  }

  const repairHistory = async () => {
    setHistLoading(true)
    setHistMsg(null)
    try {
      const result = await fetchScrapeHistory()
      invalidateCache()
      const lines = Object.entries(result.results).map(([d, v]) => `${d}: ${v}`)
      setHistMsg({
        ok: result.success,
        text: result.fixed === 0
          ? '✅ Aucun tirage à réparer'
          : `✅ ${result.fixed} tirage(s) réparé(s)\n${lines.join(' | ')}`,
      })
      await loadSysInfo()
    } catch (e) {
      setHistMsg({ ok: false, text: `❌ ${(e as Error).message}` })
    } finally {
      setHistLoading(false)
      setTimeout(() => setHistMsg(null), 10000)
    }
  }

  const saisirManuellement = async () => {
    const nums = manNums.map(Number)
    const chance = parseInt(manChance)
    if (!manDate || nums.some(n => isNaN(n) || n < 1 || n > 49) || nums.length !== 5) {
      setManMsg({ ok: false, text: '❌ 5 numéros entre 1 et 49 requis' }); return
    }
    if (isNaN(chance) || chance < 1 || chance > 10) {
      setManMsg({ ok: false, text: '❌ Numéro Chance entre 1 et 10 requis' }); return
    }
    const nums2 = manHas2nd ? manNums2.map(Number) : []
    if (manHas2nd && (nums2.some(n => isNaN(n) || n < 1 || n > 49))) {
      setManMsg({ ok: false, text: '❌ 2nd tirage: 5 numéros entre 1 et 49' }); return
    }

    // Preview which grilles win
    const wins = GRILLES.map((g, i) => {
      const n = nums.filter(x => g.includes(x)).length
      const c = CHANCES[i] === chance
      return (n === 5 && c) || n === 5 || (n === 4 && c) || n === 4 ||
        (n === 3 && c) || n === 3 || (n === 2 && c) || n === 2 || (n <= 1 && c)
    })
    const winCount = wins.filter(Boolean).length

    setManLoading(true)
    setManMsg(null)
    try {
      const result = await postTirageManuel({ date: manDate, nums, chance, nums2: manHas2nd ? nums2 : undefined })
      invalidateCache()
      setManMsg({
        ok: true,
        text: `✅ Tirage du ${manDate} enregistré — ${winCount} grille(s) gagnante(s) — gain: ${result.gain.toFixed(2)}€`,
      })
      setManNums(['', '', '', '', ''])
      setManChance('')
      setManNums2(['', '', '', '', ''])
      setManHas2nd(false)
      await loadSysInfo()
    } catch (e) {
      setManMsg({ ok: false, text: `❌ ${(e as Error).message}` })
    } finally {
      setManLoading(false)
      setTimeout(() => setManMsg(null), 8000)
    }
  }

  const enregistrerPaiement = async () => {
    const val = parseFloat(montant)
    if (!montant || isNaN(val) || val <= 0) {
      setSaveMsg({ ok: false, text: '❌ Veuillez saisir un montant valide.' })
      return
    }
    setSaving(true)
    try {
      await adminFetch('insert_paiement', {
        montant: val,
        montant_par_personne: parseFloat((val / NB_PARTICIPANTS).toFixed(2)),
        note: note.trim() || 'Distribution syndicat',
        participants: PARTICIPANTS,
      })
      setSaveMsg({ ok: true, text: `✅ ${val.toFixed(2)}€ enregistré — virements créés pour ${NB_PARTICIPANTS} participants` })
      setMontant('')
      setNote('')
      await loadLatestPaiementAndVirements()
    } catch (e) {
      setSaveMsg({ ok: false, text: `❌ ${(e as Error).message}` })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 5000)
    }
  }

  const toggleVirement = async (nom: string, checked: boolean) => {
    if (!latestPaiement) return
    const today = new Date().toISOString().split('T')[0]
    try {
      const { data } = await adminFetch('upsert_virement', {
        participant_nom: nom,
        paiement_id: latestPaiement.id,
        effectue: checked,
        date_virement: checked ? today : null,
      })
      setVirements((prev) => ({ ...prev, [nom]: data as Virement }))
    } catch (e) {
      console.error('Erreur virement:', (e as Error).message)
    }
  }

  const vCount = Object.values(virements).filter((v) => v.effectue).length

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-yellow-400">🔐 Panneau Admin</h2>
        <button onClick={onLogout} className="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition">
          Déconnexion
        </button>
      </div>

      {/* Vérification serveur */}
      <Card className="border-blue-700 bg-blue-900/20">
        <h3 className="text-base font-bold text-blue-300 mb-1">🔄 Vérification serveur</h3>
        <p className="text-xs text-gray-400 mb-3">Vérifier l'état du serveur backend.</p>
        {checkOffline ? (
          <ServerStatus onRetry={checkServeur} loading={checkLoading} />
        ) : (
          <>
            <button
              onClick={checkServeur}
              disabled={checkLoading}
              className="w-full p-3 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold transition"
            >
              {checkLoading ? '⏳ En cours...' : '🔄 Vérifier le serveur'}
            </button>
            {checkResult && (
              <p className={`mt-2 text-sm ${checkResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {checkResult}
              </p>
            )}
          </>
        )}
      </Card>

      {/* Mettre à jour les tirages */}
      <Card className="border-orange-700 bg-orange-900/20">
        <h3 className="text-base font-bold text-orange-300 mb-1">🎰 Mettre à jour les tirages</h3>
        <p className="text-xs text-gray-400 mb-3">Force le re-scraping des résultats FDJ depuis secretsdujeu.com.</p>
        <button
          onClick={forceScrape}
          disabled={scrapeLoading}
          className="w-full p-3 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-60 text-white font-bold transition"
        >
          {scrapeLoading ? '⏳ Scraping en cours...' : '🔄 Force Scrape'}
        </button>
        {scrapeMsg && (
          <p className={`mt-2 text-sm ${scrapeMsg.ok ? 'text-green-400' : 'text-orange-400'}`}>
            {scrapeMsg.text}
          </p>
        )}
        <div className="mt-3 pt-3 border-t border-orange-800">
          <p className="text-xs text-gray-400 mb-2">Répare les tirages passés avec des gains manquants (null).</p>
          <button
            onClick={repairHistory}
            disabled={histLoading}
            className="w-full p-2.5 rounded-lg bg-orange-900 hover:bg-orange-800 disabled:opacity-60 text-orange-300 font-bold text-sm transition border border-orange-700"
          >
            {histLoading ? '⏳ Réparation en cours...' : '🔧 Réparer l\'historique'}
          </button>
          {histMsg && (
            <p className={`mt-2 text-xs whitespace-pre-wrap ${histMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
              {histMsg.text}
            </p>
          )}
        </div>
      </Card>

      {/* Saisie manuelle d'un tirage */}
      <Card className="border-purple-700 bg-purple-900/20">
        <h3 className="text-base font-bold text-purple-300 mb-1">✍️ Saisie manuelle d'un tirage</h3>
        <p className="text-xs text-gray-400 mb-3">
          Utiliser quand le scraping échoue. Retrouve les numéros sur fdj.fr.
        </p>

        <label className="text-xs text-gray-400 mb-1 block">Date du tirage</label>
        <input
          type="date"
          value={manDate}
          onChange={e => setManDate(e.target.value)}
          className="w-full p-2.5 rounded-lg bg-gray-900 border border-purple-700 text-white text-sm mb-3 focus:border-purple-400 outline-none"
        />

        <label className="text-xs text-gray-400 mb-1 block">5 numéros (1–49)</label>
        <div className="flex gap-2 mb-3">
          {manNums.map((v, i) => (
            <input
              key={i}
              type="number"
              min={1} max={49}
              value={v}
              onChange={e => { const n = [...manNums]; n[i] = e.target.value; setManNums(n) }}
              placeholder={String(i + 1)}
              className="flex-1 min-w-0 p-2 rounded-lg bg-gray-900 border border-purple-700 text-white text-center text-sm focus:border-purple-400 outline-none"
            />
          ))}
        </div>

        <label className="text-xs text-gray-400 mb-1 block">Numéro Chance (1–10)</label>
        <input
          type="number"
          min={1} max={10}
          value={manChance}
          onChange={e => setManChance(e.target.value)}
          placeholder="Chance"
          className="w-full p-2.5 rounded-lg bg-gray-900 border border-purple-700 text-white text-sm mb-3 focus:border-purple-400 outline-none"
        />

        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={manHas2nd}
            onChange={e => setManHas2nd(e.target.checked)}
            className="w-4 h-4 accent-purple-500"
          />
          <span className="text-xs text-gray-400">2nd tirage (optionnel)</span>
        </label>

        {manHas2nd && (
          <>
            <label className="text-xs text-gray-400 mb-1 block">5 numéros 2nd tirage</label>
            <div className="flex gap-2 mb-3">
              {manNums2.map((v, i) => (
                <input
                  key={i}
                  type="number"
                  min={1} max={49}
                  value={v}
                  onChange={e => { const n = [...manNums2]; n[i] = e.target.value; setManNums2(n) }}
                  placeholder={String(i + 1)}
                  className="flex-1 min-w-0 p-2 rounded-lg bg-gray-900 border border-purple-700 text-white text-center text-sm focus:border-purple-400 outline-none"
                />
              ))}
            </div>
          </>
        )}

        <button
          onClick={saisirManuellement}
          disabled={manLoading}
          className="w-full p-3 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-60 text-white font-bold transition"
        >
          {manLoading ? '⏳ Enregistrement...' : '✅ Enregistrer ce tirage'}
        </button>
        {manMsg && (
          <p className={`mt-2 text-sm ${manMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {manMsg.text}
          </p>
        )}
      </Card>

      {/* Enregistrer un paiement */}
      <Card className="border-green-700 bg-green-900/20">
        <h3 className="text-base font-bold text-green-300 mb-1">💸 Enregistrer un paiement</h3>
        <p className="text-xs text-gray-400 mb-3">
          Montant total — les {NB_PARTICIPANTS} virements individuels sont créés automatiquement.
        </p>
        <input
          type="number"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          placeholder="Montant en € (ex: 650)"
          className="w-full p-3 rounded-lg bg-gray-900 border-2 border-green-700 text-white text-lg mb-2 focus:border-green-500 outline-none"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note optionnelle"
          className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm mb-3 focus:border-gray-400 outline-none"
        />
        <button
          onClick={enregistrerPaiement}
          disabled={saving}
          className="w-full p-3 rounded-lg bg-gradient-to-r from-green-700 to-green-600 hover:opacity-90 disabled:opacity-60 text-white font-bold transition"
        >
          {saving ? '⏳ Enregistrement...' : '✅ Enregistrer le paiement'}
        </button>
        {saveMsg && (
          <p className={`mt-2 text-sm ${saveMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{saveMsg.text}</p>
        )}
      </Card>

      {/* Suivi des virements du dernier paiement */}
      <Card>
        <h3 className="text-base font-bold text-green-300 mb-1">✅ Suivi des virements individuels</h3>
        {latestPaiement ? (
          <>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-gray-400">
                Dernier paiement · {Number(latestPaiement.montant_par_personne).toFixed(2)}€/pers.
              </p>
              <p className="text-xs text-gray-500">
                {new Date(latestPaiement.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {PARTICIPANTS.map((nom) => {
                const v = virements[nom]
                const done = v?.effectue ?? false
                return (
                  <label
                    key={nom}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${done ? 'bg-green-900/30 border border-green-700' : 'bg-gray-700/40 border border-gray-600'}`}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => toggleVirement(nom, e.target.checked)}
                      className="w-4 h-4 accent-green-500 cursor-pointer"
                    />
                    <span className={`flex-1 text-sm ${done ? 'text-green-300' : 'text-gray-300'}`}>{nom}</span>
                    <span className={`text-xs ${done ? 'text-green-500' : 'text-gray-500'}`}>
                      {done ? `✅ ${v?.date_virement ?? ''}` : 'En attente'}
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-600">
              <span className="text-sm text-gray-400">{vCount}/{NB_PARTICIPANTS} virements effectués</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 py-2">
            Aucun paiement enregistré — les virements apparaîtront ici après la prochaine distribution.
          </p>
        )}
      </Card>

      {/* Informations système */}
      <Card>
        <h3 className="text-base font-bold text-gray-300 mb-3">ℹ️ Informations système</h3>
        {sysLoading ? (
          <Spinner />
        ) : sysOffline ? (
          <ServerStatus onRetry={loadSysInfo} loading={sysLoading} />
        ) : sysInfo ? (
          <div className="text-sm text-gray-400 space-y-1">
            {sysInfo.split(' | ').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <button
              onClick={loadSysInfo}
              className="mt-3 w-full p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition"
            >
              🔄 Actualiser
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

export function SectionAdmin() {
  const [logged, setLogged] = useState(sessionStorage.getItem('admin_ok') === '1')

  return logged
    ? <AdminPanel onLogout={() => { sessionStorage.removeItem('admin_ok'); setLogged(false) }} />
    : <AdminLogin onLogin={() => setLogged(true)} />
}
