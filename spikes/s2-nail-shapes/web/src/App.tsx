import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Sphere, Vector3, type Mesh, type SkinnedMesh } from 'three'

/**
 * Spike S2 — พิสูจน์ว่า morph target ทรงเล็บที่สร้างจาก Blender ใช้งานได้จริงใน Three.js
 *
 * สิ่งที่ต้องพิสูจน์:
 *   1. GLTFLoader อ่าน morphTargetDictionary ได้ครบ 4 ทรงต่อเล็บ
 *   2. ตั้ง morphTargetInfluences แล้วรูปทรงเปลี่ยนจริงบนจอ
 *   3. ผสมทรงแบบต่อเนื่อง (0..1) ได้ ไม่ใช่สลับแบบขั้นบันได
 *   4. โคนเล็บไม่ขยับ — เล็บยังแนบผิวนิ้วทุกทรง
 *   5. ใช้ร่วมกับ skinning (JOINTS_0/WEIGHTS_0) ได้โดยไม่พัง
 */

const SHAPES = ['round', 'almond', 'square', 'squoval', 'stiletto'] as const
type Shape = (typeof SHAPES)[number]

const NAIL_IDS = ['thumb', 'index', 'middle', 'ring', 'little'] as const

interface Report {
  nails: string[]
  dictionary: string[]
  influenceCount: number
  skinned: boolean
}

interface HandProps {
  shape: Shape
  onReport: (report: Report) => void
  onFocus: (center: number[], radius: number) => void
}

function Hand({ shape, onReport, onFocus }: HandProps) {
  const { scene } = useGLTF('/models/hand_shapes.glb')

  const nails = useMemo(() => {
    const found: Mesh[] = []
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const parts = mesh.name.split('_')
      if (parts[0] !== 'Nail' || parts.length < 2) return
      if (NAIL_IDS.some((id) => id === parts[1])) found.push(mesh)
    })
    return found
  }, [scene])

  // ตั้งค่า influence ตรงกับ mesh — ไม่ผ่าน React state ต่อเฟรม
  // (การเปลี่ยนทรงเกิดตอนผู้ใช้กดปุ่มเท่านั้น ไม่ใช่ทุกเฟรม จึงใช้ effect ได้)
  useEffect(() => {
    for (const nail of nails) {
      const dictionary = nail.morphTargetDictionary
      const influences = nail.morphTargetInfluences
      if (!dictionary || !influences) continue
      influences.fill(0)
      const index = dictionary[shape]
      if (index !== undefined) influences[index] = 1
    }
  }, [nails, shape])

  useEffect(() => {
    const first = nails[0]
    onReport({
      nails: nails.map((nail) => nail.name),
      dictionary: first?.morphTargetDictionary ? Object.keys(first.morphTargetDictionary) : [],
      influenceCount: first?.morphTargetInfluences?.length ?? 0,
      skinned: nails.every((nail) => 'isSkinnedMesh' in nail && Boolean(nail.isSkinnedMesh)),
    })
  }, [nails, onReport])

  // รายงานกรอบของเล็บนิ้วกลางขึ้นไปให้ App จัดกล้อง
  //
  // ใช้ bounding sphere ของ mesh ที่ deform แล้วในพิกัดโลก ไม่ใช่ค่าจาก geometry
  // ตรง ๆ เพราะเล็บเป็น SkinnedMesh ซึ่ง geometry ค้างอยู่ที่ท่า rest
  // (เป็นเหตุผลเดียวกับที่ระบบจริงต้องมี refreshSkinnedBounds)
  useEffect(() => {
    const target = nails.find((nail) => nail.name.includes('middle')) ?? nails[0]
    if (!target) return

    const skinned = target as SkinnedMesh
    if (skinned.isSkinnedMesh) {
      for (const bone of skinned.skeleton.bones) bone.updateWorldMatrix(true, false)
      skinned.updateMatrixWorld(true)
      skinned.computeBoundingSphere()
    }
    target.updateWorldMatrix(true, false)

    // ต้องใช้ SkinnedMesh.boundingSphere (คำนวณผ่าน applyBoneTransform = ท่าจริง)
    // ไม่ใช่ geometry.boundingSphere ซึ่งเป็นขอบเขตของท่า rest — ถ้าใช้ตัวหลัง
    // กล้องจะบินไปจ่อตำแหน่งที่เล็บ "เคยอยู่" ก่อนโดนบอร์นดัด
    // เป็นบั๊กเดียวกับที่ nailViews.ts ของซอร์สเดิมเตือนไว้
    const sphere = new Sphere()
    if (skinned.isSkinnedMesh && skinned.boundingSphere) {
      sphere.copy(skinned.boundingSphere).applyMatrix4(target.matrixWorld)
    } else {
      new Box3().setFromObject(target).getBoundingSphere(sphere)
    }
    console.log('[S2] กรอบเล็บนิ้วกลาง', target.name, sphere.center.toArray(), sphere.radius)
    onFocus(sphere.center.toArray(), sphere.radius)
  }, [nails, onFocus])

  return <primitive object={scene} />
}

