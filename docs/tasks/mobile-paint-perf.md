# Task: ลดต้นทุนการวาดบนมือถือ — Fix A (raycast) + Fix B (frameloop demand)

## บริบท

วาดบน PC (Chrome) ลื่น แต่บน Chrome ใน iPad หน่วง

### หลักฐานที่วัดได้

แกะ `apps/web/public/models/hand.glb`:

| Mesh | สามเหลี่ยม | ชนิด |
|---|---|---|
| Hand | **118,756** | SkinnedMesh |
| Nail_index / Nail_ring | 2,048 | SkinnedMesh |
| Nail_little / middle / thumb | 1,280 | SkinnedMesh |

วัด raycast ด้วยโมเดลตัวจริงบน three 0.185.1 (Node v24, เครื่อง dev):

```
เล็บ + occluders (โค้ดปัจจุบัน)   89.13 ms/ครั้ง   hits 60/60
```

เทียบต้นทุนของการเป็น SkinnedMesh ที่จำนวนสามเหลี่ยมเท่ากัน: **แพงกว่า Mesh ธรรมดา 22.9 เท่า**
(75.05 ms เทียบกับ 3.28 ms) เพราะ three ต้องคำนวณตำแหน่ง vertex ตามกระดูกทีละจุดระหว่าง raycast

`three-mesh-bvh` ไม่ได้เป็น dependency ของโปรเจกต์ → raycast ไล่สามเหลี่ยมเชิงเส้น

**หมายเหตุความแม่นยำ:** ตัวเลข 89.13 ms วัดได้จริง ส่วนต้นทุนของ "เล็บชิ้นเดียว"
ประมาณตามสัดส่วนสามเหลี่ยม (~1.5 ms) เพราะยิงรังสีให้โดนเล็บใน Node ไม่ได้
(โมเดล skinned ตำแหน่งจริงถูกกระดูกดัด)

---

# Fix A — เลิก raycast มือทั้งข้างระหว่างลากเส้น

## ปัญหา

`apps/web/src/3d/painting/PaintController.tsx:43`

```ts
const targets = [...parts.nails.values(), ...parts.occluders]
```

`occluders` มาจาก `apps/web/src/3d/models/PartsRegistry.ts:60` ซึ่งใส่ mesh ทุกชิ้นที่ไม่ใช่เล็บ
รวม `Hand` 118,756 สามเหลี่ยม ทั้ง `onDown` และ `onMove` ใช้ `targets` ชุดเดียวกันนี้

แต่ `onMove` ที่บรรทัด 175 ทิ้งผลทุกอย่างที่ไม่ใช่เล็บที่กำลังวาดอยู่:

```ts
if (!target || target.key !== painting) return
```

จึงจ่ายค่ายิงรังสีใส่มือทุก pointermove เพื่อได้ผลที่โยนทิ้งทันที

## ทำไมตัดออกได้โดยไม่เสียความถูกต้อง

การเช็ค occluder มีไว้กัน "วาดลงเล็บที่ถูกนิ้วอื่นบัง" (`picking.ts:47`) ซึ่งจำเป็นเฉพาะ
ตอนเริ่มเส้น เพราะระหว่างลากฉากหยุดนิ่ง — มีสองกลไกค้ำไว้:

1. `PaintController.tsx:154` — `controls.enabled = false` ตอน `onDown` ผู้ใช้หมุนกล้องไม่ได้
2. `NailFocus.tsx:68` — listener `pointerdown` บนแคนวาสสั่ง `goal.current = null` + `clearFocus()`
   ทำให้การจ่อกล้องแบบ lerp ถูกยกเลิกทันทีที่แตะ กล้องจึงไม่ไถต่อระหว่างลาก

เล็บที่มองเห็นตอนเริ่มเส้นจึงยังมองเห็นตลอดเส้น

## การเปลี่ยนแปลง

ไฟล์เดียว: `apps/web/src/3d/painting/PaintController.tsx`

1. แยกเป้าหมายเป็นสองชุด
   - `pickTargets` = `[...parts.nails.values(), ...parts.occluders]` (ของเดิม) ใช้ใน `onDown`
   - ระหว่างลากใช้เฉพาะ mesh ของเล็บที่กำลังวาด: `parts.nails.get(painting)`
2. ให้ `hit()` รับรายการเป้าหมายเข้ามาเป็นพารามิเตอร์ แทนที่จะปิดทับ `targets` ตัวเดียว
3. `onMove` เรียก `hit()` ด้วยเป้าหมายชิ้นเดียวนั้น
   - ถ้าหา mesh ไม่เจอ (ไม่ควรเกิด) ให้ `return` เงียบ ๆ เหมือนกรณี `!target` เดิม
