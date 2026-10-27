import type { AvatarColor } from '../domain/types'
import './cosmic-avatar.css'

export function CosmicAvatar({ color, className = '' }: { color: AvatarColor; className?: string }) {
  return <span className={`cosmic-avatar-emblem cosmic-avatar-${color} ${className}`} aria-hidden="true">
    <span className="cosmic-avatar-core" />
    <span className="cosmic-avatar-star" />
  </span>
}
