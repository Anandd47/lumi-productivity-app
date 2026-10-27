import { useId } from 'react'
import './cosmic-flame-mark.css'

type CosmicFlameMarkProps = { days?: number; size?: number; strokeWidth?: number; animate?: boolean; className?: string }

export function CosmicFlameMark({ days = 0, size = 26, animate = false, className = '' }: CosmicFlameMarkProps) {
  const id = `cosmicFlame-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const outerGradient = `${id}-outer`
  const innerGradient = `${id}-inner`
  const coreGradient = `${id}-core`
  const milestone = days >= 100 ? 'century' : days >= 30 ? 'month' : days >= 7 ? 'week' : days > 0 ? 'active' : 'resting'

  return <svg
    className={`cosmic-flame-mark ${className} ${animate ? 'cosmic-flame-mark--celebrate' : ''}`.trim()}
    data-milestone={milestone}
    width={size}
    height={size}
    viewBox="0 0 40 48"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient id={outerGradient} x1="8" y1="43" x2="32" y2="4" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ff512f" />
        <stop offset=".55" stopColor="#ff8b38" />
        <stop offset="1" stopColor="#ffd06a" />
      </linearGradient>
      <linearGradient id={innerGradient} x1="12" y1="38" x2="29" y2="13" gradientUnits="userSpaceOnUse">
        <stop stopColor="#566bff" />
        <stop offset=".48" stopColor="#9d5dff" />
        <stop offset="1" stopColor="#fa77c8" />
      </linearGradient>
      <radialGradient id={coreGradient} cx="50%" cy="35%" r="65%">
        <stop stopColor="#fff8d6" />
        <stop offset=".48" stopColor="#ffd19a" />
        <stop offset="1" stopColor="#ff9b59" />
      </radialGradient>
    </defs>
    {milestone === 'century' && <circle className="cosmic-flame-aura" cx="20" cy="26" r="18" />}
    <path className="cosmic-flame-outer" d="M20 45c-8.2 0-14-5.4-14-13.3 0-6.1 3.6-10.3 7.6-14.8 2.8-3.1 5.2-6.5 6.1-12.2 5.3 4.7 6.8 9.4 6.1 14.2 2.7-1.5 4.6-4.4 5-7.8 5.5 6.1 8.1 12.4 8.1 19.5C38.9 39.1 31.5 45 20 45Z" fill={`url(#${outerGradient})`} />
    {milestone === 'month' && <path className="cosmic-flame-layer" d="M20 45c-8.4 0-14-5.4-14-13.2 0-5.3 3-9.8 7.3-14.5-.1 4.4 1.2 6.4 2.5 7.4C16 17 20.7 9.2 27 4c-.5 7.6 1.5 11.2 4.2 15 2.6 3.6 4.8 7 4.8 12C36 39.6 29.5 45 20 45Z" fill={`url(#${innerGradient})`} />}
    <path className="cosmic-flame-inner" d="M20.3 40.5c-4.8 0-8.2-3.2-8.2-7.8 0-3.4 1.9-5.9 4.5-8.8 1.2-1.4 2.5-3.2 3.2-5.3 2.8 2.8 3.7 5.6 3.2 8.3 1.4-.8 2.4-2.2 2.8-3.9 2.2 3.1 3.1 5.8 3.1 8.8 0 5.4-3.5 8.7-8.6 8.7Z" fill={`url(#${innerGradient})`} />
    <path className="cosmic-flame-core" d="M20.2 38.2c-2.4 0-4.1-1.7-4.1-4.1 0-1.9 1.3-3.4 2.5-4.9.7-.8 1.3-1.8 1.6-3 1.6 1.6 2.1 3.2 1.7 4.7.9-.5 1.4-1.3 1.6-2.3 1.3 1.7 1.8 3.2 1.8 4.9 0 2.9-2 4.7-5.1 4.7Z" fill={`url(#${coreGradient})`} />
    <path className="cosmic-flame-glint" d="m29.7 7.2.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill="#fff4d9" />
  </svg>
}
