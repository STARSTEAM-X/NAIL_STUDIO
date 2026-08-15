# สเปก — ระบบของตกแต่งบนเล็บ (Slice 4 ข้อ 1-3)

## 1 · ทำไมต้องมีรอบนี้

Slice 4 ทำ "ทรงเล็บ + ความยาว" เสร็จไปแล้ว (ดู `docs/superpowers/specs/2026-08-13-nail-model-pipeline-design.md`
และ DECISION D-27) เหลืออีก 6 ข้อใน Slice 4 ตาม `docs/implementation-plan.md` บรรทัด 275-291
รอบนี้ทำ 3 ข้อแรก: `geometry/surfaceProjection.ts` + `pointInHull.ts`, `NailDecoration` +
`DecorationInstances`, `TransformController`

สถาปัตยกรรมส่วนใหญ่ของฟีเจอร์นี้**ถูกออกแบบไว้แล้วก่อนหน้านี้**ในสองที่:
- DECISION D-10 (`docs/architecture.md:779-785`) — ของตกแต่งเก็บเป็นพิกัด UV ไม่ใช่ world position
- A-11/A-21 (`docs/algorithms.md:584-639`, `1128-1174`) — อัลกอริทึม UV→surface projection และ
  point-in-hull พร้อม complexity analysis และ location ที่ต้องสร้างไฟล์
- `Decoration`/`Nail.decorations` schema มีอยู่แล้วใน `packages/contracts/src/design.ts:112-133`
  (`u`, `v`, `rotation`, `scale`, `catalogId`, `color?`) — **ไม่ต้องแก้ contracts**

สเปกนี้จึงเน้นส่วนที่**ยังไม่มีใครตัดสินใจ**: โครงสร้าง React component, การจัดกลุ่ม
`InstancedMesh`, โมเดล interaction (คลิก/ลาก/แผงตัวเลข), และรูปร่าง Command — ไม่ทวนซ้ำสิ่งที่
D-10/A-11/A-21 อธิบายไว้แล้ว อ้างอิงกลับไปที่เอกสารเหล่านั้นแทน

### ข้อจำกัดที่ทำให้ขอบเขตรอบนี้แคบกว่าที่คิดตอนแรก

**ยังไม่มี asset ของตกแต่งจริง** — การทำคลัง asset 3D จริง 30-50 ชิ้นเป็นงาน Slice 5 ข้อ 1
(`docs/implementation-plan.md:297-299`, สัปดาห์ 14) ไม่ใช่ Slice 4 รอบนี้จึงใช้ **placeholder
geometry ล้วน** (primitive ง่ายๆ เช่น ทรงกลม/กล่อง/แปดเหลี่ยม 2-3 ชิ้นแทนเพชร/โบว์/สติกเกอร์)
โครงสร้าง catalog ต้องรองรับสลับเป็น GLB จริงได้ทีหลังโดยไม่แก้โค้ดที่เหลือ — แค่เปลี่ยน catalog
data (ดู §3)

**ไม่มี DOM-testing infrastructure ในโปรเจกต์** (ยืนยันจาก final review ของ Slice 4 ข้อ 4 — ไม่มี
jsdom/RTL ที่ไหนเลย) component ระดับ React จะเทสได้แค่ logic ล้วนผ่านการแยก pure function ออกมา
ไม่ใช่ full component render — เป็นข้อจำกัดของ repo ไม่ใช่ของฟีเจอร์นี้

## 2 · การตัดสินใจที่ตกลงกันแล้ว

### D-28 · โหมดวาด/ของตกแต่งแยกกันด้วยปุ่มสลับ ไม่ใช้ pointer event ร่วม

**อะไร**: เพิ่ม toolbar toggle "วาด" / "ของตกแต่ง" ในแต่ละครั้งมี controller เดียวที่ subscribe
pointer event บน canvas — `PaintController` (โหมดวาด) หรือ `TransformController` (โหมดของตกแต่ง)
ไม่ทำงานพร้อมกัน

