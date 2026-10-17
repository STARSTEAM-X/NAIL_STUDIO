# Task: MCP preview ทรงจริง + dryRun + lint_design (roadmap ลำดับ 1)

> spec ก่อนหน้า (ยกคุณภาพ luxury preset) ย้ายไปอยู่ที่ `docs/tasks/luxury-preset-quality.md`
> ที่มา: `docs/mcp-detail-roadmap.md` ข้อ 1.1, 1.7, 1.9

## บริบท

ตอนนี้ AI ปรับลายให้เหมือนรูปอ้างอิงไม่ได้ เพราะมองไม่เห็นผลที่ตัวเองวาดจริง:

- `render_preview` (`apps/mcp/src/render.ts`) วาด texture ลงช่องสี่เหลี่ยมแล้วตัดขอบด้วย convex hull
  ของ UV จึงไม่แสดงทรงเล็บ (almond/stiletto/ความยาว) และ**ไม่แสดงการยืดของลายที่ปลายเล็บ**
  ซึ่งวัดได้สูงถึง 4 เท่า (roadmap 0.1)
- สีแสดงเป็น hex ตรงตัว แต่ฉากจริงผ่านแสงและ ACES tone mapping (คู่มือ: `#dfaaa2` บนโมเดลดูเป็น `#f1d4cf`)
- ของตกแต่งเป็นวงกลมพร้อมป้าย ขนาดไม่ตรงกับของจริง
- tool ที่บันทึก (ยกเว้น `preview_recipe`) บันทึกทันทีโดยดูผลก่อนไม่ได้ และไม่คืนภาพหลังบันทึก
- กฎใน `DESIGN_RULES` เป็นแค่ข้อความ AI ทำผิดซ้ำได้

ฝั่งเว็บมีของที่ต้องใช้อยู่แล้ว: `nailFlatten.ts` คลี่เล็บที่ morph แล้วเป็นภาพแบนให้แผงวาด 2D
และ `NailCanvas2D.tsx` วาด texture ลงทีละสามเหลี่ยมด้วย affine transform

## เป้าหมาย

1. preview แสดงทรงเล็บจริงและการยืดของลายแบบเดียวกับโมเดล 3D มีแสงตามความโค้ง และสีผ่าน tone mapping แบบเดียวกับฉาก
2. ดูเล็บทีละนิ้วแบบขยายได้ (texture 1024)
3. ทุก tool ที่บันทึกรองรับ `dryRun` และคืนภาพของนิ้วที่เปลี่ยนหลังบันทึก
4. `lint_design` และคำเตือนอัตโนมัติท้ายทุก preview

## นอกขอบเขต

- ระยะ 0 (UV morph, `uvMapping`, schema v4) — ห้ามแตะ `packages/contracts` และไม่ bump schema
- 1.2 compare, 1.8 versions, 1.10 describe_pattern, 1.11 variants
- WebGL หรือ headless browser (ระยะ 3.1)
- สัดส่วนมือ (`hand.proportions`): preview ใช้รูปร่างเล็บตามไฟล์ GLB ไม่ย่อ/ขยายตามสไลเดอร์มือ
- เปลี่ยนพฤติกรรมของแผงวาด 2D ในเว็บ: refactor ได้ แต่ผลต้องเหมือนเดิมทุกประการ

## ข้อจำกัดของ runtime (สำคัญ)

- MCP รันด้วย `node src/*.ts` ตรง ๆ (type stripping ของ Node 24) **ไม่มี bundler และไม่มี path alias**
  - โค้ดจาก `apps/web` ที่ MCP import ต้องใช้ import แบบ relative เท่านั้น (ห้าม `@/`) และ**ห้ามพึ่ง `three`**
    (MCP ไม่มี three เป็น dependency และห้ามเพิ่ม)
  - ใช้ได้แค่ syntax ที่ลบ type ทิ้งได้: ห้าม `enum`, `namespace`, parameter property; type ต้อง `import type`
- ดูตัวอย่างที่ใช้อยู่แล้ว: `render.ts` import `../../web/src/3d/painting/rasterizer.ts`

---

## การออกแบบ

