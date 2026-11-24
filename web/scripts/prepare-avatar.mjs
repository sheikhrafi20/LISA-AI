#!/usr/bin/env node
/**
 * Prepares a HumanForge/MakeHuman GLB for LISA.
 *
 *   node scripts/prepare-avatar.mjs <input.glb> <output.glb>
 *
 * What it does:
 *  1. Finds each part by its node name (body, eyes, brows, lashes, teeth, tongue, hair, clothes).
 *  2. Adds 8 eye-look morph targets (ARKit names eyeLookUp/Down/In/Out Left/Right) to the eyes mesh,
 *     because this rig has no eye bones and no eye-look shapes. The eyeballs are rotated about their own
 *     centres, so the eyes can follow a target at run time.
 *  3. Re-quantizes the geometry WITHOUT the glTF-Transform `sparse` step. In the HumanForge export that
 *     step left every body morph target empty (all zeros) in our tests, which silences lip-sync.
 *  4. Verifies the result and exits with an error if key facial morph targets are empty.
 */
import { NodeIO } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'
import { dedup, dequantize, prune, quantize } from '@gltf-transform/functions'
import { fileURLToPath } from 'node:url'

export const EYE_LOOK_DEGREES = 25
export const PARTS = ['body', 'eyes', 'eyebrows', 'eyelashes', 'teeth', 'tongue', 'hair', 'clothes']
export const KEY_TARGETS = ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthSmile', 'eyeBlinkLeft', 'eyeBlinkRight']

function partNode(root, part) {
  const found = root.listNodes().filter((n) => n.getMesh() && (n.getName() === part || n.getName().startsWith(part + '-')))
  if (found.length !== 1) throw new Error(`Expected exactly one "${part}" mesh node, found ${found.length}. Is this a HumanForge export?`)
  return found[0]
}

function maxAbs(array) {
  let m = 0
  for (let i = 0; i < array.length; i++) m = Math.max(m, Math.abs(array[i]))
  return m
}

/** Rotates (x,y,z) about the X axis (pitch) or Y axis (yaw) by `rad`. */
function rotate([x, y, z], axis, rad) {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return axis === 'pitch' ? [x, y * c - z * s, y * s + z * c] : [x * c + z * s, y, -x * s + z * c]
}

export async function prepare(inputPath, outputPath, log = console.log) {
  const io = new NodeIO().registerExtensions([KHRMeshQuantization])
  const doc = await io.read(inputPath)
  await doc.transform(dequantize())
  const root = doc.getRoot()
  const nodes = Object.fromEntries(PARTS.map((p) => [p, partNode(root, p)]))
  for (const part of PARTS) nodes[part].getMesh().setName(nodes[part].getName())

  // Which side is the character's left? Take it from the body's eyeBlinkLeft morph target.
  const bodyPrim = nodes.body.getMesh().listPrimitives()[0]
  const bodyNames = nodes.body.getMesh().getExtras().targetNames ?? []
  const blinkIdx = bodyNames.indexOf('eyeBlinkLeft')
  if (blinkIdx < 0) throw new Error('The body mesh has no eyeBlinkLeft morph target.')
  const basePos = bodyPrim.getAttribute('POSITION').getArray()
  const blink = bodyPrim.listTargets()[blinkIdx].getAttribute('POSITION').getArray()
  let sumX = 0
  let count = 0
  for (let i = 0; i < blink.length / 3; i++) {
    if (Math.abs(blink[3 * i]) + Math.abs(blink[3 * i + 1]) + Math.abs(blink[3 * i + 2]) > 1e-4) { sumX += basePos[3 * i]; count++ }
  }
  if (!count) throw new Error('eyeBlinkLeft has no movement, cannot tell which eye is the left one.')
  const leftSide = sumX / count > 0 ? 1 : -1 // +1: the character's left eye is on +X
  log(`left eye is on the ${leftSide > 0 ? '+X' : '-X'} side`)

  // Eye-look morph targets.
  const eyePrim = nodes.eyes.getMesh().listPrimitives()[0]
  if (eyePrim.listTargets().length) throw new Error('The eyes mesh already has morph targets; nothing to add.')
  const pos = eyePrim.getAttribute('POSITION').getArray()
  const n = pos.length / 3
  const sum = { 1: [0, 0, 0, 0], '-1': [0, 0, 0, 0] }
  for (let i = 0; i < n; i++) {
    const s = sum[pos[3 * i] > 0 ? 1 : -1]
    s[0] += pos[3 * i]; s[1] += pos[3 * i + 1]; s[2] += pos[3 * i + 2]; s[3]++
  }
  if (!sum[1][3] || !sum[-1][3]) throw new Error('Could not find two separate eyeballs in the eyes mesh.')
  const centre = (side) => sum[side].slice(0, 3).map((v) => v / sum[side][3])
  const rad = (EYE_LOOK_DEGREES * Math.PI) / 180
  const specs = []
  for (const [label, side] of [['Left', leftSide], ['Right', -leftSide]]) {
    // Pitch: a negative rotation about X lifts the front of the eye (the character faces +Z).
    specs.push([`eyeLookUp${label}`, side, 'pitch', -rad], [`eyeLookDown${label}`, side, 'pitch', rad])
    // Yaw: positive rotation about Y moves the front of the eye towards +X. "In" is towards the nose.
    specs.push([`eyeLookIn${label}`, side, 'yaw', -side * rad], [`eyeLookOut${label}`, side, 'yaw', side * rad])
  }
  for (const [name, side, axis, angle] of specs) {
    const c = centre(side)
    const deltas = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      if ((pos[3 * i] > 0 ? 1 : -1) !== side) continue
      const p = [pos[3 * i] - c[0], pos[3 * i + 1] - c[1], pos[3 * i + 2] - c[2]]
      const r = rotate(p, axis, angle)
      deltas[3 * i] = r[0] - p[0]; deltas[3 * i + 1] = r[1] - p[1]; deltas[3 * i + 2] = r[2] - p[2]
    }
    const accessor = doc.createAccessor(name).setType('VEC3').setArray(deltas)
    eyePrim.addTarget(doc.createPrimitiveTarget(name).setAttribute('POSITION', accessor))
  }
  const eyeMesh = nodes.eyes.getMesh()
  eyeMesh.setExtras({ ...eyeMesh.getExtras(), targetNames: specs.map((s) => s[0]) })
  eyeMesh.setWeights(specs.map(() => 0))

  await doc.transform(dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }))
  await io.write(outputPath, doc)
  return verify(outputPath, log)
}