**ทำไม**: ทั้งสอง controller ตีความ pointer-down/move/up ต่างกันโดยสิ้นเชิง (วาด = ลากเส้นสีบน UV,
ของตกแต่ง = ลากย้ายตำแหน่ง) การให้สองตัวรับ event พร้อมกันแล้วแยกแยะด้วย hit-test จะซับซ้อนกว่า
(ต้องตัดสินใจว่าคลิกบนของตกแต่งหมายถึง "เลือกของตกแต่ง" หรือ "วาดทับ") และเสี่ยง edge case ที่ยัง
ไม่ต้องแก้ในตอนนี้

**ทางเลือกที่ปฏิเสธ**: ให้ของตกแต่งเลือก/ลากได้ทันทีโดยไม่ต้องสลับโหมด (คลิกโดนของตกแต่ง =
TransformController, คลิกที่อื่น = PaintController) — UX ลื่นกว่าแต่ implementation ซับซ้อนกว่า
มาก ไม่ทำในรอบนี้ ทำได้ทีหลังถ้าผู้ใช้จริงบ่นเรื่อง friction ของการสลับโหมด

### D-29 · หมุน/ย่อขยายผ่านแผงตัวเลขเท่านั้น ไม่ทำ 3D gizmo

**อะไร**: ย้ายตำแหน่งของตกแต่งทำด้วยการลากเมาส์บนตัวของตกแต่งเอง (คงแกนเดียวที่ต้องมี gesture
ต่อเนื่องจริงๆ) ส่วนหมุน/ย่อขยายทำผ่าน slider ในแผงด้านข้าง (รูปแบบเดียวกับ `PaintToolbar`
ที่มีอยู่แล้ว) ไม่มี rotate ring หรือ scale handle แบบ 3D gizmo (แบบ `TransformControls` ของ
three.js)

**ทำไม**: DoD ที่ `implementation-plan.md:299` เขียนไว้แค่ "ย้าย/หมุน/ย่อขยายได้ทั้งเมาส์และแผง
ตัวเลข" — ไม่ได้บังคับว่าทุกแกนต้องทำได้ทั้งสองทาง การสร้าง gizmo 3D ที่ใช้งานถูกต้อง (hit-test
วงแหวนหมุน, จัดการกล้องบัง handle, snapping) เป็นงานใหญ่ที่ไม่มีโค้ดต้นแบบในนี้ให้อิง (`grep`
`gizmo|TransformControls` ทั้ง repo ไม่เจอ) YAGNI: ทำเวอร์ชันง่ายก่อน วัดว่าผู้ใช้ต้องการ gizmo
จริงไหมค่อยทำ

**ทางเลือกที่ปฏิเสธ**: ใช้ `TransformControls` ของ three.js ตรงๆ — ออกแบบมาสำหรับแกน world-space
ไม่ใช่แกน UV/tangent-plane ของผิวโค้ง ต้องเขียน custom logic แปลงอยู่ดี ไม่ประหยัดงานจริง

### D-30 · เพิ่มของตกแต่งด้วยคลิกเลือกจาก catalog ไม่ใช่ drag-and-drop

**อะไร**: แผง catalog (ของตกแต่งที่เลือกได้) อยู่ข้างๆ เหมือน color picker คลิกไอคอนแล้วของตกแต่ง
วางที่กึ่งกลางเล็บที่กำลังเลือกอยู่ทันที (`u=0.5, v=0.5` ปรับเข้า hull ด้วย `pointInHull` ถ้าจุด
กึ่งกลาง UV ไม่ได้อยู่ในเล็บจริงเพราะรูปเล็บไม่สมมาตร — เลื่อนเข้าจุดที่ใกล้ศูนย์กลางที่สุดที่อยู่ใน
hull)

**ทำไม**: ตัดความซับซ้อนของ drag-and-drop ข้าม DOM ไป WebGL canvas (ต้องแปลงพิกัด, จัดการ
dragover/drop event, preview ระหว่างลาก) ผู้ใช้ยังลากปรับตำแหน่งได้ทันทีหลังคลิกอยู่ดี (D-28/D-29)
จึงไม่เสียความสามารถ แค่ขั้นตอนแรกง่ายกว่า

## 3 · Placeholder catalog

`apps/web/src/3d/decorations/decorationCatalog.ts` — array คงที่ของ:

