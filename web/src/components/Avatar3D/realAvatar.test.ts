// @vitest-environment node
import { existsSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'
import { dequantize } from '@gltf-transform/functions'
import { BODY_MORPHS, EYE_LOOK_MORPHS } from './AvatarExpressions'
import { PARTS } from '../../../scripts/prepare-avatar.mjs'

const GLB = new URL('../../../public/avatar/lisa.glb', import.meta.url).pathname
const has = existsSync(GLB)

/** Checks the REAL avatar file against what the code expects. Skipped if the file is not there yet. */
describe.skipIf(!has)('the real avatar file (public/avatar/lisa.glb)', () => {
  let root: ReturnType<Awaited<ReturnType<NodeIO['read']>>['getRoot']>
  beforeAll(async () => {
    const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).read(GLB)
    await doc.transform(dequantize())
    root = doc.getRoot()
  })

  const node = (part: string) => root.listNodes().find((n) => n.getMesh() && (n.getName() === part || n.getName().startsWith(part + '-')))!

  it('has every body part', () => {
    for (const p of PARTS) expect(node(p), p).toBeDefined()
  })
  it('has all the face morph targets the code uses, with real movement in them', () => {
    const mesh = node('body').getMesh()!
    const names: string[] = mesh.getExtras().targetNames as string[]
    expect([...names].sort()).toEqual([...BODY_MORPHS].sort())
    const prim = mesh.listPrimitives()[0]
    for (const key of ['jawOpen', 'mouthFunnel', 'mouthPucker', 'mouthStretch', 'mouthLowerDown', 'mouthUpperUp', 'mouthSmile', 'eyeBlinkLeft', 'eyeBlinkRight']) {
      const arr = prim.listTargets()[names.indexOf(key)].getAttribute('POSITION')!.getArray()!
      let max = 0
      for (const v of arr) max = Math.max(max, Math.abs(v))
      expect(max, `${key} must not be empty`).toBeGreaterThan(1e-4)
    }
  })
  it('has the 8 eye-look targets, all moving', () => {
    const mesh = node('eyes').getMesh()!
    expect((mesh.getExtras().targetNames as string[]).sort()).toEqual([...EYE_LOOK_MORPHS].sort())
    for (const t of mesh.listPrimitives()[0].listTargets()) {
      let max = 0
      for (const v of t.getAttribute('POSITION')!.getArray()!) max = Math.max(max, Math.abs(v))
      expect(max).toBeGreaterThan(1e-4)
    }
  })
  it('has the head, neck and spine bones used for movement and breathing', () => {
    const names = root.listNodes().map((n) => n.getName())
    for (const b of ['Head', 'Neck', 'Spine1', 'Spine2']) expect(names).toContain(`mixamorig:${b}`)
  })
})
