import { BlinkController, breathPitch, clamp, damp, headMotion } from './AvatarAnimation'
import { STATES } from '../../state'

/** A small seeded random generator so the tests are repeatable. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe('damp (frame-independent smoothing)', () => {
  it('moves towards the target without overshooting', () => {
    let v = 0
    for (let i = 0; i < 200; i++) {
      const next = damp(v, 1, 6, 1 / 60)
      expect(next).toBeGreaterThanOrEqual(v)
      expect(next).toBeLessThanOrEqual(1)
      v = next
    }
    expect(v).toBeGreaterThan(0.99)
  })

  it('gives the same result whatever the frame rate', () => {
    let fine = 0
    for (let i = 0; i < 10; i++) fine = damp(fine, 1, 5, 0.01)
    expect(damp(0, 1, 5, 0.1)).toBeCloseTo(fine, 10)
  })

  it('does nothing for dt = 0 or lambda = 0', () => {
    expect(damp(0.3, 1, 5, 0)).toBe(0.3)
    expect(damp(0.3, 1, 0, 0.1)).toBe(0.3)
  })

  it('clamp keeps values in range', () => {
    expect([clamp(-1), clamp(0.4), clamp(7), clamp(5, 0, 3)]).toEqual([0, 0.4, 1, 3])
  })
})

describe('BlinkController', () => {
  const blinks = (fps: number, seconds: number, seed = 7) => {
    const blink = new BlinkController(seeded(seed))
    let count = 0
    let wasClosed = false
    let min = 1
    let max = 0
    for (let i = 0; i < seconds * fps; i++) {
      const v = blink.update(1 / fps)
      min = Math.min(min, v)
      max = Math.max(max, v)
      const closed = v >= 0.5
      if (closed && !wasClosed) count++
      wasClosed = closed
    }
    return { count, min, max }
  }

  it('starts with open eyes', () => {
    expect(new BlinkController(seeded(1)).update(0.016)).toBe(0)
  })

  it('blinks about every 2 to 6 seconds, sometimes twice quickly', () => {
    const { count, min, max } = blinks(60, 120)
    expect(count).toBeGreaterThanOrEqual(15)
    expect(count).toBeLessThanOrEqual(45)
    expect(min).toBe(0)
    expect(max).toBe(1)
  })

  it('blinks the same amount at 30, 60 and 144 fps', () => {
    const a = blinks(30, 120).count
    const b = blinks(60, 120).count
    const c = blinks(144, 120).count
    expect(Math.abs(a - b)).toBeLessThanOrEqual(2)
    expect(Math.abs(c - b)).toBeLessThanOrEqual(2)
  })

  it('stays within 0..1 and survives a very long frame (a hidden tab)', () => {
    const blink = new BlinkController(seeded(3))
    for (const dt of [0.016, 5, 0.5, 30, 0.016]) {
      const v = blink.update(dt)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('a blink closes and then reopens smoothly', () => {
    const blink = new BlinkController(() => 0) // shortest wait: 2.2 s, no double blink
    const values: number[] = []
    for (let i = 0; i < 60 * 3; i++) values.push(blink.update(1 / 60))
    const peak = values.indexOf(1)
    expect(peak).toBeGreaterThan(0)
    expect(values[peak - 1]).toBeLessThan(1)
    expect(values[values.length - 1]).toBe(0)
    for (let i = 1; i < peak; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
  })
})

describe('head and breathing motion', () => {
  it.each(STATES)('%s keeps head angles small (under 0.25 rad) for a whole minute', (state) => {
    for (let t = 0; t < 60; t += 0.1) {
      const m = headMotion(t, state, 1)
      expect(Math.abs(m.yaw)).toBeLessThan(0.25)
      expect(Math.abs(m.pitch)).toBeLessThan(0.25)
      expect(Math.abs(m.roll)).toBeLessThan(0.25)
    }
  })

  it('tilts the head when listening, tips it down on error, and nods more when louder', () => {
    const avg = (state: Parameters<typeof headMotion>[1], pick: 'pitch' | 'roll', level = 0) => {
      let s = 0
      for (let t = 0; t < 60; t += 0.1) s += headMotion(t, state, level)[pick]
      return s / 600
    }
    expect(avg('listening', 'roll')).toBeGreaterThan(0.04)
    expect(avg('error', 'pitch')).toBeGreaterThan(0.08)
    expect(avg('speaking', 'pitch', 1)).toBeGreaterThan(avg('speaking', 'pitch', 0) + 0.03)
  })

  it('breathing is small and repeats every 4.6 seconds', () => {
    for (let t = 0; t < 20; t += 0.25) expect(Math.abs(breathPitch(t))).toBeLessThanOrEqual(0.014 + 1e-9)
    expect(breathPitch(1.3)).toBeCloseTo(breathPitch(1.3 + 4.6), 9)
  })
})
