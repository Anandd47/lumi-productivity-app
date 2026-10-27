import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  Activity, AlarmClock, Apple, Armchair, BookOpen, Brain, BriefcaseBusiness, CalendarDays,
  Carrot, Check, Circle, Clock3, CodeXml, CreditCard, Droplets, Dumbbell, FileText, Footprints,
  Gamepad2, GraduationCap, Headphones, HeartPulse, House, Laptop, Library, ListTodo,
  Moon, Music2, NotebookPen, Piano, Presentation, Salad, ShoppingBag, ShoppingCart,
  Sparkles, SprayCan, StickyNote, Target, Terminal, UsersRound, Wallet, type LucideIcon,
} from 'lucide-react'
import './activity-icon-picker.css'

export type ActivityIconOption = { value: string; label: string; category: string; Icon?: LucideIcon; glyph?: string }

export const TASK_ICON_OPTIONS: ActivityIconOption[] = [
  { value: 'book-open', label: 'Book', category: 'Study', Icon: BookOpen },
  { value: 'library', label: 'Books', category: 'Study', Icon: Library },
  { value: 'graduation-cap', label: 'Graduation cap', category: 'Study', Icon: GraduationCap },
  { value: 'laptop', label: 'Laptop', category: 'Coding', Icon: Laptop },
  { value: 'terminal', label: 'Terminal', category: 'Coding', Icon: Terminal },
  { value: 'code', label: 'Code', category: 'Coding', Icon: CodeXml },
  { value: 'briefcase', label: 'Briefcase', category: 'Work', Icon: BriefcaseBusiness },
  { value: 'meeting', label: 'Meeting', category: 'Work', Icon: UsersRound },
  { value: 'presentation', label: 'Presentation', category: 'Work', Icon: Presentation },
  { value: 'dumbbell', label: 'Dumbbell', category: 'Fitness', Icon: Dumbbell },
  { value: 'running', label: 'Running', category: 'Fitness', Icon: Activity },
  { value: 'walking', label: 'Walking', category: 'Fitness', Icon: Footprints },
  { value: 'shopping-cart', label: 'Shopping cart', category: 'Shopping', Icon: ShoppingCart },
  { value: 'groceries', label: 'Groceries', category: 'Shopping', Icon: Carrot },
  { value: 'shopping-bag', label: 'Shopping bag', category: 'Shopping', Icon: ShoppingBag },
  { value: 'house', label: 'Home', category: 'Home', Icon: House },
  { value: 'cleaning', label: 'Cleaning', category: 'Home', Icon: Sparkles },
  { value: 'chores', label: 'Chores', category: 'Home', Icon: Armchair },
  { value: 'wallet', label: 'Wallet', category: 'Finance', Icon: Wallet },
  { value: 'payments', label: 'Payments', category: 'Finance', Icon: CreditCard },
  { value: 'savings', label: 'Savings', category: 'Finance', Icon: Circle },
  { value: 'gamepad', label: 'Gaming', category: 'Gaming', Icon: Gamepad2 },
  { value: 'piano', label: 'Piano', category: 'Music', Icon: Piano },
  { value: 'headphones', label: 'Headphones', category: 'Music', Icon: Headphones },
  { value: 'music', label: 'Music', category: 'Music', Icon: Music2 },
  { value: 'notebook', label: 'Notebook', category: 'Writing', Icon: NotebookPen },
  { value: 'notes', label: 'Notes', category: 'Writing', Icon: StickyNote },
  { value: 'documents', label: 'Documents', category: 'Writing', Icon: FileText },
  { value: 'calendar', label: 'Calendar', category: 'Planning', Icon: CalendarDays },
  { value: 'clock', label: 'Clock', category: 'Planning', Icon: Clock3 },
  { value: 'reminders', label: 'Reminders', category: 'Planning', Icon: AlarmClock },
  { value: 'target', label: 'Target', category: 'Goals', Icon: Target },
  { value: 'focus', label: 'Focus', category: 'Goals', Icon: ListTodo },
  { value: 'task', label: 'Task', category: 'Goals', Icon: Check },
]