```ts
interface CatalogEntry {
  id: string                 // ตรงกับ Decoration.catalogId
  label: string               // Thai label สำหรับ UI
  geometry: () => BufferGeometry  // factory ไม่ใช่ instance เดียวที่แชร์ข้าม InstancedMesh
  defaultScale: number
}
```

รอบนี้มี 3 รายการ placeholder: `gem` (icosahedron รัศมีเล็ก), `bow` (box แบนสองชิ้นประกบมุม),
`star` (cone 5 เหลี่ยมคว่ำ) — เลือกจาก three.js primitive geometry ที่มีอยู่แล้ว ไม่ต้องโหลด asset
ภายนอก โครงสร้าง `CatalogEntry` ออกแบบให้ Slice 5 เพิ่มฟิลด์ `modelUrl?: string` แล้วสลับ
`geometry` factory เป็น GLTF loader ได้โดยไม่กระทบโค้ดที่เรียกใช้ catalog

## 4 · Geometry primitives (`apps/web/src/3d/geometry/`)

**ขอบเขตจริงคือ 3 ไฟล์ ไม่ใช่ 2** — `hull.ts` (A-01) เป็น prerequisite ของ `pointInHull.ts` (A-21)
ที่ยังไม่มีใครสร้าง (ดูเหตุผลใน §ย่อยของ `pointInHull.ts` ด้านล่าง) เพิ่มเข้ามาในรอบนี้

รายละเอียดอัลกอริทึมอยู่ใน A-11/A-21 (`docs/algorithms.md`) ทั้งหมดแล้ว สรุปเฉพาะ interface และ
จุดที่ต้องตัดสินใจเพิ่ม:

```ts
// surfaceProjection.ts
interface SurfacePoint { position: Vector3; normal: Vector3; tangent: Vector3 }
function projectUvToSurface(mesh: Mesh, u: number, v: number): SurfacePoint | null
```

คืน `null` เมื่อจุด UV ไม่ตกในสามเหลี่ยมไหนเลย (นอกรูปเล็บ) — เรียกใช้แบบเดียวกับที่
`panelToTexture` ใน `nailFlatten.ts` คืน `null` เมื่อจุดอยู่นอกรูป (§ pattern เดิม, ดู
`nailFlatten.ts:125-146` ที่ agent สำรวจไว้) ผู้เรียกต้อง handle `null` เอง (เช่น ตอนวาง
ของตกแต่งใหม่ กันจุดกึ่งกลาง UV ไม่อยู่ใน hull ด้วย D-30)

ใช้ `morphedPosition`/`morphedNormal` (จาก `nailMorph.ts`) และ `nailMatrix` (จาก `nailViews.ts`)
เหมือนที่ `nailViewOf` ทำอยู่แล้ว เพื่อให้ตำแหน่งของตกแต่งตาม morph target (ทรง/ความยาว) และ
hand-proportion scaling ถูกต้องเสมอ — **นี่คือเหตุผลที่ D-10 บังคับให้เก็บเป็น UV**: ถ้า
`nail_geometry.py`/D-27 เปลี่ยนทรงเล็บ ของตกแต่งต้อง reproject ใหม่อัตโนมัติผ่านฟังก์ชันนี้

