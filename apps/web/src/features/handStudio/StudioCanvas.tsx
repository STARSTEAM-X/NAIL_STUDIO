import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import { Color, Matrix3, PerspectiveCamera, SRGBColorSpace, Vector3, WebGLRenderTarget, type Mesh, type WebGLRenderer, type Scene } from 'three'
import { type Finger, type Hand } from '@nail-studio/contracts'
import { nailMatrix } from '@/3d/scene/nailViews.ts'
import { stepHandPose } from './handRig.ts'
import { decorationSurface } from './nailGeometry.ts'
import { createStudioActor, disposeStudioActor, updateStudioActor, type StudioActor } from './studioActor.ts'
import type { StudioScene } from './sceneSchema.ts'

export const STUDIO_MODEL_URL = '/models/realistic-hand-v1.glb?v=anatomy-3'
interface Controls { target: Vector3; update: () => void }
export interface StudioBridge {
  capture: (width: number, height: number, transparent: boolean) => Promise<Blob>
  focus: (hand: Hand, finger: Finger) => void
  cameraState: () => StudioScene['scene']['camera']
}
interface Props {
  value: StudioScene; selected: { hand: Hand; finger: Finger }
  onSelect: (hand: Hand, finger: Finger) => void
  onBridge: (bridge: StudioBridge | null) => void
  onCamera: (camera: StudioScene['scene']['camera']) => void
  onWarnings: (hand: Hand, warnings: string[]) => void
}

async function captureImage(gl: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, width: number, height: number, transparent: boolean): Promise<Blob> {
  if (Math.max(width, height) > gl.capabilities.maxTextureSize) throw new Error('อุปกรณ์นี้ไม่รองรับความละเอียดภาพที่เลือก')
  const target = new WebGLRenderTarget(width, height, { samples: 4 })
  target.texture.colorSpace = SRGBColorSpace
  const previousTarget = gl.getRenderTarget(), previousBackground = scene.background
  const previousAlpha = gl.getClearAlpha(), previousColor = gl.getClearColor(new Color())
  const photoCamera = camera.clone()
  photoCamera.aspect = width / height
  photoCamera.updateProjectionMatrix()
  const pixels = new Uint8Array(width * height * 4)
  try {
    if (transparent) { scene.background = null; gl.setClearColor(0x000000, 0) }
    gl.setRenderTarget(target); gl.clear(); gl.render(scene, photoCamera)
    gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)
  } finally {
    scene.background = previousBackground
    gl.setClearColor(previousColor, previousAlpha)
    gl.setRenderTarget(previousTarget)
    target.dispose()
  }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('ไม่สามารถสร้างภาพ PNG ได้')
  const output = context.createImageData(width, height)
  for (let row = 0; row < height; row += 1) {
    output.data.set(pixels.subarray((height - row - 1) * width * 4, (height - row) * width * 4), row * width * 4)
  }
  context.putImageData(output, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('ส่งออก PNG ไม่สำเร็จ')), 'image/png'))
}

function HandActor({ hand, value, selected, onSelect, actors, lowQuality, onWarnings }: {
  hand: Hand; value: StudioScene['hands']['right']; selected: Props['selected']; onSelect: Props['onSelect']
  actors: Map<Hand, StudioActor>; lowQuality: boolean
  onWarnings: Props['onWarnings']
}) {
  const { scene } = useGLTF(STUDIO_MODEL_URL)
  const invalidate = useThree((state) => state.invalidate)
  const actor = useMemo(() => createStudioActor(scene, invalidate), [scene, invalidate])
  const valueRef = useRef(value)
  const first = useRef(true)
  const moving = useRef(true)
  useEffect(() => {
    actors.set(hand, actor)
    return () => { actors.delete(hand); disposeStudioActor(actor); onWarnings(hand, []) }
  }, [actor, hand, actors, onWarnings])
  useEffect(() => {
    valueRef.current = value
    const transformChanged = actor.previous?.pose !== value.pose || actor.previous?.proportions !== value.proportions
    updateStudioActor(actor, value, lowQuality)
    onWarnings(hand, [...new Set([...actor.warnings.values()].flat())])
    if (first.current) { stepHandPose(actor.rig, value.pose, 1, true); first.current = false }
    moving.current = moving.current || transformChanged
    invalidate()
  }, [actor, value, lowQuality, invalidate, hand, onWarnings])
  useEffect(() => {
    for (const [finger, resource] of actor.resources) {
      resource.material.emissive.set(hand === selected.hand && finger === selected.finger ? '#281416' : '#000000')
      resource.material.emissiveIntensity = .13
    }
    invalidate()
  }, [actor, hand, selected, invalidate])
  useFrame((_, delta) => {
    if (!moving.current) return
    moving.current = stepHandPose(actor.rig, valueRef.current.pose, delta)
    actor.root.updateMatrixWorld(true)
    // Nails are small, so refreshing their picking volumes is inexpensive.
    for (const mesh of actor.nails.values()) {
      const skinned = mesh as import('three').SkinnedMesh
      skinned.computeBoundingSphere(); skinned.computeBoundingBox()
    }
    if (!moving.current) { actor.skin.computeBoundingSphere(); actor.skin.computeBoundingBox() }
    else invalidate()
  })
  const click = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    for (const [finger, mesh] of actor.nails) if (mesh === event.object) onSelect(hand, finger)
  }
  return <primitive object={actor.root} dispose={null} onPointerDown={click} />
}

