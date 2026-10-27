import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Bell, BookOpen, CheckCircle2, Clock3, House, LogOut, MoreHorizontal, ListChecks, ListTodo, Timer } from 'lucide-react'
import { dateFromISO, formatToday, toISODate } from '../domain/date'
import type { FocusSession, Habit, ISODate, Task } from '../domain/types'
import { CosmicAvatar } from '../components/CosmicAvatar'
import { ParticleOrb } from '../components/ParticleOrb'
import { CosmicStar } from '../components/CosmicStar'
import { CosmicFlameMark } from '../components/CosmicFlameMark'
import { setHabitCompletion } from '../features/habits/repository'
import { useHabits } from '../features/habits/useHabits'
import { HabitDashboardCard, HabitsScreen } from '../features/habits/HabitViews'
import { useTasks } from '../features/tasks/useTasks'
import { calculateTaskProgress } from '../features/tasks/progress'
import { TaskDashboardCard, TasksScreen } from '../features/tasks/TaskViews'
import { FocusScreen } from '../features/focus/FocusScreen'
import { useFocusTimer } from '../features/focus/useFocusTimer'
import { useStudyData } from '../features/focus/useStudyData'
import { formatDuration, summarizeStudy } from '../features/focus/progress'
import { InsightsScreen } from '../features/insights/InsightsScreen'
import { useInsightsData } from '../features/insights/useInsightsData'
import { addLocalDays, mondayOf, studyIntensity } from '../features/insights/calendar'
import { useSleepData } from '../features/sleep/useSleepData'
import { SleepTracker } from '../features/sleep/SleepTracker'
import { HealthScreen } from '../features/health/HealthScreen'
import { useHealthData } from '../features/health/useHealthData'
import { StreakScreen } from '../features/streaks/StreakScreen'
import { useStreakData } from '../features/streaks/useStreakData'
import { qualifiesForStreak } from '../features/streaks/streak'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { useProfileData } from '../features/profile/useProfileData'
import { NotificationsScreen } from '../features/notifications/NotificationsScreen'
import { useReminderScheduler } from '../features/notifications/useReminderScheduler'
import { AuthGate, type LumiAccountProfile } from '../features/auth/AuthGate'
import { supabase, supabaseConfigured } from '../features/auth/supabaseClient'
import { AdminUsersScreen } from '../features/admin/AdminUsersScreen'
import { useCreatorAccess } from '../features/admin/useCreatorAccess'
import { MoreScreen } from '../features/navigation/MoreScreen'
import { screenFromPath, screenPaths } from '../features/navigation/routes'
import { ConfirmDialogProvider } from '../components/ConfirmDialog'

const navItems = [
  { label: 'Home', icon: House }, { label: 'Tasks', icon: ListTodo }, { label: 'Habits', icon: ListChecks },
  { label: 'Focus', icon: Timer }, { label: 'More', icon: MoreHorizontal },
]
const moreScreens = ['Sleep', 'Health', 'Insights', 'Profile', 'Notifications', 'Streak']
export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  useEffect(() => {
    const updateVisibility = () => document.documentElement.classList.toggle('lumi-backgrounded', document.visibilityState === 'hidden')
    const handleNavigation = () => setPathname(window.location.pathname)
    const updateKeyboardLayout = () => {
      const viewport = window.visualViewport
      const activeElement = document.activeElement
      const isTextEntry = activeElement instanceof HTMLElement && activeElement.matches('textarea,select,[contenteditable="true"],input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="hidden"])')
      const viewportIsCovered = Boolean(viewport && window.innerHeight - viewport.height > 140)
      document.documentElement.classList.toggle('lumi-keyboard-open', isTextEntry && viewportIsCovered)
    }
    document.addEventListener('visibilitychange', updateVisibility)
    document.addEventListener('focusin', updateKeyboardLayout)
    document.addEventListener('focusout', updateKeyboardLayout)
    window.addEventListener('popstate', handleNavigation)
    window.visualViewport?.addEventListener('resize', updateKeyboardLayout)
    window.visualViewport?.addEventListener('scroll', updateKeyboardLayout)
    updateVisibility()
    updateKeyboardLayout()
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
      document.documentElement.classList.remove('lumi-backgrounded')
      document.documentElement.classList.remove('lumi-keyboard-open')
      document.removeEventListener('focusin', updateKeyboardLayout)
      document.removeEventListener('focusout', updateKeyboardLayout)
      window.removeEventListener('popstate', handleNavigation)
      window.visualViewport?.removeEventListener('resize', updateKeyboardLayout)
      window.visualViewport?.removeEventListener('scroll', updateKeyboardLayout)
    }
  }, [])
  const path = pathname.replace(/\/+$/, '')
  return <ConfirmDialogProvider>
    {path === '/admin' || path === '/admin/users'
      ? <AuthGate>{(account) => account ? <AdminUsersScreen adminId={account.userId} /> : null}</AuthGate>
      : <AuthGate>{(account) => <DashboardApp account={account} showAccountMode={supabaseConfigured} />}</AuthGate>}
  </ConfirmDialogProvider>
}

