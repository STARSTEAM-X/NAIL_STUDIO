/// <reference types="vite/client" />
import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { FINGERS, type Finger } from '../packages/contracts/src/index.ts'
import { buildFromRecipe, PRESETS } from '../packages/patterns/src/index.ts'
import { NailScene } from '../apps/web/src/3d/scene/NailScene.tsx'
import { ReadOnlyDesignScene } from '../apps/web/src/3d/scene/ReadOnlyDesignScene.tsx'
import { cameraForNail, nailMatrix, nailViewOf } from '../apps/web/src/3d/scene/nailViews.ts'
import { morphedPosition } from '../apps/web/src/3d/scene/nailMorph.ts'
import { DesignStoreProvider } from '../apps/web/src/features/design/DesignStoreProvider.tsx'
import { Vector3, type Mesh, type PerspectiveCamera } from 'three'

/** เครื่องมือตรวจในเครื่อง: ใช้ฉาก วัสดุ โมเดล และของตกแต่งจริง ไม่เรียก API หรือบันทึกงาน */
function FrameNail({ finger, onReady }: { finger: Finger; onReady: () => void }) {
  const frames = useRef(0)
  const { scene, camera, controls, invalidate } = useThree()
  useEffect(() => { frames.current = 0; invalidate() }, [finger, invalidate])
  useFrame(() => {
    if (frames.current >= 30) return
    const mesh = scene.getObjectByName(`Nail_${finger}`) as Mesh | undefined
    if (!mesh) { invalidate(); return }
    frames.current++
    if (frames.current === 20) {
      const view = nailViewOf(mesh)
      // ทิศปลายเล็บจาก UV จริง ทำให้ภาพไม่กลับหัวเมื่อนิ้วเอียง
      const uv = mesh.geometry.getAttribute('uv')
      let low = 0, high = 0, lo = Infinity, hi = Infinity
      for (let i = 0; i < uv.count; i++) {
        const a = Math.hypot(uv.getX(i) - 0.5, uv.getY(i) - 0.15)
        const b = Math.hypot(uv.getX(i) - 0.5, uv.getY(i) - 0.85)
        if (a < lo) { lo = a; low = i }
        if (b < hi) { hi = b; high = i }
      }
      const matrix = nailMatrix(mesh)
      const tip = morphedPosition(mesh, low, new Vector3()).applyMatrix4(matrix)
      const base = morphedPosition(mesh, high, new Vector3()).applyMatrix4(matrix)
      camera.up.copy(tip.sub(base).normalize())
      camera.position.copy(cameraForNail(view, (camera as PerspectiveCamera).fov, 0.72))
      camera.lookAt(view.center)
      const orbit = controls as unknown as { target: Vector3; update(): void } | undefined
      orbit?.target.copy(view.center)
      orbit?.update()
    }
    if (frames.current === 30) onReady()
    invalidate()
  })
  return null
}

function App() {
  const [id, setId] = useState('pastel-botanical')
  const [finger, setFinger] = useState<Finger>('index')
  const [ready, setReady] = useState(false)
  const doc = useMemo(() => buildFromRecipe(PRESETS[id]!.recipe).document, [id])
  const key = `${id}-${finger}`
  return <>
    <header>
      <h1>Nail Studio · 3D review</h1>
      <label>ชุดลาย <select aria-label="ชุดลาย" value={id} onChange={(e) => { setReady(false); setId(e.target.value) }}>{Object.entries(PRESETS).map(([value, p]) => <option key={value} value={value}>{p.title}</option>)}</select></label>
      <label>นิ้ว <select aria-label="นิ้ว" value={finger} onChange={(e) => { setReady(false); setFinger(e.target.value as Finger) }}>{FINGERS.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
      <span id="status">{ready ? '3D ready' : 'Rendering…'}</span>
    </header>
    <main><DesignStoreProvider key={id} document={doc}><NailScene><ReadOnlyDesignScene /><FrameNail key={key} finger={finger} onReady={() => setReady(true)} /></NailScene></DesignStoreProvider></main>
    <footer>{PRESETS[id]!.description} · ผิว: {doc.nails[`right.${finger}`].finish} · ลากภาพเพื่อหมุนตรวจแสง · พรีวิวในเครื่อง</footer>
  </>
}

const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<App />)
