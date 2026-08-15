# สเปก — สัดส่วนมือ + สีผิว (Slice 4 ข้อ 5)

## 1 · ทำไมต้องมีรอบนี้

Slice 4 เหลือ 3 ข้อสุดท้ายตาม `docs/implementation-plan.md:306-308` (สัดส่วนมือ+สีผิว,
thumbnail, exporters) หลังจากของตกแต่ง (ข้อ 1-3, ดู
`docs/superpowers/specs/2026-08-15-nail-decoration-design.md`) และทรงเล็บ/ความยาว (ข้อ 4, ดู
`docs/superpowers/specs/2026-08-13-nail-model-pipeline-design.md`) เสร็จแล้ว รอบนี้ทำข้อ 5
เท่านั้น

สถาปัตยกรรมของฟีเจอร์นี้**ถูกตัดสินใจไว้แล้วเกือบทั้งหมด** ก่อนรอบนี้เริ่ม:

- **Schema พร้อมใช้แล้ว** — `handSettingsSchema` ใน `packages/contracts/src/design.ts:135-143`
  มี `skinTone: hexColorSchema` และ `proportions: { handScale, palmWidth, fingerLength,
  fingerWidth }` (ทุกตัว `z.number()` จำกัดช่วงในสคีมาอยู่แล้ว: `handScale` 0.8-1.2, อีก 3 ตัว
  0.7-1.3) `createEmptyDocument()` seed ค่าตั้งต้นไว้แล้ว (`skinTone: '#e8bfa0'`, proportions
  ทุกตัว = 1) **ไม่ต้องแก้ contracts**
- **โค้ดต้นแบบเต็มรูปแบบมีอยู่แล้ว** ใน `Source/NailDesine-TEST/src/three/` —
  `handBones.ts`, `handProportions.ts` (รวม `refreshSkinnedBounds`) และลำดับเรียกใน
  `Design.tsx` (~บรรทัด 110-181) `docs/source-audit.md:156` และ `docs/architecture.md:193`
  ระบุตรงกันว่าให้ **"ยกจากเดิม"** ไม่ใช่ออกแบบใหม่
- **D-10** (`docs/architecture.md:779-785`) ออกแบบให้ของตกแต่งเก็บเป็น UV ไว้ล่วงหน้า
  **เพื่อรอฟีเจอร์นี้โดยเฉพาะ** — `DecorationInstances.tsx` (สร้างใน Slice 4 ข้อ 1-3) rebuild
  instance matrix ทุกครั้งที่ `document` เปลี่ยน identity โดย derive ตำแหน่งจาก
  `projectUvToSurface` ซึ่งอ่าน `nailMatrix(mesh)` สดทุกครั้ง — **ถ้าสเกลบอร์นเปลี่ยนและมีการ
  เรียก `updateMatrixWorld` ก่อน ของตกแต่งจะ reproject เองอัตโนมัติ ไม่ต้องเขียนโค้ด
  reproject เพิ่ม**

สเปกนี้จึงเน้นเฉพาะส่วนที่**ยังไม่มีใครตัดสินใจ**: จะผูก state/Command/UI เข้ากับโครงสร้าง
ปัจจุบันของ `apps/web` (ที่ต่างจาก `NailDesine-TEST` เดิม — มี `designStore`/`HistoryStack`/
Command pattern ที่ของเดิมไม่มี) ยังไงบ้าง

## 2 · การตัดสินใจที่ตกลงกันแล้ว (จากบทสนทนาออกแบบ)

### D-32 · Undo/Redo ผูกกับ Command pattern เหมือนฟีเจอร์อื่น

สไลเดอร์สัดส่วน/สีผิว commit เป็น `Command` เข้า `HistoryStack` แบบเดียวกับ opacity slider
(Slice 3) — coalescing ด้วย `mergeKey` ระหว่างลากต่อเนื่อง 1 gesture = 1 รายการ history

### D-33 · Live update ระหว่างลาก + coalesce เป็น history เดียว

มือ 3D ขยับตามทันทีขณะลาก slider (ไม่ใช่ apply ตอนปล่อยเมาส์เท่านั้น) แต่ `HistoryStack` เห็น
แค่ 1 รายการต่อการลาก 1 ครั้ง (mergeKey เดียวกันตลอด gesture, หมดอายุเมื่อปล่อยเมาส์ — ตาม
แพทเทิร์น `SetLayerOpacityCommand`) **Trade-off ที่ยอมรับ**: `refreshSkinnedBounds` (จัดว่า
ไม่ถูกมาก — เดิน bone ทุกตัวใน skeleton + คำนวณ bounding sphere ใหม่ต่อ mesh) จะถูกเรียกทุก
เฟรมที่ค่าเปลี่ยนระหว่างลาก ไม่ใช่แค่ตอนปล่อย ยอมรับเพราะ scope กระทบแค่ ~6 mesh (5 เล็บ + ผิว)
และ 6 บอร์น (palm + finger root 5 อัน) ถ้าวัดแล้วหน่วงจริงค่อย debounce ทีหลัง (measure-first
policy เดียวกับ A-08/A-21/S3)