### A. แยกโค้ดคำนวณที่ไม่พึ่ง three ออกมาใช้ร่วมกัน (apps/web)

**A1. `apps/web/src/3d/painting/flatTriangles.ts` (ใหม่, pure)**
ย้ายของต่อไปนี้จาก `nailFlatten.ts` มาไว้ที่นี่ แล้วให้ `nailFlatten.ts` import และ re-export
(caller เดิม เช่น `NailCanvas2D.tsx` ไม่ต้องแก้)
- type `FlatTriangle`, `FlatNail`, ค่าคงที่ `PADDING`
- `panelToTexture`, `textureToPanelTransform` (ย้ายมาตรง ๆ ไม่เปลี่ยนพฤติกรรม)
- `fitToPanel(flatX, flatY, uv, indices, panelSize, texSize)` = ส่วนหลังของ `flattenNail`
  ตั้งแต่หา bounds/scale จนสร้าง `triangles` (รับ array ตัวเลขธรรมดา ไม่รับ BufferAttribute)
  และคืน `scale` (พิกเซลแผงต่อหนึ่งหน่วยของพิกัดที่ส่งเข้ามา) เพิ่มใน `FlatNail`
- ใหม่ `textureToPanel(flat, u, v)` ทิศกลับของ `panelToTexture`: รับ UV 0–1 (v ตามเอกสาร, v = 0 ปลาย)
  คืนพิกัดแผงหรือ null ถ้าอยู่นอกเล็บ
- ใหม่ `triangleStretch(triangle)`: อัตราส่วน singular value ใหญ่ ÷ เล็ก ของ affine 2×2 จาก
  `textureToPanelTransform` พร้อมบอกทิศที่ยืด (`'along' | 'across'` เทียบแกน v ของ texture)

`flattenNail` ยังคำนวณ world-space position และแกนอ้างอิงแบบเดิม แล้วเรียก `fitToPanel`
→ เทสต์ `nailFlatten.test.ts` เดิมต้องผ่านโดยไม่แก้

**A2. `apps/web/src/3d/models/nailMorphWeights.ts` (ใหม่, pure)**
`nailMorphWeights(targetNames: readonly string[], shape, length): number[]`
ใช้กฎเดียวกับ `applyNailMorphs` (round/medium ไม่มี target, อื่น ๆ น้ำหนัก 1, บวกกันได้)
แล้วแก้ `applyNailMorphs` ให้เรียกฟังก์ชันนี้ (เรียงชื่อตาม `morphTargetDictionary`)
→ `nailMorphs.test.ts` เดิมต้องผ่านโดยไม่แก้

**A3. ข้อมูลของตกแต่งฝั่ง MCP (`packages/patterns/src/catalog.ts`)**
เพิ่มใน `DecorationInfo`: `worldRadius` (รัศมีในหน่วยโลกเมื่อ `scale = 1`
= `geometry().boundingSphere.radius × defaultScale`) และ `defaultColor`
เพิ่มเทสต์ฝั่งเว็บ (`decorationCatalog.test.ts` หรือไฟล์ใหม่) ที่ตรวจว่า id ตรงกันครบหนึ่งต่อหนึ่ง,
`worldRadius` ต่างจากค่าที่คำนวณจาก geometry จริงไม่เกิน 5% และ `defaultColor` ตรงกัน
กันข้อมูลสองที่ไม่ตรงกันในอนาคต

**A4. ชนิดลายหนาแน่น (`packages/patterns`)**
เพิ่ม `dense: boolean` ใน `PATTERN_TYPES` เกณฑ์คือลายที่ใช้ค่าเริ่มต้นแล้วได้ ≥ 150 stroke
เทสต์ต้องวัดจริงด้วย `renderPattern` ค่าเริ่มต้นทุกชนิด แล้วตรวจว่าแฟล็กตรงกับจำนวนที่วัดได้

### B. อ่านโมเดลและคลี่เล็บใน MCP

**B1. `apps/mcp/src/glb.ts` (ใหม่)** — ย้ายตัวอ่าน GLB จาก `render.ts` มาขยาย
- อ่าน mesh `Nail_<finger>` ทั้ง 5 นิ้ว: POSITION, NORMAL, TEXCOORD_0, indices (5123/5125)
  และ morph target ทุกตัว (POSITION + NORMAL) ชื่อจาก `mesh.extras.targetNames`
