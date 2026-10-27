import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Download, FileUp, Save, UserRound, Sparkles } from 'lucide-react'
import { CosmicAvatar } from '../../components/CosmicAvatar'
import { useLumiConfirm } from '../../components/ConfirmDialog'
import type { AvatarColor } from '../../domain/types'
import { formatDuration } from '../focus/progress'
import { validateLumiBackup } from './repository'
import type { useProfileData } from './useProfileData'
import type { LumiAccountProfile } from '../auth/AuthGate'
import './profile.css'

type ProfileData = ReturnType<typeof useProfileData>
const avatarColors: Array<{ value: AvatarColor; label: string }> = [
  { value: 'orange', label: 'Solar orange' }, { value: 'violet', label: 'Cosmic violet' }, { value: 'blue', label: 'Nebula blue' }, { value: 'rose', label: 'Starlight rose' },
]

export function ProfileScreen({ data, account, onGoalsSaved }: { data: ProfileData; account?: LumiAccountProfile; onGoalsSaved: () => Promise<void> }) {
  const confirm = useLumiConfirm()
  const [displayName, setDisplayName] = useState('')
  const [avatarColor, setAvatarColor] = useState<AvatarColor>('orange')
  const [studyHours, setStudyHours] = useState(6)
  const [sleepHours, setSleepHours] = useState(8)
  const [waterGlasses, setWaterGlasses] = useState(8)
  const [accountName, setAccountName] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountFeedback, setAccountFeedback] = useState('')
  const [accountError, setAccountError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!data.settings) return
    setDisplayName(data.settings.profile?.displayName ?? '')
    setAvatarColor(data.settings.profile?.avatarColor ?? 'orange')
    setStudyHours(data.settings.studyTargetSeconds / 3600)
    setSleepHours(data.settings.sleepTargetMinutes / 60)
    setWaterGlasses(data.settings.waterGoalGlasses)
  }, [data.settings])

  useEffect(() => {
    if (!account?.loading) setAccountName(account?.displayName ?? '')
  }, [account?.displayName, account?.loading])

  async function saveAccountName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAccountError('')
    setAccountFeedback('')
    setAccountSaving(true)
    try {
      if (!account) throw new Error('Sign in to save an account display name.')
      await account.saveDisplayName(accountName)
      setAccountFeedback('Account display name saved.')
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : 'The account display name could not be saved.')
    } finally {
      setAccountSaving(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await data.saveProfileSettings({ displayName, avatarColor, studyTargetSeconds: Math.round(studyHours * 3600), sleepTargetMinutes: Math.round(sleepHours * 60), waterGoalGlasses: waterGlasses })
    if (saved) await onGoalsSaved()
  }

  async function downloadBackup() {
    const backup = await data.exportData()
    if (!backup) return
    try {
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `lumi-backup-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      data.setNotice('Lumi data backup downloaded.')
    } catch {
      data.setError('Your browser could not create the download. Try using a current browser and download the backup again.')
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Backup files must be 25 MB or smaller.')
      const parsed: unknown = JSON.parse(await file.text())
      const backup = validateLumiBackup(parsed)
      const total = Object.values(backup.stores).reduce((sum, records) => sum + records.length, 0)
      const accepted = await confirm({ title: 'Replace your saved data?', description: `Importing this backup replaces the current local Lumi records with ${total} backup records. Export a backup first if you want to preserve the current data.`, confirmLabel: 'Replace data', destructive: true })
      if (!accepted) return
      if (await data.importData(backup)) await onGoalsSaved()
    } catch (cause) {
      data.setError(cause instanceof Error ? cause.message : 'This backup could not be read. Nothing was changed.')
    } finally {
      event.target.value = ''
    }
  }

  const recordCount = Object.values(data.counts).reduce((sum, count) => sum + count, 0)
  return <section className="account-screen" aria-labelledby="profile-title">
    <header className="account-page-heading"><div><span className="section-kicker"><UserRound size={13} /> YOUR SPACE</span><h1 id="profile-title">Profile</h1><p>Personal details and daily goals.</p></div></header>
    <section className="profile-identity-card" aria-label="Your Lumi profile">
      <CosmicAvatar color={avatarColor} className="profile-identity-avatar" />
      <div><span className="profile-identity-kicker"><Sparkles size={13} /> YOUR LUMI SPACE</span><strong>{account?.displayName || displayName || 'Welcome to Lumi'}</strong><span>{account?.email ?? 'A personal space for your daily rhythm'}</span></div>
    </section>
    {account && <form className="account-panel glass profile-form" onSubmit={(event) => void saveAccountName(event)} aria-labelledby="account-profile-title">
      <div className="account-panel-heading"><div><h2 id="account-profile-title">Account display name</h2><p>Shown across your signed-in sessions. This does not change your profile on this device.</p></div></div>
      {account.loading && <p className="data-note" role="status">Loading account profile…</p>}
      {account.error && <p className="account-feedback account-error" role="alert">{account.error}</p>}
      {accountError && <p className="account-feedback account-error" role="alert">{accountError}</p>}
      {accountFeedback && <p className="account-feedback" role="status">{accountFeedback}</p>}
      <label className="account-field">Display name<input maxLength={48} value={accountName} disabled={account.loading || accountSaving} onChange={(event) => setAccountName(event.target.value)} placeholder="Add a display name" autoComplete="name" /></label>
      <button type="submit" className="primary-button account-save" disabled={account.loading || accountSaving}>{accountSaving ? 'Saving…' : 'Save account name'}</button>
    </form>}
    {data.error && <p className="account-feedback account-error" role="alert">{data.error}</p>}
    {data.notice && <p className="account-feedback" role="status">{data.notice}</p>}
    <form className="account-panel glass profile-form" onSubmit={save}>
      <div className="account-panel-heading"><div><h2>This device’s profile and daily goals</h2><p>Your name and avatar here are separate from your account display name.</p></div></div>
      <label className="account-field">Display name<input maxLength={48} value={displayName} disabled={data.loading || data.saving} onChange={(event) => setDisplayName(event.target.value)} placeholder="Enter your name" autoComplete="name" /></label>
      <fieldset className="avatar-choice"><legend>Avatar color</legend><div>{avatarColors.map((color) => <button type="button" key={color.value} className={`avatar-choice-button avatar-${color.value} ${avatarColor === color.value ? 'selected' : ''}`} aria-label={color.label} aria-pressed={avatarColor === color.value} disabled={data.loading || data.saving} onClick={() => setAvatarColor(color.value)}><CosmicAvatar color={color.value} /></button>)}</div></fieldset>
      <div className="account-panel-heading goals-heading"><div><h2>Daily goals</h2><p>These are the shared goals used by your dashboard and tracking pages.</p></div></div>
      <div className="goal-fields">
        <label className="account-field">Study goal · hours<input type="number" min={1} max={24} step={0.5} required value={studyHours} disabled={data.loading || data.saving} onChange={(event) => setStudyHours(Number(event.target.value))} /><small>Current: {formatDuration(studyHours * 3600)}</small></label>
        <label className="account-field">Sleep goal · hours<input type="number" min={1} max={24} step={0.5} required value={sleepHours} disabled={data.loading || data.saving} onChange={(event) => setSleepHours(Number(event.target.value))} /><small>Default: 8 hours</small></label>
        <label className="account-field">Water goal · glasses<input type="number" min={1} max={32} step={1} required value={waterGlasses} disabled={data.loading || data.saving} onChange={(event) => setWaterGlasses(Number(event.target.value))} /><small>Default: 8 glasses</small></label>
      </div>
      <div className="appearance-note"><strong>Appearance</strong><span>Lumi’s warm, quiet palette is designed to keep your focus on what matters.</span></div>
      <button type="submit" className="primary-button account-save" disabled={data.loading || data.saving}><Save size={15} />{data.saving ? 'Saving…' : 'Save profile and goals'}</button>
    </form>

    <section className="account-panel glass data-management" aria-labelledby="data-management-title">
      <div className="account-panel-heading"><div><h2 id="data-management-title">Your data</h2><p>{data.loading ? 'Loading saved record count…' : `${recordCount} saved records on this device.`}</p></div></div>
      <p className="data-note">Your records stay on this device unless you export a backup. Import replaces these records after confirmation.</p>
      <div className="data-actions"><button type="button" className="secondary-button" disabled={data.loading || data.saving} onClick={() => void downloadBackup()}><Download size={15} /> Export data</button><button type="button" className="secondary-button" disabled={data.loading || data.saving} onClick={() => fileRef.current?.click()}><FileUp size={15} /> Import backup</button><input ref={fileRef} className="visually-hidden-file" type="file" accept="application/json,.json" aria-label="Choose a Lumi JSON backup file" onChange={(event) => void importBackup(event)} /></div>
    </section>
    <section className="account-panel glass profile-about" aria-labelledby="profile-about-title">
      <div className="account-panel-heading"><div><h2 id="profile-about-title">About Lumi</h2><p>A little progress every day.</p></div></div>
      <p className="profile-creator-credit">Made with ♡ by Anand</p>
    </section>
  </section>
}
