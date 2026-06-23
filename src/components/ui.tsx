import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export function Spinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-10 h-10 border-4 border-gray-700 border-t-yellow-400 rounded-full animate-spin" />
    </div>
  )
}

export function LoadingWithHint() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="text-center">
      <Spinner />
      {slow && (
        <p className="text-xs text-amber-400 mt-2 animate-pulse">
          Chargement en cours...
        </p>
      )}
    </div>
  )
}

export function ErrorMsg({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-950/60 border border-red-700/60 rounded-xl p-4 text-sm">
      <p className="text-red-300">⚠️ {message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs text-red-400 underline hover:text-red-300 transition"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-800/80 rounded-xl border border-gray-700/60 p-4 ${className}`}>
      {children}
    </div>
  )
}

export function Badge({ children, color = 'blue' }: { children: ReactNode; color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-900/80 text-blue-300 border border-blue-700/50',
    green:  'bg-green-900/80 text-green-300 border border-green-700/50',
    yellow: 'bg-yellow-900/80 text-yellow-300 border border-yellow-700/50',
    red:    'bg-red-900/80 text-red-300 border border-red-700/50',
    purple: 'bg-purple-900/80 text-purple-300 border border-purple-700/50',
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <Card className="text-center py-12">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-gray-300 font-medium">{title}</p>
      {subtitle && <p className="text-gray-500 text-sm mt-2">{subtitle}</p>}
    </Card>
  )
}