export const HABIT_ICON_OPTIONS: ActivityIconOption[] = [
  ...TASK_ICON_OPTIONS,
  { value: 'water', label: 'Water', category: 'Wellness', Icon: Droplets },
  { value: 'nutrition', label: 'Nutrition', category: 'Wellness', Icon: Apple },
  { value: 'food', label: 'Food', category: 'Wellness', Icon: Salad },
  { value: 'sleep', label: 'Sleep', category: 'Wellness', Icon: Moon },
  { value: 'meditation', label: 'Meditation', category: 'Wellness', Icon: Brain },
  { value: 'health', label: 'Health', category: 'Wellness', Icon: HeartPulse },
  { value: 'self-care', label: 'Self-care', category: 'Wellness', Icon: HeartPulse },
  { value: 'hobby', label: 'Hobby', category: 'Wellness', Icon: Sparkles },
  { value: 'cleaning-spray', label: 'Household cleaning', category: 'Wellness', Icon: SprayCan },
  { value: '✦', label: 'Classic star', category: 'Classic', glyph: '✦' },
  { value: '📖', label: 'Classic book', category: 'Classic', glyph: '📖' },
  { value: '💧', label: 'Classic water', category: 'Classic', glyph: '💧' },
  { value: '🧘', label: 'Classic meditation', category: 'Classic', glyph: '🧘' },
  { value: '🚶', label: 'Classic walking', category: 'Classic', glyph: '🚶' },
  { value: '✍️', label: 'Classic writing', category: 'Classic', glyph: '✍️' },
  { value: '🌙', label: 'Classic sleep', category: 'Classic', glyph: '🌙' },
  { value: '💪', label: 'Classic strength', category: 'Classic', glyph: '💪' },
]

export function ActivityIcon({ value, size = 18, className }: { value?: string | null; size?: number; className?: string }) {
  if (!value) return null
  const option = [...TASK_ICON_OPTIONS, ...HABIT_ICON_OPTIONS].find((item) => item.value === value)
  if (option?.Icon) return <option.Icon size={size} strokeWidth={1.8} className={className} aria-hidden="true" />
  if (option?.glyph) return <span className={className} aria-hidden="true">{option.glyph}</span>
  // Preserve icon strings already stored by earlier Lumi versions.
  return <span className={className} aria-hidden="true">{value}</span>
}

export function ActivityIconPicker({ value, onChange, options, label, noneLabel = 'None', disabled = false }: {
  value: string
  onChange: (value: string) => void
  options: ActivityIconOption[]
  label: string
  noneLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  const categories = [...new Set(options.map((option) => option.category))]
  const [category, setCategory] = useState(selected?.category ?? categories[0] ?? '')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div className="activity-icon-picker" ref={rootRef} onKeyDown={handleKeyDown}>
    <span className="activity-icon-picker-label">{label}</span>
    <button ref={triggerRef} type="button" className="activity-icon-trigger" aria-label={`${open ? 'Close' : 'Choose'} ${label.toLowerCase()}`} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)}>
      <span className="activity-icon-trigger-preview">{selected ? <ActivityIcon value={selected.value} size={18} /> : <Circle size={18} aria-hidden="true" />}</span>
      <span>{selected?.label ?? (value ? 'Saved icon' : noneLabel)}</span>
      <span className="activity-icon-trigger-action">{open ? 'Close' : 'Choose'}</span>
    </button>
    {open && <div className="activity-icon-popover" role="dialog" aria-label={`${label} icon picker`}>
      <div className="activity-icon-categories" role="group" aria-label="Icon categories">{categories.map((item) => <button key={item} type="button" disabled={disabled} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="activity-icon-grid" role="group" aria-label={`${category} icons`}>
        {options.filter((option) => option.category === category).map((option) => <button key={option.value} type="button" disabled={disabled} className={value === option.value ? 'selected' : ''} aria-label={option.label} title={option.label} aria-pressed={value === option.value} onClick={() => choose(option.value)}><ActivityIcon value={option.value} size={20} /></button>)}
        <button type="button" disabled={disabled} className={`activity-icon-none ${value === '' ? 'selected' : ''}`} aria-label={noneLabel} title={noneLabel} aria-pressed={value === ''} onClick={() => choose('')}><Circle size={18} aria-hidden="true" /><span>{noneLabel}</span></button>
      </div>
      <p className="activity-icon-hint">Choose an icon or select {noneLabel.toLowerCase()}.</p>
    </div>}
  </div>
}