function StudioContents(props: Props) {
  const { value, selected, onSelect, onBridge, onCamera } = props
  const actors = useMemo(() => new Map<Hand, StudioActor>(), [])
  const { camera, gl, scene, invalidate } = useThree()
  const controls = useThree((state) => state.controls) as Controls | null
  useEffect(() => {
    if (!controls) return
    camera.position.fromArray(value.scene.camera.position)
    controls.target.fromArray(value.scene.camera.target)
    controls.update(); invalidate()
  }, [value.scene.camera, controls, camera, invalidate])
  useEffect(() => {
    if (!controls) return undefined
    const read = (): StudioScene['scene']['camera'] => ({ position: camera.position.toArray(), target: controls.target.toArray() })
    onBridge({
      capture: (width, height, transparent) => captureImage(gl, scene, camera as PerspectiveCamera, width, height, transparent),
      cameraState: read,
      focus: (hand, finger) => {
        const actor = actors.get(hand)
        if (!actor) return
        const mesh = actor.nails.get(finger)! as Mesh
        mesh.updateWorldMatrix(true, false)
        const point = decorationSurface(actor.frames.get(finger)!, actor.previous!.nails[finger], .5, .55)
        const matrix = nailMatrix(mesh)
        const target = point.position.applyMatrix4(matrix)
        const normal = point.normal.applyMatrix3(new Matrix3().getNormalMatrix(matrix)).normalize()
        camera.position.copy(target).addScaledVector(normal, .06)
        controls.target.copy(target); controls.update(); invalidate(); onCamera(read())
      },
    })
    return () => onBridge(null)
  }, [actors, camera, controls, gl, scene, invalidate, onBridge, onCamera])
  const both = value.hands.left.enabled && value.hands.right.enabled
  const light = value.scene.lighting
  const keyColor = light === 'warm' ? '#ffe1b9' : light === 'cool' ? '#d1e4ff' : '#ffffff'
  const strength = value.scene.intensity
  return <>
    <color attach="background" args={[value.scene.background]} />
    <ambientLight intensity={.35 * strength} />
    {/* Soft key shadows give the contact shading between fingers and under the
        nail folds; the frustum is fitted to the hand, not the default 10 m. */}
    <directionalLight position={[-.15, .23, .3]} intensity={2 * strength} color={keyColor}
      castShadow={value.scene.quality !== 'low'} shadow-mapSize={[2048, 2048]} shadow-bias={-.0001} shadow-normalBias={.0006}
      shadow-radius={4} shadow-camera-near={.05} shadow-camera-far={1.2}
      shadow-camera-left={-.22} shadow-camera-right={.22} shadow-camera-top={.22} shadow-camera-bottom={-.22} />
    <directionalLight position={[.22, .07, .1]} intensity={.6 * strength} color={light === 'studio' ? '#ffffff' : keyColor} />
    <Environment resolution={value.scene.quality === 'low' ? 128 : 256}>
      <Lightformer position={[-.15, .15, .25]} scale={[.2, .4, 1]} intensity={value.scene.highlights ? 2.5 * strength : .4} color={keyColor} />
      <Lightformer position={[.18, .05, .18]} scale={[.14, .3, 1]} intensity={value.scene.highlights ? 1.5 * strength : .3} color="#ffffff" />
      <Lightformer position={[0, .3, -.1]} scale={[.3, .2, 1]} intensity={strength} color={keyColor} />
    </Environment>
    {(['left', 'right'] as const).map((hand) => value.hands[hand].enabled && <group key={hand}
      position={[both ? (hand === 'left' ? -.09 : .09) : (hand === 'left' ? -.015 : .015), 0, 0]}
      scale={[hand === 'left' ? -1 : 1, 1, 1]}>
      <HandActor hand={hand} value={value.hands[hand]} selected={selected} onSelect={onSelect} actors={actors} lowQuality={value.scene.quality === 'low'} onWarnings={props.onWarnings} />
    </group>)}
    <OrbitControls makeDefault enablePan enableDamping dampingFactor={.12} minDistance={.025} maxDistance={1.3}
      onEnd={() => { if (controls) onCamera({ position: camera.position.toArray(), target: controls.target.toArray() }) }} />
  </>
}

export function StudioCanvas(props: Props) {
  return <Canvas frameloop="demand" shadows="soft" dpr={props.value.scene.quality === 'low' ? 1 : [1, 1.5]}
    camera={{ position: [0, .032, .57], fov: 38, near: .001, far: 5 }}
    gl={{ alpha: true, antialias: true }}>
    <Suspense fallback={null}><StudioContents {...props} /></Suspense>
  </Canvas>
}
