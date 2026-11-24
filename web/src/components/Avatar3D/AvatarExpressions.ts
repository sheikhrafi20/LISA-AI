import type { Gaze, LisaState, Pose } from '../../types/avatar'

/**
 * The morph targets that exist on LISA's current model (checked against the real GLB with
 * scripts/prepare-avatar.mjs). The model is a MakeHuman character: only some ARKit names exist,
 * some are one combined shape instead of left/right, and there are no Oculus visemes.
 * Everything LISA animates must come from this list. If you replace the model, run
 * `npm run avatar:prepare` and update this list, then `npm test` will tell you what broke.
 */
export const BODY_MORPHS = [
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight', 'eyeSquintLeft', 'eyeSquintRight',
  'browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight', 'browInnerUpLeft', 'browInnerUpRight',
  'browUpLeft', 'browUpRight', 'jawOpen', 'mouthSmile', 'mouthFrown', 'mouthLowerDown', 'mouthUpperUp',
  'mouthPress', 'mouthPucker', 'mouthFunnel', 'mouthStretch', 'mouthDimple', 'mouthRollOut', 'mouthClose',
  'mouthLeft', 'noseCompress', 'noseDepress', 'noseSneerLeft', 'noseSneerRight', 'nostrilFlareLeft',
  'nostrilFlareRight', 'neckTense',
] as const

export const EYE_LOOK_MORPHS = [
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
] as const

export const EXPECTED_MORPHS: readonly string[] = [...BODY_MORPHS, ...EYE_LOOK_MORPHS]

/** The facial expression each state shows. Small values on purpose: natural, not cartoonish. */
export const STATE_POSES: Record<LisaState, Pose> = {
  idle: { mouthSmile: 0.22, browInnerUpLeft: 0.06, browInnerUpRight: 0.06 },
  listening: {
    mouthSmile: 0.3, browInnerUpLeft: 0.4, browInnerUpRight: 0.4, browOuterUpLeft: 0.18, browOuterUpRight: 0.18,
    eyeWideLeft: 0.1, eyeWideRight: 0.1,
  },
  processing: {
    browInnerUpLeft: 0.22, browInnerUpRight: 0.22, browDownLeft: 0.12, mouthPress: 0.12,
    eyeSquintLeft: 0.12, eyeSquintRight: 0.12,
  },
  speaking: { mouthSmile: 0.25, browInnerUpLeft: 0.12, browInnerUpRight: 0.12 },
  error: {
    browInnerUpLeft: 0.7, browInnerUpRight: 0.7, browDownLeft: 0.1, mouthFrown: 0.45, eyeWideLeft: 0.1, eyeWideRight: 0.1,
  },
}

/** Where each state makes the eyes drift, added to the pointer-following gaze (thinking looks up and aside). */
export const GAZE_OFFSET: Record<LisaState, Gaze> = {
  idle: { x: 0, y: 0 },
  listening: { x: 0, y: 0.02 },
  processing: { x: -0.35, y: 0.45 },
  speaking: { x: 0, y: 0 },
  error: { x: 0, y: -0.35 },
}

/** Splits a pose into channels the model has and channels it lacks. Unknown names are never applied. */
export function resolvePose(pose: Pose, available: ReadonlySet<string>): { applied: Pose; missing: string[] } {
  const applied: Pose = {}
  const missing: string[] = []
  for (const [name, weight] of Object.entries(pose)) (available.has(name) ? (applied[name] = weight) : missing.push(name))
  return { applied, missing }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Turns a gaze direction into the eyeLook* weights. The character faces the camera, so the screen-right
 * side is the character's left: looking right turns her left eye outward and her right eye inward.
 */
export function gazeToMorphs(gaze: Gaze, out: Pose = {}): Pose {
  const x = Math.max(-1, Math.min(1, gaze.x))
  const y = Math.max(-1, Math.min(1, gaze.y))
  out.eyeLookOutLeft = clamp01(x)
  out.eyeLookInRight = clamp01(x)
  out.eyeLookInLeft = clamp01(-x)
  out.eyeLookOutRight = clamp01(-x)
  out.eyeLookUpLeft = clamp01(y)
  out.eyeLookUpRight = clamp01(y)
  out.eyeLookDownLeft = clamp01(-y)
  out.eyeLookDownRight = clamp01(-y)
  return out
}
