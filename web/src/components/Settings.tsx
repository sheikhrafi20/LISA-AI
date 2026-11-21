import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CloseIcon } from '../icons'
import { MODELS, type Settings as SettingsValues } from '../useSettings'

interface Props {
  open: boolean
  onClose: () => void
  settings: SettingsValues
  onChange: (patch: Partial<SettingsValues>) => void
}

const field = 'mt-1.5 w-full rounded-xl border border-ink/10 bg-white/70 px-3 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]'

export default function Settings({ open, onClose, settings, onChange }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/15" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="glass absolute right-0 top-0 flex h-full w-full max-w-sm flex-col gap-5 overflow-y-auto p-6 pt-[max(1.5rem,env(safe-area-inset-top))]"
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-light tracking-[0.2em]">SETTINGS</h2>
              <button aria-label="Close settings" autoFocus onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5">
                <CloseIcon />
              </button>
            </div>

            <label className="block text-sm text-ink/70">
              AI model
              <select className={field} value={settings.model} onChange={(e) => onChange({ model: e.target.value })}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-ink/70">
              Language
              <select className={field} value={settings.language} onChange={(e) => onChange({ language: e.target.value as 'en' | 'bn' })}>
                <option value="en">English</option>
                <option value="bn">বাংলা (depends on the voice service)</option>
              </select>
            </label>

            <label className="block text-sm text-ink/70">
              Speech speed: {settings.rate.toFixed(2)}×
              <input type="range" min={0.7} max={1.3} step={0.05} value={settings.rate} onChange={(e) => onChange({ rate: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent)]" />
            </label>

            <label className="flex items-center justify-between text-sm text-ink/70">
              Reduce motion
              <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => onChange({ reduceMotion: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
            </label>

            <p className="mt-auto text-xs leading-relaxed text-ink/45">
              Saved on this device only. The model, language and speed are used once chat and voice are connected (Phases 4 and 5). API keys are never stored here.
            </p>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