- รองรับ accessor แบบ **sparse** (morph target ในไฟล์นี้เป็น sparse ทั้งหมด) และ `byteStride`
- อ่านสเกลของ node `Armature` (≈ 0.031748) สำหรับแปลงขนาดของตกแต่ง
- ไฟล์ไม่ตรงที่คาด (ไม่มีนิ้ว, ใช้ extension บีบอัดอย่าง Draco) → throw ข้อความที่บอกสาเหตุ
- อ่านครั้งเดียวแล้วเก็บไว้ในหน่วยความจำ

**B2. `apps/mcp/src/nailShape.ts` (ใหม่)**
`flatNailFor(finger, shape, length, panelSize, texSize): FlatNail & { normals, armatureScale }`
1. ตำแหน่งและ normal ที่ morph แล้ว = ฐาน + Σ น้ำหนัก × delta (น้ำหนักจาก A2)
2. แกนของภาพ (ทำใน mesh-local ไม่มี skin ไม่มีฉาก):
   - `n` = ค่าเฉลี่ยของ normal ที่ morph แล้ว ทำให้เป็นหน่วย (ชี้ออกนอกเล็บ)
   - `up` = ค่าเฉลี่ยถ่วงพื้นที่ของ −∂P/∂v (ทิศไปทางปลายเล็บ) ฉายลงระนาบที่ตั้งฉาก `n` แล้วทำเป็นหน่วย
   - `right` = `up × n` → เป็นภาพที่มองจากนอกเล็บ ปลายเล็บอยู่บน
   - ต่างจากแผงในเว็บที่ใช้แกนตั้งของโลก: ที่นี่ทุกนิ้วจะตั้งตรงเสมอ ตั้งใจให้ต่าง และให้เขียนคอมเมนต์ไว้
3. เรียก `fitToPanel` (A1) และเก็บ normal ต่อจุดยอดในกรอบ (right, up, n) ไว้ใช้ลงแสง
4. แคชตาม (finger, shape, length, panelSize, texSize) — มีไม่เกิน 5 × 5 × 4 × 2 = 200 รายการ

### C. Preview ใหม่ (`apps/mcp/src/render.ts`)

**C1. API**
```ts
export interface PreviewOptions {
  scope?: 'right' | 'left' | 'both'   // ค่าเดิม
  only?: NailKey[]                     // ค่าเดิม
  zoom?: 'hand' | 'nail'               // ใหม่ ค่าเริ่มต้น 'hand'
  lighting?: 'scene' | 'flat'          // ใหม่ ค่าเริ่มต้น 'scene'
}
export function renderPreviewPng(document: DesignDocument, options?: PreviewOptions): Buffer
```
- `hand`: ขนาดช่องเดิม (200 × 226) texture 512 เรียงแถวละหนึ่งมือแบบเดิม
- `nail`: ช่อง 512 × 560 texture 1024 (ไม่ต้องย่อ stroke) จำกัด 1–3 นิ้ว ถ้าเกินให้ throw
  `zoom: 'nail' แสดงได้ครั้งละไม่เกิน 3 นิ้ว (ได้ N) — ระบุ nails ให้แคบลง`

**C2. ขั้นตอนต่อเล็บหนึ่งนิ้ว**
1. วาด texture ด้วย `renderLayer` + `compositeLayers` เดิม
2. วาด texture ลงช่องทีละสามเหลี่ยมด้วย `textureToPanelTransform` + clip สามเหลี่ยมที่ขยายขอบ
   `SEAM_BLEED = 0.5` พิกเซล (แบบเดียวกับ `NailCanvas2D.tsx`)
   นอกขอบเล็บเป็นสีพื้นหลัง `#f4efec` ทุกพิกเซล (ไม่มีขอบ hull แบบเดิม)
3. **มือซ้าย**: editor แสดงแค่มือขวา จึงใช้รูปทรงของนิ้วเดียวกันจากมือขวาแล้วกลับภาพแนวนอน
   (กลับเฉพาะรูปทรง texture ของมือซ้ายใช้ข้อมูลของมือซ้ายเอง) ภาพจึงเป็นกระจกของมือขวา