/** ตั้งตำแหน่งกล้องครั้งเดียวเมื่อรู้กรอบของเล็บแล้ว */
function CameraRig({ center, radius }: { center: [number, number, number]; radius: number }) {
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    // ระยะที่ทำให้เล็บกินเฟรมราว 45% — สูตรเดียวกับ cameraForNail ของระบบจริง
    const half = (35 / 2) * (Math.PI / 180)
    const distance = radius / Math.tan(half) / 0.45
    const offset = new Vector3(0.15, 0.35, 1).normalize().multiplyScalar(distance)
    camera.position.set(...center).add(offset)
    camera.lookAt(...center)
    camera.updateProjectionMatrix()
  }, [camera, center, radius])
  return null
}

interface Focus {
  center: [number, number, number]
  radius: number
}

export function App() {
  const [shape, setShape] = useState<Shape>('round')
  const [report, setReport] = useState<Report | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const seen = useRef(false)
  const framed = useRef(false)

  const handleReport = useCallback((next: Report) => {
    if (seen.current) return
    seen.current = true
    setReport(next)
  }, [])

  // จ่อกล้องครั้งเดียวตอนโหลดเสร็จ — ถ้าจ่อใหม่ทุกครั้งที่เปลี่ยนทรง
  // กล้องจะกระโดดกลับทุกครั้งที่ผู้ใช้หมุนดูแล้วกดปุ่ม ซึ่งน่ารำคาญ
  const handleFocus = useCallback((center: number[], radius: number) => {
    if (framed.current) return
    framed.current = true
    setFocus({ center: [center[0] ?? 0, center[1] ?? 0, center[2] ?? 0], radius })
  }, [])

  const dictOk = report !== null && report.dictionary.length === 4
  const nailsOk = report !== null && report.nails.length === 5

  return (
    <>
      <div className="hud">
        <h1>SPIKE S2 · ทรงเล็บด้วย morph target</h1>
        <div className="shapes">
          {SHAPES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === shape ? 'active' : ''}
              onClick={() => setShape(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
        <dl>
          <dt>mesh เล็บ</dt>
          <dd className={nailsOk ? 'ok' : 'fail'}>{report?.nails.length ?? 0} / 5</dd>
          <dt>morph target ต่อเล็บ</dt>
          <dd className={dictOk ? 'ok' : 'fail'}>{report?.influenceCount ?? 0} / 4</dd>
          <dt>ชื่อทรงที่อ่านได้</dt>
          <dd>{report?.dictionary.join(', ') || '—'}</dd>
          <dt>เป็น SkinnedMesh</dt>
          <dd className={report?.skinned ? 'ok' : 'fail'}>{report?.skinned ? 'ใช่' : 'ไม่ใช่'}</dd>
          <dt>ทรงที่เลือก</dt>
          <dd>{shape}</dd>
        </dl>
      </div>

      <div className="stage">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0.055, 0.16], fov: 35, near: 0.005, far: 10 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#0e0d10']} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[0.3, 0.5, 0.4]} intensity={1.8} />
          <Environment resolution={256}>
            <Lightformer
              form="rect"
              intensity={3}
              position={[0, 0.5, 0.4]}
              scale={[0.6, 0.35, 1]}
              color="#ffffff"
            />
          </Environment>
          <Suspense fallback={null}>
            <Hand shape={shape} onReport={handleReport} onFocus={handleFocus} />
          </Suspense>
          {focus && <CameraRig center={focus.center} radius={focus.radius} />}
          <OrbitControls
            makeDefault
            target={focus?.center ?? [0, 0, 0]}
            minDistance={0.005}
            maxDistance={1}
          />
        </Canvas>
      </div>
    </>
  )
}

useGLTF.preload('/models/hand_shapes.glb')
