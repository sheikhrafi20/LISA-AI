import { LIP_MORPHS, LipSyncAnalyzer, computeFeatures, poseFromFeatures, silentPose } from './LipSync'

const RATE = 48000
const BINS = 512

/** One analysis frame: a sine wave of the given loudness in the time data, and a spectrum with one peak. */
function frame(peakHz: number, amplitude: number) {
  const time = new Float32Array(1024)
  for (let i = 0; i < time.length; i++) time[i] = amplitude * Math.sin((2 * Math.PI * peakHz * i) / RATE)
  const freq = new Float32Array(BINS)
  const binHz = RATE / (2 * BINS)
  for (let i = 0; i < BINS; i++) freq[i] = -100 + 70 * Math.exp(-(((i * binHz - peakHz) / 120) ** 2))
  return { time, freq }
}

const pose = (hz: number, amp = 0.3) => {
  const { time, freq } = frame(hz, amp)
  return poseFromFeatures(computeFeatures(time, freq, RATE))
}

describe('computeFeatures', () => {
  it('measures loudness, and silence is silence', () => {
    expect(computeFeatures(...(Object.values(frame(500, 0)) as [Float32Array, Float32Array]), RATE).level).toBe(0)
    const loud = computeFeatures(frame(500, 0.4).time, frame(500, 0.4).freq, RATE).level
    const soft = computeFeatures(frame(500, 0.05).time, frame(500, 0.05).freq, RATE).level
    expect(loud).toBeGreaterThan(soft)
    expect(loud).toBeGreaterThan(0.9)
    expect(soft).toBeGreaterThan(0)
  })
  it('finds the brightness of the sound', () => {
    const low = computeFeatures(frame(450, 0.3).time, frame(450, 0.3).freq, RATE).centroid
    const high = computeFeatures(frame(2300, 0.3).time, frame(2300, 0.3).freq, RATE).centroid
    expect(low).toBeGreaterThan(350)
    expect(low).toBeLessThan(600)
    expect(high).toBeGreaterThan(2000)
    expect(high).toBeLessThan(2600)
  })
  it('detects "s" sounds from energy above 4 kHz', () => {
    const f = frame(6000, 0.3)
    expect(computeFeatures(f.time, f.freq, RATE).sibilance).toBeGreaterThan(0.8)
    const v = frame(500, 0.3)
    expect(computeFeatures(v.time, v.freq, RATE).sibilance).toBeLessThan(0.1)
  })
  it('copes with -Infinity decibels and empty input', () => {
    const freq = new Float32Array(BINS).fill(-Infinity)
    expect(computeFeatures(new Float32Array(1024), freq, RATE)).toEqual({ level: 0, centroid: 0, sibilance: 0 })
    expect(() => computeFeatures(new Float32Array(0), new Float32Array(0), RATE)).not.toThrow()
  })
})

describe('poseFromFeatures', () => {
  it('closes the mouth for silence', () => {
    expect(poseFromFeatures({ level: 0, centroid: 1500, sibilance: 0 })).toEqual(silentPose())
  })
  it('gives only channels that exist on the model, all within 0 to 1', () => {
    for (const hz of [300, 450, 900, 1400, 2300, 3000, 6000]) {
      const p = pose(hz)
      expect(Object.keys(p).sort()).toEqual([...LIP_MORPHS].sort())
      for (const v of Object.values(p)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
    }
  })
  it('"oo" pushes the lips forward with a small jaw opening', () => {
    const p = pose(450)
    expect(p.mouthFunnel).toBeGreaterThan(0.6)
    expect(p.mouthPucker).toBeGreaterThan(0.3)
    expect(p.jawOpen).toBeLessThan(0.5)
    expect(p.mouthStretch).toBeLessThan(0.1)
  })
  it('"aa" opens the jaw wide', () => {
    const p = pose(1400)
    expect(p.jawOpen).toBeGreaterThan(0.6)
    expect(p.mouthLowerDown).toBeGreaterThan(0.3)
    expect(p.mouthFunnel).toBeLessThan(0.1)
  })
  it('"ee" stretches the lips', () => {
    const p = pose(2300)
    expect(p.mouthStretch).toBeGreaterThan(0.5)
    expect(p.jawOpen).toBeLessThan(0.5)
    expect(p.mouthFunnel).toBeLessThan(0.1)
  })
  it('louder speech opens the mouth further', () => {
    expect(pose(1400, 0.4).jawOpen).toBeGreaterThan(pose(1400, 0.05).jawOpen)
  })
})

describe('LipSyncAnalyzer', () => {
  /** A stand-in AnalyserNode that serves whatever frame the test sets. */
  function fakeAnalyser() {
    const state = { frame: frame(1400, 0) }
    const node = {
      fftSize: 1024,
      frequencyBinCount: BINS,
      context: { sampleRate: RATE },
      getFloatTimeDomainData: (a: Float32Array) => a.set(state.frame.time),
      getFloatFrequencyData: (a: Float32Array) => a.set(state.frame.freq),
    }
    return { state, node: node as unknown as AnalyserNode }
  }

  it('opens quickly when speech starts and closes when it stops', () => {
    const { state, node } = fakeAnalyser()
    const lip = new LipSyncAnalyzer(node)
    state.frame = frame(1400, 0.4)
    for (let i = 0; i < 6; i++) lip.update(1 / 60)
    expect(lip.pose.jawOpen).toBeGreaterThan(0.5)
    state.frame = frame(1400, 0)
    for (let i = 0; i < 60; i++) lip.update(1 / 60)
    expect(lip.pose.jawOpen).toBeLessThan(0.02)
  })
  it('opens faster than it closes (attack faster than release)', () => {
    const { state, node } = fakeAnalyser()
    const lip = new LipSyncAnalyzer(node)
    state.frame = frame(1400, 0.4)
    lip.update(1 / 30)
    const opened = lip.pose.jawOpen
    for (let i = 0; i < 20; i++) lip.update(1 / 60)
    const full = lip.pose.jawOpen
    state.frame = frame(1400, 0)
    lip.update(1 / 30)
    expect(opened / full).toBeGreaterThan(1 - (full - lip.pose.jawOpen) / full)
  })
  it('is frame rate independent', () => {
    const run = (fps: number) => {
      const { state, node } = fakeAnalyser()
      const lip = new LipSyncAnalyzer(node)
      state.frame = frame(1400, 0.4)
      for (let i = 0; i < fps * 0.1; i++) lip.update(1 / fps)
      return lip.pose.jawOpen
    }
    expect(run(30)).toBeCloseTo(run(120), 2)
  })
  it('reset closes the mouth at once', () => {
    const { state, node } = fakeAnalyser()
    const lip = new LipSyncAnalyzer(node)
    state.frame = frame(1400, 0.4)
    for (let i = 0; i < 10; i++) lip.update(1 / 60)
    lip.reset()
    expect(Object.values(lip.pose).every((v) => v === 0)).toBe(true)
  })
  it('configures an analyser for speech', () => {
    const a = { fftSize: 0, smoothingTimeConstant: 0, minDecibels: 0, maxDecibels: 0 } as unknown as AnalyserNode
    LipSyncAnalyzer.configure(a)
    expect(a.fftSize).toBe(1024)
    expect(a.smoothingTimeConstant).toBeCloseTo(0.4)
  })
})
