import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Raycaster,
  Vector3,
  type Intersection,
  type Object3D,
  type SkinnedMesh,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'

/**
 * Spike S3 — BVH กับ SkinnedMesh (ความเสี่ยง R-4)
 *
 * คำถามที่ต้องตอบ
 * ---------------
 * 1. สร้าง BVH บน Hand (118,756 tris) ใช้เวลาเท่าไร กินหน่วยความจำเท่าไร
 * 2. raycast ด้วย BVH เร็วกว่าเดิมกี่เท่า
 * 3. BVH สร้างจาก position attribute ซึ่งเป็นท่า rest — แต่ mesh มือถูกบอร์นดัด
 *    เมื่อผู้ใช้ลากสไลเดอร์สัดส่วน ผลลัพธ์จะยังถูกต้องไหม
 * 4. ถ้าไม่ถูก ต้อง bake ตำแหน่งที่ถูก skin แล้วสร้าง BVH ใหม่ — ใช้เวลาเท่าไร
 *
 * ข้อ 3 คือหัวใจ: three.js raycast ของ SkinnedMesh เป็น skin-aware
 * (Mesh.raycast เรียก getVertexPosition ซึ่ง SkinnedMesh override ให้ใช้ applyBoneTransform)
 * ส่วน acceleratedRaycast ของ three-mesh-bvh อ่านจาก BVH ที่สร้างจากพิกัดดิบ
 * ถ้าท่าไม่ตรงกับ rest ผลจะผิด
 */

const MODEL_URL = '/models/hand.glb'

// SkinnedMesh.raycast ของ three.js ไม่ได้แค่ทดสอบ 118,756 สามเหลี่ยมต่อรังสี
// แต่ต้องเรียก applyBoneTransform ให้ทุก vertex ของทุกสามเหลี่ยมด้วย
// = ~356,000 การแปลงเมทริกซ์ต่อรังสีเดียว
//
// ที่ 200 รังสีจึงบล็อก main thread จนหน้าเว็บไม่ตอบสนอง (ทดลองแล้ว 2 ครั้ง)
// ลดเหลือ 40 รังสี — ตัวเลขที่รายงานเป็น "ต่อรังสี" อยู่แล้ว จึงยังเทียบกันได้
// และความแตกต่างระหว่างวิธีมีขนาดหลายเท่า ไม่ใช่หลักเปอร์เซ็นต์ที่ต้องการ n มาก
const RAY_COUNT = 40
const REPEATS = 3
const WARMUP = 5

type Report = Record<string, unknown>
const report: Report = {}

function out(): void {
  const element = document.getElementById('out')
  if (element) element.textContent = JSON.stringify(report, null, 2)
}

function log(key: string, value: unknown): void {
  report[key] = value
  console.log(`[S3] ${key}`, value)
  out()
}

/** คืนคิวให้เบราว์เซอร์วาดผลระหว่างเฟส ไม่งั้นหน้าค้างจนจบ */
function breathe(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0) })
}

/** PRNG แบบมี seed - ต้องได้ชุดรังสีเดิมทุกครั้งไม่งั้นเทียบผลกันไม่ได้ */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 16807 + 13) % 2147483647
    return state / 2147483647
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits))
}

/** ตำแหน่ง vertex หลังผ่านการ skin - ใช้สร้าง BVH ที่ตรงกับท่าจริง */
function bakeSkinnedGeometry(mesh: SkinnedMesh): BufferGeometry {
  const source = mesh.geometry
  const position = source.getAttribute('position') as BufferAttribute
  const baked = new Float32Array(position.count * 3)
  const vertex = new Vector3()

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index)
    mesh.applyBoneTransform(index, vertex)
    baked[index * 3] = vertex.x
    baked[index * 3 + 1] = vertex.y
    baked[index * 3 + 2] = vertex.z
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(baked, 3))
  if (source.index) geometry.setIndex(source.index)
  return geometry
}

