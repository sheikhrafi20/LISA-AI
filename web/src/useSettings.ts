import { useCallback, useState } from 'react'

export interface Settings {
  model: string
  language: 'en' | 'bn'
  rate: number
  reduceMotion: boolean
}

export const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fast, lowest cost)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (balanced)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
]

const KEY = 'lisa.settings.v1'
const DEFAULTS: Settings = { model: MODELS[0].id, language: 'en', rate: 1, reduceMotion: false }

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null
    if (!raw || typeof raw !== 'object') return DEFAULTS
    return {
      model: MODELS.some((m) => m.id === raw.model) ? (raw.model as string) : DEFAULTS.model,
      language: raw.language === 'bn' ? 'bn' : 'en',
      rate: typeof raw.rate === 'number' && raw.rate >= 0.7 && raw.rate <= 1.3 ? raw.rate : 1,
      reduceMotion: raw.reduceMotion === true,
    }
  } catch {
    return DEFAULTS
  }
}

/** Settings are kept on this device only (localStorage). */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage may be blocked; settings then last for this visit only */
      }
      return next
    })
  }, [])
  return { settings, update }
}