4. `lighting: 'scene'` ทำแบบต่อพิกเซลภายในเล็บ:
   - หา normal ที่จุดนั้นด้วย barycentric ของสามเหลี่ยมในแผง (rasterize ทีละสามเหลี่ยมใน bounding box)
   - `linear = srgbToLinear(rgb)`
   - `lit = linear × (AMBIENT + KEY × max(0, N·L)) + specular(finish, N)` โดยแสงอยู่ในกรอบภาพ
     `L = normalize(0.3, 0.5, 0.8)` และมุมมอง `V = (0, 0, 1)`
   - ตั้ง `AMBIENT + KEY × (N₀·L) = SCENE_LIGHT_GAIN` เมื่อ `N₀ = (0, 0, 1)` และใช้ `AMBIENT = 0.35 × SCENE_LIGHT_GAIN`
   - `out = linearToSrgb(acesFilmic(lit))` ตามสูตร `ACESFilmicToneMapping` ของ three.js
     (คูณ exposure ÷ 0.6, เมทริกซ์ input/output, `RRTAndODTFit`) exposure = 1 ตามค่าเริ่มต้นของ R3F
   - `SCENE_LIGHT_GAIN = 1.6` เป็นค่าตั้งต้นจากคู่สีในคู่มือ Claude จะปรับเทียบกับฉากจริงตอนรีวิว
     ให้เป็นค่าคงที่ชื่อเดียวที่แก้ได้ที่เดียว
   - `lighting: 'flat'` = ไม่ลงแสงและไม่ทำ tone mapping (ให้ AI ใช้ดูสี hex ตรง ๆ)
5. specular แยกตาม finish (ค่าประมาณ เขียนคอมเมนต์ว่าไม่ใช่ PBR):
   | finish | ผล |
   |---|---|
   | glossy | Blinn-Phong แคบ (shininess ≈ 80) ความแรงปานกลาง |
   | matte | ไม่มี specular, KEY ลดลง 10% |
   | chrome | specular กว้างและแรง + ลดความอิ่มของสีพื้นเข้าหาเทาตามมุม |
   | glitter | Blinn-Phong + จุดประกาย hash ตามพิกเซล (seed คงที่ ภาพเดิมทุกครั้ง) |
   | pearl | specular กว้าง + เหลือบสี (hue เลื่อนตาม N·V) อ่อน ๆ |
   | cat_eye | แถบสว่างเฉียง −30° ผ่านกลางเล็บ ขอบฟุ้ง (ตาม `anisotropyRotation` ของเว็บ) |
6. ของตกแต่ง: วาดหลังลงแสง ตำแหน่ง = `textureToPanel(flat, u, v)` ถ้าได้ null ไม่วาด
   (lint จะเตือนแทน) รัศมีพิกเซล = `worldRadius × scale ÷ armatureScale × flat.scale`
   สี = `decoration.color ?? defaultColor` หมุนตาม `rotation`
   | หมวด | sprite |
   |---|---|
   | gemstone | รูปหลายเหลี่ยม 8 เหลี่ยม + gradient เหลี่ยมเพชร + ประกายสีขาว 1 จุด |
   | pearl | วงกลม radial gradient + ไฮไลต์บนซ้าย |
   | metal | วงกลม/วงแหวน linear gradient โลหะ |
   | motif, ribbon | รูปมนสีเต็ม + ขอบเข้ม 1px + ไฮไลต์อ่อน |
7. ป้ายใต้ภาพ: `${key} · ${shape}/${length} · ${finish}`

**C3. ขนาดและเวลา**
- base64 ของ `zoom: 'nail'` 3 นิ้ว (preset ที่หนาแน่นที่สุด) ≤ 1.5 MB และของ `hand` 2 มือ ≤ 1 MB
  ถ้าเกินให้ลดความละเอียด texture ของ `hand` ลง ไม่ใช่ลดขนาดช่อง
- เวลา `hand` 2 มือของ preset ที่หนาแน่นที่สุดให้ log ไว้ในรายงาน เทสต์กำหนดเพดาน 3000 ms (กัน flaky)