4. พฤติกรรมที่เหลือคงเดิมทุกอย่าง — รวมถึงการ `return` เงียบเมื่อลากออกนอกเล็บ
   (บรรทัด 174–175) ซึ่งยังต้องทำงานเหมือนเดิม เพราะเป้าหมายชิ้นเดียวก็ยังพลาดได้
   เมื่อลากพ้นขอบเล็บ

## ห้ามแตะ

- **ห้ามเปลี่ยน `onDown`** ให้เลิกใช้ occluders — จะทำให้วาดทะลุไปลงเล็บที่ถูกบังอยู่
  ซึ่งเป็นบั๊กที่ `picking.ts:47` ตั้งใจกันไว้ และผู้ใช้จะไม่รู้ตัวจนหมุนกล้อง
- ห้ามเพิ่ม dependency ใหม่ (เช่น `three-mesh-bvh`) งานนี้ไม่ต้องใช้
- ห้ามแก้ `picking.ts`, `PartsRegistry.ts`, หรือไฟล์โมเดล

## Acceptance criteria — Fix A

1. `onDown` ยังยิงใส่ `nails + occluders` เหมือนเดิม
2. `onMove` ยิงใส่ mesh ของเล็บที่กำลังวาดเท่านั้น
3. ลากออกนอกเล็บแล้วลากกลับเข้ามา ยังวาดต่อได้ (ไม่จบเส้น)
4. เริ่มวาดบนเล็บที่ถูกนิ้วอื่นบัง ยังต้องไม่เกิดเส้น
5. เทสเดิมทั้งหมดผ่าน

---

# Fix B — เปิด `frameloop="demand"`

## ปัญหา

`apps/web/src/3d/scene/NailScene.tsx:20` ไม่ได้ตั้ง `frameloop` → ค่า default คือ `'always'`
เรนเดอร์ 60 fps ตลอดเวลาแม้ไม่มีอะไรเปลี่ยน

`apps/web/src/3d/scene/DesignScene.tsx:20` เขียนคอมเมนต์ไว้แล้วว่า *"including when the
renderer is running in demand mode"* และต่อ `invalidate()` รอไว้ — โครงสร้างพร้อม แต่ไม่เคยเปิด

บน iPad การเรนเดอร์ตลอดเวลาทำให้เครื่องร้อนแล้วโดน thermal throttling ซึ่งทำให้ยิ่งใช้ยิ่งช้า

## การเปลี่ยนแปลง

### B1. เปิดโหมด

`apps/web/src/3d/scene/NailScene.tsx` — เพิ่ม `frameloop="demand"` ให้ `<Canvas>`

### B2. ใส่ `invalidate()` ให้ทุกที่ที่แก้วัตถุ three นอกวงจร React

**นี่คือส่วนที่พังง่ายที่สุดของงานนี้** ใน demand mode เฟรมจะถูกวาดเมื่อมีคนสั่งเท่านั้น
โค้ดที่แก้ฉากผ่าน `store.subscribe` หรือ ref จะเปลี่ยนข้อมูลแล้วไม่มีใครวาด — จอค้าง

ต้องเพิ่ม `invalidate()` ที่ **2 จุด** (ค้นครบและตรวจสอบแล้ว):

| ไฟล์ | จุด | อาการถ้าลืม |
|---|---|---|
| `3d/scene/NailFocus.tsx:81` | ใน `useFrame` เมื่อ `goal.current` ยังไม่ null | กล้องจ่อเล็บค้างกลางทาง เคลื่อนไม่จบ |
| `3d/decorations/DecorationInstances.tsx:128` | ใน subscriber ตอนตั้ง `needsRebuildRef` | เพิ่ม/ลบ/ย้ายของตกแต่งแล้วจอไม่เปลี่ยน |

ทั้งสองไฟล์ถูก render ใต้ `<Canvas>` (ผ่าน `DesignScene`) จึงเรียก
`useThree((state) => state.invalidate)` ได้ตามปกติ

**หมายเหตุ `NailFocus`:** `useFrame` ที่ยัง lerp อยู่ต้องขอเฟรมถัดไปเอง ไม่งั้น
แอนิเมชันจะหยุดหลังเฟรมแรก — เรียก `invalidate()` ทุกครั้งที่ยังไม่ settled

### จุดที่ตรวจแล้วว่า **ไม่ต้องแก้** — ห้ามแก้

