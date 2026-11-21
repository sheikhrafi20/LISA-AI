import type { LisaState } from '../state'

/** Placeholder stage. The 3D avatar replaces the orb in Phase 2. */
export default function Stage({ state }: { state: LisaState }) {
  return (
    <div aria-hidden="true" data-testid="stage" data-stage-state={state} className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="relative h-[min(62vh,92vw)] w-[min(62vh,92vw)]">
        <span className="ring ring-a" />
        <span className="ring ring-b" />
        <div className="orb" />
        <p className="absolute inset-x-0 bottom-[10%] text-center text-[11px] uppercase tracking-[0.3em] text-ink/35">
          Avatar placeholder · Phase 2
        </p>
      </div>
      <div className="floor" />
    </div>
  )
}