### D-34 · แผงใหม่แยกต่างหาก ไม่รวมเข้าแผงที่มีอยู่

`HandPanel.tsx` เป็น panel ใหม่คู่กับ `LayerPanel`/`DecorationPanel`/`VersionHistoryPanel` ที่
มีอยู่แล้วใน `apps/web/src/features/design/` เปิดจากปุ่ม toolbar เดียวกับที่เปิด panel อื่นๆ
เหตุผล: สัดส่วนมือ/สีผิวเป็นการตั้งค่าระดับ "ทั้งมือ" คนละ scope กับเลเยอร์/ของตกแต่งที่เป็นระดับ
"ต่อเล็บ" การแยกแผงทำให้ mental model ตรงไปตรงมา ไม่ต้องเดาว่าปุ่มไหนอยู่ในแผงไหน

## 3 · ไฟล์ใหม่ (`apps/web/src/3d/models/`)

ยกจาก `Source/NailDesine-TEST/src/three/handBones.ts` และ `handProportions.ts` ตรงตัว ปรับ
ให้เข้ากับ type ปัจจุบัน (`NailKey`/`NailId` ของ `packages/contracts` แทนของเดิม)

```ts
// handBones.ts
const PALM_BONE = 'Palm'
const FINGER_CHAIN_ROOTS: Record<Finger, string> =
  { thumb: 'Thumb2', index: 'Index1', middle: 'Middle1', ring: 'Ring1', little: 'Pinky1' }
  // Thumb2 ไม่ใช่ Thumb1 เพราะ Thumb1 เป็นใบไม้ข้างเคียง ไม่ใช่รากของ chain จริง

export interface HandBones {
  palm: Bone
  fingerRoots: Record<Finger, Bone>
}

export function collectBones(root: Object3D): HandBones
// เดิน scene หา Bone ตามชื่อคงที่ — throw ถ้าหาไม่เจอตัวใดตัวหนึ่ง
// (แพทเทิร์นเดียวกับ buildPartsRegistry ที่ throw เมื่อ mesh เล็บ/ผิวหาย)
```

```ts
// handProportions.ts
export function applyProportions(bones: HandBones, settings: HandSettings['proportions']): void
// ตั้ง scale เฉพาะที่ finger-chain root เท่านั้น (ไม่ใช่ทุกข้อต่อ — scale สืบทอดลงลูกอัตโนมัติ
// ใน three.js ตั้งทุกข้อต่อจะทบเป็นกำลัง 4)
//   palm.scale.set(palmWidth, 1, palmWidth)
//   fingerRoot.scale.set(fingerWidth / palmWidth, fingerLength, fingerWidth / palmWidth)
//   (หารด้วย palmWidth ออก เพราะ finger root เป็นลูกของ Palm ใน hierarchy — ไม่หารจะทำให้
//   ขยาย palmWidth แล้วนิ้วอ้วนขึ้นไปด้วยโดยไม่ตั้งใจ)
// handScale ไม่ได้อยู่ในฟังก์ชันนี้ — ยังคงเป็น root-level scale ผ่าน <primitive scale={...}>
// ใน HandModel.tsx เหมือนเดิม (คนละกลไกกับสัดส่วนต่อชิ้นส่วน ไม่ต้องรวมเข้าโค้ดเดียวกัน)

export function refreshSkinnedBounds(meshes: readonly SkinnedMesh[]): void
// สำหรับแต่ละ mesh: bone.updateWorldMatrix(true, false) ทุกบอร์นใน skeleton →
// skinned.updateMatrixWorld(true) → computeBoundingSphere() + computeBoundingBox()
// ไม่ทำขั้นตอนนี้ = raycast วาดสี (picking.ts) และ frustum culling พังเงียบๆ หลังสเกลบอร์น
// (bounding cache ของ three.js ไม่รู้ตัวว่า geometry ที่แท้จริงขยับ)
```

