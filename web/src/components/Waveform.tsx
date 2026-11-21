import type { CSSProperties } from 'react'
import type { LisaState } from '../state'

const BARS = 28

interface Props {
  state: LisaState
  /** Real audio levels (0 to 1) will be passed here once microphone/audio is connected (Phase 4). */
  levels?: number[]
}

/** Until real audio is connected the bars are decorative and follow the LISA state. */
export default function Waveform({ state, levels }: Props) {
  return (
    <div aria-hidden="true" data-testid="waveform" data-state-view={state} className="flex h-12 items-end justify-center gap-[5px]">
      {Array.from({ length: BARS }, (_, i) => {
        const edge = 1 - Math.abs(i - BARS / 2 + 0.5) / (BARS / 2)
        const style: CSSProperties = levels
          ? { transform: `scaleY(${Math.max(0.08, Math.min(1, levels[i % levels.length] ?? 0))})` }
          : { animationDelay: `${(i * 0.06) % 0.9}s`, height: `${30 + edge * 70}%` }
        return <span key={i} className="bar" style={style} />
      })}
    </div>
  )
}
