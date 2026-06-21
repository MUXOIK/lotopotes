import { useState } from 'react'
import { getSyndicatByCode } from '../lib/db'
import { SYNDICAT_STORAGE_KEY } from '../lib/constants'
import type { Syndicat } from '../lib/types'
import { Button } from '../components/ui'

interface Props {
  onCreateNew: () => void
  onJoin: (syndicat: Syndicat) => void
}

export function PageHome({ onCreateNew, onJoin }: Props) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const syndicat = await getSyndicatByCode(code.trim())
      if (!syndicat) {
        setError('Syndicat introuvable. Vérifiez le code (ex: LP-A3K7).')
        return
      }
      localStorage.setItem(SYNDICAT_STORAGE_KEY, syndicat.id)
      onJoin(syndicat)
    } catch {
      setError('Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="text-7xl mb-4">🎲</div>
          <h1 className="text-3xl font-bold text-yellow-400 mb-1">LotoPotes</h1>
          <p className="text-gray-400 text-sm">Gérez votre syndicat Loto entre amis</p>
        </div>

        {/* Créer */}
        <div className="space-y-3">
          <Button onClick={onCreateNew}>
            🎰 Créer un nouveau syndicat
          </Button>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-gray-700" />
            <span className="px-3 text-xs text-gray-500">ou</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          {/* Rejoindre */}
          <div className="space-y-2">
            <p className="text-sm text-gray-400 text-center">Rejoindre avec un code syndicat</p>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="LP-A3K7"
              maxLength={7}
              className="w-full p-3 rounded-xl bg-gray-900 border-2 border-gray-600 text-white text-center text-2xl font-bold tracking-widest focus:border-yellow-400 outline-none transition-colors uppercase"
            />
            <Button variant="secondary" onClick={handleJoin} disabled={loading || !code.trim()}>
              {loading ? '⏳ Recherche...' : '→ Accéder'}
            </Button>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center animate-fade-in">{error}</p>
          )}
        </div>

        <p className="text-center text-xs text-gray-600">
          Le code syndicat est fourni par votre trésorier
        </p>
      </div>
    </div>
  )
}