**สมมติฐานที่ต้องยืนยันตอน implement**: rest-pose scale ของ `Palm` และทุก finger root ใน
`hand.glb` ปัจจุบันต้องเป็น 1.0 พอดี (`applyProportions` เขียนทับ scale แบบ absolute ไม่ใช่
คูณสะสม) — ถ้าไม่ใช่ต้องปรับสูตรเป็น `restScale × factor` ตรวจด้วย unit test ที่โหลด `hand.glb`
จริงแล้วอ่านค่า `scale` ตั้งต้นของบอร์นทั้ง 6 ตัว

## 4 · แก้ไฟล์เดิม

### `PartsRegistry.ts`

เพิ่มฟิลด์ `bones: HandBones` ใน `HandParts` เรียก `collectBones(root)` ใน
`buildPartsRegistry` (จุดเดียวกับที่เดินหา `nails`/`skin` อยู่แล้ว — คนละรอบ traverse ไม่ได้
เพราะ `Bone` ไม่ใช่ `Mesh` ต้องเช็ค `instanceof Bone` แยกจาก `mesh.isMesh`)

### `documentEdits.ts`

เพิ่ม helper ระดับเอกสาร (ของเดิมมีแต่ `replaceNail` ซึ่ง scope แคบกว่าที่ต้องการ — สัดส่วน
มือ/สีผิวอยู่ที่ `document.hand` ไม่ใช่ `document.nails[key]`):

```ts
export function replaceHand(
  document: DesignDocument,
  update: (hand: HandSettings) => HandSettings,
): CommandResult {
  const current = document.hand
  const next = update(current)
  if (next === current) return { document, affects: NO_AFFECTS }
  return { document: { ...document, hand: next }, affects: NO_AFFECTS }
}
```

`affects: NO_AFFECTS` ถูกต้อง — สัดส่วน/สีผิวไม่ทำให้เท็กซ์เจอร์เล็บนิ้วไหน dirty
(`useNailTextures` ไม่ต้องวาดใหม่) `document` identity ที่เปลี่ยนก็พอสำหรับให้
`DecorationInstances` rebuild เอง และให้ effect ใหม่ (§5) ตรวจจับความเปลี่ยนแปลง

### `designStore.ts`

เพิ่ม action `setSkinTone(hex: string)` และ `setProportions(partial: Partial<Proportions>,
mergeKey?: string)` — รูปแบบ dispatch เดียวกับ action อื่นทุกตัว (สร้าง Command → ส่งเข้า
`HistoryStack.execute`)

### จุดเรียก apply (คู่กับ `useNailTextures.ts` ที่มีอยู่แล้ว)

Effect ใหม่ (component เดียวกับที่ mount `HandModel`+`PartsRegistry`, หรือ hook แยก
`useHandProportions(parts, document.hand)`) เทียบ `document.hand` กับ ref ค่าที่ apply ไปแล้ว
ล่าสุด — **skip ถ้า reference เท่ากัน** (ป้องกัน `refreshSkinnedBounds` รันซ้ำโดยไม่จำเป็นตอน
re-render ที่ไม่เกี่ยวกับมือ) ลำดับตรงตาม `Design.tsx` เดิม:

