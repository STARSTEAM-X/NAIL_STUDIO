import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import type { Mesh } from 'three'

/**
 * Spike S1 — พิสูจน์ว่า React 19 + @react-three/fiber v9 + @react-three/drei v10
 * ทำงานร่วมกันได้จริง ไม่ใช่แค่ peer dependency ตรงกัน
 *
 * สิ่งที่ต้องผ่านทั้งหมด (ถ้าข้อใดข้อหนึ่งพัง = ความเสี่ยง R-1 ยังไม่ปิด):
 *   1. <Canvas> สร้าง WebGL context ได้ภายใต้ StrictMode (mount 2 รอบ)
 *   2. useGLTF โหลด hand.glb 11.2 MiB ได้
 *   3. OrbitControls (drei) หมุน/ซูมได้
 *   4. Environment + Lightformer (drei) เรนเดอร์ได้ — ใช้ WebGLRenderTarget ภายใน
 *      ซึ่งเป็นจุดที่ R3F v9 เปลี่ยน API มากที่สุด
 *   5. traverse หา mesh เล็บได้ครบ 5 ชิ้น (รูปแบบ PartsRegistry ของระบบจริง)
 *   6. useFrame ทำงานทุกเฟรมโดยไม่ทำให้ React re-render
 *
 * ผลพลอยได้: เก็บ baseline benchmark ครั้งแรกไปใส่ docs/performance.md
 */

const NAIL_NAMES = ['thumb', 'index', 'middle', 'ring', 'little'] as const

export interface SpikeStats {
  loadMs: number | null
  nailsFound: string[]
  triangles: number
  drawCalls: number
  geometries: number
  textures: number
  programs: number
  fps: number
  frameMs: number
}

const EMPTY_STATS: SpikeStats = {
  loadMs: null,
  nailsFound: [],
  triangles: 0,
  drawCalls: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  fps: 0,
  frameMs: 0,
}

class Boundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(`${error.message}\n\n${info.componentStack ?? ''}`)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** โหลดโมเดลจริงจาก NailDesine-TEST แล้วรายงานว่าเจอ mesh เล็บครบไหม */
function HandModel({ onReady }: { onReady: (nails: string[]) => void }) {
  const { scene } = useGLTF('/models/hand.glb')

  useEffect(() => {
    const found: string[] = []
    scene.traverse((object) => {
      if (!(object as Mesh).isMesh) return
      const parts = object.name.split('_')
      if (parts[0] !== 'Nail' || parts.length !== 2) return
      const id = NAIL_NAMES.find((candidate) => candidate === parts[1])
      if (id) found.push(id)
    })
    onReady(found)
  }, [scene, onReady])

  return <primitive object={scene} />
}

/**
 * เก็บสถิติจาก renderer.info โดยไม่ทำให้ React re-render ทุกเฟรม
 *
 * นี่คือรูปแบบที่ระบบจริงต้องใช้ทุกที่ (ข้อกำหนด React Performance ของโจทย์):
 * useFrame เขียนลง ref แล้วอัปเดต state แค่วินาทีละครั้งเท่านั้น
 */
function StatsProbe({ onSample }: { onSample: (sample: Partial<SpikeStats>) => void }) {
  const gl = useThree((state) => state.gl)
  const frames = useRef(0)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    frames.current += 1
    elapsed.current += delta
    if (elapsed.current < 1) return
    const info = gl.info
    onSample({
      fps: Math.round(frames.current / elapsed.current),
      frameMs: Number(((elapsed.current / frames.current) * 1000).toFixed(2)),
      triangles: info.render.triangles,
      drawCalls: info.render.calls,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    })
    frames.current = 0
    elapsed.current = 0
  })

  return null
}

export function App() {
  const [stats, setStats] = useState<SpikeStats>(EMPTY_STATS)
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(performance.now())

  const handleSample = useCallback((sample: Partial<SpikeStats>) => {
    setStats((previous) => ({ ...previous, ...sample }))
  }, [])

  const handleNails = useCallback((nailsFound: string[]) => {
    setStats((previous) => ({
      ...previous,
      nailsFound,
      loadMs: Math.round(performance.now() - startedAt.current),
    }))
  }, [])

  if (error) {
    return <div className="error">Spike S1 ล้มเหลว{'\n\n'}{error}</div>
  }

  const allNails = stats.nailsFound.length === NAIL_NAMES.length

  return (
    <>
      <div className="hud">
        <h1>SPIKE S1 · React 19 + R3F v9 + drei v10</h1>
        <dl>
          <dt>เวลาโหลด GLB</dt>
          <dd>{stats.loadMs === null ? 'กำลังโหลด…' : `${stats.loadMs} ms`}</dd>
          <dt>mesh เล็บที่จับได้</dt>
          <dd className={allNails ? 'ok' : 'fail'}>
            {stats.nailsFound.length} / {NAIL_NAMES.length}
          </dd>
          <dt>สามเหลี่ยม/เฟรม</dt>
          <dd>{stats.triangles.toLocaleString()}</dd>
          <dt>draw calls</dt>
          <dd>{stats.drawCalls}</dd>
          <dt>geometries</dt>
          <dd>{stats.geometries}</dd>
          <dt>textures</dt>
          <dd>{stats.textures}</dd>
          <dt>shader programs</dt>
          <dd>{stats.programs}</dd>
          <dt>FPS</dt>
          <dd>{stats.fps}</dd>
          <dt>frame time</dt>
          <dd>{stats.frameMs} ms</dd>
        </dl>
      </div>

      <div className="stage">
        <Boundary onError={setError}>
          <Canvas
            shadows={false}
            dpr={[1, 2]}
            camera={{ position: [0, 0.03, 0.85], fov: 35, near: 0.01, far: 10 }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
          >
            <color attach="background" args={['#0e0d10']} />
            <ambientLight intensity={0.25} />
            <directionalLight position={[0.3, 0.5, 0.4]} intensity={1.6} />
            <Environment resolution={256}>
              <Lightformer
                form="rect"
                intensity={3}
                position={[0, 0.5, 0.4]}
                scale={[0.6, 0.35, 1]}
                color="#ffffff"
              />
              <Lightformer
                form="rect"
                intensity={1.2}
                position={[-0.5, 0.1, 0.2]}
                scale={[0.35, 0.6, 1]}
                color="#ffd9c0"
              />
            </Environment>
            <Suspense fallback={null}>
              <HandModel onReady={handleNails} />
            </Suspense>
            <StatsProbe onSample={handleSample} />
            <OrbitControls
              makeDefault
              target={[0, 0.03, 0.13]}
              minDistance={0.025}
              maxDistance={1.2}
              enablePan={false}
            />
          </Canvas>
        </Boundary>
      </div>
    </>
  )
}

useGLTF.preload('/models/hand.glb')
