interface Props {
  num: number
  variant?: 'primary' | 'secondary' | 'chance' | 'hot' | 'cold'
  size?: 'sm' | 'md' | 'lg'
  highlight?: boolean
}

const variantStyles: Record<string, string> = {
  primary: 'bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-yellow-400',
  secondary: 'bg-gradient-to-br from-emerald-500 to-emerald-700 border-2 border-yellow-400',
  chance: 'bg-gradient-to-br from-yellow-500 to-yellow-700 border-2 border-yellow-300',
  hot: 'bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-300',
  cold: 'bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-blue-400',
}

const sizeStyles: Record<string, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

export function Boule({ num, variant = 'primary', size = 'md', highlight = false }: Props) {
  return (
    <div
      className={`
        inline-flex items-center justify-center rounded-full font-bold text-white
        flex-shrink-0 transition-transform animate-pop
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${highlight ? 'ring-4 ring-white ring-opacity-70 scale-110' : ''}
      `}
    >
      {num}
    </div>
  )
}
