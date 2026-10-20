import { Bone, Group, Matrix3, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, Vector3, type SkinnedMesh, type Object3D, type BufferGeometry, type Material } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { FINGERS, type Finger } from '@nail-studio/contracts'
import { captureNailFrame, createParametricNail, decorationSurface, type NailFrame } from './nailGeometry.ts'
import { createHandRig, type HandRig } from './handRig.ts'
import { createSkinMaterial, createStudioNailMaterial, sparkleTexture, updateSkinMaterial, updateStudioNailMaterial, type NailMaterialResource } from './studioMaterials.ts'
import type { StudioDecoration, StudioHand, StudioNail } from './sceneSchema.ts'
import { layoutAttachments } from './attachmentLayout.ts'

export interface StudioActor {
  root: Object3D; skin: SkinnedMesh; rig: HandRig
  nails: Map<Finger, Mesh>; frames: Map<Finger, NailFrame>; resources: Map<Finger, NailMaterialResource>
  attachments: Map<Finger, Group>; sparkle: ReturnType<typeof sparkleTexture>
  previous: StudioHand | undefined; lowQuality: boolean
  warnings: Map<Finger, string[]>
}

export function createStudioActor(source: Object3D, onTextureReady: () => void): StudioActor {
  const root = clone(source)
  root.updateMatrixWorld(true)
  const nails = new Map<Finger, Mesh>()
  const skinParts: Mesh[] = []
  let skin: SkinnedMesh | undefined
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.frustumCulled = false
    object.castShadow = object.receiveShadow = true
    if (object.name === 'Hand') skin = object as SkinnedMesh
    if (object.name.startsWith('Cuticle_')) skinParts.push(object)
    for (const finger of FINGERS) if (object.name === `Nail_${finger}`) nails.set(finger, object)
  })
  if (!skin || !(skin.material instanceof MeshStandardMaterial) || nails.size !== 5) throw new Error('โมเดลมือใหม่ไม่ครบ: ต้องมี Hand, Skeleton และเล็บทั้ง 5 นิ้ว')
  skin.material = createSkinMaterial(skin.material)
  for (const part of skinParts) part.material = skin.material
  const rig = createHandRig(root, nails)
  const frames = new Map<Finger, NailFrame>(), resources = new Map<Finger, NailMaterialResource>(), attachments = new Map<Finger, Group>()
  for (const finger of FINGERS) {
    const nail = nails.get(finger)!
    const [mcp, , dip] = rig.fingers[finger]
    const inverse = new Matrix4().copy(nail.matrixWorld).invert()
    const direction = new Vector3(0, 1, 0).applyQuaternion(dip.bone.getWorldQuaternion(dip.rest.clone())).transformDirection(inverse)
    const dorsal = mcp.spread.clone().applyQuaternion(mcp.bone.getWorldQuaternion(mcp.rest.clone())).transformDirection(inverse)
    frames.set(finger, captureNailFrame(nail, direction, dorsal))
    const resource = createStudioNailMaterial(onTextureReady)
    resources.set(finger, resource)
    nail.material = resource.material
    const attachment = new Group()
    attachment.name = `${finger}_NailDecorations`
    dip.bone.add(attachment)
    attachments.set(finger, attachment)
  }
  return { root, skin, rig, nails, frames, resources, attachments, sparkle: sparkleTexture(), previous: undefined, lowQuality: false, warnings: new Map() }
}

function disposeAttachment(group: Group): void {
  group.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose()
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
    }
  })
  group.clear()
}

function decorationObject(item: StudioDecoration): Group {
  const group = new Group()
  const pearl = item.type === 'pearl'
  const material = new MeshPhysicalMaterial({ color: item.color, metalness: pearl ? .1 : .5, roughness: pearl ? .18 : .1, clearcoat: 1, iridescence: pearl ? .6 : 0 })
  const add = (geometry: BufferGeometry, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh)
  }
  if (item.type === 'diamond') add(new OctahedronGeometry(.00115), 0, .00085)
  else if (pearl) add(new SphereGeometry(.00115, 16, 12), 0, .00095)
  else if (item.type === 'bow') {
    add(new SphereGeometry(.001, 12, 8), -.0011, .00065, 0, 1.2, .55, .7)
    add(new SphereGeometry(.001, 12, 8), .0011, .00065, 0, 1.2, .55, .7)
    add(new SphereGeometry(.0006, 12, 8), 0, .0007)
  } else if (item.type === 'flower' || item.type === 'sticker') {
    for (let index = 0; index < 5; index += 1) {
      const angle = index * Math.PI * 2 / 5
      add(new SphereGeometry(.0008, 12, 8), Math.cos(angle) * .001, .0004, Math.sin(angle) * .001, 1, item.type === 'sticker' ? .08 : .45, 1)
    }
    add(new SphereGeometry(.0006, 12, 8), 0, .00065)
  } else {
    const geometry = new TorusGeometry(.0013, .0003, 8, 20)
    geometry.rotateX(Math.PI / 2)
    add(geometry, 0, .0004)
    add(new OctahedronGeometry(.00065), 0, .0008)
  }
  return group
}

