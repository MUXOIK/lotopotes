import { useEffect, useRef } from 'react'

export function Confetti() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const colors = ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ffffff']
    const pieces: HTMLDivElement[] = []

    for (let i = 0; i < 100; i++) {
      const el = document.createElement('div')
      const size = Math.random() * 10 + 6
      const isCircle = Math.random() > 0.5
      el.style.cssText = `
        position:fixed;
        width:${size}px;height:${size}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${isCircle ? '50%' : '2px'};
        top:-20px;
        left:${Math.random() * 100}vw;
        pointer-events:none;
        z-index:9999;
        animation: confettiFall ${2 + Math.random() * 3}s ease-in ${Math.random() * 1.5}s forwards;
        transform:rotate(${Math.random() * 360}deg);
        --drift:${Math.random() * 100}px;
      `
      container.appendChild(el)
      pieces.push(el)
    }

    const timeout = setTimeout(() => { pieces.forEach((p) => p.remove()) }, 6000)
    return () => {
      clearTimeout(timeout)
      pieces.forEach((p) => p.remove())
    }
  }, [])

  return <div ref={containerRef} />
}
