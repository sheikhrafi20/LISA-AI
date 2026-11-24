import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'

/** Distance at which a region of `height` x `width` metres just fits the view. */
export function frameDistance(fovDeg: number, aspect: number, height: number, width: number): number {
  const t = Math.tan((fovDeg * Math.PI) / 360)
  return Math.max(height / 2 / t, width / 2 / (t * aspect))
}

interface Props {
  /** Point the camera looks at (metres): the base of the neck / upper chest. */
  target?: [number, number, number]
  /** The part of the body that must stay in view: head and chest. */
  height?: number
  width?: number
}

/** Half-body framing that adapts to portrait phones and wide desktop windows. */
export default function AvatarCamera({ target = [0, 1.36, 0], height = 0.86, width = 0.66 }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const aspect = useThree((s) => s.size.width / s.size.height)
  useLayoutEffect(() => {
    camera.fov = 24
    camera.near = 0.1
    camera.far = 30
    camera.aspect = aspect
    camera.position.set(target[0], target[1] + 0.03, target[2] + frameDistance(camera.fov, aspect, height, width))
    camera.lookAt(target[0], target[1], target[2])
    camera.updateProjectionMatrix()
  }, [camera, aspect, target, height, width])
  return null
}