function rebuildAttachments(actor: StudioActor, finger: Finger, nail: StudioNail): void {
  const group = actor.attachments.get(finger)!
  disposeAttachment(group)
  const frame = actor.frames.get(finger)!
  const mesh = actor.nails.get(finger)! as SkinnedMesh
  const transform = new Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[frame.joint]!, mesh.bindMatrix)
  const normalMatrix = new Matrix3().getNormalMatrix(transform)
  const layout = layoutAttachments(frame, nail)
  actor.warnings.set(finger, layout.warnings)
  for (const { item, u, v, scale } of layout.placements) {
    const surface = decorationSurface(frame, nail, u, v)
    const position = surface.position.applyMatrix4(transform)
    const normal = surface.normal.applyMatrix3(normalMatrix).normalize()
    const tangent = surface.tangent.transformDirection(transform)
    const across = new Vector3().crossVectors(tangent, normal).normalize()
    const object = decorationObject(item)
    object.position.copy(position).addScaledVector(normal, .00012)
    object.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(tangent, normal, across))
    object.rotateY(item.rotation * Math.PI / 180)
    object.scale.setScalar(scale)
    object.name = `Decoration_${item.id}`
    group.add(object)
  }
}

function geometryKey(nail: StudioNail): string {
  return `${nail.shape}|${nail.length}|${nail.width}|${nail.curvature}|${nail.taper}|${nail.tipWidth}`
}
function materialKey(nail: StudioNail): string {
  return `${nail.baseColor}|${nail.tipColor}|${nail.finish}|${nail.opacity}|${JSON.stringify(nail.pattern)}|${nail.texture}`
}
export function updateStudioActor(actor: StudioActor, hand: StudioHand, lowQuality: boolean): void {
  updateSkinMaterial(actor.skin.material as MeshPhysicalMaterial, hand.skin)
  const palm = actor.root.getObjectByName('Palm') as Bone
  palm.scale.set(hand.proportions.palmWidth, 1, 1)
  for (const finger of FINGERS) {
    const mcp = actor.rig.fingers[finger][0].bone
    const root = mcp.parent as Bone
    root.scale.set(hand.proportions.fingerWidth / hand.proportions.palmWidth, hand.proportions.fingerLengths[finger], hand.proportions.fingerWidth)
    const nail = hand.nails[finger], previous = actor.previous?.nails[finger]
    const mesh = actor.nails.get(finger)!
    const geometryChanged = !previous || geometryKey(nail) !== geometryKey(previous) || actor.lowQuality !== lowQuality
    if (geometryChanged) {
      // Cached GLTF geometry belongs to useGLTF. Dispose only geometry we own.
      if (mesh.userData.studioGeometry === true) mesh.geometry.dispose()
      mesh.geometry = createParametricNail(actor.frames.get(finger)!, nail, lowQuality)
      const skinned = mesh as SkinnedMesh
      skinned.computeBoundingBox(); skinned.computeBoundingSphere()
      mesh.userData.studioGeometry = true
      mesh.morphTargetDictionary = {}; mesh.morphTargetInfluences = []
    }
    if (!previous || materialKey(nail) !== materialKey(previous)) updateStudioNailMaterial(actor.resources.get(finger)!, nail, actor.sparkle)
    if (geometryChanged || nail.decorations !== previous?.decorations) rebuildAttachments(actor, finger, nail)
  }
  actor.root.updateMatrixWorld(true)
  actor.previous = hand
  actor.lowQuality = lowQuality
}

export function disposeStudioActor(actor: StudioActor): void {
  for (const group of actor.attachments.values()) disposeAttachment(group)
  for (const mesh of actor.nails.values()) if (mesh.userData.studioGeometry === true) mesh.geometry.dispose()
  for (const resource of actor.resources.values()) {
    if (resource.image) { resource.image.onload = null; resource.image.onerror = null; resource.image.src = '' }
    resource.image = null; resource.imageData = null
    resource.material.dispose(); resource.texture.dispose()
  }
  for (const material of [actor.skin.material].flat() as Material[]) material.dispose()
  actor.sparkle.dispose()
  // SkeletonUtils clones the Skeleton; its GPU bone texture is per instance.
  const skeletons = new Set<SkinnedMesh['skeleton']>()
  actor.root.traverse((object) => { if ((object as SkinnedMesh).isSkinnedMesh) skeletons.add((object as SkinnedMesh).skeleton) })
  for (const skeleton of skeletons) skeleton.dispose()
  actor.previous = undefined
}
