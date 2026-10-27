import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { App } from '@capacitor/app'
import { AlertTriangle, Sparkles } from 'lucide-react'
import './ConfirmDialog.css'

export type ConfirmationOptions = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type PendingConfirmation = ConfirmationOptions & { id: number; closing: boolean }
type ConfirmationContextValue = { confirm: (options: ConfirmationOptions) => Promise<boolean> }

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null)

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<PendingConfirmation | null>(null)
  const requestId = useRef(0)
  const pending = useRef<{ id: number; resolve: (accepted: boolean) => void } | null>(null)
  const closeTimer = useRef<number | null>(null)

  const confirm = useCallback((options: ConfirmationOptions) => new Promise<boolean>((resolve) => {
    if (pending.current || dialog?.closing) {
      resolve(false)
      return
    }
    const id = ++requestId.current
    pending.current = { id, resolve }
    setDialog({ ...options, id, closing: false })
  }), [dialog?.closing])

  const settle = useCallback((accepted: boolean) => {
    const current = pending.current
    if (!current) return
    pending.current = null
    current.resolve(accepted)
    setDialog((existing) => existing?.id === current.id ? { ...existing, closing: true } : existing)
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setDialog((existing) => existing?.id === current.id ? null : existing)
      closeTimer.current = null
    }, 180)
  }, [])

  const finishClosing = useCallback((id: number) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    setDialog((existing) => existing?.id === id && existing.closing ? null : existing)
  }, [])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    pending.current?.resolve(false)
    pending.current = null
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])
  return <ConfirmationContext.Provider value={value}>
    {children}
    {dialog && <ConfirmDialog dialog={dialog} onResolve={settle} onFinishClosing={finishClosing} />}
  </ConfirmationContext.Provider>
}

export function useLumiConfirm() {
  const context = useContext(ConfirmationContext)
  if (!context) throw new Error('useLumiConfirm must be used inside ConfirmDialogProvider.')
  return context.confirm
}

function ConfirmDialog({ dialog, onResolve, onFinishClosing }: {
  dialog: PendingConfirmation
  onResolve: (accepted: boolean) => void
  onFinishClosing: (id: number) => void
}) {
  const generatedId = useId()
  const titleId = `lumi-confirm-title-${generatedId}`
  const descriptionId = `lumi-confirm-description-${generatedId}`
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onResolve(false)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    let active = true
    let backButtonListener: { remove: () => Promise<void> } | undefined
    void App.addListener('backButton', () => onResolve(false)).then((listener) => {
      if (active) backButtonListener = listener
      else void listener.remove()
    })
    return () => {
      active = false
      void backButtonListener?.remove()
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus({ preventScroll: true })
    }
  }, [dialog.id, onResolve])

  const modal = <div
    className={`lumi-confirm-backdrop ${dialog.closing ? 'is-closing' : ''}`}
    onClick={(event) => { if (event.target === event.currentTarget && !dialog.closing) onResolve(false) }}
    onTransitionEnd={(event) => { if (event.target === event.currentTarget && dialog.closing) onFinishClosing(dialog.id) }}
  >
    <section ref={dialogRef} className={`lumi-confirm-dialog ${dialog.destructive ? 'is-destructive' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <span className="lumi-confirm-icon" aria-hidden="true">{dialog.destructive ? <AlertTriangle size={18} /> : <Sparkles size={18} />}</span>
      <h2 id={titleId}>{dialog.title}</h2>
      <p id={descriptionId}>{dialog.description}</p>
      <div className="lumi-confirm-actions">
        <button ref={cancelRef} type="button" className="secondary-button lumi-confirm-cancel" disabled={dialog.closing} onClick={() => onResolve(false)}>{dialog.cancelLabel ?? 'Cancel'}</button>
        <button type="button" className={`primary-button lumi-confirm-accept ${dialog.destructive ? 'is-destructive' : ''}`} disabled={dialog.closing} onClick={() => onResolve(true)}>{dialog.confirmLabel ?? 'Confirm'}</button>
      </div>
    </section>
  </div>

  return createPortal(modal, document.body)
}
