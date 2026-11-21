import { STATES, type LisaState } from '../state'

interface Props {
  state: LisaState
  onPick: (s: LisaState) => void
}

/** Development helper (hidden in production builds): previews each state's visuals before real voice and AI exist. */
export default function DevPreview({ state, onPick }: Props) {
  return (
    <div className="glass absolute left-1/2 top-[4.5rem] z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1 text-[11px]">
      <span className="px-2 uppercase tracking-widest text-ink/40">dev preview</span>
      {STATES.map((s) => (
        <button key={s} onClick={() => onPick(s)} aria-pressed={state === s} className={`rounded-full px-2.5 py-1 capitalize transition ${state === s ? 'bg-[var(--accent)] text-white' : 'hover:bg-ink/5'}`}>
          {s}
        </button>
      ))}
    </div>
  )
}