function bvhBytes(bvh: MeshBVH): number {
  const roots = (bvh as unknown as { _roots?: ArrayBuffer[] })._roots
  if (!Array.isArray(roots)) return -1
  return roots.reduce((total, buffer) => total + buffer.byteLength, 0)
}

interface Ray {
  origin: Vector3
  direction: Vector3
}

function buildRays(targets: Object3D[]): Ray[] {
  const box = new Box3()
  for (const target of targets) box.expandByObject(target)
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())

  // กล้องอยู่หน้ามือ ระยะประมาณเดียวกับมุมมองเริ่มต้นของแอปจริง
  const origin = center.clone().add(new Vector3(0, 0, Math.max(size.x, size.y) * 2.5))

  const random = seeded(20260812)
  const rays: Ray[] = []
  for (let index = 0; index < RAY_COUNT; index += 1) {
    // เล็งเข้าใจกลางกรอบ (0.7 เท่า) ให้รังสีส่วนใหญ่ชนจริง
    //
    // รอบแรกใช้ 1.4 เท่าเพื่อให้มีรังสีพลาดเป้าปนอยู่ด้วย แต่ได้อัตราการชนเพียง 7/40
    // ทำให้การเทียบ "ความถูกต้อง" อ่อน — 33 รังสีที่พลาดทั้งคู่ถูกนับว่าตรงกัน
    // ทั้งที่ไม่ได้พิสูจน์อะไรเลย
    const point = new Vector3(
      center.x + (random() - 0.5) * size.x * 0.7,
      center.y + (random() - 0.5) * size.y * 0.7,
      center.z + (random() - 0.5) * size.z * 0.7,
    )
    rays.push({ origin, direction: point.sub(origin).normalize() })
  }
  return rays
}

interface Hit {
  object: string
  distance: number
}

function castAll(raycaster: Raycaster, rays: Ray[], targets: Object3D[]): (Hit | null)[] {
  const hits: (Hit | null)[] = []
  for (const ray of rays) {
    raycaster.set(ray.origin, ray.direction)
    const first: Intersection | undefined = raycaster.intersectObjects(targets, false)[0]
    hits.push(first ? { object: first.object.name, distance: first.distance } : null)
  }
  return hits
}

function timeCasts(raycaster: Raycaster, rays: Ray[], targets: Object3D[]): number[] {
  // warmup - ให้ JIT อุ่นเครื่องก่อน ไม่งั้นรอบแรกช้ากว่าความจริงหลายเท่า
  castAll(raycaster, rays.slice(0, WARMUP), targets)
  const runs: number[] = []
  for (let index = 0; index < REPEATS; index += 1) {
    const started = performance.now()
    castAll(raycaster, rays, targets)
    runs.push(performance.now() - started)
  }
  return runs
}

/** สัดส่วนที่สองวิธีให้ผลตรงกัน - วัดความถูกต้อง ไม่ใช่แค่ความเร็ว */
function agreement(a: (Hit | null)[], b: (Hit | null)[]): Record<string, number> {
  let same = 0
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index] ?? null
    const right = b[index] ?? null
    if (left === null && right === null) { same += 1; continue }
    if (left === null || right === null) continue
    if (left.object === right.object && Math.abs(left.distance - right.distance) < 1e-5) same += 1
  }
  return { ตรงกัน: same, ทั้งหมด: a.length, สัดส่วน: round(same / a.length, 4) }
}

const originalRaycast = Mesh.prototype.raycast

