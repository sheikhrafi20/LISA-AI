import { LIP_MORPHS, LipSyncAnalyzer, computeFeatures, poseFromFeatures, silentPose, type Features } from './LipSync'
import { BODY_MORPHS } from './AvatarExpressions'

const SAMPLE_RATE = 48000
const BINS = 512

/** A spectrum (in dB per bin) with one smooth peak at `hz`, like a vowel with one strong formant. */
const spectrum = (hz: number, width = 250, floor = -100) => {
  const out = new Float32Array(BINS).fill(floor)
  const binHz = SAMPLE_RATE / (2 * BINS)
  for (let i = 0; i < BINS; i++) out[i] = Math.max(floor, -4 - ((i * binHz - hz) / width) ** 2 * 10)
  return out
}
const sine = (amp: number, hz = 220, n = 1024) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE))

const oo: Features = { level: 0.8, centroid: 450, sibilance: 0.05 }
const aa: Features = { level: 0.8, centroid: 1400, sibilance: 0.05 }
const ee: Features = { level: 0.8, centroid: 2300, sibilance: 0.1 }

describe('computeFeatures', () => {
  it('treats silence as level 0', () => {
    const f = computeFeatures(new Float32Array(1024), new Float32Array(BINS).fill(-Infinity), SAMPLE_RATE)
    expect(f).toEqual({ level: 0, centroid: 0, sibilance: 0 })
  })

  it('ignores very quiet background noise', () => {
    expect(computeFeatures(sine(0.01), spectrum(500), SAMPLE_RATE).level).toBe(0)
  })

  it('gets louder with a bigger signal', () => {
    const quiet = computeFeatures(sine(0.05), spectrum(500), SAMPLE_RATE).level
    const loud = computeFeatures(sine(0.4), spectrum(500), SAMPLE_RATE).level
    expect(loud).toBeGreaterThan(quiet)
    expect(loud).toBeLessThanOrEqual(1)
  })

  it.each([450, 1400, 2300])('finds a spectral peak near %i Hz', (hz) => {
    expect(computeFeatures(sine(0.3), spectrum(hz), SAMPLE_RATE).centroid).toBeGreaterThan(hz * 0.85)
    expect(computeFeatures(sine(0.3), spectrum(hz), SAMPLE_RATE).centroid).toBeLessThan(hz * 1.15)
  })

  it('detects high-frequency (s, sh) energy', () => {
    const s = computeFeatures(sine(0.3), spectrum(6500, 900), SAMPLE_RATE)
    expect(s.sibilance).toBeGreaterThan(0.6)
    expect(computeFeatures(sine(0.3), spectrum(500), SAMPLE_RATE).sibilance).toBeLessThan(0.1)
  })
})

describe('poseFromFeatures', () => {
  it('closes the mouth for silence', () => {
    expect(poseFromFeatures({ level: 0, centroid: 1400, sibilance: 0 })).toEqual(silentPose())
  })

  it('oo: lips pushed forward, jaw only a little open', () => {
    const p = poseFromFeatures(oo)
    expect(p.mouthFunnel).toBeGreaterThan(0.6)
    expect(p.mouthPucker).toBeGreaterThan(0.3)
    expect(p.jawOpen).toBeLessThan(0.45)
  })

  it('aa: jaw wide open, lower lip down, no lip rounding', () => {
    const p = poseFromFeatures(aa)
    expect(p.jawOpen).toBeGreaterThan(0.6)
    expect(p.mouthLowerDown).toBeGreaterThan(0.35)
    expect(p.mouthFunnel).toBeLessThan(0.1)
  })

  it('ee: lips stretched, jaw not very open', () => {
    const p = poseFromFeatures(ee)
    expect(p.mouthStretch).toBeGreaterThan(0.45)
    expect(p.jawOpen).toBeLessThan(0.45)
    expect(p.mouthSmile).toBeGreaterThan(0.1)
  })

  it('the three vowels are clearly different shapes', () => {
    const [a, b, c] = [oo, aa, ee].map(poseFromFeatures)
    expect(b.jawOpen).toBeGreaterThan(a.jawOpen)
    expect(b.jawOpen).toBeGreaterThan(c.jawOpen)
    expect(a.mouthFunnel).toBeGreaterThan(c.mouthFunnel)
    expect(c.mouthStretch).toBeGreaterThan(a.mouthStretch)
  })

  it('a louder voice opens the jaw further', () => {
    const soft = poseFromFeatures({ ...aa, level: 0.2 }).jawOpen
    const loud = poseFromFeatures({ ...aa, level: 0.9 }).jawOpen
    expect(loud).toBeGreaterThan(soft * 2)
  })

  it('hissing sounds slightly open and stretch the mouth', () => {
    const p = poseFromFeatures({ level: 0.7, centroid: 0, sibilance: 0.9 })
    expect(p.jawOpen).toBeGreaterThan(0.1)
    expect(p.mouthStretch).toBeGreaterThan(0.1)
  })

  it('only uses morph targets the model has, and keeps weights between 0 and 1', () => {
    for (const c of [0, 100, 450, 900, 1400, 1900, 2300, 3300, 5000]) {
      for (const level of [0, 0.3, 1]) {
        const pose = poseFromFeatures({ level, centroid: c, sibilance: 0.9 })
        for (const [name, weight] of Object.entries(pose)) {
          expect((BODY_MORPHS as readonly string[]).includes(name)).toBe(true)
          expect(weight).toBeGreaterThanOrEqual(0)
          expect(weight).toBeLessThanOrEqual(1)
        }
      }
    }
    expect(Object.keys(silentPose())).toEqual([...LIP_MORPHS])
  })
})

