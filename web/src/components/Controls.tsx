import { useState, type FormEvent } from 'react'
import { MicIcon, StopIcon } from '../icons'
import type { LisaState } from '../state'

interface Props {
  state: LisaState
  onUnavailable: (message: string) => void
  onStop: () => void
}

export default function Controls({ state, onUnavailable, onStop }: Props) {
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onUnavailable('Chatting with Claude arrives in Phase 5.')
  }

  return (
    <form onSubmit={submit} className="glass flex w-full max-w-xl items-center gap-2 rounded-full p-2 pl-5">
      <input
        aria-label="Message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message…"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink/40"
      />
      {state === 'speaking' && (
        <button type="button" aria-label="Stop speaking" onClick={onStop} className="glass grid h-11 w-11 place-items-center rounded-full text-ink/70 transition hover:text-ink">
          <StopIcon />
        </button>
      )}
      <button
        type="button"
        aria-label="Start voice input"
        onClick={() => onUnavailable('Voice input arrives in Phase 4.')}
        className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/40 transition hover:scale-105 active:scale-95"
      >
        <MicIcon />
      </button>
    </form>
  )
}
