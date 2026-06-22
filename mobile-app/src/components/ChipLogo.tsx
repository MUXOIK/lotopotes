export function ChipLogo({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="48" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="3"/>
      <circle cx="50" cy="50" r="44" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 6.28"/>
      <circle cx="50" cy="50" r="34" fill="#0f2744" stroke="#f59e0b" strokeWidth="2"/>
      <circle cx="50" cy="50" r="22" fill="#1d4ed8" stroke="#fbbf24" strokeWidth="1.5"/>
      <text x="50" y="56" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="900" textAnchor="middle" fill="#fbbf24" letterSpacing="-1">LP</text>
      <circle cx="50" cy="8"  r="4" fill="#fbbf24"/>
      <circle cx="50" cy="92" r="4" fill="#fbbf24"/>
      <circle cx="8"  cy="50" r="4" fill="#fbbf24"/>
      <circle cx="92" cy="50" r="4" fill="#fbbf24"/>
      <circle cx="21" cy="21" r="3" fill="#fbbf24"/>
      <circle cx="79" cy="21" r="3" fill="#fbbf24"/>
      <circle cx="21" cy="79" r="3" fill="#fbbf24"/>
      <circle cx="79" cy="79" r="3" fill="#fbbf24"/>
    </svg>
  )
}
