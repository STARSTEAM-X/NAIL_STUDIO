/// <reference types="vite/client" />

// three-mesh-bvh ติดตั้งตัวเองด้วยการเพิ่ม property เข้าไปใน prototype ของ three
// (boundsTree บน BufferGeometry, firstHitOnly บน Raycaster) ซึ่ง type ของ three
// ไม่รู้จัก จึงต้องประกาศเพิ่มเอง
import 'three'
import type { MeshBVH } from 'three-mesh-bvh'

declare module 'three' {
  interface BufferGeometry {
    boundsTree?: MeshBVH
  }
  interface Raycaster {
    firstHitOnly?: boolean
  }
}