### D. dryRun และคืนภาพหลังบันทึก (`apps/mcp/src/server.ts`)

**D1.** เปลี่ยน `updateDesign` ให้รับตัวเลือกและคืนผลแบบมีโครงสร้าง:
```ts
updateDesign(projectId, edit, { dryRun, preview }): Promise<CallToolResult>
```
1. อ่านเวอร์ชันล่าสุด → `edit` → `designDocumentSchema.parse`
2. หานิ้วที่เปลี่ยน: เทียบ `JSON.stringify` ของเล็บทีละนิ้ว ก่อน/หลัง
3. ไม่มีนิ้วไหนเปลี่ยน → **ไม่บันทึก** คืน `ไม่มีการเปลี่ยนแปลง — ไม่ได้บันทึกเวอร์ชันใหม่`
4. `dryRun` → ไม่เรียก `saveVersion` คืนข้อความ `ตัวอย่าง (ยังไม่บันทึก) — นิ้วที่เปลี่ยน: …` + ภาพ + lint
5. ไม่ใช่ dryRun → บันทึกพร้อม `expectedVersion` แบบเดิม คืนข้อความเดิม + ภาพ (ถ้า `preview`) + lint
6. ภาพ = `zoom: 'hand'`, `only` = นิ้วที่เปลี่ยน, `scope` = มือที่มีนิ้วเปลี่ยน
   ถ้ามีนิ้วเปลี่ยนแค่ 1 นิ้วให้ใช้ `zoom: 'nail'`

**D2.** เพิ่ม `dryRun: z.boolean().default(false)` และ `preview: z.boolean().default(true)` ให้ทุก tool ที่บันทึก:
`apply_recipe`, `apply_preset`, `set_nail`, `set_nail_properties`, `copy_nail`, `mirror_hand`,
`add_strokes`, `add_decoration`, `clear_nail` (`create_project` ไม่ต้องมี เพราะสร้างโปรเจกต์จริงทุกครั้ง)

**D3.** `render_preview` และ `preview_recipe` เพิ่ม `zoom` และ `lighting` (C1)
แปลข้อความ error ของ zoom เกิน 3 นิ้วเป็น `errorResult`

**D4.** อัปเดตข้อความ `instructions` ของ server และ resource `nailstudio://guide`:
ลำดับใหม่ "ร่าง → `dryRun: true` → ดูภาพ + คำเตือน → ปรับ → บันทึก" และบอกว่ามี `zoom: 'nail'`

### E. lint (`apps/mcp/src/lint.ts` ใหม่ + tool `lint_design`)

```ts
interface LintFinding { code: LintCode; nail: NailKey; message: string }
function lintDesign(document: DesignDocument, options: { nails?: NailKey[]; recipe?: Recipe }): LintFinding[]
```
ข้ามเลเยอร์ที่ `visible: false` และ stroke `erase` เสมอ

| code | เงื่อนไข | ข้อความ (ตัวอย่าง) |
|---|---|---|
| `OUTSIDE_NAIL` | ลายชิ้นเล็กที่จุดศูนย์กลางอยู่นอกเล็บ (`textureToPanel` คืน null) หรือของตกแต่งที่จุดศูนย์กลางอยู่นอกเล็บหรือห่างขอบน้อยกว่ารัศมีของตัวเอง | `right.ring: ลาย 3 ชิ้นอยู่นอกเล็บ (มองไม่เห็น)` |
| `STRETCHED` | ลายชิ้นเล็กหรือของตกแต่งที่ `triangleStretch` ≥ 1.5 ตรงจุดศูนย์กลาง | `right.index: ลายชิ้นที่ v≈0.12 จะถูกยืดตามแนวยาว ×2.6 บนทรง stiletto/extra` |
| `LOW_CONTRAST` | กลุ่มสี (stroke สีเดียวกัน) ที่ทำให้ภาพเปลี่ยนเฉลี่ย ΔE76 < 10 บนพิกเซลที่มันปกคลุม | `right.middle: สี #f7e9e4 แทบมองไม่เห็นบนพื้น (ΔE 4.2)` |
| `NEAR_LIMIT` | ≥ 5 เลเยอร์ (จาก 6), เลเยอร์ใดมี ≥ 450 stroke (จาก 500) หรือ JSON ของเอกสาร ≥ 3 MB (API รับ 4 MB) | `right.thumb: ใช้ 5/6 เลเยอร์ — ใกล้เพดาน` |
| `DENSE_PATTERNS` | มี `recipe`: นิ้วที่ใช้ลาย `dense` มากกว่า 2 ลาย | `index: ลายหนาแน่น 3 ลาย (แนะนำไม่เกิน 2)` |

