import React, { useState, useRef, useEffect } from 'react'
import type { Section } from './lib/types'
import { APP_PASSWORD } from './lib/constants'
import { SectionAccueil } from './sections/SectionAccueil'
import { SectionBilan } from './sections/SectionBilan'
import { SectionHistorique } from './sections/SectionHistorique'
import { SectionPaiements } from './sections/SectionPaiements'
import { SectionProbabilites } from './sections/SectionProbabilites'
import { SectionContrat } from './sections/SectionContrat'
import { SectionAdmin } from './sections/SectionAdmin'

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: 'accueil', label: 'Accueil', icon: '🏠' },
  { id: 'bilan', label: 'Bilan', icon: '📊' },
  { id: 'historique', label: 'Historique', icon: '🏆' },
  { id: 'paiements', label: 'Paiements', icon: '💳' },
  { id: 'probabilites', label: 'Stats', icon: '🎯' },
  { id: 'contrat', label: 'Contrat', icon: '📜' },
  { id: 'admin', label: 'Admin', icon: '🔐' },
]

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
      setTimeout(() => { setErr(''); setShake(false) }, 3000)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 rounded-2xl p-8 border-2 border-yellow-500 max-w-sm w-full text-center ${shake ? 'animate-shake' : ''}`}>
        <div className="text-5xl mb-4">🎲</div>
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
          className="w-full p-3 rounded-xl bg-gray-900 border-2 border-yellow-500 text-white text-center text-lg tracking-widest mb-3 focus:border-yellow-300 outline-none"
        />
        <button
          onClick={check}
          className="w-full p-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-bold text-base hover:opacity-90 active:scale-95 transition"
        >
          🔓 Accéder
        </button>
        {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
      </div>
    </div>
  )
}

function App() {
  const [loggedIn, setLoggedIn] = useState(sessionStorage.getItem('app_ok') === '1')
  const [section, setSection] = useState<Section>('accueil')
  const [showNavArrow, setShowNavArrow] = useState(true)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const onScroll = () => {
      setShowNavArrow(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 5)
    }
    nav.addEventListener('scroll', onScroll, { passive: true })
    return () => nav.removeEventListener('scroll', onScroll)
  }, [])

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-3 py-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 rounded-xl p-5 mb-4 border-2 border-yellow-500 shadow-lg">
          <h1 className="text-2xl font-bold text-yellow-400 leading-tight">🎲 LES POTES MILLIONNAIRES</h1>
          <p className="text-gray-300 text-sm mt-1">Syndicat Loto — Saison 2026-2027</p>
        </div>

        {/* Nav */}
        <div className="relative mb-5">
          <div
            ref={navRef}
            className="flex gap-2 overflow-x-auto pb-1 scroll-smooth"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all
                  ${section === item.id
                    ? 'bg-yellow-400 text-gray-900 shadow-md'
                    : 'bg-gray-700 text-white hover:bg-gray-600 active:scale-95'
                  }`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
          {showNavArrow && (
            <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none flex items-center justify-end pr-1">
              <span className="text-yellow-400 text-lg animate-bounce-x">›</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div>
          {section === 'accueil' && <SectionAccueil />}
          {section === 'bilan' && <SectionBilan />}
          {section === 'historique' && <SectionHistorique />}
          {section === 'paiements' && <SectionPaiements />}
          {section === 'probabilites' && <SectionProbabilites />}
          {section === 'contrat' && <SectionContrat />}
          {section === 'admin' && <SectionAdmin />}
        </div>

      </div>
    </div>
  )
}

export default App
