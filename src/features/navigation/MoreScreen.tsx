import { ArrowRight, Bell, ChartNoAxesColumnIncreasing, HeartPulse, Moon, Settings2, UserRound } from 'lucide-react'
import type { AvatarColor } from '../../domain/types'
import { CosmicAvatar } from '../../components/CosmicAvatar'
import { CosmicFlameMark } from '../../components/CosmicFlameMark'
import './more-screen.css'

const destinations = [
  { label: 'Sleep', description: 'Rest and weekly patterns', icon: Moon, group: 'Wellbeing' },
  { label: 'Health', description: 'Water and movement', icon: HeartPulse, group: 'Wellbeing' },
  { label: 'Insights', description: 'Your progress over time', icon: ChartNoAxesColumnIncreasing, group: 'Reflection' },
  { label: 'Streak', description: 'Qualifying days and milestones', icon: CosmicFlameMark, group: 'Reflection' },
  { label: 'Notifications', description: 'Reminders and preferences', icon: Bell, group: 'Preferences' },
] as const

export function MoreScreen({ onNavigate, displayName, email, avatarColor, streakDays = 0, streakMilestoneAnimation = false }: { onNavigate: (destination: string) => void; displayName?: string; email?: string | null; avatarColor: AvatarColor; streakDays?: number; streakMilestoneAnimation?: boolean }) {
  const groups = ['Wellbeing', 'Reflection', 'Preferences'] as const
  return <section className="more-screen" aria-labelledby="more-title">
    <header className="more-screen-heading">
      <span className="section-kicker">YOUR SPACE</span>
      <h1 id="more-title">A little more</h1>
      <p>Everything you need, gathered in one place.</p>
    </header>
    <button type="button" className="more-account-card" onClick={() => onNavigate('Profile')} aria-label="Open profile and settings">
      <CosmicAvatar color={avatarColor} className="more-account-avatar" />
      <span className="more-account-copy"><strong>{displayName?.trim() || 'Your Lumi profile'}</strong><small>{email || 'Your goals, preferences and saved data'}</small></span>
      <span className="more-account-action"><Settings2 size={17} /><span>Profile &amp; settings</span><ArrowRight size={16} /></span>
    </button>
    {groups.map((group) => <section className="more-group" key={group} aria-labelledby={`more-${group.toLowerCase()}`}>
      <h2 id={`more-${group.toLowerCase()}`}>{group}</h2>
      <div className="more-destinations">
        {destinations.filter((item) => item.group === group).map(({ label, description, icon: Icon }) => <button
          key={label}
          type="button"
          className="more-destination"
          onClick={() => onNavigate(label)}
          aria-label={`Open ${label}: ${description}`}
        >
          <span className="more-destination-icon">{label === 'Streak' ? <CosmicFlameMark days={streakDays} size={26} animate={streakMilestoneAnimation} /> : <Icon size={20} strokeWidth={1.8} />}</span>
          <span className="more-destination-copy"><strong>{label}</strong><small>{description}</small></span>
          <ArrowRight className="more-destination-arrow" size={16} aria-hidden="true" />
        </button>)}
        {group === 'Preferences' && <button type="button" className="more-destination" onClick={() => onNavigate('Profile')} aria-label="Open profile and Lumi settings">
          <span className="more-destination-icon"><UserRound size={20} strokeWidth={1.8} /></span>
          <span className="more-destination-copy"><strong>Profile &amp; settings</strong><small>Personal details, goals and backups</small></span>
          <ArrowRight className="more-destination-arrow" size={16} aria-hidden="true" />
        </button>}
      </div>
    </section>)}
  </section>
}

