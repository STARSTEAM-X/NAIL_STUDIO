import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { HOME_POSITION, HOME_TARGET, MAX_DISTANCE, MIN_DISTANCE } from './cameraPresets.ts'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * ฉาก 3D กลางของระบบ — คุมเฉพาะ "เวที" ไม่รู้จักเนื้อหาที่วางบนเวที
 *
 * ค่ากล้อง แสง และ tone mapping อยู่ที่นี่ที่เดียว เพื่อให้ทุกหน้าที่แสดงงาน
 * (editor, พรีวิว template, VR) เห็นดีไซน์เดียวกันเหมือนกันทุกประการ
 * ถ้าแต่ละหน้าตั้งแสงเอง ดีไซน์เดียวกันจะดูคนละสีในแต่ละหน้า
 */
export function NailScene({ children, fallback }: Props) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      camera={{ position: HOME_POSITION, fov: 35, near: 0.01, far: 10 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#17120f']} />
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
        <Lightformer
          form="rect"
          intensity={1}
          position={[0.5, -0.1, 0.1]}
          scale={[0.35, 0.6, 1]}
          color="#c0d6ff"
        />
      </Environment>

      <Suspense fallback={fallback ?? null}>{children}</Suspense>

      <OrbitControls
        makeDefault
        target={HOME_TARGET}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        enablePan={false}
      />
    </Canvas>
  )
}
