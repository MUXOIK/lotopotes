import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTest } from '../lib/api'
import { PARTICIPANTS, ADMIN_PASSWORD, NB_PARTICIPANTS } from '../lib/constants'
import type { Virement } from '../lib/types'
import { Spinner, Card } from '../components/ui'

// Admin writes go through the Edge Function — never the anon client
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

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [montant, setMontant] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [virements, setVirements] = useState<Record<string, string>>({})
  const [sysInfo, setSysInfo] = useState<string | null>(null)
  const [scrapingResult, setScrapingResult] = useState<string | null>(null)
  const [scrapingLoading, setScrapingLoading] = useState(false)

  useEffect(() => {
    // Reads still use the anon client (SELECT policy remains open)
    supabase.from('virements').select('*').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((v: Virement) => {
          if (v.effectue) map[v.participant_nom] = v.date_virement ?? ''
        })
        setVirements(map)
      }
    })
    loadSysInfo()
  }, [])

  const loadSysInfo = async () => {
    try {
      const data = await fetchTest()
      setSysInfo(
        `Serveur: ${data.ok ? '✅ En ligne' : '❌ Hors ligne'} | Tirages: ${data.allGains} | Cagnotte: ${data.cagnotte}€`
      )
    } catch {
      setSysInfo('❌ Impossible de contacter le serveur')
    }
  }

  const forceScraping = async () => {
    setScrapingLoading(true)
    setScrapingResult(null)
    try {
      const data = await fetchTest()
      setScrapingResult(
        data.ok
          ? `✅ Serveur OK — ${data.allGains} tirages en mémoire, cagnotte ${data.cagnotte}€`
          : '❌ Serveur indisponible'
      )
    } catch {
      setScrapingResult('❌ Erreur de connexion au serveur')
    } finally {
      setScrapingLoading(false)
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
      })
      setSaveMsg({ ok: true, text: `✅ ${val.toFixed(2)}€ enregistré (${(val / NB_PARTICIPANTS).toFixed(2)}€/pers.)` })
      setMontant('')
      setNote('')
    } catch (e) {
      setSaveMsg({ ok: false, text: `❌ ${(e as Error).message}` })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 4000)
    }
  }

  const toggleVirement = async (nom: string, checked: boolean) => {
    const today = new Date().toISOString().split('T')[0]
    try {
      await adminFetch('upsert_virement', {
        participant_nom: nom,
        effectue: checked,
        date_virement: checked ? today : null,
      })
      setVirements((prev) => {
        const next = { ...prev }
        if (checked) next[nom] = today
        else delete next[nom]
        return next
      })
    } catch (e) {
      console.error('Erreur virement:', (e as Error).message)
    }
  }

  const resetVirements = async () => {
    if (!confirm('Réinitialiser tous les virements ?')) return
    try {
      await adminFetch('reset_virements')
      setVirements({})
    } catch (e) {
      console.error('Erreur reset:', (e as Error).message)
    }
  }

  const vCount = Object.keys(virements).length

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
        <button
          onClick={forceScraping}
          disabled={scrapingLoading}
          className="w-full p-3 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold transition"
        >
          {scrapingLoading ? '⏳ En cours...' : '🔄 Vérifier le serveur'}
        </button>
        {scrapingResult && (
          <p className={`mt-2 text-sm ${scrapingResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
            {scrapingResult}
          </p>
        )}
      </Card>

      {/* Enregistrer un paiement */}
      <Card className="border-green-700 bg-green-900/20">
        <h3 className="text-base font-bold text-green-300 mb-1">💸 Enregistrer un paiement</h3>
        <p className="text-xs text-gray-400 mb-3">Montant total distribué au syndicat.</p>
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

      {/* Suivi des virements */}
      <Card>
        <h3 className="text-base font-bold text-green-300 mb-1">✅ Suivi des virements individuels</h3>
        <p className="text-xs text-gray-400 mb-3">Cochez quand le virement a été effectué.</p>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {PARTICIPANTS.map((nom) => {
            const done = !!virements[nom]
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
                  {done ? `✅ ${virements[nom]}` : 'En attente'}
                </span>
              </label>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-600 flex justify-between items-center">
          <span className="text-sm text-gray-400">{vCount}/{NB_PARTICIPANTS} virements effectués</span>
          <button
            onClick={resetVirements}
            className="px-3 py-1.5 text-xs border border-red-600 text-red-400 rounded-lg hover:bg-red-900/30 transition"
          >
            Réinitialiser
          </button>
        </div>
      </Card>

      {/* Informations système */}
      <Card>
        <h3 className="text-base font-bold text-gray-300 mb-3">ℹ️ Informations système</h3>
        {sysInfo ? (
          <div className="text-sm text-gray-400 space-y-1">
            {sysInfo.split(' | ').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <button onClick={loadSysInfo} className="mt-2 text-xs text-blue-400 hover:underline">Actualiser</button>
          </div>
        ) : (
          <Spinner />
        )}
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
