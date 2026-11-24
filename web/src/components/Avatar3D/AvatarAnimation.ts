import type { LisaState } from '../../types/avatar'

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

/**
 * Frame-rate independent smoothing: moves `current` towards `target`. Stepping once with dt = 0.1
 * gives exactly the same result as ten steps of 0.01, so animation looks the same at 30 and 144 fps.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

/** Natural blinking: random gaps of about 2 to 6 seconds, sometimes a quick double blink. */
export class BlinkController {
  private phase: 'wait' | 'closing' | 'hold' | 'opening' = 'wait'
  private clock = 0
  private wait: number
  private double = false
  value = 0

  static readonly CLOSE = 0.07
  static readonly HOLD = 0.04
  static readonly OPEN = 0.12

  constructor(private rng: () => number = Math.random) {
    this.wait = this.interval()
  }

  private interval() {
    return 2.2 + this.rng() * 4.3
  }

  /** Advances by dt seconds and returns how closed the eyes are (0 open, 1 closed). */
  update(dt: number): number {
    let left = dt
    while (left > 0) {
      const need = this.phase === 'wait' ? this.wait - this.clock
        : this.phase === 'closing' ? BlinkController.CLOSE - this.clock
        : this.phase === 'hold' ? BlinkController.HOLD - this.clock
        : BlinkController.OPEN - this.clock
      const step = Math.min(left, Math.max(need, 0))
      this.clock += step
      left -= step
      if (this.clock + 1e-9 < need + (this.clock - step)) break // phase not finished
      this.clock = 0
      if (this.phase === 'wait') { this.phase = 'closing'; this.double = !this.double && this.rng() < 0.15 }
      else if (this.phase === 'closing') this.phase = 'hold'
      else if (this.phase === 'hold') this.phase = 'opening'
      else { this.phase = 'wait'; this.wait = this.double ? 0.14 : this.interval(); if (!this.double) this.double = false }
    }
    const t = this.clock
    const ease = (x: number) => x * x * (3 - 2 * x)
    this.value = this.phase === 'closing' ? ease(clamp(t / BlinkController.CLOSE))
      : this.phase === 'hold' ? 1
      : this.phase === 'opening' ? 1 - ease(clamp(t / BlinkController.OPEN))
      : 0
    return this.value
  }
}

/** Slow breathing: a tiny forward and back tilt of the upper spine, about 13 breaths a minute. */
export function breathPitch(t: number): number {
  return 0.014 * Math.sin((2 * Math.PI * t) / 4.6)
}

export interface HeadAngles { yaw: number; pitch: number; roll: number }

const wander = (t: number, a: number, b: number) => 0.6 * Math.sin(t * a) + 0.4 * Math.sin(t * b + 1.7)

/** Radians of head movement per state: gentle drift at rest, a tilt when listening, nods while speaking. */
const AMPLITUDE: Record<LisaState, { drift: number; pitch: number; roll: number }> = {
  idle: { drift: 0.035, pitch: 0, roll: 0 },
  listening: { drift: 0.025, pitch: 0.02, roll: 0.07 },
  processing: { drift: 0.015, pitch: -0.05, roll: -0.03 },
  speaking: { drift: 0.045, pitch: 0, roll: 0.02 },
  error: { drift: 0.01, pitch: 0.12, roll: 0 },
}

/** `level` (0 to 1) is how loud LISA is speaking; it adds small nods in time with her voice. */
export function headMotion(t: number, state: LisaState, level = 0): HeadAngles {
  const a = AMPLITUDE[state]
  return {
    yaw: a.drift * wander(t, 0.37, 0.91),
    pitch: a.pitch + a.drift * 0.6 * wander(t, 0.53, 1.21) + (state === 'speaking' ? 0.04 * level : 0),
    roll: a.roll + a.drift * 0.4 * wander(t, 0.29, 0.77),
  }
}

/**
 * Signs that map the angles above onto the model's head bone axes. Found by looking at renders of the
 * actual LISA model (positive yaw turns her towards the screen-right, positive pitch tips her chin down).
 */
export const HEAD_AXIS_SIGN = { yaw: 1, pitch: 1, roll: 1 } as const