นิยาม:
- **ลายชิ้นเล็ก** = stroke `brush` หรือ `fill` ที่กรอบ (จุดทั้งหมด ± รัศมี `size/2/1024`) มีเส้นทแยง ≤ 0.2 ในหน่วย UV
- **LOW_CONTRAST**: วาด composite ที่ขนาด 96 สองแบบ คือ "ครบ" กับ "ไม่มีกลุ่มสีนี้" แปลงทั้งสองด้วย
  scene color (C2 ข้อ 4 ที่ N₀) แล้วคิด ΔE76 ใน Lab บนพิกเซลที่กลุ่มสีนี้มี alpha > 0.5
  ตรวจไม่เกิน 12 กลุ่มสีต่อนิ้ว เรียงตามจำนวนพิกเซลที่ปกคลุม ถ้าเกินให้แจ้ง `ตรวจ 12 จาก N สี`
- ค่าคงที่ทุกตัว (0.2, 1.5, 10, 96, 12, 450, 3 MB) ประกาศเป็นค่าคงที่มีชื่อด้านบนไฟล์

การแสดงผล:
- tool ใหม่ `lint_design(projectId, nails?)` แบบ `readOnlyHint: true` คืนรายการหรือ `ไม่พบปัญหา`
- `preview_recipe`, `render_preview` และทุกผลลัพธ์จาก D1 ต่อท้ายด้วย
  `คำเตือน:` + สูงสุด 15 บรรทัด + `…และอีก N รายการ` (ไม่มีคำเตือน = ไม่ต่อท้ายอะไร)
- `preview_recipe` และ `apply_recipe`/`set_nail` ส่ง recipe เข้าไปเพื่อตรวจ `DENSE_PATTERNS`

---

## ไฟล์ที่กระทบ

| ไฟล์ | การเปลี่ยน |
|---|---|
| `apps/web/src/3d/painting/flatTriangles.ts` | ใหม่ (A1) |
| `apps/web/src/3d/painting/nailFlatten.ts` | ใช้ A1 + re-export |
| `apps/web/src/3d/models/nailMorphWeights.ts` | ใหม่ (A2) |
| `apps/web/src/3d/models/nailMorphs.ts` | ใช้ A2 |
| `apps/web/src/3d/decorations/*.test.ts` | เทสต์ความตรงกันของ catalog (A3) |
| `packages/patterns/src/catalog.ts` | `worldRadius`, `defaultColor`, `dense` (A3, A4) |
| `packages/patterns/src/*.test.ts` | เทสต์ `dense` |
| `apps/mcp/src/glb.ts`, `nailShape.ts`, `lint.ts` | ใหม่ (B, E) |
| `apps/mcp/src/render.ts` | preview ใหม่ (C) |
| `apps/mcp/src/server.ts` | D + tool `lint_design` |
| `apps/mcp/src/*.test.ts` | เทสต์ใหม่ทั้งหมดด้านล่าง |

ห้ามแตะ `packages/contracts`, `apps/api`, `apps/ai`, `hand.glb` และ `tools/build_model.py`

## ความซับซ้อน

- อ่าน GLB: O(V + T) ครั้งเดียว (V ≈ 1,089 จุด, T ≈ 2,048 สามเหลี่ยมต่อนิ้ว)
- คลี่เล็บ: O(V·K + T) ต่อชุดทรง (K = 7 target) แล้วแคช
- preview ต่อนิ้ว: O(S + P) โดย S = จำนวน dab ที่ rasterize และ P = พิกเซลในช่อง
  (การลงแสงแตะแต่ละพิกเซลในเล็บครั้งเดียว ผ่าน bounding box ของสามเหลี่ยม)
