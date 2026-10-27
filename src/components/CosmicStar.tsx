import { useState } from 'react'
import './cosmic-star.css'

const encouragements = [
  'One small step still counts.',
  'You’re finding your rhythm.',
  'Keep going at your own pace.',
  'A little progress is stardust.',
]

export function CosmicStar() {
  const [interaction, setInteraction] = useState(0)
  const message = interaction === 0 ? 'Tap for a little encouragement.' : encouragements[(interaction - 1) % encouragements.length]

  return <div className="cosmic-star-companion">
    <button
      className="cosmic-star-button"
      type="button"
      aria-label="Cosmic star companion. Tap for encouragement."
      aria-describedby="cosmic-star-message"
      title="Tap for a little encouragement"
      onClick={() => setInteraction((count) => count + 1)}
    >
      <svg key={interaction} className={`cosmic-star-svg ${interaction ? 'is-reacting' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <radialGradient id="cosmicStarFill" cx="35%" cy="27%" r="75%">
            <stop stopColor="#fff2c4" />
            <stop offset=".33" stopColor="#ffb16c" />
            <stop offset=".68" stopColor="#c281ff" />
            <stop offset="1" stopColor="#589ff2" />
          </radialGradient>
          <linearGradient id="cosmicStarEdge" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ffd27a" />
            <stop offset=".55" stopColor="#ff8d70" />
            <stop offset="1" stopColor="#7e9dff" />
          </linearGradient>
        </defs>
        <path d="M32 4.8 38.7 23l19.1.8-15 11.8 5.2 18.5L32 43.4 16 54.1l5.2-18.5-15-11.8 19.1-.8L32 4.8Z" fill="url(#cosmicStarFill)" stroke="url(#cosmicStarEdge)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M19 26c3.4-5.5 9.1-8.2 15.4-8.1" fill="none" stroke="#fff4df" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
        <circle cx="26" cy="31" r="1.7" fill="#312847" />
        <circle cx="38" cy="31" r="1.7" fill="#312847" />
        <path d="M28 36c2.4 2.4 5.6 2.4 8 0" fill="none" stroke="#44304b" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m48 11 1.1 3.3 3.3 1.1-3.3 1.1-1.1 3.3-1.1-3.3-3.3-1.1 3.3-1.1L48 11Z" fill="#fff1b7" />
      </svg>
    </button>
    <span id="cosmic-star-message" className="cosmic-star-message" aria-live="polite">{message}</span>
  </div>
}
