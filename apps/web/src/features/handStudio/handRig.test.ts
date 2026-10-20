import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { Bone, Matrix4, Mesh, Quaternion, Raycaster, Vector3, type Object3D, type SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { FINGERS, type Finger } from '@nail-studio/contracts'
import { nailMatrix } from '@/3d/scene/nailViews.ts'
import { createHandRig, stepHandPose } from './handRig.ts'
import { createPose, POSES } from './sceneSchema.ts'
import { createStudioScene, SHAPES } from './sceneSchema.ts'
import { captureNailFrame, createParametricNail, nailSurface } from './nailGeometry.ts'

/** Load the actual NEW asset, stripping only images for a GPU-free Node test. */
async function asset(): Promise<Object3D> {
  const bytes = await readFile(new URL('../../../public/models/realistic-hand-v1.glb', import.meta.url))
  const size = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + size).toString())
  delete json.materials; delete json.textures; delete json.images; delete json.samplers
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material
  const text = JSON.stringify(json), aligned = Math.ceil(Buffer.byteLength(text) / 4) * 4
  const chunk = bytes.subarray(20 + size)
  const result = Buffer.alloc(20 + aligned + chunk.length, 0x20)
  bytes.copy(result, 0, 0, 12)
  result.writeUInt32LE(result.length, 8); result.writeUInt32LE(aligned, 12); result.writeUInt32LE(0x4e4f534a, 16)
  result.write(text, 20); chunk.copy(result, 20 + aligned)
  return new Promise((resolve, reject) => new GLTFLoader().parse(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '', (gltf) => resolve(gltf.scene), reject))
}
function setup(root: Object3D) {
  const nails = new Map<Finger, Mesh>()
  for (const finger of FINGERS) nails.set(finger, root.getObjectByName(`Nail_${finger}`) as Mesh)
  return { nails, rig: createHandRig(root, nails) }
}