- `textureToPanel` / `panelToTexture`: O(T) ต่อจุด lint เรียกต่อลายชิ้นเล็กหนึ่งครั้ง
  → O(M·T) โดย M = จำนวนลายชิ้น (ถ้าวัดแล้วช้าเกิน 200 ms ต่อเอกสาร ค่อยทำตารางแบ่งช่อง ห้ามเดา)
- LOW_CONTRAST: O(C·(S + 96²)) ต่อนิ้ว C ≤ 12
- หานิ้วที่เปลี่ยน (D1): O(ขนาดเอกสาร)

## Edge cases

- `zoom: 'nail'` แต่ขยายชื่อนิ้วแล้วได้ > 3 นิ้ว (เช่น `index` = 2 นิ้ว × 2) → error ที่อ่านแล้วเข้าใจ
- สามเหลี่ยมเสื่อม (`textureToPanelTransform` คืน null) → ข้ามทั้งตอนวาดและตอนลงแสง
- ของตกแต่งหรือลายชิ้นที่อยู่นอกเล็บ → ไม่วาด แต่ lint ต้องเตือน
- เลเยอร์ซ่อน, blend `multiply`/`screen`, stroke `erase` → การวาดใช้ `compositeLayers` เดิม ส่วน lint ข้ามตามที่กำหนด
- เล็บเปล่า (ไม่มี stroke) → แสดงสีพื้นลงแสงถูกต้อง และไม่มีคำเตือน
- dryRun บนเวอร์ชันที่มีคนบันทึกแทรก → ไม่บันทึกอยู่แล้วจึงไม่ชน ส่วนบันทึกจริงยังได้ 409 แบบเดิม
- ข้อความของ `ApiError` / `ZodError` ยังต้องผ่าน `errorResult` เหมือนเดิม
- มือซ้าย: ภาพเป็นกระจกของมือขวา ป้ายบอกคีย์มือซ้ายถูกต้อง

## เทสต์ที่ต้องมี

**เว็บ (`apps/web`)**
1. `nailFlatten.test.ts` และ `nailMorphs.test.ts` เดิมผ่านโดยไม่แก้
2. `textureToPanel` ∘ `panelToTexture` ไปกลับได้จุดเดิม (คลาด < 1e-6) และนอกเล็บได้ null ทั้งสองทาง
3. `triangleStretch` กับ affine ที่รู้คำตอบ (ยืด v ×2 → 2, `'along'`; หมุนอย่างเดียว → 1)
4. `nailMorphWeights` ครบ 5 × 4 ชุด
5. catalog ของตกแต่งตรงกันระหว่างเว็บกับ patterns (A3)

**patterns**
6. แฟล็ก `dense` ตรงกับจำนวน stroke ที่วัดจริง (A4)

**MCP**
7. `glb.ts`: ได้ 5 นิ้ว, target 7 ตัวตามชื่อและลำดับ, sparse ขยายครบเท่าจำนวนจุดยอด, `armatureScale` ≈ 0.031748
8. `nailShape.ts`: ทุกนิ้ว × 20 ชุดทรงไม่ throw; ปลายเล็บอยู่บน (ค่าเฉลี่ย y ของจุดที่ v < 0.1
   น้อยกว่าของจุดที่ v > 0.9); นิ้วชี้ อัตราส่วนสูง/กว้างเรียง `extra > long > medium > short`
9. `toSceneColor('#dfaaa2')` ที่ N₀ = `#e9d3ce` ± 2 ต่อช่อง (ค่าที่คำนวณจากสูตร ACES ของ three.js
   ที่ gain 1.6) และสีดำต้องได้สีดำ
10. preview เล็บสีพื้นล้วน: พิกเซลนอกเล็บเป็น `#f4efec` ทุกพิกเซล; พิกเซลกลางเล็บอยู่ภายใน ±12 ต่อช่อง
    ของ `toSceneColor(baseColor)`; `lighting: 'flat'` ได้สีพื้นตรงตัว (±1)
