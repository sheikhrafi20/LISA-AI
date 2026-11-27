import { BODY_MORPHS, EXPECTED_MORPHS, EYE_LOOK_MORPHS, GAZE_OFFSET, STATE_POSES, gazeToMorphs, resolvePose } from './AvatarExpressions'
import { STATES } from '../../state'

const known = new Set<string>(EXPECTED_MORPHS)

describe('expressions only use morph targets the model really has', () => {
  it('has a pose for every state', () => {
    expect(Object.keys(STATE_POSES).sort()).toEqual([...STATES].sort())
  })

  it.each(STATES)('%s pose uses known names and weights between 0 and 1', (state) => {
    for (const [name, weight] of Object.entries(STATE_POSES[state])) {
      expect(known.has(name), `${name} is not a morph target of the LISA model`).toBe(true)
      expect(weight).toBeGreaterThanOrEqual(0)
      expect(weight).toBeLessThanOrEqual(1)
    }
  })

  it('has no duplicate morph names and keeps eye-look names separate', () => {
    expect(new Set(EXPECTED_MORPHS).size).toBe(EXPECTED_MORPHS.length)
    expect(EYE_LOOK_MORPHS).toHaveLength(8)
    expect(BODY_MORPHS).toHaveLength(34)
  })

  it('keeps gaze offsets within range', () => {
    for (const g of Object.values(GAZE_OFFSET)) {
      expect(Math.abs(g.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(g.y)).toBeLessThanOrEqual(1)
    }
  })

  it('resolvePose never applies a name the model lacks', () => {
    const { applied, missing } = resolvePose({ jawOpen: 0.5, madeUpShape: 1, mouthSmile: 0.2 }, new Set(['jawOpen', 'mouthSmile']))
    expect(applied).toEqual({ jawOpen: 0.5, mouthSmile: 0.2 })
    expect(missing).toEqual(['madeUpShape'])
  })
})

describe('gazeToMorphs', () => {
  const only = (pose: Record<string, number>) => Object.entries(pose).filter(([, v]) => v > 0)

  it('looking right (on screen) turns her left eye out and her right eye in', () => {
    expect(only(gazeToMorphs({ x: 1, y: 0 }))).toEqual([['eyeLookOutLeft', 1], ['eyeLookInRight', 1]])
  })

  it('looking left turns her left eye in and her right eye out', () => {
    expect(only(gazeToMorphs({ x: -0.5, y: 0 }))).toEqual([['eyeLookInLeft', 0.5], ['eyeLookOutRight', 0.5]])
  })

  it('looking up and down drives both eyes together', () => {
    expect(only(gazeToMorphs({ x: 0, y: 0.7 }))).toEqual([['eyeLookUpLeft', 0.7], ['eyeLookUpRight', 0.7]])
    expect(only(gazeToMorphs({ x: 0, y: -0.3 }))).toEqual([['eyeLookDownLeft', 0.3], ['eyeLookDownRight', 0.3]])
  })

  it('clamps out-of-range input and only writes eye-look channels', () => {
    const pose = gazeToMorphs({ x: 9, y: -9 })
    expect(pose.eyeLookOutLeft).toBe(1)
    expect(pose.eyeLookDownLeft).toBe(1)
    expect(Object.keys(pose).sort()).toEqual([...EYE_LOOK_MORPHS].sort())
  })

  it('reuses the object it is given (no allocation every frame)', () => {
    const out = { eyeBlinkLeft: 0.4 } as Record<string, number>
    expect(gazeToMorphs({ x: 0, y: 0 }, out)).toBe(out)
    expect(out.eyeBlinkLeft).toBe(0.4)
  })
})