function DashboardApp({ account, showAccountMode }: { account?: LumiAccountProfile; showAccountMode: boolean }) {
  const [activeNav, setActiveNav] = useState(() => screenFromPath(window.location.pathname))
  const [selectedDate, setSelectedDate] = useState<ISODate>(() => toISODate(new Date()))
  useEffect(() => {
    const syncActiveScreen = () => {
      const screen = screenFromPath(window.location.pathname)
      setActiveNav(screen)
      if (screen === 'Home') setSelectedDate(toISODate(new Date()))
    }
    window.addEventListener('popstate', syncActiveScreen)
    return () => window.removeEventListener('popstate', syncActiveScreen)
  }, [])
  function navigateTo(destination: string) {
    const nextPath = screenPaths[destination]
    if (nextPath && window.location.pathname !== nextPath) window.history.pushState({ lumiScreen: destination }, '', nextPath)
    if (destination === 'Home') setSelectedDate(toISODate(new Date()))
    setActiveNav(destination)
  }
  const creatorAccess = useCreatorAccess(account?.userId)
  const activeTab = moreScreens.includes(activeNav) ? 'More' : activeNav
  const habitData = useHabits(selectedDate)
  const taskData = useTasks(selectedDate, account?.userId)
  const studyData = useStudyData(selectedDate)
  const insightsData = useInsightsData()
  const sleepData = useSleepData()
  const healthData = useHealthData()
  const streakData = useStreakData()
  const [streakMilestoneAnimation, setStreakMilestoneAnimation] = useState(false)
  const previousTodayQualified = useRef<boolean | null>(null)
  const streakAnimationTimeout = useRef<number | undefined>(undefined)
  const todayLog = streakData.dailyLogs.find((log) => log.date === streakData.stats.today)
  const todayQualifies = qualifiesForStreak(streakData.habits, todayLog, streakData.stats.today)
  useEffect(() => {
    if (streakData.loading || streakData.error) return
    const isMilestone = [7, 14, 30, 100].includes(streakData.stats.currentStreak)
    if (previousTodayQualified.current === false && todayQualifies && isMilestone) {
      setStreakMilestoneAnimation(true)
      window.clearTimeout(streakAnimationTimeout.current)
      streakAnimationTimeout.current = window.setTimeout(() => setStreakMilestoneAnimation(false), 620)
    }
    previousTodayQualified.current = todayQualifies
  }, [streakData.error, streakData.loading, streakData.stats.currentStreak, todayQualifies])
  useEffect(() => () => window.clearTimeout(streakAnimationTimeout.current), [])
  const profileData = useProfileData()
  const displayName = account ? account.displayName ?? '' : profileData.settings?.profile?.displayName ?? ''
  useReminderScheduler(profileData.settings?.notifications)
  useEffect(() => { if (activeNav === 'Profile' || activeNav === 'Notifications') void profileData.reload() }, [activeNav, profileData.reload])
  useEffect(() => { if (activeNav === 'Insights') void insightsData.reload() }, [activeNav, insightsData.reload])
  useEffect(() => { if (!habitData.loading) void streakData.reload() }, [habitData.habits, habitData.dailyLog, habitData.loading, streakData.reload])
  const studyTargetSeconds = studyData.settings?.studyTargetSeconds ?? 6 * 3600
  const studySummary = useMemo(() => summarizeStudy(studyData.sessions, studyTargetSeconds), [studyData.sessions, studyTargetSeconds])
  const completedTaskIds = taskData.dailyLog?.completedTaskIds ?? []
  const doneCount = useMemo(() => {
    const taskIds = new Set(taskData.tasks.map((task) => task.id))
    return completedTaskIds.filter((id) => taskIds.has(id)).length
  }, [taskData.tasks, completedTaskIds])
  const taskProgress = useMemo(() => calculateTaskProgress(taskData.tasks, completedTaskIds), [taskData.tasks, completedTaskIds])
  const completedIds = habitData.dailyLog?.completedHabitIds ?? []
  const taskCompletionPercent = taskData.loading || taskData.error ? 0 : taskProgress.percentage
  const progress = studyData.loading || studyData.error ? 0 : studySummary.percent
  const orbState = studyData.loading ? 'loading' : studyData.error ? 'error' : studySummary.totalSeconds === 0 ? 'empty' : 'ready'

  function toggleHabit(habit: Habit, completed: boolean) {
    void habitData.mutate(() => setHabitCompletion(selectedDate, habit.id, completed), completed ? 'Habit marked complete for this day.' : 'Habit marked incomplete for this day.')
  }
  function toggleTask(task: Task, completed: boolean) {
    void taskData.mutate(() => taskData.setTaskCompletion(selectedDate, task.id, completed), completed ? 'Task completed for this day.' : 'Task marked incomplete for this day.')
  }

  async function reloadAfterProfileChange() {
    await Promise.all([profileData.reload(), studyData.reload(), sleepData.reload(), healthData.reload(), insightsData.reload(), habitData.reload(), taskData.reload(), streakData.reload()])
  }
  const reloadStudyAfterTimerSave = useCallback(() => {
    void studyData.reload()
    void insightsData.reload()
  }, [studyData.reload, insightsData.reload])

  const habitViewData = {
    habits: habitData.habits,
    completedIds,
    weekLogs: habitData.weekLogs,
    date: selectedDate,
    loading: habitData.loading,
    saving: habitData.saving,
    error: habitData.error,
    notice: habitData.notice,
    mutate: habitData.mutate,
    reload: habitData.reload,
    onToggle: toggleHabit,
  }
  const taskViewData = { ...taskData, completedIds: taskData.dailyLog?.completedTaskIds ?? [], date: selectedDate, onToggle: toggleTask }

  return (
    <main className="app-shell">
      <div className="space-grain" aria-hidden="true" />
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="shooting-star star-one" aria-hidden="true" />
      <div className="shooting-star star-two" aria-hidden="true" />

      <div className="dashboard">
        <header className="topbar">
          <div className="brand-mark"><img className="brand-symbol" src="/lumi-mark.svg" alt="" /> <span>Lumi</span></div>
          <div className="topbar-right">
            {showAccountMode && <span className={`account-mode ${account?.email ? 'account-mode-signed-in' : ''}`} title={!account?.email ? 'Your tasks are saved on this device. Sign in to sync tasks across sessions.' : taskData.cloudStatus === 'connected' ? 'Your tasks are synced. Other Lumi records remain on this device.' : taskData.cloudStatus === 'error' ? 'Task sync is unavailable. Other Lumi records remain on this device.' : 'Checking task sync. Other Lumi records remain on this device.'}>{!account?.email ? 'ON THIS DEVICE' : taskData.cloudStatus === 'connected' ? 'TASKS SYNCED' : taskData.cloudStatus === 'error' ? 'TASK SYNC ISSUE' : 'CHECKING TASKS'}</span>}
            <div className="topbar-actions">
              {account?.email && <button type="button" className="icon-button auth-logout" aria-label="Sign out of Lumi" title="Sign out" onClick={() => void supabase?.auth.signOut()}><LogOut size={17} /></button>}
              <button type="button" className="icon-button notification" aria-label="Notifications" title="Notifications" aria-current={activeNav === 'Notifications' ? 'page' : undefined} onClick={() => { if (activeNav !== 'Notifications') navigateTo('Notifications') }}><Bell size={19} /></button>
              <button type="button" className={`avatar avatar-${profileData.settings?.profile?.avatarColor ?? 'orange'}`} aria-label="Open profile" aria-current={activeNav === 'Profile' ? 'page' : undefined} title="Profile" onClick={() => { if (activeNav !== 'Profile') navigateTo('Profile') }}><CosmicAvatar color={profileData.settings?.profile?.avatarColor ?? 'orange'} /></button>
            </div>
          </div>
        </header>

        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => <button key={label} type="button" className={`primary-nav-item ${activeTab === label ? 'active' : ''}`} onClick={() => navigateTo(label)} aria-current={activeTab === label ? 'page' : undefined}>
            <Icon size={18} strokeWidth={activeTab === label ? 2.2 : 1.8} /><span>{label}</span>
          </button>)}
        </nav>

        {activeNav === 'Focus' ? null : activeNav === 'Streak' ? <StreakScreen data={streakData} milestoneAnimation={streakMilestoneAnimation} onManageHabits={() => navigateTo('Habits')} /> : activeNav === 'Profile' ? <ProfileScreen data={profileData} account={account} onGoalsSaved={reloadAfterProfileChange} /> : activeNav === 'Notifications' ? <NotificationsScreen data={profileData} /> : activeNav === 'Health' ? <HealthScreen data={healthData} /> : activeNav === 'Sleep' ? <SleepTracker data={sleepData} /> : activeNav === 'Insights' ? <InsightsScreen data={insightsData.data} loading={insightsData.loading} error={insightsData.error} onRetry={() => void insightsData.reload()} selectedDate={selectedDate} onDateChange={setSelectedDate} /> : activeNav === 'More' ? <MoreScreen onNavigate={navigateTo} displayName={displayName} email={account?.email} avatarColor={profileData.settings?.profile?.avatarColor ?? 'orange'} streakDays={streakData.stats.currentStreak} streakMilestoneAnimation={streakMilestoneAnimation} /> : activeNav === 'Habits' ? <HabitsScreen
          data={habitViewData}
          onDateChange={setSelectedDate}
        /> : activeNav === 'Tasks' ? <TasksScreen data={taskViewData} onDateChange={setSelectedDate} /> : <HomeScreen
          name={displayName}
          date={selectedDate}
          progress={progress}
          taskProgressPercent={taskCompletionPercent}
          orbState={orbState}
          taskCount={taskData.tasks.length}
          doneCount={doneCount}
          tasksLoading={taskData.loading}
          tasksError={taskData.error}
          task={taskData.tasks.find((item) => !completedTaskIds.includes(item.id)) ?? null}
          onCompleteTask={(task) => toggleTask(task, true)}
          studySummary={studySummary}
          studySessions={insightsData.data?.sessions}
          studyHistoryLoading={insightsData.loading}
          studyHistoryError={insightsData.error}
          studyLoading={studyData.loading}
          studyError={studyData.error}
          streak={streakData.stats.currentStreak}
          streakMilestoneAnimation={streakMilestoneAnimation}
          streakLoading={streakData.loading || Boolean(streakData.error)}
          onOpenStreak={() => navigateTo('Streak')}
          onOpenInsights={() => navigateTo('Insights')}
          habitViewData={habitViewData}
          taskViewData={taskViewData}
        />}
        <FocusTimerController active={activeNav === 'Focus'} date={selectedDate} onDateChange={setSelectedDate} study={studyData} onSessionSaved={reloadStudyAfterTimerSave} />
        <footer className="encouragement app-footer"><span className="encouragement-dot" />Small steps add up to stardust.<span className="creator-credit">Made with ♡ by Anand</span>{creatorAccess.status === 'authorized' && <a className="creator-access-link" href="/admin">Creator Access</a>}{account?.userId && creatorAccess.status === 'unavailable' && <span className="creator-access-status" role="status">{creatorAccess.message ?? 'Creator access could not be checked.'}<button type="button" onClick={() => void creatorAccess.refresh()}>Try again</button></span>}</footer>
      </div>

    </main>
  )
}

