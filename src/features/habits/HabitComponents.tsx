import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Habit, HabitKind, ISODate } from '../../domain/types'
import { formatISODate } from '../../domain/date'
import { ActivityIcon, ActivityIconPicker, HABIT_ICON_OPTIONS } from '../../components/ActivityIconPicker'

export function HabitRows({
  habits,
  date,
  completedIds,
  editable = false,
  disabled = false,
  onToggle,
  onEdit,
  onDelete,
}: {
  habits: Habit[]
  date: ISODate
  completedIds: string[]
  editable?: boolean
  disabled?: boolean
  onToggle: (habit: Habit, completed: boolean) => void
  onEdit?: (habit: Habit) => void
  onDelete?: (habit: Habit) => void
}) {
  const sortedHabits = [...habits].sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'core' ? -1 : 1)
  return <div className="habit-list">
    {sortedHabits.map((habit) => {
      const checked = completedIds.includes(habit.id)
      const activeOnDate = habit.createdAt <= date && (!habit.archivedAt || date < habit.archivedAt)
      return <article className={`habit-row ${checked ? 'is-done' : ''} ${!activeOnDate ? 'is-inactive' : ''}`} key={habit.id}>
        <label className="habit-check" title={activeOnDate ? `Mark ${habit.name} complete for ${formatISODate(date)}` : `${habit.name} was not active on ${formatISODate(date)}`}>
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled || !activeOnDate}
            onChange={(event) => onToggle(habit, event.target.checked)}
            aria-label={`${checked ? 'Mark incomplete' : 'Mark complete'}: ${habit.name} for ${formatISODate(date)}`}
          />
          <span className="habit-check-visual" aria-hidden="true"><Check size={15} /></span>
        </label>
        <span className={`habit-icon icon-${habit.color}`} aria-hidden="true"><ActivityIcon value={habit.icon} size={17} /></span>
        <div className="habit-copy">
          <strong className="habit-name">{habit.name}</strong>
          <span className="habit-meta">
            <span className={`habit-kind kind-${habit.kind}`}>{habit.kind === 'core' ? 'Core' : 'Optional'}</span>
            <span>{habit.targetPerWeek}× / week</span>
            {!activeOnDate && <span className="inactive-note">Not active that day</span>}
          </span>
        </div>
        {editable && <div className="habit-actions">
          <button type="button" className="habit-action" aria-label={`Edit ${habit.name}`} disabled={disabled} onClick={() => onEdit?.(habit)}><Pencil size={15} /></button>
          <button type="button" className="habit-action delete-action" aria-label={`Delete ${habit.name}`} disabled={disabled} onClick={() => onDelete?.(habit)}><Trash2 size={15} /></button>
        </div>}
      </article>
    })}
  </div>
}

export function HabitEditor({
  habit,
  disabled,
  onSave,
  onCancel,
}: {
  habit: Habit | null
  disabled: boolean
  onSave: (input: { name: string; kind: HabitKind; icon: string; color: Habit['color']; targetPerWeek: number }) => Promise<boolean>
  onCancel: () => void
}) {
  const [name, setName] = useState(habit?.name ?? '')
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? 'core')
  const [icon, setIcon] = useState(habit?.icon ?? '✦')
  const [color, setColor] = useState<Habit['color']>(habit?.color ?? 'orange')
  const [target, setTarget] = useState(habit?.targetPerWeek ?? 5)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await onSave({ name, kind, icon, color, targetPerWeek: target })) onCancel()
  }

  return <form className="habit-editor" onSubmit={submit} aria-label={habit ? 'Edit habit' : 'Add a habit'}>
    <div className="editor-heading">
      <h3>{habit ? 'Edit habit' : 'Create a habit'}</h3>
      <button type="button" className="habit-action" aria-label="Close habit form" disabled={disabled} onClick={onCancel}><X size={17} /></button>
    </div>
    <label className="field-label" htmlFor="habit-name">Habit name</label>
    <input id="habit-name" className="habit-text-input" type="text" value={name} maxLength={48} required autoComplete="off" autoFocus disabled={disabled} placeholder="e.g. Read for 20 minutes" onChange={(event) => setName(event.target.value)} />

    <fieldset className="kind-fieldset" disabled={disabled}>
      <legend className="field-label">Habit type</legend>
      <label className={`kind-option ${kind === 'core' ? 'selected' : ''}`}><input type="radio" name="habit-kind" value="core" checked={kind === 'core'} onChange={() => setKind('core')} /><span><strong>Core</strong><small>Counts toward your streak</small></span></label>
      <label className={`kind-option ${kind === 'optional' ? 'selected' : ''}`}><input type="radio" name="habit-kind" value="optional" checked={kind === 'optional'} onChange={() => setKind('optional')} /><span><strong>Optional</strong><small>Tracked separately from tasks</small></span></label>
    </fieldset>

    <div className="editor-row">
      <ActivityIconPicker value={icon} onChange={setIcon} options={HABIT_ICON_OPTIONS} label="Icon" disabled={disabled} />
      <label className="field-label" htmlFor="habit-color">Accent
        <select id="habit-color" className="habit-select" value={color} disabled={disabled} onChange={(event) => setColor(event.target.value as Habit['color'])}>
          <option value="orange">Orange</option><option value="violet">Violet</option><option value="blue">Blue</option>
        </select>
      </label>
      <label className="field-label" htmlFor="habit-target">Days / week
        <input id="habit-target" className="habit-select" type="number" min={1} max={7} step={1} required value={target} disabled={disabled} onChange={(event) => setTarget(Number(event.target.value))} />
      </label>
    </div>
    <div className="editor-actions"><button type="button" className="secondary-button" disabled={disabled} onClick={onCancel}>Cancel</button><button type="submit" className="primary-button" disabled={disabled}><Plus size={16} />{disabled ? 'Saving…' : habit ? 'Save changes' : 'Add habit'}</button></div>
  </form>
}

export function HabitNotice({ error, notice, onRetry }: { error: string | null; notice: string | null; onRetry: () => void }) {
  if (!error && !notice) return null
  return <div className={`habit-notice ${error ? 'notice-error' : 'notice-success'}`} role={error ? 'alert' : 'status'}>
    <span>{error ?? notice}</span>{error && <button type="button" onClick={onRetry}>Retry</button>}
  </div>
}