Implementation: brute-force วน triangle ทั้งหมด (T ≤ 512 ตาม A-11's ข้อสรุปว่า "acceptable ที่
T≤512 ไม่ต้องทำ grid ก่อน") — **ไม่ทำ 16×16 grid ที่ A-11 เตรียมไว้เป็น extension path** จนกว่าจะ
วัดแล้วว่าช้าจริง (measure-first policy เดียวกับที่ A-08/A-21 ใช้)

```ts
// pointInHull.ts
function isPointInHull(hull: ReadonlyArray<Point>, point: Point): boolean
```

Binary search แบบ fan decomposition ตาม A-21 ตรงตัว

**พบระหว่างเขียนสเปกนี้ (ไม่ได้อยู่ในผลสำรวจตอนแรก)**: `pointInHull.ts` ต้องการ hull เป็น input
แต่ **A-01 (`hull.ts`, Andrew's Monotone Chain) ก็ยังไม่มีไฟล์จริงในโปรเจกต์เช่นกัน** —
`grep convexHullUv` ทั้ง `apps/web/src` ไม่เจอ (ยืนยันแล้ว ไม่ใช่แค่เอเจนต์พลาด) แม้
`docs/algorithms.md:29-76` จะออกแบบอัลกอริทึมและ location (`apps/web/src/3d/geometry/hull.ts`,
ยกจาก `NailDesine-TEST/src/nail/hull.ts`) ไว้ครบแล้วก็ตาม เหตุผลที่ยังไม่มีคือระบบวาดเดิม
(`nailFlatten.ts`/`panelToTexture`) ตัดขอบเล็บด้วยการเช็ค triangle membership ตรงๆ ไม่ต้องใช้ hull
เลย — เพิ่งมาจำเป็นตอนนี้ที่ A-21 ต้องการ

**เพิ่ม A-01 (`hull.ts`) เข้าขอบเขตของ task ที่ทำ `pointInHull.ts`** (เป็น prerequisite ตรงไปตรงมา
ไม่ใช่งานแยก) — ยกอัลกอริทึมจาก `docs/algorithms.md:29-76` ตรงตัว: `computeHull(points: Pt2[]):
Pt2[]`, Andrew's Monotone Chain, Θ(V log V), รับพิกัด UV ของทุก vertex ของเล็บ (V = 81-289 จุด
ตามที่ระบุไว้ — แต่ตอนนี้หลัง subdivide ใน D-27 แล้ว `Nail_index` มี 1,089 verts ไม่ใช่ 81 ต้องเช็ค
ว่าค่า V จริงตอนนี้ทำให้ performance ยังอยู่ในขอบเขตที่ยอมรับได้หรือไม่ — Θ(V log V) ที่ V=1089 ≈
10,900 การเปรียบเทียบ ยังเร็วมากในบริบท "10 ครั้งต่อการเปิด editor" ไม่น่าเป็นปัญหา แต่ควร note
ไว้เผื่อ verify ตอน implement)

## 5 · Rendering (`apps/web/src/3d/decorations/`)

### `DecorationInstances.tsx`

1 `InstancedMesh` ต่อ `catalogId` **ครอบคลุมทั้งมือ** (ไม่แยกต่อเล็บ) เพราะ instance ทั้งหมดของ
catalog เดียวกันแชร์ geometry/material ได้อยู่แล้วไม่ว่าจะอยู่เล็บไหน — สอดคล้องกับเหตุผลที่
`NailTextureSet` เดิมจองแคนวาสต่อเล็บ (คนละเรื่อง คนละ optimization target)

Rebuild instance matrix buffer เมื่อ:
- `document.nails[*].decorations` เปลี่ยน (เพิ่ม/ลบ/ย้ายของตกแต่งที่ catalog นั้น)
- morph target เปลี่ยน (ผู้ใช้เปลี่ยนทรง/ความยาวเล็บ — ของตกแต่งต้อง reproject ตำแหน่งใหม่)
- hand-proportion เปลี่ยน (สเกลเปลี่ยน `nailMatrix`)

ใช้ dirty-set pattern เดียวกับระบบ texture เดิม (A-07 — คำนวณเฉพาะ nail ที่ affected ไม่ใช่ทั้ง
มือทุกครั้ง) รายละเอียด matrix composition: `position` จาก `projectUvToSurface`, `quaternion`
จาก `tangent`+`normal`+`decoration.rotation` (หมุนรอบ normal), `scale` จาก
`decoration.scale × catalogEntry.defaultScale`

### `NailDecoration.tsx`

Thin wrapper — ต่อ instance index กับ `decorationId` สำหรับ hit-test (raycast คืน
`instanceId` ของ `InstancedMesh`, ต้อง map กลับเป็น `{nailKey, decorationId}` ผ่าน array คู่ขนาน
ที่ build พร้อมกับ matrix buffer)

## 6 · Interaction (`apps/web/src/3d/interactions/TransformController.tsx`)

Plain TS class (ตาม D-05) รับ pointer event ผ่าน React wrapper บางๆ (ตาม pattern
`picking.ts`/`PaintController.tsx` — "ส่วนที่เหลือใน component จึงเป็นเพียงการต่อสาย ไม่มีการ
ตัดสินใจซ่อนอยู่")

- **เลือก**: คลิกบนของตกแต่ง (raycast บรุทฟอร์ซกับ `DecorationInstances` ของเล็บที่ active เท่านั้น
  — ไม่ต้อง BVH ตาม D-06's เหตุผลเดิม "128-512 tris ต้นทุนสร้าง BVH มากกว่าที่ประหยัด") → เก็บ
  `selectedDecoration: {nailKey, decorationId} | null` ใน state ใหม่ (`SelectionController.ts`
  ตามที่ระบุไว้ใน planned tree ของ `architecture.md` แต่ยังไม่มีไฟล์)
- **ย้าย**: pointer-down บนของตกแต่งที่เลือกอยู่ → pointer-move คำนวณ UV ใหม่จาก raycast hit
  บนเล็บ (ใช้ pipeline เดียวกับ `picking.ts` ที่มีอยู่แล้วสำหรับวาด) → clamp ด้วย `isPointInHull`
  ก่อน apply → pointer-up commit เป็น `MoveDecorationCommand`
- **หมุน/ย่อขยาย**: แผงข้าง (component ใหม่ เช่น `DecorationPanel.tsx` คู่กับ `PaintToolbar.tsx`)
  มี slider หมุน (0-360°) และ scale (ตาม `scale.positive().max(1)` ใน schema) → commit เป็น
  `ScaleDecorationCommand` / รวมเข้า `MoveDecorationCommand` field `rotation` (ดู §7)
- **ลบ**: ปุ่ม "ลบ" ในแผงข้างเดียวกัน (ใช้งานได้เมื่อมีของตกแต่งถูกเลือกอยู่เท่านั้น) → commit เป็น
  `RemoveDecorationCommand` — ระบุไว้ชัดเจนเพราะไม่งั้น command นี้จะไม่มีจุดเรียกใช้จริงในรอบนี้
  (บทเรียนจาก final review ของ Slice 4 ข้อ 4 ที่เจอ `merge()` เป็น dead code เพราะไม่มี caller ส่ง
  `mergeKey` มา)

## 7 · Command shape (`apps/web/src/3d/history/commands/`)

`algorithms.md:538` ระบุรูปแบบ `MoveDecorationCommand` ไว้ล่วงหน้าแล้ว — ใช้ตามนั้นตรงๆ:

```ts
class AddDecorationCommand implements Command {
  constructor(nailKey: NailKey, decoration: Decoration)
  // do: append เข้า nail.decorations, undo: filter ออกด้วย id — mirror AddStrokeCommand
}

class RemoveDecorationCommand implements Command {
  constructor(nailKey: NailKey, decoration: Decoration, index: number)
  // เก็บ snapshot เต็มไว้ตอน undo ใส่กลับที่ index เดิม (ลำดับ array มีผลกับ instance index
  // ตอน rebuild buffer แต่ไม่ผลต่อ correctness — แค่ทำให้ diff อ่านง่ายกว่า append ท้ายเสมอ)
}

class MoveDecorationCommand implements Command {
  constructor(nailKey: NailKey, decorationId: string,
              before: {u: number; v: number; rotation: number},
              after: {u: number; v: number; rotation: number},
              mergeKey?: string)
  // mirror SetShapeCommand: merge() coalesce ระหว่างลากต่อเนื่อง (มี mergeKey เดียวกัน)
}

class ScaleDecorationCommand implements Command {
  constructor(nailKey: NailKey, decorationId: string,
              before: number, after: number, mergeKey?: string)
  // mirror SetFinishCommand เป๊ะ
}
```

ทุก command route ผ่าน `replaceNail`/`result()` helper ใน `documentEdits.ts` ที่มีอยู่แล้ว (คง
identity-preserving pattern — คืน object เดิมถ้าไม่มีอะไรเปลี่ยนจริง ตามกฎที่ comment หัวไฟล์
เขียนไว้) `documentEdits.ts`'s `cloneNail`/`nailsMatch` รองรับ `decorations` array อยู่แล้ว
(บรรทัด 53, 70-73) ไม่ต้องแก้

## 8 · การทดสอบ

- `hull.test.ts` / `surfaceProjection.test.ts` / `pointInHull.test.ts` — pure function, edge case: จุดขอบ hull
  พอดี, triangle เสื่อม (พื้นที่ ≈ 0), จุดนอกรูปเล็บ (คืน `null`/`false`), มุมเล็บที่แหลมมาก
  (stiletto — UV distortion สูงตาม D-27 อาจทำให้ triangle lookup ผิดพลาดง่ายกว่าทรงอื่น ต้องมี
  test case เจาะจงทรงนี้)
- Command tests (`commands.test.ts`) — do/undo/merge สำหรับทั้ง 4 command ตาม pattern เดิม
  (`SetShapeCommand`/`SetFinishCommand` เป็นต้นแบบ)
- **ไม่มี** component-level test สำหรับ `DecorationInstances`/`TransformController`/
  `DecorationPanel` — ข้อจำกัด DOM-testing ของ repo (ดู §1) ทดแทนด้วยการตรวจมือบนเบราว์เซอร์จริง
  ตอนปิดงาน (เหมือน Task 12 ของรอบ pipeline)

## 9 · ผลกระทบที่ต้องยอมรับ

- Placeholder geometry (§3) จะดูไม่สวยจนกว่า Slice 5 ทำ asset จริง — เป็นที่รู้กันแล้ว ไม่ใช่บั๊ก
- ของตกแต่งบนเล็บที่มี UV distortion สูง (โป้ง, D-27) จะ project ตำแหน่งผิดเพี้ยนมากกว่าเล็บอื่น
  เพราะ `projectUvToSurface` ยืมสมมติฐานเรื่อง UV เดียวกับระบบวาด — เป็นผลต่อเนื่องจาก known
  limitation เดิม ไม่ใช่บั๊กใหม่ของฟีเจอร์นี้
- ไม่มี 3D gizmo (D-29) — ผู้ใช้ที่คุ้นเคยกับโปรแกรม 3D อื่นอาจแปลกใจที่หมุน/ย่อขยายด้วยเมาส์
  ไม่ได้โดยตรง

## 10 · สิ่งที่ไม่อยู่ในรอบนี้

- Asset 3D จริงของของตกแต่ง (Slice 5)
- Drag-and-drop จาก catalog (D-30 ตัดออก)
- 3D transform gizmo (D-29 ตัดออก)
- Grid-based spatial index สำหรับ `surfaceProjection` (ทำต่อเมื่อวัดแล้วว่า brute-force ช้าจริง)
- Scatter/generator สำหรับวางของตกแต่งอัตโนมัติ (A-20, Poisson-disk — คนละงาน อยู่ใน generator
  slice)
- สัดส่วนมือ + สีผิว, thumbnail, exporters (Slice 4 ข้อ 5-7 ที่เหลือ)

## 11 · เกณฑ์ว่าเสร็จ

- เลือกของตกแต่งจาก catalog → ปรากฏกลางเล็บที่เลือกอยู่
- ลากของตกแต่งด้วยเมาส์ → ตำแหน่งเปลี่ยนตาม ไม่หลุดออกนอกเล็บ (`isPointInHull` clamp ทำงาน)
- ปรับ slider หมุน/ย่อขยาย → ของตกแต่งเปลี่ยนตาม
- เลือกของตกแต่งแล้วกด "ลบ" → หายไปจากเล็บ
- Ctrl+Z / Ctrl+Y ใช้ได้ครบทั้ง 4 command
- เปลี่ยนทรง/ความยาวเล็บ (จากฟีเจอร์ที่เพิ่งทำ Slice 4 ข้อ 4) ขณะมีของตกแต่งติดอยู่ → ของตกแต่ง
  ยังติดผิวเล็บ ไม่ลอย ไม่จม (พิสูจน์ D-10 ตามที่ DoD เดิมของ Slice 4 เขียนไว้)
- `npm run typecheck`, `npm run test` ผ่านสะอาด
