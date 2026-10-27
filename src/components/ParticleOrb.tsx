import { useEffect, useMemo, useRef, useState } from 'react'
import './particle-orb.css'

export function ParticleOrb({ progress, state = 'ready', metricLabel = 'task progress', emptyHint = 'Add a task to begin tracking progress.' }: { progress: number; state?: 'ready' | 'empty' | 'loading' | 'error'; metricLabel?: string; emptyHint?: string }) {
  const [particleCount, setParticleCount] = useState(() => getParticleCount())
  const orbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const orb = orbRef.current
    if (!orb || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(([entry]) => {
      orb.classList.toggle('orb-wrap--offscreen', !entry.isIntersecting)
    }, { threshold: 0.05 })
    observer.observe(orb)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 600px)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateParticleCount = () => setParticleCount(getParticleCount())
    compact.addEventListener('change', updateParticleCount)
    reducedMotion.addEventListener('change', updateParticleCount)
    return () => {
      compact.removeEventListener('change', updateParticleCount)
      reducedMotion.removeEventListener('change', updateParticleCount)
    }
  }, [])

  const particles = useMemo(() => Array.from({ length: particleCount }, (_, index) => {
    const angle = (index / particleCount) * Math.PI * 2
    const radius = 43 + ((index * 17) % 13) / 2
    return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, delay: `${(index % 23) * -0.11}s`, size: 1 + (index % 3) * 0.42 }
  }), [particleCount])

  const label = state === 'loading'
    ? `Today’s ${metricLabel} is loading`
    : state === 'error'
      ? `Today’s ${metricLabel} is unavailable because saved data could not be loaded`
      : state === 'empty'
        ? `Today’s ${metricLabel} is zero percent. ${emptyHint}`
        : `Today’s ${metricLabel} ${progress} percent`

  return <div ref={orbRef} className="orb-wrap" role="img" aria-label={label}>
    <div className="orb-aura" />
    <div className="orb-core"><div className="orb-dynamics"><div className="orb-flow flow-a" /><div className="orb-flow flow-b" /><div className="orb-flow flow-c" /><div className="orb-shine" />
      <div className="orb-dots">{particles.map((p, i) => <i key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: p.delay, width: p.size, height: p.size }} />)}</div>
    </div>
    </div>
    <div className="orbit-particles">{particles.slice(0, Math.round(progress * 0.96)).map((p, i) => <i key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: p.delay, width: p.size + 0.2, height: p.size + 0.2 }} />)}</div>
  </div>
}

function getParticleCount() {
  const compact = window.matchMedia('(max-width: 600px)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return compact || reducedMotion ? 8 : 48
}
