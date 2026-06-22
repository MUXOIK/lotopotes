import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import type { Syndicat, Page } from './lib/types'
import { SYNDICAT_STORAGE_KEY } from './lib/constants'
import { getSyndicatById } from './lib/db'
import { Spinner } from './components/ui'
import { ChipLogo } from './components/ChipLogo'
import { PageHome } from './pages/PageHome'
import { PageOnboarding } from './pages/PageOnboarding'

const PageDashboard    = lazy(() => import('./pages/PageDashboard').then(m => ({ default: m.PageDashboard })))
const PageBilan        = lazy(() => import('./pages/PageBilan').then(m => ({ default: m.PageBilan })))
const PageHistorique   = lazy(() => import('./pages/PageHistorique').then(m => ({ default: m.PageHistorique })))
const PagePaiements    = lazy(() => import('./pages/PagePaiements').then(m => ({ default: m.PagePaiements })))
const PageProbabilites = lazy(() => import('./pages/PageProbabilites').then(m => ({ default: m.PageProbabilites })))
const PageContrat      = lazy(() => import('./pages/PageContrat').then(m => ({ default: m.PageContrat })))

type NavItem = { id: Page; label: string; icon: string }

const NAV_MAIN: NavItem[] = [
  { id: 'dashboard',    label: 'Accueil',    icon: '🏠' },
  { id: 'bilan',        label: 'Bilan',      icon: '📊' },
  { id: 'historique',   label: 'Historique', icon: '🏆' },
  { id: 'paiements',    label: 'Paiements',  icon: '💳' },
]
const NAV_MORE: NavItem[] = [
  { id: 'probabilites', label: 'Stats',    icon: '🎯' },
  { id: 'contrat',      label: 'Contrat',  icon: '📜' },
]