describe('new original hand asset and rig', () => {
  it('has a skinned hand, five independent rigid nails, 23 bones and five sockets', async () => {
    const root = await asset()
    const skin = root.getObjectByName('Hand') as SkinnedMesh
    expect(skin.isSkinnedMesh).toBe(true)
    expect(skin.geometry.getAttribute('uv')).toBeDefined()
    const bones: Bone[] = []
    root.traverse((object) => { if (object instanceof Bone) bones.push(object) })
    expect(bones).toHaveLength(23)
    expect(root.getObjectByName('Forearm')).toBeDefined()
    for (const finger of FINGERS) {
      const nail = root.getObjectByName(`Nail_${finger}`) as SkinnedMesh
      expect(nail.isSkinnedMesh).toBe(true)
      expect(root.getObjectByName(`${finger[0]!.toUpperCase()}${finger.slice(1)}_NailRoot`)).toBeDefined()
      const weights = nail.geometry.getAttribute('skinWeight')
      for (let i = 0; i < weights.count; i += 1) expect(weights.getX(i)).toBeCloseTo(1)
    }
    expect(root.getObjectByName('Cube')).toBeUndefined()
  })
  it('moves the selected joint and its nail while leaving other finger and wrist poses unchanged', async () => {
    const root = await asset(), { rig, nails } = setup(root)
    const middle = rig.fingers.middle[0].bone.quaternion.clone(), wrist = rig.wrist.bone.quaternion.clone()
    const before = nailMatrix(nails.get('index')!).elements.slice()
    const pose = createPose('open')
    pose.joints.index.pip = 55
    stepHandPose(rig, pose, 1, true); root.updateMatrixWorld(true)
    expect(nailMatrix(nails.get('index')!).elements).not.toEqual(before)
    expect(rig.fingers.middle[0].bone.quaternion.angleTo(middle)).toBeLessThan(1e-7)
    expect(rig.wrist.bone.quaternion.angleTo(wrist)).toBeLessThan(1e-7)
  })
  it('keeps every nail rigidly attached to its distal bone in every required pose', async () => {
    const root = await asset(), { rig, nails } = setup(root)
    const offsets = new Map<Finger, Vector3>()
    for (const finger of FINGERS) {
      const point = new Vector3().fromBufferAttribute(nails.get(finger)!.geometry.getAttribute('position'), 0)
      point.applyMatrix4(nailMatrix(nails.get(finger)!))
      offsets.set(finger, rig.fingers[finger][2].bone.worldToLocal(point))
    }
    for (const preset of POSES) {
      stepHandPose(rig, createPose(preset), 1, true); root.updateMatrixWorld(true)
      for (const finger of FINGERS) {
        const point = new Vector3().fromBufferAttribute(nails.get(finger)!.geometry.getAttribute('position'), 0).applyMatrix4(nailMatrix(nails.get(finger)!))
        const local = rig.fingers[finger][2].bone.worldToLocal(point)
        expect(local.distanceTo(offsets.get(finger)!), `${preset}:${finger}`).toBeLessThan(1e-6)
      }
    }
  })
  it('clones independent skeletons for left/right while sharing immutable source geometry', async () => {
    const source = await asset(), left = clone(source), right = clone(source)
    const a = setup(left), b = setup(right)
    const before = b.rig.fingers.index[1].bone.quaternion.clone()
    stepHandPose(a.rig, createPose('soft_fist'), 1, true)
    expect(b.rig.fingers.index[1].bone.quaternion.angleTo(before)).toBeLessThan(1e-7)
    expect(a.nails.get('index')!.geometry).toBe(b.nails.get('index')!.geometry)
    expect((a.nails.get('index') as SkinnedMesh).skeleton).not.toBe((b.nails.get('index') as SkinnedMesh).skeleton)
  })
  it('interpolates smoothly and returns exactly to its bind pose after repeated switches', async () => {
    const root = await asset(), { rig } = setup(root)
    const joint = rig.fingers.index[1]
    const start = joint.bone.quaternion.clone()
    stepHandPose(rig, createPose('soft_fist'), 1 / 60)
    const partial = joint.bone.quaternion.angleTo(start)
    stepHandPose(rig, createPose('soft_fist'), 1, true)
    expect(partial).toBeGreaterThan(0)
    expect(partial).toBeLessThan(joint.bone.quaternion.angleTo(start))
    for (let index = 0; index < 100; index += 1) {
      stepHandPose(rig, createPose('soft_fist'), 1, true)
      stepHandPose(rig, createPose('open'), 1, true)
    }
    expect(joint.bone.quaternion.angleTo(start)).toBeLessThan(1e-7)
    expect(joint.bone.quaternion.angleTo(new Quaternion().copy(joint.rest))).toBeLessThan(1e-7)
  })
  it('locks the first 40% of the measured nail bed across all shapes and lengths', async () => {
    const root = await asset(), { rig, nails } = setup(root)
    for (const finger of FINGERS) {
      const mesh = nails.get(finger)!
      const distal = rig.fingers[finger][2]
      const direction = new Vector3(0, 1, 0).applyQuaternion(distal.bone.getWorldQuaternion(new Quaternion()))
      const dorsal = rig.fingers[finger][0].spread.clone().applyQuaternion(rig.fingers[finger][0].bone.getWorldQuaternion(new Quaternion()))
      const frame = captureNailFrame(mesh, direction, dorsal)
      expect(frame.bed, finger).toBeDefined()
      const neutral = createStudioScene().hands.right.nails[finger]
      for (const shape of SHAPES) for (const length of [0, .5, 1]) {
        const nail = { ...neutral, shape, length, width: 1.15, curvature: 1.4 }
        for (const u of [.1, .5, .9]) for (const v of [0, .15, .3, .4]) {
          expect(nailSurface(frame, nail, u, v).distanceTo(nailSurface(frame, neutral, u, v)), `${finger}:${shape}:${v}`).toBeLessThan(1e-9)
        }
        const geometry = createParametricNail(frame, nail, true)
        const position = geometry.getAttribute('position'), indices = geometry.getIndex()!
        // Every top triangle must still face outwards after corner rounding.
        for (let cursor = 0; cursor < 20 * 12 * 12; cursor += 12) {
          const a = new Vector3().fromBufferAttribute(position, indices.getX(cursor))
          const b = new Vector3().fromBufferAttribute(position, indices.getX(cursor + 1))
          const c = new Vector3().fromBufferAttribute(position, indices.getX(cursor + 2))
          const facing = b.clone().sub(a).cross(c.clone().sub(a)).dot(frame.normal)
          expect(facing, `${finger}:${shape}:${length}:cell ${cursor / 12}; frame=${JSON.stringify({ along: frame.along, normal: frame.normal, width: frame.width, length: frame.bedLength })}; triangle=${JSON.stringify([a, b, c])}`).toBeGreaterThan(0)
        }
        geometry.dispose()
      }
    }
  })
  it('keeps native nail roots within 0.4 mm of the actual skin surface', async () => {
    const root = await asset(), { rig, nails } = setup(root)
    const skin = root.getObjectByName('Hand') as SkinnedMesh
    root.updateMatrixWorld(true)
    skin.computeBoundingBox(); skin.computeBoundingSphere()
    for (const finger of FINGERS) {
      const mesh = nails.get(finger)!
      const columns = mesh.userData.bedColumns as number
      const distal = rig.fingers[finger][2].bone
      const matrix = new Matrix4().copy(mesh.matrixWorld)
      const direction = new Vector3(0, 1, 0).applyQuaternion(distal.getWorldQuaternion(new Quaternion()))
      const dorsal = rig.fingers[finger][0].spread.clone().applyQuaternion(rig.fingers[finger][0].bone.getWorldQuaternion(new Quaternion()))
      const normal = dorsal.addScaledVector(direction, -dorsal.dot(direction)).normalize()
      const frame = captureNailFrame(mesh, direction, normal)
      const nail = createStudioScene().hands.right.nails[finger]
      for (const column of [4, Math.floor(columns / 2), columns - 4]) {
        const point = nailSurface(frame, nail, column / columns, 0).applyMatrix4(matrix)
        const ray = new Raycaster(point.clone().addScaledVector(normal, .002), normal.clone().negate(), 0, .004)
        const hit = ray.intersectObject(skin, false)[0]
        expect(hit, finger).toBeDefined()
        expect(point.distanceTo(hit!.point), finger).toBeLessThan(.0004)
      }
    }
  })
})
