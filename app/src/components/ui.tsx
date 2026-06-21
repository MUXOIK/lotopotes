import React from 'react'

export function Spinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-10 h-10 border-4 border-gray-600 border-t-yellow-400 rounded-full animate-spin" />
    </div>
  )
}

export function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300 text-sm">
      ⚠️ {message}
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-800 rounded-xl border border-gray-700 p-4 ${className}`}>
      {children}
    </div>
  )
}

export function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-800 text-blue-200',
    green: 'bg-green-800 text-green-200',
    yellow: 'bg-yellow-700 text-yellow-100',
    red: 'bg-red-800 text-red-200',
    purple: 'bg-purple-800 text-purple-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  )
}
