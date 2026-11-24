import { useEffect, type MutableRefObject } from 'react'
import type { Gaze } from '../types/avatar'

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

/** Points the avatar's gaze at the pointer or finger. After a few idle seconds it returns to the centre. */
export function useGazeTracking(gaze: MutableRefObject<Gaze>, idleMs = 4000) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const aim = (clientX: number, clientY: number) => {
      gaze.current.x = clamp((clientX / window.innerWidth) * 2 - 1)
      gaze.current.y = clamp(-((clientY / window.innerHeight) * 2 - 1))
      clearTimeout(timer)
      timer = setTimeout(() => { gaze.current.x = 0; gaze.current.y = 0 }, idleMs)
    }
    const onPointer = (e: PointerEvent) => aim(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) aim(t.clientX, t.clientY) }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('touchmove', onTouch)
    }
  }, [gaze, idleMs])
}