function FocusTimerController({ active, date, onDateChange, study, onSessionSaved }: { active: boolean; date: ISODate; onDateChange: (date: ISODate) => void; study: ReturnType<typeof useStudyData>; onSessionSaved: () => void }) {
  const timer = useFocusTimer(active)
  const handledSessionVersion = useRef(0)
  useEffect(() => {
    if (timer.sessionVersion > handledSessionVersion.current) {
      handledSessionVersion.current = timer.sessionVersion
      onSessionSaved()
    }
  }, [timer.sessionVersion, onSessionSaved])
  return active ? <FocusScreen date={date} onDateChange={onDateChange} timer={timer} study={study} /> : null
}

function HomeScreen({ name, date, progress, taskProgressPercent, orbState, taskCount, doneCount, tasksLoading, tasksError, task, onCompleteTask, studySummary, studySessions, studyHistoryLoading, studyHistoryError, studyLoading, studyError, streak, streakMilestoneAnimation, streakLoading, onOpenStreak, onOpenInsights, habitViewData, taskViewData }: {
  name: string; date: ISODate; progress: number; taskProgressPercent: number; orbState: 'ready' | 'empty' | 'loading' | 'error'; taskCount: number; doneCount: number; tasksLoading: boolean; tasksError: string | null; task: Task | null; onCompleteTask: (task: Task) => void;
  studySummary: ReturnType<typeof summarizeStudy>; studySessions?: FocusSession[]; studyHistoryLoading: boolean; studyHistoryError: string | null; studyLoading: boolean; studyError: string | null; streak: number; streakMilestoneAnimation: boolean; streakLoading: boolean; onOpenStreak: () => void; onOpenInsights: () => void; habitViewData: Parameters<typeof HabitDashboardCard>[0]['data']; taskViewData: Parameters<typeof TaskDashboardCard>[0]['data'];
}) {
  const dateLabel = formatToday(dateFromISO(date))
  const activeHabits = habitViewData.habits.filter((habit) => habit.createdAt <= date && (!habit.archivedAt || date < habit.archivedAt))
  const doneHabits = activeHabits.filter((habit) => habitViewData.completedIds.includes(habit.id)).length
  const weekActivity = useMemo(() => {
    const start = mondayOf(dateFromISO(date))
    const totals = new Map<ISODate, number>()
    for (const session of studySessions ?? []) totals.set(session.date, (totals.get(session.date) ?? 0) + session.durationSeconds)
    return Array.from({ length: 7 }, (_, index) => {
      const day = addLocalDays(start, index)
      const key = toISODate(day)
      return { key, dayLabel: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day), seconds: totals.get(key) ?? 0 }
    })
  }, [date, studySessions])
  const maxWeekSeconds = Math.max(0, ...weekActivity.map((day) => day.seconds))
  const weekTotalSeconds = weekActivity.reduce((total, day) => total + day.seconds, 0)
  const circumference = 2 * Math.PI * 174
  const orbOffset = circumference * (1 - progress / 100)
  return <div className="home-page performance-home" aria-label="Lumi home dashboard">
    <section className="race-heading" aria-labelledby="greeting">
      <div className="race-heading-copy"><span className="race-kicker"><Activity size={13} /> DAILY PERFORMANCE <i /></span><span className="home-date">{dateLabel}</span><h1 id="greeting">Good evening{name ? <>, <strong>{name}</strong></> : ''}<span className="race-subtitle">One clear move at a time.</span></h1></div>
      <button type="button" className="home-streak" onClick={onOpenStreak} aria-label={`${streakLoading ? 'Streak unavailable' : `Current streak ${streak} days`}. View details`}><span className="home-streak-icon" aria-hidden="true"><CosmicFlameMark days={streak} size={27} animate={streakMilestoneAnimation} /></span><strong className="home-streak-count">{streakLoading ? '—' : `${streak} days`}</strong></button>
    </section>

    <section className="performance-stage" aria-label="Daily study progress and next action">
      <div className="stage-topline"><span>TODAY’S PERFORMANCE</span><span className="live-indicator"><i /> STUDY TARGET</span></div>
      <div className="orb-layout">
        <div className="orb-instrument" style={{ '--orb-progress': `${progress}%` } as React.CSSProperties}>
          <svg className="orb-telemetry" viewBox="0 0 400 400" aria-hidden="true">
            <defs><linearGradient id="orbProgress" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff674f" /><stop offset=".52" stopColor="#ff9b61" /><stop offset="1" stopColor="#8b7cff" /></linearGradient></defs>
            <circle className="orb-tick-ring" cx="200" cy="200" r="190" />
            <circle className="orb-track-ring" cx="200" cy="200" r="174" />
            <circle className="orb-progress-ring" cx="200" cy="200" r="174" stroke="url(#orbProgress)" strokeDasharray={circumference} strokeDashoffset={orbOffset} />
          </svg>
          <ParticleOrb progress={progress} state={orbState} metricLabel="study progress" emptyHint="Start a focus session to begin tracking study time." />
          <div className="orb-reading" aria-live="polite"><strong>{studyLoading || studyError ? '—' : progress}<small>{studyLoading || studyError ? '' : '%'}</small></strong><span>DAILY STUDY PROGRESS</span><em>{studyLoading ? 'Loading study history' : studyError ? 'Study data unavailable' : studySummary.totalSeconds === 0 ? 'Start a focus session to begin' : `${formatDuration(studySummary.totalSeconds)} / ${formatDuration(studySummary.targetSeconds)} STUDIED`}</em></div>
          <div className="orb-node orb-node-one" aria-hidden="true" /><div className="orb-node orb-node-two" aria-hidden="true" />
        </div>
        <aside className="orb-briefing">
          <div className="briefing-label"><span>UP NEXT</span><Clock3 size={15} /></div>
          {task ? <><strong className="briefing-task">{task.title}</strong><span className="briefing-time">{task.time || 'Whenever you’re ready'}</span><button type="button" className="briefing-action" onClick={() => onCompleteTask(task)}><CheckCircle2 size={16} /> Mark complete</button></> : <><strong className="briefing-task">{tasksError ? 'Tasks unavailable' : tasksLoading ? 'Loading your plan' : taskCount ? 'All priorities complete' : 'Set your first priority'}</strong><span className="briefing-time">{tasksError ? 'Could not read your saved tasks.' : 'Your next step will appear here.'}</span></>}
          <CosmicStar />
        </aside>
      </div>
    </section>

    <section className="telemetry-strip" aria-label="Daily telemetry">
      <article className="telemetry-cell"><span className="telemetry-index">01</span><span className="telemetry-icon telemetry-red"><CheckCircle2 size={17} /></span><div><small>TASKS COMPLETE</small><strong>{tasksLoading || tasksError ? '—' : `${doneCount} / ${taskCount}`}</strong><span>{tasksError ? 'Unavailable' : taskCount ? `${taskCount - doneCount} remaining` : 'No tasks yet'}</span></div><div className="telemetry-meter"><i style={{ width: `${taskProgressPercent}%` }} /></div></article>
      <article className="telemetry-cell"><span className="telemetry-index">02</span><span className="telemetry-icon telemetry-violet"><Activity size={17} /></span><div><small>HABITS TODAY</small><strong>{habitViewData.loading || habitViewData.error ? '—' : `${doneHabits} / ${activeHabits.length}`}</strong><span>{habitViewData.error ? 'Unavailable' : activeHabits.length ? 'Routines completed' : 'No routines scheduled'}</span></div><div className="telemetry-meter telemetry-meter-violet"><i style={{ width: `${activeHabits.length ? Math.round(doneHabits / activeHabits.length * 100) : 0}%` }} /></div></article>
      <article className="telemetry-cell"><span className="telemetry-index">03</span><span className="telemetry-icon telemetry-blue"><BookOpen size={17} /></span><div><small>FOCUS LOGGED</small><strong>{formatDuration(studySummary.totalSeconds)}</strong><span>of {formatDuration(studySummary.targetSeconds)} daily target</span></div><div className="telemetry-meter telemetry-meter-blue"><i style={{ width: `${studySummary.percent}%` }} /></div></article>
    </section>

    <section className="study-activity-preview" aria-labelledby="week-activity-title">
      <div className="study-activity-heading"><div><span className="home-label">STUDY ACTIVITY</span><h2 id="week-activity-title">This week</h2></div><button type="button" onClick={onOpenInsights}>View Insights</button></div>
      {studyHistoryLoading ? <p className="study-activity-message" role="status">Loading saved study history…</p> : studyHistoryError ? <p className="study-activity-message" role="status">Study history is unavailable.</p> : <>
        <div className="study-activity-strip" role="list" aria-label="Saved focused study time by day">
          {weekActivity.map((day) => {
            const intensity = studyIntensity(day.seconds)
            const barHeight = maxWeekSeconds ? Math.max(8, Math.round(day.seconds / maxWeekSeconds * 34)) : 6
            const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(dateFromISO(day.key))
            return <div className="study-activity-day" role="listitem" key={day.key} aria-label={`${dayName}: ${formatDuration(day.seconds)} focused`} title={`${dayName}: ${formatDuration(day.seconds)} focused`}>
              <span className={`study-activity-bar level-${intensity}`} style={{ height: `${barHeight}px` }} />
              <small>{day.dayLabel}</small>
            </div>
          })}
        </div>
        <p className="study-activity-total">{formatDuration(weekTotalSeconds)} focused this week</p>
      </>}
    </section>

    <div className="home-section-topline"><div><span className="home-label">RACE PLAN</span><h2>Today’s priorities</h2></div><span className="home-date-note">{dateLabel}</span></div>
    <div className="home-lists"><TaskDashboardCard data={taskViewData} /><HabitDashboardCard data={habitViewData} /></div>
  </div>
}