/** A stand-in AnalyserNode that serves fixed audio data. */
function fakeAnalyser(time: Float32Array, freq: Float32Array) {
  const data = { time, freq }
  const node = {
    fftSize: 1024,
    frequencyBinCount: BINS,
    context: { sampleRate: SAMPLE_RATE },
    getFloatTimeDomainData: (a: Float32Array) => a.set(data.time),
    getFloatFrequencyData: (a: Float32Array) => a.set(data.freq),
  }
  return { node: node as unknown as AnalyserNode, data }
}

describe('LipSyncAnalyzer', () => {
  const ahh = () => fakeAnalyser(sine(0.4), spectrum(1400))

  it('opens the jaw while a vowel plays and closes it in silence', () => {
    const { node, data } = ahh()
    const lips = new LipSyncAnalyzer(node)
    for (let i = 0; i < 20; i++) lips.update(1 / 60)
    expect(lips.pose.jawOpen).toBeGreaterThan(0.5)
    data.time = new Float32Array(1024)
    data.freq = new Float32Array(BINS).fill(-Infinity)
    for (let i = 0; i < 60; i++) lips.update(1 / 60)
    expect(lips.pose.jawOpen).toBeLessThan(0.02)
  })

  it('opens faster than it closes', () => {
    const { node, data } = ahh()
    const lips = new LipSyncAnalyzer(node)
    for (let i = 0; i < 3; i++) lips.update(1 / 60)
    const opened = lips.pose.jawOpen
    const peak = new LipSyncAnalyzer(node)
    for (let i = 0; i < 40; i++) peak.update(1 / 60)
    data.time = new Float32Array(1024)
    data.freq = new Float32Array(BINS).fill(-Infinity)
    const before = peak.pose.jawOpen
    for (let i = 0; i < 3; i++) peak.update(1 / 60)
    const closedBy = before - peak.pose.jawOpen
    expect(opened / before).toBeGreaterThan(closedBy / before)
  })

  it('gives the same mouth whatever the frame rate', () => {
    const a = new LipSyncAnalyzer(ahh().node)
    const b = new LipSyncAnalyzer(ahh().node)
    for (let i = 0; i < 6; i++) a.update(1 / 60)
    for (let i = 0; i < 12; i++) b.update(1 / 120)
    expect(a.pose.jawOpen).toBeCloseTo(b.pose.jawOpen, 6)
  })

  it('reset closes the mouth at once', () => {
    const lips = new LipSyncAnalyzer(ahh().node)
    for (let i = 0; i < 20; i++) lips.update(1 / 60)
    lips.reset()
    expect(Object.values(lips.pose).every((v) => v === 0)).toBe(true)
  })

  it('configure sets speech-friendly analyser settings', () => {
    const node = { fftSize: 2048, smoothingTimeConstant: 0.8, minDecibels: -90, maxDecibels: -10 } as AnalyserNode
    LipSyncAnalyzer.configure(node)
    expect([node.fftSize, node.smoothingTimeConstant, node.minDecibels, node.maxDecibels]).toEqual([1024, 0.4, -100, -20])
  })
})
