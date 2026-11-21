import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Stage from './components/Stage'
import Waveform from './components/Waveform'
import Controls from './components/Controls'
import Settings from './components/Settings'
import DevPreview from './components/DevPreview'
import { GearIcon } from './icons'
import { STATE_COPY, type LisaState } from './state'
import { useSettings } from './useSettings'

export default function App() {
  const [state, setState] = useState<LisaState>('idle')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { settings, update } = useSettings()
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const copy = STATE_COPY[state]

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <main data-state={state} data-motion={settings.reduceMotion ? 'reduced' : 'full'} className="studio relative h-dvh w-full overflow-hidden text-ink">
      <Stage state={state} />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <h1 className="text-xl font-light tracking-[0.5em]">LISA</h1>
        <button aria-label="Open settings" onClick={() => setSettingsOpen(true)} className="glass grid h-11 w-11 place-items-center rounded-full text-ink/70 transition hover:text-ink">
          <GearIcon />
        </button>
      </header>

      {import.meta.env.DEV && <DevPreview state={state} onPick={setState} />}

      <section className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="text-center">
          <p role="status" aria-live="polite" data-testid="status" className="text-xl font-light">{copy.label}</p>
          <p className="text-sm text-ink/55">{copy.hint}</p>
        </div>
        <Waveform state={state} />
        <Controls state={state} onUnavailable={setToast} onStop={() => setState('idle')} />
      </section>

      <AnimatePresence>
        {toast && (
          <motion.div key={toast} role="alert" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <Settings open={settingsOpen} onClose={closeSettings} settings={settings} onChange={update} />
    </main>
  )
}
