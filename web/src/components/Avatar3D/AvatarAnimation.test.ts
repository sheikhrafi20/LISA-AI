import { BlinkController, breathPitch, clamp, damp, headMotion } from './AvatarAnimation'
import { STATES } from '../../state'

/** A small deterministic random generator so the blink tests give the same result every run. */
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Counts blinks in `seconds` of simulated time at a fixed frame rate. */
function countBlinks(fps: number, seconds: number, seed: number) {
  const blink = new BlinkController(seeded(seed))
  const dt = 1 / fps
  let blinks = 0
  let was = 0
  let max = 0
  let min = 1
  for (let i = 0; i < seconds * fps; i++) {
    const v = blink.update(dt)
    max = Math.max(max, v); min = Math.min(min, v)
    if (v > 0.5 && was <= 0.5) blinks++
    was = v
  }
  return { blinks, max, min }
}

describe('damp (frame independent smoothing)', () => {
  it('moves towards the target without overshooting', () => {
    let v = 0
    for (let i = 0; i < 100; i++) { v = damp(v, 1, 6, 1 / 60); expect(v).toBeLessThanOrEqual(1) }
    expect(v).toBeGreaterThan(0.99)
  })
  it('gives the same result for one big step and many small steps', () => {
    const once = damp(0, 1, 6, 0.5)
    let many = 0
    for (let i = 0; i < 50; i++) many = damp(many, 1, 6, 0.01)
    expect(many).toBeCloseTo(once, 10)
  })
  it('does not move when dt is 0', () => {
    expect(damp(0.3, 1, 6, 0)).toBe(0.3)
  })
})

describe('natural blinking', () => {
  it('blinks at a human rate (roughly 8 to 25 times a minute)', () => {
    const { blinks } = countBlinks(60, 120, 7)
    expect(blinks / 2).toBeGreaterThan(8)
    expect(blinks / 2).toBeLessThan(25)
  })
  it('fully closes and fully opens, never leaving 0 to 1', () => {
    const { max, min } = countBlinks(60, 60, 3)
    expect(max).toBeCloseTo(1, 5)
    expect(min).toBe(0)
  })
  it('blinks about as often at 30 fps as at 144 fps', () => {
    const slow = countBlinks(30, 300, 11).blinks
    const fast = countBlinks(144, 300, 11).blinks
    expect(Math.abs(slow - fast)).toBeLessThanOrEqual(Math.ceil(fast * 0.1))
  })
  it('survives a huge frame gap without breaking', () => {
    const blink = new BlinkController(seeded(1))
    const v = blink.update(30)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  })
  it('stays open most of the time', () => {
    const blink = new BlinkController(seeded(5))
    let closed = 0
    for (let i = 0; i < 6000; i++) if (blink.update(1 / 60) > 0.5) closed++
    expect(closed / 6000).toBeLessThan(0.1)
  })
})

describe('breathing and head movement', () => {
  it('breathing is a small periodic tilt', () => {
    let max = 0
    for (let t = 0; t < 20; t += 0.05) max = Math.max(max, Math.abs(breathPitch(t)))
    expect(max).toBeGreaterThan(0.01)
    expect(max).toBeLessThan(0.02)
    expect(breathPitch(0)).toBeCloseTo(0)
  })
  it('head movement stays small in every state', () => {
    for (const s of STATES) {
      for (let t = 0; t < 60; t += 0.1) {
        const h = headMotion(t, s, 1)
        for (const a of [h.yaw, h.pitch, h.roll]) expect(Math.abs(a)).toBeLessThan(0.25)
      }
    }
  })
  it('listening tilts the head, speaking adds nods with the voice level', () => {
    expect(Math.abs(headMotion(0, 'listening').roll)).toBeGreaterThan(0.05)
    expect(headMotion(2, 'speaking', 1).pitch).toBeGreaterThan(headMotion(2, 'speaking', 0).pitch)
  })
  it('clamp keeps values in range', () => {
    expect(clamp(5)).toBe(1)
    expect(clamp(-2)).toBe(0)
    expect(clamp(0.4)).toBe(0.4)
  })
})