async function main(): Promise<void> {
  const loader = new GLTFLoader()
  const started = performance.now()
  const gltf = await loader.loadAsync(MODEL_URL)
  log('โหลด GLB (ms)', Math.round(performance.now() - started))
  await breathe()

  gltf.scene.updateMatrixWorld(true)

  let hand: SkinnedMesh | null = null
  const nails: Mesh[] = []
  gltf.scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (mesh.name.startsWith('Nail_')) nails.push(mesh)
    else if (mesh.name === 'Hand') hand = mesh as unknown as SkinnedMesh
  })
  if (hand === null) throw new Error('ไม่พบ mesh มือชื่อ Hand')
  const handMesh: SkinnedMesh = hand

  log('ข้อมูลโมเดล', {
    meshMue: handMesh.name,
    isSkinnedMesh: handMesh.isSkinnedMesh === true,
    trisMue: (handMesh.geometry.getIndex()?.count ?? 0) / 3,
    jamnuanLep: nails.length,
    trisLepRuam: nails.reduce((sum, nail) => sum + (nail.geometry.getIndex()?.count ?? 0) / 3, 0),
  })
  await breathe()

  const targets: Object3D[] = [...nails, handMesh]
  const rays = buildRays(targets)
  const raycaster = new Raycaster()
  raycaster.firstHitOnly = true

  // ---------- A: baseline (three.js ปกติ skin-aware) ----------
  log('กำลังรัน', 'A baseline — ช้าที่สุด รอสักครู่')
  await breathe()
  const baselineRuns = timeCasts(raycaster, rays, targets)
  const baselineHits = castAll(raycaster, rays, targets)
  log('A baseline (three.js ปกติ)', {
    median_ms: round(median(baselineRuns)),
    tor_rangsi_us: round((median(baselineRuns) / RAY_COUNT) * 1000),
    rangsi_thi_chon: baselineHits.filter(Boolean).length,
    rangsi_thangmot: RAY_COUNT,
  })
  await breathe()

  // ---------- B: BVH จาก geometry ดิบ (ท่า rest) ----------
  Mesh.prototype.raycast = acceleratedRaycast
  const buildStart = performance.now()
  const restBvh = new MeshBVH(handMesh.geometry)
  const buildMs = performance.now() - buildStart
  handMesh.geometry.boundsTree = restBvh
  log('B สร้าง BVH จากท่า rest', {
    wela_ms: round(buildMs, 1),
    memory_MB: round(bvhBytes(restBvh) / 1024 / 1024),
  })
  await breathe()

  const bvhRuns = timeCasts(raycaster, rays, targets)
  const bvhHits = castAll(raycaster, rays, targets)
  log('B raycast ด้วย BVH (ท่าเริ่มต้น)', {
    median_ms: round(median(bvhRuns)),
    tor_rangsi_us: round((median(bvhRuns) / RAY_COUNT) * 1000),
    reo_khuen_thao: round(median(baselineRuns) / median(bvhRuns), 1),
    trong_kap_baseline: agreement(baselineHits, bvhHits),
  })
  await breathe()

  // ---------- C: หลังดัดบอร์น (จำลองสไลเดอร์สัดส่วนมือ) ----------
  const scaled: string[] = []
  for (const bone of handMesh.skeleton.bones) {
    if (/palm|hand/i.test(bone.name)) {
      bone.scale.set(1.25, 1, 1.25)
      scaled.push(bone.name)
    }
  }
  for (const bone of handMesh.skeleton.bones) bone.updateWorldMatrix(true, false)
  handMesh.updateMatrixWorld(true)
  handMesh.skeleton.update()
  handMesh.computeBoundingSphere()
  log('C ดัดบอร์น', { bone_thi_prap_scale: scaled })
  await breathe()

  Mesh.prototype.raycast = originalRaycast
  const truthHits = castAll(raycaster, rays, targets)
  Mesh.prototype.raycast = acceleratedRaycast
  const staleHits = castAll(raycaster, rays, targets)
  log('C BVH ท่า rest ใช้กับมือที่ถูกดัดแล้ว', {
    trong_kap_khwam_jing: agreement(truthHits, staleHits),
    mai_het: 'ต่ำ = BVH ค้างที่ท่า rest ผลลัพธ์เชื่อไม่ได้',
  })
  await breathe()

  // ---------- D: bake ตำแหน่งที่ skin แล้ว แล้วสร้าง BVH ใหม่ ----------
  const bakeStart = performance.now()
  const bakedGeometry = bakeSkinnedGeometry(handMesh)
  const bakeMs = performance.now() - bakeStart

  const rebuildStart = performance.now()
  const bakedBvh = new MeshBVH(bakedGeometry)
  const rebuildMs = performance.now() - rebuildStart
  bakedGeometry.boundsTree = bakedBvh

  const proxy = new Mesh(bakedGeometry)
  proxy.name = 'Hand'
  proxy.matrixWorld.copy(handMesh.matrixWorld)
  proxy.matrixAutoUpdate = false

  const bakedTargets: Object3D[] = [...nails, proxy]
  const bakedHits = castAll(raycaster, rays, bakedTargets)
  const bakedRuns = timeCasts(raycaster, rays, bakedTargets)
  log('D bake + สร้าง BVH ใหม่', {
    bake_ms: round(bakeMs, 1),
    sang_bvh_ms: round(rebuildMs, 1),
    ruam_ms: round(bakeMs + rebuildMs, 1),
    median_ms: round(median(bakedRuns)),
    tor_rangsi_us: round((median(bakedRuns) / RAY_COUNT) * 1000),
    trong_kap_khwam_jing: agreement(truthHits, bakedHits),
  })
  await breathe()

  // ---------- F: ทางแก้ที่ดูเหมือนถูกแต่ผิด ----------
  //
  // เมื่อรู้ว่า Mesh.prototype.raycast ไม่มีผลกับ SkinnedMesh สิ่งแรกที่ทุกคนจะลอง
  // คือแพตช์ SkinnedMesh.prototype.raycast ด้วย ซึ่ง "เร็วขึ้นทันที"
  // แต่ BVH ถูกสร้างจากท่า rest ผลลัพธ์จึงผิดเมื่อบอร์นถูกดัด
  // เฟสนี้มีไว้เพื่อบันทึกหลักฐานว่าทางลัดนี้ใช้ไม่ได้ ไม่ใช่แค่บอกว่าอย่าทำ
  const skinnedProto = Object.getPrototypeOf(handMesh) as { raycast: typeof originalRaycast }
  const originalSkinnedRaycast = skinnedProto.raycast
  skinnedProto.raycast = acceleratedRaycast
  handMesh.geometry.boundsTree = restBvh

  const shortcutHits = castAll(raycaster, rays, targets)
  const shortcutRuns = timeCasts(raycaster, rays, targets)
  skinnedProto.raycast = originalSkinnedRaycast

  log('F แพตช์ SkinnedMesh.prototype.raycast (ทางลัดที่ผิด)', {
    median_ms: round(median(shortcutRuns)),
    tor_rangsi_us: round((median(shortcutRuns) / RAY_COUNT) * 1000),
    reo_khuen_thao: round(median(baselineRuns) / median(shortcutRuns), 1),
    trong_kap_khwam_jing: agreement(truthHits, shortcutHits),
    mai_het: 'เร็วขึ้นจริง แต่ถ้าสัดส่วนตรงกันไม่ใช่ 1 แปลว่าผลผิด',
  })
  await breathe()

  // ---------- E: ขอบล่าง - ยิงเฉพาะเล็บ ไม่มี occluder ----------
  Mesh.prototype.raycast = originalRaycast
  const nailsOnlyRuns = timeCasts(raycaster, rays, nails)
  log('E ยิงเฉพาะเล็บ (ขอบล่างทางทฤษฎี)', {
    median_ms: round(median(nailsOnlyRuns)),
    tor_rangsi_us: round((median(nailsOnlyRuns) / RAY_COUNT) * 1000),
    mai_het: 'ใช้จริงไม่ได้ - ไม่มี occluder แปลว่าสีทะลุนิ้วไปลงเล็บที่มองไม่เห็น',
  })

  log('สถานะ', 'เสร็จ')
}

main().catch((error: unknown) => {
  log('ล้มเหลว', error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error))
})
