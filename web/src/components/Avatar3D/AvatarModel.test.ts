import { Mesh, BoxGeometry, Group, Bone } from 'three'
import { buildBindings, findBone, reportMorphs } from './AvatarModel'
import { frameDistance } from './AvatarCamera'
import { EXPECTED_MORPHS } from './AvatarExpressions'
import { isMobileDevice, isWebGLAvailable } from './webgl'

/** A plain mesh that carries morph targets with the given names. */
function morphMesh(names: string[]) {
  const mesh = new Mesh(new BoxGeometry())
  mesh.morphTargetDictionary = Object.fromEntries(names.map((n, i) => [n, i]))
  mesh.morphTargetInfluences = names.map(() => 0)
  return mesh
}

describe('morph target discovery (nothing is assumed about the model)', () => {
  it('collects names from every mesh that has morph targets', () => {
    const root = new Group()
    root.add(morphMesh(['jawOpen', 'mouthSmile']), morphMesh(['jawOpen', 'eyeBlinkLeft']), new Mesh(new BoxGeometry()))
    const b = buildBindings(root)
    expect([...b.keys()].sort()).toEqual(['eyeBlinkLeft', 'jawOpen', 'mouthSmile'])
    expect(b.get('jawOpen')).toHaveLength(2) // jawOpen drives the face and the teeth
    expect(b.get('mouthSmile')?.[0].index).toBe(1)
  })
  it('reports exactly which expected channels the model is missing', () => {
    const root = new Group()
    root.add(morphMesh(['jawOpen', 'someUnknownTarget']))
    const r = reportMorphs(buildBindings(root))
    expect(r.found).toEqual(['jawOpen'])
    expect(r.missing).toContain('mouthSmile')
    expect(r.missing).not.toContain('jawOpen')
    expect(r.found.length + r.missing.length).toBe(EXPECTED_MORPHS.length)
    expect(r.all).toContain('someUnknownTarget')
  })
  it('an empty model gives an empty binding, not a crash', () => {
    const r = reportMorphs(buildBindings(new Group()))
    expect(r.found).toEqual([])
    expect(r.missing).toHaveLength(EXPECTED_MORPHS.length)
  })
  it('finds bones under both spellings of the name', () => {
    const root = new Group()
    const a = new Bone(); a.name = 'mixamorigHead'
    const b = new Bone(); b.name = 'mixamorig:Neck'
    root.add(a, b)
    expect(findBone(root, 'Head')).toBe(a)
    expect(findBone(root, 'Neck')).toBe(b)
    expect(findBone(root, 'Spine1')).toBeUndefined()
  })
})

describe('camera framing', () => {
  it('moves further back for a narrower (phone) window so the width still fits', () => {
    const wide = frameDistance(24, 16 / 9, 0.86, 0.66)
    const phone = frameDistance(24, 9 / 19, 0.86, 0.66)
    expect(phone).toBeGreaterThan(wide)
  })
  it('the framed area really fits at the computed distance', () => {
    const fov = 24
    for (const aspect of [0.45, 1, 1.78]) {
      const d = frameDistance(fov, aspect, 0.86, 0.66)
      const viewH = 2 * d * Math.tan((fov * Math.PI) / 360)
      expect(viewH).toBeGreaterThanOrEqual(0.86 - 1e-9)
      expect(viewH * aspect).toBeGreaterThanOrEqual(0.66 - 1e-9)
    }
  })
})

describe('device checks', () => {
  it('reports no WebGL in this test environment, so the fallback is used', () => {
    expect(isWebGLAvailable()).toBe(false)
  })
  it('does not treat a desktop-sized window as mobile', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia
    expect(isMobileDevice()).toBe(false)
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
    expect(isMobileDevice()).toBe(true)
  })
})
