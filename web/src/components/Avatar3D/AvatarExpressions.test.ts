import { BODY_MORPHS, EXPECTED_MORPHS, EYE_LOOK_MORPHS, GAZE_OFFSET, STATE_POSES, gazeToMorphs, resolvePose } from './AvatarExpressions'
import { LIP_MORPHS } from './LipSync'
import { STATES } from '../../state'

describe('expressions only use morph targets the model has', () => {
  const known = new Set<string>(EXPECTED_MORPHS)

  it('every state pose uses known morph names with weights between 0 and 1', () => {
    for (const s of STATES) {
      for (const [name, weight] of Object.entries(STATE_POSES[s])) {
        expect(known.has(name), `${s}: "${name}" is not a morph target of the model`).toBe(true)
        expect(weight).toBeGreaterThanOrEqual(0)
        expect(weight).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every lip-sync channel is a real morph target', () => {
    for (const name of LIP_MORPHS) expect(known.has(name), name).toBe(true)
  })

  it('every state has a pose and a gaze offset', () => {
    for (const s of STATES) {
      expect(Object.keys(STATE_POSES[s]).length).toBeGreaterThan(0)
      expect(GAZE_OFFSET[s]).toBeDefined()
    }
  })

  it('does not assume Oculus visemes or ARKit names the model lacks', () => {
    expect(known.has('viseme_aa')).toBe(false)
    expect(known.has('mouthSmileLeft')).toBe(false) // this model has one combined mouthSmile
    expect(BODY_MORPHS).toContain('mouthSmile')
    expect(EYE_LOOK_MORPHS).toHaveLength(8)
  })
})

describe('resolvePose', () => {
  it('applies known channels and reports unknown ones instead of faking them', () => {
    const { applied, missing } = resolvePose({ jawOpen: 0.5, viseme_aa: 1, mouthSmile: 0.2 }, new Set(['jawOpen', 'mouthSmile']))
    expect(applied).toEqual({ jawOpen: 0.5, mouthSmile: 0.2 })
    expect(missing).toEqual(['viseme_aa'])
  })
})

describe('gazeToMorphs', () => {
  it('looking to the screen right turns her left eye out and her right eye in', () => {
    const m = gazeToMorphs({ x: 0.6, y: 0 })
    expect(m.eyeLookOutLeft).toBeCloseTo(0.6)
    expect(m.eyeLookInRight).toBeCloseTo(0.6)
    expect(m.eyeLookInLeft).toBe(0)
    expect(m.eyeLookOutRight).toBe(0)
  })
  it('looking to the screen left is the mirror image', () => {
    const m = gazeToMorphs({ x: -0.4, y: 0 })
    expect(m.eyeLookInLeft).toBeCloseTo(0.4)
    expect(m.eyeLookOutRight).toBeCloseTo(0.4)
    expect(m.eyeLookOutLeft).toBe(0)
  })
  it('handles up, down and out-of-range input', () => {
    expect(gazeToMorphs({ x: 0, y: 5 }).eyeLookUpLeft).toBe(1)
    expect(gazeToMorphs({ x: 0, y: -0.5 }).eyeLookDownRight).toBeCloseTo(0.5)
    expect(gazeToMorphs({ x: 0, y: -0.5 }).eyeLookUpRight).toBe(0)
  })
  it('only produces the eyeLook channels, all of which exist after avatar:prepare', () => {
    const names = Object.keys(gazeToMorphs({ x: 0.3, y: 0.3 }))
    expect(names.sort()).toEqual([...EYE_LOOK_MORPHS].sort())
  })
})