11. ทรง stiletto/extra กับ round/medium ได้รูปเล็บต่างกัน (จำนวนพิกเซลในเล็บต่างกันมากกว่า 10%)
12. ซ้าย/ขวา: เอกสารที่ `mirrorLeft` แล้ว ภาพของ `left.index` เท่ากับภาพของ `right.index` กลับแนวนอน (คลาดได้ ≤ 2 ต่อช่อง)
13. ตำแหน่งของตกแต่งที่ (0.5, 0.5): พิกเซลกลางของ sprite อยู่ไม่เกิน 2 px จาก `textureToPanel(0.5, 0.5)`
14. ขนาด payload และเวลา (C3); `zoom: 'nail'` 4 นิ้ว → error
15. dryRun: ทุก tool ใน D2 เมื่อ `dryRun: true` แล้ว `FakeApi.saves` ไม่เพิ่ม และผลมีภาพ + `ยังไม่บันทึก`
16. บันทึกจริง: ผลมีภาพเฉพาะนิ้วที่เปลี่ยน; `preview: false` ไม่มีภาพ; แก้ที่ไม่เปลี่ยนอะไร → ไม่บันทึก
17. 409 ยังได้ข้อความเดิม
18. lint: ทุก code มีเทสต์ทั้งกรณีเจอและไม่เจออย่างน้อยกรณีละ 1 รวมถึงเลเยอร์ซ่อนกับ erase ต้องไม่ถูกนับ
19. `lint_design` ผ่าน MCP client จริง (`InMemoryTransport` แบบเทสต์เดิม)
20. ทดสอบว่า Node import โมดูลใน A1/A2 จากฝั่ง MCP ได้จริง (ไม่มี `three` และ `@/`)

คำสั่งที่ต้องผ่าน: lint, typecheck และ test ของ `apps/mcp`, `apps/web`, `packages/patterns`
(ดูคำสั่งจริงใน `package.json` ของแต่ละ workspace และ root)

## Acceptance criteria

- [ ] `render_preview` แสดงทรงจริงตาม shape/length รวมการยืดที่ปลายเล็บ ปลายเล็บอยู่บน
- [ ] `lighting: 'scene'` ลงแสงตามความโค้งและ tone mapping ACES ส่วน `'flat'` ได้ hex ตรงตัว
- [ ] `zoom: 'nail'` ใช้ texture 1024 จำกัด 3 นิ้ว
- [ ] ของตกแต่งเป็น sprite ตามหมวด ขนาดตามสเกลจริง
- [ ] ทุก tool ใน D2 รองรับ `dryRun` และ `preview` และไม่บันทึกเมื่อไม่มีอะไรเปลี่ยน
- [ ] `lint_design` ทำงาน และคำเตือนต่อท้ายทุก preview
- [ ] แผงวาด 2D ในเว็บทำงานเหมือนเดิม (เทสต์เดิมผ่านโดยไม่แก้)
- [ ] ไม่แตะ contracts/API/schema ไม่เพิ่ม dependency
- [ ] lint, typecheck และ test ผ่านทุก workspace ที่แก้

## สิ่งที่ Claude จะทำตอนรีวิว (ไม่ใช่งานของ Codex)

- ปรับเทียบ `SCENE_LIGHT_GAIN` โดยเปิด `tools/pattern-review.html` ด้วยเบราว์เซอร์ วัดสีกลางเล็บจริง
  สำหรับ 5 สีพื้น แล้วเลือก gain ที่ ΔE เฉลี่ยต่ำสุด
- วางภาพ preview เทียบกับแผงวาด 2D ในเว็บสำหรับ 3 ทรง เพื่อยืนยันว่ารูปทรงและการยืดตรงกัน

## ความเสี่ยงที่เหลือ

- แสงและ finish ใน preview เป็นค่าประมาณ ไม่ใช่ PBR ของฉากจริง (มุมไฮไลต์อาจต่างจากที่ผู้ใช้หมุนดู)
- preview ไม่สะท้อนสัดส่วนมือที่ผู้ใช้ปรับ
- ภาพมือซ้ายเป็นกระจกของมือขวา ซึ่งถูกต้องตราบที่เว็บยังใช้โมเดลมือขวาอย่างเดียว
- ถ้า Phase 0 (UV morph) เกิดขึ้น `nailShape.ts` ต้องเพิ่ม `morphedUv` ตามไปด้วย (roadmap 0.4)