1. `applyProportions(parts.bones, document.hand.proportions)`
2. ตั้งสีผิว: `(parts.skin.material as MeshStandardMaterial).color.set(document.hand.skinTone)`
   (material เป็น clone จาก GLTF ต้นฉบับอยู่แล้วตามกฎจาก Slice 2 lesson "อย่า clone จากตัวที่
   เพิ่ง clone" — ตั้งสีบน clone นี้ตรงๆ ไม่กระทบ mesh อื่น)
3. `refreshSkinnedBounds([...parts.nails.values(), parts.skin])`
4. อัปเดต ref ค่าที่ apply แล้ว **หลัง** ขั้นตอนบนสำเร็จทั้งหมด (ถ้า throw กลางทางต้องไม่ mark
   ว่า applied แล้ว — บทเรียนเดียวกับ `HistoryStack.undo/redo` cursor ใน Slice 3)

**ไม่ทำระหว่างกำลังวาดเส้นอยู่** (เช็ค flag เดียวกับที่ `beginPaint()`/painting state ใช้อยู่
แล้วใน Slice 3) เพื่อไม่ให้ `refreshSkinnedBounds` แทรกกลางเส้นที่กำลังลาก

## 5 · Command (`apps/web/src/3d/history/commands/handCommands.ts`)

```ts
class SetSkinToneCommand implements Command {
  constructor(before: string, after: string)
  do(document) { return replaceHand(document, (hand) =>
    hand.skinTone === this.after ? hand : { ...hand, skinTone: this.after }) }
  undo(document) { return replaceHand(document, (hand) =>
    hand.skinTone === this.before ? hand : { ...hand, skinTone: this.before }) }
  // ไม่มี merge() — color picker คอมมิตครั้งเดียวตอนเลือกสี ไม่ได้ลากต่อเนื่องแบบ slider
}

class SetProportionsCommand implements Command {
  constructor(
    before: HandSettings['proportions'],
    after: HandSettings['proportions'],
    mergeKey?: string,
  )
  do(document) { return replaceHand(document, (hand) =>
    hand.proportions === this.after ? hand : { ...hand, proportions: this.after }) }
  undo(document) { return replaceHand(document, (hand) =>
    hand.proportions === this.before ? hand : { ...hand, proportions: this.before }) }
  merge(next: Command): Command | null {
    if (!(next instanceof SetProportionsCommand) || this.mergeKey === undefined
      || next.mergeKey !== this.mergeKey) return null
    return new SetProportionsCommand(this.before, next.after, this.mergeKey)
  }
  // เก็บ proportions ทั้งก้อน (4 ค่า) ไม่ใช่ทีละ field เดียว — ผู้ใช้อาจลาก slider คนละตัวใน
  // gesture เดียวกันไม่บ่อย แต่การเก็บทั้งก้อนทำให้ merge เป็น O(1) เทียบ mergeKey ตรงๆ ไม่ต้อง
  // เดาว่า field ไหนเปลี่ยน (mirror แนวคิดเดียวกับที่ SetLayerOpacityCommand เก็บค่าเดียวเพราะ
  // scope แคบกว่า — ที่นี่ scope เป็น "สัดส่วนมือทั้งชุด" ไม่ใช่ field เดียว จึงเก็บทั้งก้อน)
}
```

ทั้งสอง command route ผ่าน `replaceHand` (§4) ซึ่งคง identity-preserving ตามกฎเดียวกับ
`replaceNail`/`replaceLayer`

## 6 · UI (`apps/web/src/features/design/HandPanel.tsx`)

- 4 slider (`handScale` 0.8-1.2, `palmWidth`/`fingerLength`/`fingerWidth` 0.7-1.3 — ตรงกับช่วง
  ที่ `handSettingsSchema` กำหนดไว้แล้ว ป้องกันผู้ใช้ตั้งค่านอกช่วงจน command ถูก schema reject
  เงียบๆ ที่ layer เอกสาร) แต่ละตัว `onChange` เรียก `setProportions(partial, mergeKey)` ทันที
  (live update ตาม D-33) `mergeKey` คงที่ตลอด gesture เดียว (สร้างใหม่ตอน `onPointerDown`,
  ปล่อยตอน `onPointerUp`/`onChangeCommitted` — รูปแบบเดียวกับที่ opacity slider ใน Slice 3 ใช้)
- 1 color picker (native `<input type="color">` — ไม่ต้องเพิ่ม dependency) `onChange` (หรือ
  `onBlur`/native color picker's commit event) เรียก `setSkinTone(hex)` ครั้งเดียวตอนปิด picker
- ปุ่มเปิดแผงอยู่ toolbar เดียวกับปุ่มเปิด `DecorationPanel`/`LayerPanel` (D-34)

**ไม่มี component-level test** — ข้อจำกัด DOM-testing เดิมของ repo (ไม่มี jsdom/RTL) เหมือนที่
ระบุไว้แล้วใน spec ของตกแต่ง §1 ทดแทนด้วยตรวจมือบนเบราว์เซอร์จริงตอนปิดงาน

## 7 · การทดสอบ

- `handBones.test.ts` — โหลด `hand.glb` จริง (หรือ mock scene graph ที่มีโครง Bone ตรงชื่อ) →
  `collectBones` คืนค่าครบ 6 บอร์น, throw ข้อความชัดเจนถ้าลบชื่อบอร์นใดออกจาก fixture
- `handProportions.test.ts`:
  - `applyProportions`: fixture `palmWidth=1.3, fingerWidth=1` → คาด finger root
    `scale.x ≈ fingerWidth/palmWidth ≈ 0.769`
  - `refreshSkinnedBounds`: สร้าง `SkinnedMesh` mock, ตั้ง bone scale ก่อนเรียก, ยืนยันว่า
    `boundingSphere` หลังเรียกต่างจากก่อนเรียก (พิสูจน์ cache ถูก invalidate จริง ไม่ใช่แค่ฟังก์ชัน
    รันโดยไม่ error)
- Command round-trip (`commands.test.ts`) — `do()`→`undo()` ได้เอกสารเท่าเดิมทุก field ทั้ง
  `SetSkinToneCommand`/`SetProportionsCommand`, `merge()` coalesce 1 gesture = 1 รายการ history
  (ตาม pattern `SetLayerOpacityCommand`/`SetShapeCommand` ที่มีอยู่แล้ว)
- **Integration บนเบราว์เซอร์จริง (จำเป็น ไม่ใช่ทางเลือก)**: วางของตกแต่งไว้บนเล็บ → ลาก
  `palmWidth`/`fingerLength` → ยืนยันของตกแต่งยังติดผิวเล็บ ไม่ลอยไม่จม (พิสูจน์ D-10 ตามที่ DoD
  เดิมของ Slice 4 เขียนไว้ตรงๆ ว่า "เปลี่ยนสัดส่วนมือ/ความยาวเล็บ → ของตกแต่งยังติดผิวเหมือนเดิม")
  — เทสอัตโนมัติอย่างเดียวพิสูจน์เรื่องนี้ไม่ได้เพราะต้องเห็นเรนเดอร์จริงหลาย frame ต่อเนื่อง
  (บทเรียนซ้ำจาก Slice 2/3: "การตรวจด้วยเทสอย่างเดียวยืนยันได้แค่ว่าโค้ดรัน ไม่ได้ยืนยันว่าคนเห็น
  ผลถูกต้อง")

## 8 · ผลกระทบที่ต้องยอมรับ

- `refreshSkinnedBounds` รันทุกเฟรมที่ค่าเปลี่ยนระหว่างลาก slider (D-33) — ยอมรับจนกว่าจะวัดว่า
  หน่วงจริง (scope เล็ก: 6 mesh, 6 บอร์น)
- เล็บที่มี UV distortion สูง (โป้ง — known limitation จาก D-27) ที่มีของตกแต่งติดอยู่ อาจ
  reproject ตำแหน่งคลาดเคลื่อนกว่าเล็บอื่นหลังสเกลบอร์น — เป็นผลต่อเนื่องจาก limitation เดิม
  ไม่ใช่บั๊กใหม่ของฟีเจอร์นี้ (ระบุซ้ำจาก spec ของตกแต่ง §9 เพราะเกี่ยวข้องโดยตรงกับรอบนี้)
- ค่าตั้งต้น (`handScale`/`palmWidth`/... = 1) ทำให้ mesh ปัจจุบันไม่เปลี่ยนรูปจนกว่าผู้ใช้แตะ
  slider — ผู้ใช้ที่ไม่เคยเปิด `HandPanel` เลยจะไม่เห็นผลกระทบใดๆ ตามที่ตั้งใจ (backward-compatible
  กับเอกสารเก่าที่ไม่มีฟิลด์นี้ตอน save เพราะ schema seed ค่าตั้งต้นให้อยู่แล้ว)

## 9 · สิ่งที่ไม่อยู่ในรอบนี้

- Thumbnail capture, Exporters (Slice 4 ข้อ 6-7 ที่เหลือ)
- Debounce/throttle `refreshSkinnedBounds` ระหว่างลาก (ทำต่อเมื่อวัดแล้วว่าหน่วงจริง)
- ปรับ UI ให้มี preset สัดส่วนมือสำเร็จรูป (เช่น "มือเล็ก"/"มือใหญ่") — ไม่มีในแผนเดิม ไม่เพิ่มเอง
- แก้ UV distortion ของเล็บโป้ง (ค้างจาก D-25/D-27 เป็นงานคนละ scope)

## 10 · เกณฑ์ว่าเสร็จ

- ลาก slider `palmWidth`/`fingerLength`/`fingerWidth`/`handScale` → มือ 3D เปลี่ยนรูปทันที
- เลือกสีผิวใหม่ → ผิวมือเปลี่ยนสี เล็บไม่เปลี่ยนสีตาม (คนละ material)
- วางของตกแต่งไว้บนเล็บ → ปรับสัดส่วนมือ → ของตกแต่งยังติดผิวเล็บ ไม่ลอยไม่จม (พิสูจน์บนเบราว์เซอร์
  จริง — DoD เดิมของ Slice 4)
- วาดสี/คลิกเลือกของตกแต่งยังทำงานถูกต้องหลังปรับสัดส่วนมือ (พิสูจน์ `refreshSkinnedBounds` ทำงาน
  จริง ไม่ใช่แค่ไม่ error)
- Ctrl+Z / Ctrl+Y ย้อน/ทำซ้ำการเปลี่ยนสัดส่วน/สีผิวได้ถูกต้อง ลาก slider 1 ครั้งต่อเนื่อง = history
  1 รายการ
- `npm run typecheck`, `npm run test` ผ่านสะอาด
