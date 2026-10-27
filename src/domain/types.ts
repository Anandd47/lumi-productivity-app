export type ISODate = `${number}-${number}-${number}`
export type HabitKind = 'core' | 'optional'

export interface Task {
  id: string
  title: string
  time: string
  date: ISODate
  /** Optional icon key. Older records without an icon remain valid. */
  icon?: string
}

export type FocusTimerKind = 'pomodoro' | 'countdown' | 'stopwatch'
export type FocusTimerPhase = 'focus' | 'break'
export type FocusTimerStatus = 'idle' | 'running' | 'paused'

export interface FocusSession {
  id: string
  date: ISODate
  subject: string
  startedAt: number
  endedAt: number
  durationSeconds: number
  kind: FocusTimerKind
}

/** A single resumable timer snapshot. Running countdowns use an absolute end time. */
export interface FocusTimerState {
  id: 'current'
  kind: FocusTimerKind
  phase: FocusTimerPhase
  status: FocusTimerStatus
  subject: string
  focusSeconds: number
  breakSeconds: number
  countdownSeconds: number
  remainingSeconds: number
  accumulatedSeconds: number
  sessionStartedAt: number | null
  startedAt: number | null
  endsAt: number | null
  updatedAt: number
}

export interface LumiSettings {
  id: 'settings'
  studyTargetSeconds: number
  sleepTargetMinutes: number
  waterGoalGlasses: number
  profile?: ProfilePreferences
  notifications?: NotificationPreferences
}

export type AvatarColor = 'orange' | 'violet' | 'blue' | 'rose'

export interface ProfilePreferences {
  displayName: string
  avatarColor: AvatarColor
}

export interface NotificationPreferences {
  enabled: boolean
  studyReminderEnabled: boolean
  studyReminderTime: string
  goalReminderEnabled: boolean
  goalReminderTime: string
  sleepReminderEnabled: boolean
  sleepReminderTime: string
  lastStudyReminderDate?: ISODate
  lastGoalReminderDate?: ISODate
  lastSleepReminderDate?: ISODate
}

export interface WaterEntry {
  id: string
  date: ISODate
  glasses: number
  createdAt: number
}

export type ActivityType = 'Walking' | 'Running' | 'Cycling' | 'Strength training' | 'Yoga' | 'Other'

export interface ActivityEntry {
  id: string
  date: ISODate
  type: ActivityType
  durationMinutes: number
  createdAt: number
}

/** `date` is the local calendar day on which the user woke up. */
export interface SleepRecord {
  id: string
  date: ISODate
  startTime: string
  wakeTime: string
  startedAt: number
  endedAt: number
  durationMinutes: number
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: 'orange' | 'violet' | 'blue'
  targetPerWeek: number
  kind: HabitKind
  createdAt: ISODate
  archivedAt?: ISODate
}

export interface DailyLog {
  date: ISODate
  completedHabitIds: string[]
  focusMinutes: number
  studyMinutes: number
  sleepMinutes?: number
  healthChecks: number
  completedPriorityIds: string[]
  completedTaskIds: string[]
  note?: string
}

export interface GraceDay {
  /** Calendar month represented as YYYY-MM. */
  month: `${number}-${number}`
  usedOn: ISODate
}

