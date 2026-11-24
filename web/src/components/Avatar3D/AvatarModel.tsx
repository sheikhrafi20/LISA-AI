import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Euler, Mesh, Object3D, Quaternion, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Gaze, LisaState, MorphBindings, MorphReport, Pose } from '../../types/avatar'
import { EXPECTED_MORPHS, GAZE_OFFSET, STATE_POSES, gazeToMorphs } from './AvatarExpressions'
import { BlinkController, HEAD_AXIS_SIGN, breathPitch, clamp, damp, headMotion } from './AvatarAnimation'
import { LIP_MORPHS } from './LipSync'

/** Bones are looked up by name. Three.js removes the colon from "mixamorig:Head", so both spellings are tried. */
export function findBone(root: Object3D, name: string): Object3D | undefined {
  return root.getObjectByName(`mixamorig${name}`) ?? root.getObjectByName(`mixamorig:${name}`)
}

/** Collects every morph target on the model: name to the (mesh, index) pairs it drives. Nothing is assumed. */
export function buildBindings(root: Object3D): MorphBindings {
  const bindings: MorphBindings = new Map()
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      const list = bindings.get(name) ?? []
      list.push({ mesh, index })
      bindings.set(name, list)
    }
  })
  return bindings
}

export function reportMorphs(bindings: MorphBindings): MorphReport {
  const all = [...bindings.keys()].sort()
  return {
    found: EXPECTED_MORPHS.filter((n) => bindings.has(n)),
    missing: EXPECTED_MORPHS.filter((n) => !bindings.has(n)),
    all,
  }
}

const lambdaFor = (name: string) =>
  name.startsWith('eyeBlink') ? 45 : name.startsWith('eyeLook') ? 14 : (LIP_MORPHS as readonly string[]).includes(name) ? 30 : 6

const AXIS_X = new Vector3(1, 0, 0)

export interface AvatarModelProps {
  url: string
  state: LisaState
  gaze: MutableRefObject<Gaze>
  /** Mouth shape from real audio (LipSyncAnalyzer.pose); null when nothing is playing. */
  lip: MutableRefObject<Pose | null>
  onReport?: (report: MorphReport) => void
}

export default function AvatarModel({ url, state, gaze, lip, onReport }: AvatarModelProps) {
  const gltf = useGLTF(url)
  const scene = useMemo(() => clone(gltf.scene), [gltf])
  const bindings = useMemo(() => buildBindings(scene), [scene])

  const parts = useMemo(() => {
    const bones = { head: findBone(scene, 'Head'), neck: findBone(scene, 'Neck'), spine1: findBone(scene, 'Spine1'), spine2: findBone(scene, 'Spine2') }
    const rest = new Map<Object3D, Quaternion>()
    for (const b of Object.values(bones)) if (b) rest.set(b, b.quaternion.clone())
    return { bones, rest }
  }, [scene])

  useEffect(() => {
    // Skinned meshes with morph targets have unreliable bounding spheres, so never cull them.
    scene.traverse((o) => { if ((o as Mesh).isMesh) o.frustumCulled = false })
    const report = reportMorphs(bindings)
    if (report.missing.length) console.warn('[LISA] morph targets missing on this model (skipped):', report.missing.join(', '))
    onReport?.(report)
  }, [scene, bindings, onReport])

  const current = useRef<Pose>({})
  const target = useRef<Pose>({})
  const blink = useRef(new BlinkController())
  const eyes = useRef({ x: 0, y: 0 })
  const angles = useRef({ yaw: 0, pitch: 0, roll: 0 })
  const clock = useRef(0)
  const tmp = useMemo(() => ({ euler: new Euler(), quat: new Quaternion() }), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1) // a long pause (hidden tab) must not make a huge jump
    clock.current += dt
    const t = clock.current

    // 1. What each channel should be right now.
    const want = target.current
    for (const k in want) want[k] = 0
    for (const [k, v] of Object.entries(STATE_POSES[state])) want[k] = v
    const offset = GAZE_OFFSET[state]
    eyes.current.x = damp(eyes.current.x, clamp(gaze.current.x * 0.8 + offset.x, -1, 1), 10, dt)
    eyes.current.y = damp(eyes.current.y, clamp(gaze.current.y * 0.6 + offset.y, -1, 1), 10, dt)
    gazeToMorphs(eyes.current, want)
    const closed = blink.current.update(dt)
    want.eyeBlinkLeft = Math.max(want.eyeBlinkLeft ?? 0, closed)
    want.eyeBlinkRight = Math.max(want.eyeBlinkRight ?? 0, closed)
    const mouth = lip.current
    if (mouth) {
      for (const name of LIP_MORPHS) want[name] = Math.max(name === 'mouthSmile' ? (want[name] ?? 0) * (1 - 0.8 * (mouth.jawOpen ?? 0)) : 0, mouth[name] ?? 0)
    }

    // 2. Move the real morph target weights towards them, smoothly.
    const now = current.current
    for (const k in want) if (!(k in now)) now[k] = 0
    for (const k in now) {
      const v = damp(now[k], want[k] ?? 0, lambdaFor(k), dt)
      now[k] = v
      const list = bindings.get(k)
      if (list) for (const b of list) b.mesh.morphTargetInfluences![b.index] = v
    }

    // 3. Head, neck and breathing.
    const { head, neck, spine1, spine2 } = parts.bones
    const motion = headMotion(t, state, mouth?.jawOpen ?? 0)
    const a = angles.current
    a.yaw = damp(a.yaw, motion.yaw + eyes.current.x * 0.2, 5, dt)
    a.pitch = damp(a.pitch, motion.pitch - eyes.current.y * 0.12, 5, dt)
    a.roll = damp(a.roll, motion.roll, 5, dt)
    const turn = (bone: Object3D | undefined, share: number) => {
      const rest = bone && parts.rest.get(bone)
      if (!bone || !rest) return
      tmp.euler.set(a.pitch * share * HEAD_AXIS_SIGN.pitch, a.yaw * share * HEAD_AXIS_SIGN.yaw, a.roll * share * HEAD_AXIS_SIGN.roll, 'YXZ')
      bone.quaternion.copy(rest).multiply(tmp.quat.setFromEuler(tmp.euler))
    }
    turn(head, 0.6)
    turn(neck, 0.4)
    const breath = breathPitch(t)
    for (const [bone, share] of [[spine1, 1], [spine2, 0.6]] as const) {
      const rest = bone && parts.rest.get(bone)
      if (bone && rest) bone.quaternion.copy(rest).multiply(tmp.quat.setFromAxisAngle(AXIS_X, breath * share))
    }
  })

  return <primitive object={scene} />
}
