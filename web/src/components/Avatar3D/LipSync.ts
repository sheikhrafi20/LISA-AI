import type { Pose } from '../../types/avatar'
import { clamp, damp } from './AvatarAnimation'

/**
 * Audio-driven mouth animation.
 *
 * It listens to the real audio that is playing (a Web Audio AnalyserNode), not to the text, and turns the
 * loudness and the "brightness" of the sound into mouth shapes that exist on LISA's model:
 *   loudness -> how far the jaw opens
 *   low, dark vowels (oo, oh) -> lips pushed forward (mouthFunnel, mouthPucker)
 *   open vowels (aa) -> jaw and lower lip down
 *   bright vowels (ee) and "s" sounds -> lips stretched
 * This is an energy and spectrum approximation of the vowel, not phoneme recognition.
 */
export const LIP_MORPHS = [
  'jawOpen', 'mouthFunnel', 'mouthPucker', 'mouthStretch', 'mouthLowerDown', 'mouthUpperUp', 'mouthSmile',
] as const

export interface Features {
  /** 0 (silence) to 1 (loud). */
  level: number
  /** Spectral centroid in Hz over 200 to 3500 Hz: low for "oo", high for "ee". */
  centroid: number
  /** Share of energy above 4 kHz ("s", "sh", "f" sounds), 0 to 1. */
  sibilance: number
}

const GATE = 0.01 // RMS below this is treated as silence (background noise)
const REFERENCE = 0.2 // RMS that counts as "loud" speech

/** Measures one analysis frame. `freqDb` is AnalyserNode.getFloatFrequencyData (decibels per bin). */
export function computeFeatures(time: Float32Array, freqDb: Float32Array, sampleRate: number): Features {
  let sum = 0
  for (let i = 0; i < time.length; i++) sum += time[i] * time[i]
  const rms = Math.sqrt(sum / Math.max(1, time.length))
  const level = clamp((rms - GATE) / (REFERENCE - GATE))
  const binHz = sampleRate / (2 * freqDb.length)
  let weighted = 0
  let band = 0
  let high = 0
  let total = 0
  for (let i = 1; i < freqDb.length; i++) {
    const f = i * binHz
    const p = Number.isFinite(freqDb[i]) ? Math.pow(10, freqDb[i] / 10) : 0
    if (f >= 200 && f <= 3500) { weighted += f * p; band += p }
    if (f >= 200 && f <= 9000) total += p
    if (f >= 4000 && f <= 9000) high += p
  }
  return { level, centroid: band > 0 ? weighted / band : 0, sibilance: total > 0 ? high / total : 0 }
}

/** Triangular membership: 0 outside [lo, hi], 1 at `peak`. */
const tri = (x: number, lo: number, peak: number, hi: number) =>
  x <= lo || x >= hi ? 0 : x < peak ? (x - lo) / (peak - lo) : (hi - x) / (hi - peak)

export function silentPose(): Pose {
  return Object.fromEntries(LIP_MORPHS.map((m) => [m, 0]))
}

/** Mouth shape for one frame of features. */
export function poseFromFeatures(f: Features): Pose {
  if (f.level <= 0.01) return silentPose()
  const c = f.centroid
  let oo = tri(c, 0, 450, 850)
  let oh = tri(c, 600, 900, 1250)
  let aa = tri(c, 1000, 1400, 1900)
  let ee = tri(c, 1600, 2300, 3300)
  const norm = oo + oh + aa + ee
  if (norm > 0) { oo /= norm; oh /= norm; aa /= norm; ee /= norm } else { aa = 0.5 } // unvoiced noise: half-open
  const s = clamp((f.sibilance - 0.35) / 0.4)
  const L = f.level
  return {
    jawOpen: clamp(L * (oo * 0.35 + oh * 0.65 + aa + ee * 0.4) * 0.9 + L * s * 0.15),
    mouthFunnel: clamp(L * (oo + oh * 0.55)),
    mouthPucker: clamp(L * oo * 0.6),
    mouthStretch: clamp(L * (ee * 0.8 + s * 0.3)),
    mouthLowerDown: clamp(L * (aa * 0.6 + oh * 0.2)),
    mouthUpperUp: clamp(L * (ee * 0.2 + s * 0.25)),
    mouthSmile: clamp(L * ee * 0.35),
  }
}

/** Reads an AnalyserNode every frame and returns a smoothed mouth pose (opens fast, closes a bit slower). */
export class LipSyncAnalyzer {
  readonly pose: Pose = silentPose()
  private time = new Float32Array(0)
  private freq = new Float32Array(0)

  constructor(private analyser: AnalyserNode, private attack = 30, private release = 14) {
    this.time = new Float32Array(analyser.fftSize)
    this.freq = new Float32Array(analyser.frequencyBinCount)
  }

  /** Settings that suit speech. Call once on a new AnalyserNode. */
  static configure(analyser: AnalyserNode) {
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.4
    analyser.minDecibels = -100
    analyser.maxDecibels = -20
  }

  update(dt: number): Pose {
    this.analyser.getFloatTimeDomainData(this.time)
    this.analyser.getFloatFrequencyData(this.freq)
    const target = poseFromFeatures(computeFeatures(this.time, this.freq, this.analyser.context.sampleRate))
    for (const name of LIP_MORPHS) {
      const now = this.pose[name]
      this.pose[name] = damp(now, target[name], target[name] > now ? this.attack : this.release, dt)
    }
    return this.pose
  }

  /** Closes the mouth immediately (used when speech stops). */
  reset() {
    for (const name of LIP_MORPHS) this.pose[name] = 0
  }
}