/** Re-reads the written file and checks that the morph targets LISA needs really contain data. */
export async function verify(path, log = console.log) {
  const io = new NodeIO().registerExtensions([KHRMeshQuantization])
  const doc = await io.read(path)
  await doc.transform(dequantize())
  const root = doc.getRoot()
  const report = { path, parts: {}, bodyTargets: [], eyeTargets: [], triangles: 0, problems: [] }
  for (const part of PARTS) {
    const node = partNode(root, part)
    const prim = node.getMesh().listPrimitives()[0]
    const tris = Math.round(prim.getIndices().getCount() / 3)
    report.parts[part] = { node: node.getName(), triangles: tris, morphTargets: prim.listTargets().length }
    report.triangles += tris
  }
  const body = partNode(root, 'body').getMesh()
  const names = body.getExtras().targetNames ?? []
  report.bodyTargets = names
  for (const key of KEY_TARGETS) {
    const i = names.indexOf(key)
    if (i < 0) { report.problems.push(`body has no "${key}" target`); continue }
    const m = maxAbs(body.listPrimitives()[0].listTargets()[i].getAttribute('POSITION').getArray())
    if (m < 1e-4) report.problems.push(`body target "${key}" is empty (all zeros)`)
    log(`  ${key.padEnd(14)} max delta ${m.toFixed(4)}`)
  }
  const eyes = partNode(root, 'eyes').getMesh()
  report.eyeTargets = eyes.getExtras().targetNames ?? []
  eyes.listPrimitives()[0].listTargets().forEach((t, i) => {
    const m = maxAbs(t.getAttribute('POSITION').getArray())
    log(`  ${String(report.eyeTargets[i]).padEnd(18)} max delta ${m.toFixed(4)}`)
    if (m < 1e-4) report.problems.push(`eye target "${report.eyeTargets[i]}" is empty`)
  })
  if (report.eyeTargets.length !== 8) report.problems.push(`expected 8 eye-look targets, found ${report.eyeTargets.length}`)
  return report
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , input, output] = process.argv
  if (!input || !output) {
    console.error('usage: node scripts/prepare-avatar.mjs <input.glb> <output.glb>')
    process.exit(2)
  }
  prepare(input, output)
    .then((r) => {
      console.log(`\nparts: ${JSON.stringify(r.parts)}\ntotal triangles: ${r.triangles}`)
      if (r.problems.length) { console.error('\nPROBLEMS:\n- ' + r.problems.join('\n- ')); process.exit(1) }
      console.log('\nOK: the avatar file is ready.')
    })
    .catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
}
