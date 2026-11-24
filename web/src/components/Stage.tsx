import type { MutableRefObject } from 'react'
import AvatarCanvas, { type AvatarStatus } from './Avatar3D/AvatarCanvas'
import type { Gaze, LisaState, MorphReport, Pose } from '../types/avatar'

interface Props {
  state: LisaState
  gaze: MutableRefObject<Gaze>
  lip: MutableRefObject<Pose | null>
  modelUrl?: string
  onStatus?: (status: AvatarStatus, report?: MorphReport) => void
}

/** The full-screen studio: soft state rings behind the real 3D avatar. */
export default function Stage({ state, gaze, lip, modelUrl, onStatus }: Props) {
  return (
    <div data-testid="stage" data-stage-state={state} className="pointer-events-none absolute inset-0">
      <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
        <div className="relative h-[min(62vh,92vw)] w-[min(62vh,92vw)] -translate-y-[8%]">
          <span className="ring ring-a" />
          <span className="ring ring-b" />
        </div>
      </div>
      <AvatarCanvas state={state} gaze={gaze} lip={lip} modelUrl={modelUrl} onStatus={onStatus} />
    </div>
  )
}
