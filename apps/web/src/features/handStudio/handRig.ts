import { Bone, MathUtils, Quaternion, Vector3, type Object3D, type Mesh } from 'three'
import { FINGERS, type Finger } from '@nail-studio/contracts'
import type { HandPose } from './sceneSchema.ts'

const STEMS: Record<Finger, string> = { thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', little: 'Pinky' }
export interface RigJoint { bone: Bone; rest: Quaternion; flex: Vector3; spread: Vector3; twist: Vector3 }
export interface HandRig { wrist: RigJoint; fingers: Record<Finger, [RigJoint, RigJoint, RigJoint]> }

function requireBone(bones: Map<string, Bone>, name: string): Bone {
  const bone = bones.get(name)
  if (!bone) throw new Error(`โมเดลมือขาดกระดูก ${name}`)
  return bone
}

export function createHandRig(root: Object3D, nails: Map<Finger, Mesh>): HandRig {
  root.updateMatrixWorld(true)
  const bones = new Map<string, Bone>()
  root.traverse((object) => { if (object instanceof Bone) bones.set(object.name, object) })
  const makeJoint = (bone: Bone, outward: Vector3): RigJoint => {
    // glTF stores float32 quaternions; normalize once so a zero-angle pose
    // remains exactly stationary rather than producing a false angular delta.
    bone.quaternion.normalize()
    const inverse = bone.getWorldQuaternion(new Quaternion()).invert()
    const spread = outward.clone().applyQuaternion(inverse).normalize()
    const twist = new Vector3(0, 1, 0)
    return { bone, rest: bone.quaternion.clone(), flex: new Vector3().crossVectors(twist, spread.clone().negate()).normalize(), spread, twist }
  }
  const fingers = {} as HandRig['fingers']
  for (const finger of FINGERS) {
    const stem = STEMS[finger]
    const distal = requireBone(bones, `${stem}4`)
    const middle = requireBone(bones, `${stem}3`)
    const mesh = nails.get(finger)
    if (!mesh) throw new Error(`โมเดลมือขาดเล็บ ${finger}`)
    const attribute = mesh.geometry.getAttribute('position')
    const center = new Vector3(), point = new Vector3()
    for (let index = 0; index < attribute.count; index += 1) center.add(point.fromBufferAttribute(attribute, index))
    center.divideScalar(attribute.count).applyMatrix4(mesh.matrixWorld)
    const origin = middle.getWorldPosition(new Vector3())
    const axis = distal.getWorldPosition(new Vector3()).sub(origin).normalize()
    const outward = center.sub(origin)
    outward.addScaledVector(axis, -outward.dot(axis)).normalize()
    const authoredNormal = mesh.userData.bedNormal as unknown
    if (Array.isArray(authoredNormal) && authoredNormal.length === 3 && authoredNormal.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      outward.fromArray(authoredNormal).transformDirection(mesh.matrixWorld)
    }
    const names = [2, 3, 4]
    fingers[finger] = names.map((index) => makeJoint(requireBone(bones, `${stem}${index}`), outward)) as HandRig['fingers'][Finger]
  }
  return { fingers, wrist: makeJoint(requireBone(bones, 'Wrist'), new Vector3(0, 0, 1)) }
}

const rotation = new Quaternion()
function rotate(joint: RigJoint, flex: number, spread = 0, twist = 0): Quaternion {
  const target = joint.rest.clone()
  target.multiply(rotation.setFromAxisAngle(joint.spread, MathUtils.degToRad(spread)))
  target.multiply(rotation.setFromAxisAngle(joint.flex, MathUtils.degToRad(flex)))
  target.multiply(rotation.setFromAxisAngle(joint.twist, MathUtils.degToRad(twist)))
  return target
}

/** Frame-rate independent interpolation, bounded angles, no camera/root side effects. */
export function stepHandPose(rig: HandRig, pose: HandPose, delta: number, immediate = false): boolean {
  const alpha = immediate ? 1 : 1 - Math.exp(-12 * Math.min(delta, 0.1))
  let moving = false
  const apply = (joint: RigJoint, target: Quaternion) => {
    if (joint.bone.quaternion.angleTo(target) < 0.0002) joint.bone.quaternion.copy(target)
    else { joint.bone.quaternion.slerp(target, alpha); moving = true }
  }
  for (const finger of FINGERS) {
    const [mcp, pip, dip] = rig.fingers[finger]
    const joints = pose.joints[finger]
    const opposition = finger === 'thumb' ? MathUtils.clamp(pose.opposition, 0, 65) : 0
    // Opposition combines CMC sweep and axial rotation; twisting the thumb's
    // long axis alone cannot bring the tip towards the index finger.
    apply(mcp, rotate(mcp, MathUtils.clamp(joints.mcp, -10, finger === 'thumb' ? 50 : 85), MathUtils.clamp(joints.spread, -18, 18) - opposition * .7, opposition * .4))
    apply(pip, rotate(pip, MathUtils.clamp(joints.pip, 0, finger === 'thumb' ? 65 : 100)))
    apply(dip, rotate(dip, MathUtils.clamp(joints.dip, 0, 75)))
  }
  const wrist = rig.wrist
  const target = wrist.rest.clone()
    .multiply(rotation.setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(pose.wrist.x)))
    .multiply(rotation.setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(pose.wrist.y)))
    .multiply(rotation.setFromAxisAngle(new Vector3(0, 0, 1), MathUtils.degToRad(pose.wrist.z)))
  apply(wrist, target)
  return moving
}
