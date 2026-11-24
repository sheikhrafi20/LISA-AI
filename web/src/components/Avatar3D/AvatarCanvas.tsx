import { Component, Suspense, useCallback, useEffect, useState, type MutableRefObject, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import AvatarModel from './AvatarModel'
import AvatarCamera from './AvatarCamera'
import AvatarLighting from './AvatarLighting'
import { isMobileDevice, isWebGLAvailable } from './webgl'
import type { Gaze, LisaState, MorphReport, Pose } from '../../types/avatar'

export type AvatarStatus = 'loading' | 'ready' | 'unavailable'

export const DEFAULT_MODEL_URL = '/avatar/lisa.glb'

function Fallback({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-testid="avatar-fallback" role="status" className="pointer-events-auto absolute inset-0 grid place-items-center px-6 text-center">
      <div className="relative h-[min(54vh,80vw)] w-[min(54vh,80vw)]">
        <div className="orb" />
        <div className="glass absolute inset-x-0 top-1/2 mx-auto w-[min(26rem,90vw)] -translate-y-1/2 rounded-3xl p-5">
          <p className="text-base">{title}</p>
          <p className="mt-1 text-sm text-ink/60">{detail}</p>
        </div>
      </div>
    </div>
  )
}

class Boundary extends Component<{ children: ReactNode; onError: (e: Error) => void; fallback: (e: Error) => ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { this.props.onError(error) }
  render() { return this.state.error ? this.props.fallback(this.state.error) : this.props.children }
}

function Loading() {
  const { progress, active } = useProgress()
  return (
    <div data-testid="avatar-loading" className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="glass rounded-full px-5 py-2 text-sm text-ink/70" role="status">
        {active ? `Loading LISA… ${Math.round(progress)}%` : 'Preparing LISA…'}
      </div>
    </div>
  )
}

interface Props {
  state: LisaState
  gaze: MutableRefObject<Gaze>
  lip: MutableRefObject<Pose | null>
  modelUrl?: string
  onStatus?: (status: AvatarStatus, report?: MorphReport) => void
}

export default function AvatarCanvas({ state, gaze, lip, modelUrl = DEFAULT_MODEL_URL, onStatus }: Props) {
  const [webgl] = useState(isWebGLAvailable)
  const [mobile] = useState(isMobileDevice)
  const [ready, setReady] = useState(false)
  const [lost, setLost] = useState(false)

  useEffect(() => { if (!webgl) onStatus?.('unavailable') }, [webgl, onStatus])
  const onReport = useCallback((r: MorphReport) => { setReady(true); onStatus?.('ready', r) }, [onStatus])
  const onError = useCallback(() => onStatus?.('unavailable'), [onStatus])

  if (!webgl) {
    return <Fallback title="3D is not available on this device" detail="Your browser cannot create a WebGL view. LISA's chat and voice still work." />
  }
  if (lost) {
    return <Fallback title="The graphics connection was lost" detail="Reload the page to bring LISA back." />
  }
  return (
    <Boundary
      onError={onError}
      fallback={() => (
        <Fallback title="LISA's 3D model could not be loaded" detail={`Put the avatar file at web/public${modelUrl} (see web/README.md), then reload.`} />
      )}
    >
      <Canvas
        className="!absolute inset-0"
        dpr={[1, mobile ? 1.5 : 2]}
        gl={{ antialias: !mobile, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 24, near: 0.1, far: 30, position: [0, 1.4, 3] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setLost(true) })
        }}
      >
        <AvatarCamera />
        <AvatarLighting />
        <Suspense fallback={null}>
          <AvatarModel url={modelUrl} state={state} gaze={gaze} lip={lip} onReport={onReport} />
        </Suspense>
      </Canvas>
      {!ready && <Loading />}
    </Boundary>
  )
}
