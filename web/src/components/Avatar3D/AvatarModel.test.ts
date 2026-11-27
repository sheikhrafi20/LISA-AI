import { Group, Mesh, Object3D } from 'three'
import { buildBindings, findBone, reportMorphs } from './AvatarModel'
import { frameDistance } from './AvatarCamera'
import { EXPECTED_MORPHS } from './AvatarExpressions'
import { isMobileDevice, isWebGLAvailable } from './webgl'

const morphMesh = (names: string[]) => {
  const mesh = new Mesh()
  mesh.morphTargetDictionary = Object.fromEntries(names.map((n, i) => [n, i]))
  mesh.morphTargetInfluences = names.map(() => 0)
  return mesh
}

describe('model inspection (nothing is assumed)', () => {
  it('finds bones whichever way the loader spelled the name', () => {
    const root = new Group()
    const head = new Object3D(); head.name = 'mixamorigHead'
    const neck = new Object3D(); neck.name = 'mixamorig:Neck'
    root.add(head, neck)
    expect(findBone(root, 'Head')).toBe(head)
    expect(findBone(root, 'Neck')).toBe(neck)
    expect(findBone(root, 'Spine1')).toBeUndefined()
  })

  it('collects morph targets across several meshes (face, teeth, lashes...)', () => {
    const root = new Group()
    const face = morphMesh(['jawOpen', 'eyeBlinkLeft'])
    const teeth = morphMesh(['jawOpen'])
    root.add(face, teeth, new Mesh())
    const bindings = buildBindings(root)
    expect(bindings.get('jawOpen')).toEqual([{ mesh: face, index: 0 }, { mesh: teeth, index: 0 }])
    expect(bindings.get('eyeBlinkLeft')).toEqual([{ mesh: face, index: 1 }])
    expect(bindings.has('mouthSmile')).toBe(false)
  })

  it('reports exactly which expected morph targets are missing', () => {
    const root = new Group()
    root.add(morphMesh(['jawOpen', 'someOtherShape']))
    const report = reportMorphs(buildBindings(root))
    expect(report.found).toEqual(['jawOpen'])
    expect(report.missing).toHaveLength(EXPECTED_MORPHS.length - 1)
    expect(report.missing).not.toContain('jawOpen')
    expect(report.all).toEqual(['jawOpen', 'someOtherShape'])
  })

  it('a model with no morph targets reports everything missing', () => {
    const report = reportMorphs(buildBindings(new Group()))
    expect(report.found).toEqual([])
    expect(report.missing).toHaveLength(EXPECTED_MORPHS.length)
  })
})

describe('camera framing', () => {
  it('fits the height on a wide window and the width on a tall phone', () => {
    const wide = frameDistance(24, 16 / 9, 0.86, 0.66)
    const tall = frameDistance(24, 9 / 19, 0.86, 0.66)
    expect(wide).toBeCloseTo(0.86 / 2 / Math.tan((24 * Math.PI) / 360), 6)
    expect(tall).toBeGreaterThan(wide)
  })

  it('moves back for a bigger region', () => {
    expect(frameDistance(24, 1, 1.2, 0.9)).toBeGreaterThan(frameDistance(24, 1, 0.8, 0.6))
  })
})

describe('WebGL detection', () => {
  afterEach(() => { vi.restoreAllMocks(); delete (window as unknown as Record<string, unknown>).WebGLRenderingContext })

  it('is false when the browser has no WebGL (as in this test environment)', () => {
    expect(isWebGLAvailable()).toBe(false)
  })

  it('is true when a WebGL context can be created', () => {
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function () {}
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
    expect(isWebGLAvailable()).toBe(true)
  })

  it('is false when creating a context fails or throws', () => {
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function () {}
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    spy.mockReturnValue(null)
    expect(isWebGLAvailable()).toBe(false)
    spy.mockImplementation(() => { throw new Error('blocked') })
    expect(isWebGLAvailable()).toBe(false)
  })

  it('detects touch devices and small screens for the lower pixel ratio', () => {
    const original = window.matchMedia
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
    expect(isMobileDevice()).toBe(true)
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia
    expect(isMobileDevice()).toBe(window.innerWidth < 640)
    window.matchMedia = original
  })
})
