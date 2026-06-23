import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import type { Section } from './lib/types'
import { APP_PASSWORD } from './lib/constants'
import { Spinner } from './components/ui'

const SectionAccueil     = lazy(() => import('./sections/SectionAccueil').then(m => ({ default: m.SectionAccueil })))
const SectionBilan       = lazy(() => import('./sections/SectionBilan').then(m => ({ default: m.SectionBilan })))
const SectionHistorique  = lazy(() => import('./sections/SectionHistorique').then(m => ({ default: m.SectionHistorique })))
const SectionPaiements   = lazy(() => import('./sections/SectionPaiements').then(m => ({ default: m.SectionPaiements })))
const SectionProbabilites= lazy(() => import('./sections/SectionProbabilites').then(m => ({ default: m.SectionProbabilites })))
const SectionContrat     = lazy(() => import('./sections/SectionContrat').then(m => ({ default: m.SectionContrat })))
const SectionAdmin       = lazy(() => import('./sections/SectionAdmin').then(m => ({ default: m.SectionAdmin })))

type NavItem = { id: Section; label: string; icon: string }

const NAV_ITEMS: NavItem[] = [
  { id: 'accueil',      label: 'Accueil',    icon: '🏠' },
  { id: 'bilan',        label: 'Bilan',      icon: '📊' },
  { id: 'historique',   label: 'Historique', icon: '🏆' },
  { id: 'paiements',    label: 'Paiements',  icon: '💳' },
  { id: 'probabilites', label: 'Stats',      icon: '🎯' },
  { id: 'contrat',      label: 'Contrat',    icon: '📜' },
  { id: 'admin',        label: 'Admin',      icon: '🔐' },
]

const BOTTOM_NAV: NavItem[] = NAV_ITEMS.slice(0, 5)
const MORE_NAV: NavItem[]   = NAV_ITEMS.slice(5)

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(false)

  const check = () => {
    if (pwd.trim().toUpperCase().replace(/\s/g, '') === APP_PASSWORD) {
      sessionStorage.setItem('app_ok', '1')
      onLogin()
    } else {
      setErr('Mot de passe incorrect')
      setShake(true)
      setTimeout(() => { setErr(''); setShake(false) }, 2500)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50 p-4">
      <div
        className="bg-gray-800 rounded-2xl p-8 border-2 border-yellow-500 max-w-sm w-full text-center shadow-2xl"
        style={{ animation: shake ? 'shake 0.4s ease-in-out' : 'none' }}
      >
        <div className="text-6xl mb-4">🎲</div>
        <h1 className="text-xl font-bold text-yellow-400 mb-1">LES POTES MILLIONNAIRES</h1>
        <p className="text-gray-400 text-sm mb-6">Syndicat Loto — Saison 2026-2027</p>
        <input
          type="text"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          placeholder="Mot de passe..."
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full p-3 rounded-xl bg-gray-900 border-2 border-yellow-500 text-white text-center text-lg tracking-widest mb-3 focus:border-yellow-300 outline-none transition-colors"
        />
        <button
          onClick={check}
          className="w-full p-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-bold text-base hover:opacity-90 active:scale-95 transition-all"
        >
          🔓 Accéder
        </button>
        {err && <p className="text-red-400 text-sm mt-3 animate-fade-in">{err}</p>}
      </div>
    </div>
  )
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-center text-xs py-2 px-4 font-semibold">
      Hors connexion — les données peuvent être obsolètes
    </div>
  )
}

function MoreMenu({ current, onSelect, onClose }: { current: Section; onSelect: (s: Section) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute bottom-20 right-2 bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden min-w-44"
        onClick={(e) => e.stopPropagation()}
      >
        {MORE_NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => { onSelect(item.id); onClose() }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors
              ${current === item.id ? 'bg-yellow-400 text-gray-900' : 'text-gray-200 hover:bg-gray-700'}`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function App() {
  const [loggedIn, setLoggedIn] = useState(sessionStorage.getItem('app_ok') === '1')
  const [section, setSection]   = useState<Section>('accueil')
  const [showMore, setShowMore] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [section])

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />

  const moreActive = MORE_NAV.some(n => n.id === section)

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <OfflineBanner />

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-3 pt-4 pb-24">

          <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 rounded-2xl p-5 mb-4 border border-yellow-500/50 shadow-lg shadow-blue-950/50">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎲</span>
              <div>
                <h1 className="text-lg font-bold text-yellow-400 leading-tight">LES POTES MILLIONNAIRES</h1>
                <p className="text-blue-300/70 text-xs mt-0.5">Syndicat Loto · Saison 2026-2027</p>
              </div>
            </div>
          </div>

          <Suspense fallback={<Spinner />}>
            {section === 'accueil'      && <SectionAccueil />}
            {section === 'bilan'        && <SectionBilan />}
            {section === 'historique'   && <SectionHistorique />}
            {section === 'paiements'    && <SectionPaiements />}
            {section === 'probabilites' && <SectionProbabilites />}
            {section === 'contrat'      && <SectionContrat />}
            {section === 'admin'        && <SectionAdmin />}
          </Suspense>

        </div>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 safe-area-bottom">
        <div className="max-w-lg mx-auto flex items-stretch">
          {BOTTOM_NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => { setSection(item.id); setShowMore(false) }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-xs font-medium transition-colors min-h-[56px]
                ${section === item.id ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] leading-none mt-1">{item.label}</span>
              {section === item.id && (
                <span className="absolute bottom-1 w-1 h-1 bg-yellow-400 rounded-full" />
              )}
            </button>
          ))}

          <button
            onClick={() => setShowMore((v) => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-xs font-medium transition-colors min-h-[56px]
              ${moreActive || showMore ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-xl leading-none">⋯</span>
            <span className="text-[10px] leading-none mt-1">
              {moreActive ? MORE_NAV.find(n => n.id === section)?.label ?? 'Plus' : 'Plus'}
            </span>
          </button>
        </div>
      </nav>

      {showMore && (
        <MoreMenu
          current={section}
          onSelect={(s) => { setSection(s); setShowMore(false) }}
          onClose={() => setShowMore(false)}
        />
      )}
    </div>
  )
}

export default App