function AdminUnlock({ onUnlock, onCancel, password }: { onUnlock: () => void; onCancel: () => void; password: string }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(false)

  const check = () => {
    if (pwd.trim().toUpperCase() === password.toUpperCase()) {
      onUnlock()
    } else {
      setErr('Mot de passe incorrect')
      setShake(true)
      setTimeout(() => { setErr(''); setShake(false) }, 2500)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className={`bg-gray-800 rounded-2xl p-6 border-2 border-yellow-500 max-w-xs w-full text-center ${shake ? 'animate-shake' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-4xl mb-3">🔐</div>
        <h3 className="text-base font-bold text-yellow-400 mb-1">Accès trésorier</h3>
        <p className="text-xs text-gray-400 mb-4">Entrez le mot de passe administrateur</p>
        <input
          type="text"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="Mot de passe..."
          autoFocus
          autoCapitalize="none"
          className="w-full p-3 rounded-xl bg-gray-900 border-2 border-yellow-500 text-white text-center font-bold tracking-widest mb-3 focus:border-yellow-300 outline-none transition-colors"
        />
        <button
          onClick={check}
          className="w-full p-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          Accéder
        </button>
        {err && <p className="text-red-400 text-xs mt-2 animate-fade-in">{err}</p>}
      </div>
    </div>
  )
}

function SyndicatApp({ syndicat, onLeave }: { syndicat: Syndicat; onLeave: () => void }) {
  const [page, setPage] = useState<Page>('dashboard')
  const [showMore, setShowMore] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminUnlock, setShowAdminUnlock] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const moreActive = NAV_MORE.some(n => n.id === page)

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Scrollable content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-3 pt-4 pb-24">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 rounded-2xl p-4 mb-4 border border-yellow-500/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChipLogo size={40} />
                <div>
                  <h1 className="text-base font-bold text-yellow-400 leading-tight">{syndicat.nom.toUpperCase()}</h1>
                  <p className="text-blue-300/70 text-xs mt-0.5">Code : <strong className="text-yellow-300">{syndicat.code}</strong></p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {isAdmin ? (
                  <span className="text-xs bg-yellow-800/60 text-yellow-300 px-2 py-0.5 rounded">Trésorier</span>
                ) : (
                  <button
                    onClick={() => setShowAdminUnlock(true)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    🔐
                  </button>
                )}
                <button
                  onClick={() => { localStorage.removeItem(SYNDICAT_STORAGE_KEY); onLeave() }}
                  className="text-xs text-gray-600 hover:text-gray-400 transition"
                >
                  Quitter
                </button>
              </div>
            </div>
          </div>

          {/* Page content */}
          <Suspense fallback={<Spinner />}>
            {page === 'dashboard'    && <PageDashboard syndicat={syndicat} />}
            {page === 'bilan'        && <PageBilan syndicat={syndicat} />}
            {page === 'historique'   && <PageHistorique syndicat={syndicat} />}
            {page === 'paiements'    && <PagePaiements syndicat={syndicat} isAdmin={isAdmin} />}
            {page === 'probabilites' && <PageProbabilites syndicat={syndicat} />}
            {page === 'contrat'      && <PageContrat syndicat={syndicat} />}
          </Suspense>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50">
        <div className="max-w-lg mx-auto flex items-stretch">
          {NAV_MAIN.map(item => (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setShowMore(false) }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-xs font-medium transition-colors min-h-[56px]
                ${page === item.id ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] leading-none mt-1">{item.label}</span>
              {page === item.id && <span className="absolute bottom-1 w-1 h-1 bg-yellow-400 rounded-full" />}
            </button>
          ))}
          <button
            onClick={() => setShowMore(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-xs font-medium transition-colors min-h-[56px]
              ${moreActive || showMore ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="text-xl leading-none">⋯</span>
            <span className="text-[10px] leading-none mt-1">
              {moreActive ? NAV_MORE.find(n => n.id === page)?.label ?? 'Plus' : 'Plus'}
            </span>
          </button>
        </div>
      </nav>

      {showMore && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-20 right-2 bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden min-w-44"
            onClick={e => e.stopPropagation()}
          >
            {NAV_MORE.map(item => (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setShowMore(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors
                  ${page === item.id ? 'bg-yellow-400 text-gray-900' : 'text-gray-200 hover:bg-gray-700'}`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdminUnlock && (
        <AdminUnlock
          password={syndicat.admin_password}
          onUnlock={() => { setIsAdmin(true); setShowAdminUnlock(false) }}
          onCancel={() => setShowAdminUnlock(false)}
        />
      )}
    </div>
  )
}

function AppLoader({ onLoaded }: { onLoaded: (s: Syndicat | null) => void }) {
  useEffect(() => {
    const id = localStorage.getItem(SYNDICAT_STORAGE_KEY)
    if (!id) { onLoaded(null); return }
    getSyndicatById(id)
      .then(s => onLoaded(s))
      .catch(() => onLoaded(null))
  }, [onLoaded])
  return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Spinner /></div>
}

type AppState =
  | { screen: 'loading' }
  | { screen: 'home' }
  | { screen: 'onboarding' }
  | { screen: 'syndicat'; syndicat: Syndicat }

export default function App() {
  const [state, setState] = useState<AppState>({ screen: 'loading' })

  const handleLoaded = (syndicat: Syndicat | null) => {
    setState(syndicat ? { screen: 'syndicat', syndicat } : { screen: 'home' })
  }

  const handleCreated = async (id: string, _code: string) => {
    localStorage.setItem(SYNDICAT_STORAGE_KEY, id)
    const s = await getSyndicatById(id)
    if (s) setState({ screen: 'syndicat', syndicat: s })
  }

  if (state.screen === 'loading') return <AppLoader onLoaded={handleLoaded} />
  if (state.screen === 'home') return (
    <PageHome
      onCreateNew={() => setState({ screen: 'onboarding' })}
      onJoin={syndicat => setState({ screen: 'syndicat', syndicat })}
    />
  )
  if (state.screen === 'onboarding') return (
    <PageOnboarding
      onComplete={handleCreated}
      onCancel={() => setState({ screen: 'home' })}
    />
  )
  return <SyndicatApp syndicat={state.syndicat} onLeave={() => setState({ screen: 'home' })} />
}