- **`3d/painting/useNailTextures.ts:92`** — hook นี้ถูกเรียกที่ `NailEditor.tsx:102`
  ซึ่งอยู่**นอก** `<Canvas>` (`<NailScene>` เพิ่งถูกสร้างที่บรรทัด 461) จึงเรียก
  `useThree` ที่นี่ไม่ได้ **แต่ไม่จำเป็นต้องเรียก** เพราะ subscriber ตัวนี้เรียก
  `set.rebuild(key)` ก่อนเสมอ → `NailTextureSet.rebuild()` ยิง `updateListeners`
  ที่บรรทัดสุดท้าย → `LiveTextureInvalidator` (`DesignScene.tsx:27`) เรียก
  `invalidate()` ให้อยู่แล้ว ครอบคลุมทั้ง `syncFinish` และ `syncShape`
  เพราะทั้งคู่อยู่ในบล็อกเดียวกับ `rebuild`
- **`3d/models/useHandProportions.ts:44`** — ถูกเรียกที่ `DesignScene.tsx:34`
  ซึ่งอยู่ใต้ `<Canvas>` แล้ว แต่การเปลี่ยนสัดส่วนมือมาจาก `state.document.hand`
  ซึ่งไม่ผ่าน `rebuild` → **ยังต้อง invalidate** ให้เพิ่มที่นี่ด้วย (รวมเป็น 3 จุด)

> แก้ไขจากฉบับก่อน: ตารางเดิมระบุ 4 จุดโดยรวม `useNailTextures` ไว้ด้วย ซึ่งผิด
> ทั้งเพราะอยู่นอก Canvas และเพราะมีทางเดิน invalidate อยู่แล้ว

### B3. OrbitControls

`OrbitControls` ของ drei เรียก `invalidate` ให้เองเมื่อกล้องเปลี่ยน และโปรเจกต์**ไม่ได้ตั้ง**
`enableDamping` จึงไม่ต้องแก้อะไร — ตรวจให้แน่ใจว่าหมุน/ซูมด้วยเมาส์ยังลื่นหลังเปลี่ยนโหมด

## ห้ามแตะ

- **ห้ามแก้ `preserveDrawingBuffer` หรือ `antialias`** — เป็น Fix C/D คนละงาน ยังไม่อนุมัติ
- ห้ามลด `TEX_SIZE` หรือแก้ตรรกะ composite ใน `NailTextureSet.ts`
- ห้ามเปลี่ยน `dpr={[1, 1.5]}`

## Acceptance criteria — Fix B

1. `<Canvas frameloop="demand">`
2. เลือกเล็บแล้วกล้องจ่อจนถึงที่หมายและหยุดนิ่ง ไม่ค้างกลางทาง
3. หมุน/ซูมด้วย OrbitControls ยังลื่น
4. วาดเส้นแล้วเห็นสีตามนิ้วทันทีเหมือนเดิม
5. เพิ่ม/ย้าย/ลบของตกแต่ง แล้วจอเปลี่ยนตามทันที
6. เปลี่ยนชนิดผิวเล็บ แล้วจอเปลี่ยนตามทันที
7. ปรับสัดส่วนมือ แล้วจอเปลี่ยนตามทันที
8. Undo / Redo แล้วจอเปลี่ยนตามทันที
9. บันทึกงาน (thumbnail capture) ยังได้ภาพที่ไม่ว่างเปล่า

> ข้อ 9 สำคัญ: `ThumbnailCapture` / `SnapshotCapture` อ่านจาก drawing buffer
> ถ้าในโหมด demand ไม่มีเฟรมถูกวาดก่อน capture อาจได้ภาพว่าง ต้องทดสอบจริง
> ถ้าพบว่าว่าง ให้ `invalidate()` แล้วรอเฟรมก่อน capture — ห้ามแก้ด้วยการเปิด
> `frameloop` กลับเป็น always

---

## Tests

- เทสเดิมทั้งหมดต้องผ่าน
- เพิ่ม unit test ให้ Fix A ถ้าทำได้โดยไม่ต้องมี WebGL: ยืนยันว่าเส้นทาง `onMove`
  ไม่ได้ยิงใส่ occluders (เช่น spy ที่ `intersectObjects`) — ถ้าโครงเทสเดิมทำไม่ไหว
  ให้ข้ามแล้วรายงานเหตุผล อย่าฝืนเขียนเทสที่ผูกกับ implementation จนเปราะ

## คำสั่งที่ต้องรัน

- `npm run typecheck`
- `npm run test`
- `npm run build --workspace apps/web`

## Complexity

Fix A: ลดงานต่อ pointermove จาก O(สามเหลี่ยมทั้งมือ = 126,692) เหลือ O(สามเหลี่ยมเล็บเดียว ≈ 1,280–2,048)
Fix B: ลดจำนวนเฟรมที่วาดจาก 60/วินาทีคงที่ เหลือเท่าที่มีการเปลี่ยนแปลงจริง
