# Task: `add_path` — วาดลายอิสระจาก SVG path (roadmap 1.5)

> spec ก่อนหน้า (preview ทรงจริง + dryRun + lint) ย้ายไปอยู่ที่ `docs/tasks/mcp-preview-lint.md`
> ที่มา: `docs/mcp-detail-roadmap.md` ข้อ 1.5

## บริบท

ผู้ใช้อยากให้ AI ออกแบบลายใหม่ทั้งเล็บโดยไม่ต้องอิง pattern สำเร็จรูป เช่น "ลายมังกรไฟ"
ตอนนี้ทางเดียวคือ `add_strokes` ซึ่งไม่เหมาะกับงานนี้
- AI ต้องกะพิกัดจุดของแปรงกลมทีละจุด และกำหนดขนาดเป็นพิกเซล
- เทสีได้แค่ทั้งเลเยอร์ (`fill`) ระบายรูปปิดเอง (ตัวมังกร หัว เกล็ด) ไม่ได้
- ส่งได้ครั้งละ 500 เส้น ลายซับซ้อนต้องเรียกหลายรอบและควบคุมยาก

LLM เขียน **SVG path** ได้ดีกว่าการกะพิกัด dab มาก สเปกนี้จึงเพิ่มการแปลง SVG path เป็น stroke ชุดเดิม
ซึ่งเก็บเป็นเอกสารแบบเดิม แก้ต่อได้ แสดงผลบนเว็บได้ทันที และไม่ต้องแก้ schema ของเอกสาร

## เป้าหมาย

1. ชนิดลายใหม่ `path` ใน recipe ใช้ได้ทุกที่ที่ใช้ recipe (`preview_recipe`, `apply_recipe`, `set_nail`, preset)
2. tool ใหม่ `add_path` สำหรับต่อลายหลาย path ลงบนเล็บที่มีอยู่ รองรับ `dryRun` / `preview` และคำเตือน lint
3. รองรับคำสั่ง SVG path ครบ (`M L H V C S Q T A Z` ทั้งตัวใหญ่และตัวเล็ก)
4. ระบายรูปปิดได้ (`fill`) ตามกฎ `nonzero` / `evenodd` ลากเส้นขอบได้ (`stroke`) กำหนดความหนาเป็นหน่วยเดียวกับ viewBox

## นอกขอบเขต

- ไล่สีภายในรูป (linear/radial gradient), ขอบฟุ้ง (feather) → ระยะ 2.1 `kind: 'shape'`
- **รูประบายโปร่งแสง:** `fill` ทึบเสมอ เพราะแถว scanline ซ้อนกัน 55% สีจะสะสมเป็นแถบ ส่วน `opacity` ใช้ได้เฉพาะเส้นขอบ
- ข้อความ/ฟอนต์, `transform` ของ SVG, ไฟล์ SVG ทั้งไฟล์ (รับเฉพาะ path data)
- เก็บ `source` ของลายไว้แก้ทีละชิ้น → 1.3
- แก้ schema ของเอกสาร, rasterizer ของเว็บ, API

## การออกแบบ

### A. ตัวแยกและแปลง SVG path — `packages/patterns/src/svgPath.ts` (ใหม่, pure)

```ts
export type Subpath = { points: Pt[]; closed: boolean }
export function parseSvgPath(d: string): PathCommand[]          // แยกคำสั่ง + ตรวจรูปแบบ
export function flattenSvgPath(d: string, tolerance: number): Subpath[]  // เส้นโค้ง → เส้นตรง
```

**การแยก (parse)**
- คำสั่ง `M m L l H h V v C c S s Q q T t A a Z z`
- ตัวเลขแบบ SVG: เครื่องหมาย, ทศนิยมไม่มีเลขหน้า (`.5`), exponent (`1e-3`), ตัวเลขติดกัน (`0.5.5` = 0.5, 0.5)
  และ comma/space เป็นตัวคั่น
- พารามิเตอร์ซ้ำโดยไม่เขียนคำสั่งซ้ำ (`L 1 2 3 4`) และ `M` ที่ตามด้วยคู่พิกัดเพิ่มให้ถือเป็น `L`
- flag ของ `A` เป็นตัวเลขเดี่ยว `0`/`1` เขียนติดกันได้ (`a1 1 0 011 1`)
- ผิดรูปแบบ → throw `PathSyntaxError` ที่บอกตำแหน่งตัวอักษรและสาเหตุ เช่น `path ผิดที่ตำแหน่ง 42: คาดว่าเป็นตัวเลขหลัง C`
  ห้ามเดาหรือข้าม เพราะ AI ต้องรู้ว่าผิดตรงไหนเพื่อแก้

**การแปลงเส้นโค้งเป็นเส้นตรง (flatten)**
- Bezier กำลังสอง/สาม: แบ่งครึ่งแบบ adaptive จนความโค้งต่ำกว่า `tolerance` (วัดระยะจุดควบคุมถึงเส้นตรง)
  ลึกไม่เกิน 10 ชั้นต่อเส้นโค้ง
- `A` (arc): แปลงพารามิเตอร์ endpoint → center ตาม SVG spec (F.6.5) รวมการขยายรัศมีเมื่อเล็กเกิน (F.6.6)
  แล้วแบ่งเป็น cubic ช่วงละ ≤ 90° ก่อน flatten รัศมีเป็น 0 ให้ถือเป็นเส้นตรง
- `S`/`T` สะท้อนจุดควบคุมของคำสั่งก่อนหน้า (ถ้าคำสั่งก่อนหน้าไม่ใช่เส้นโค้งชนิดเดียวกัน ใช้จุดปัจจุบัน)
- `Z` ปิด subpath และกลับไปจุดเริ่ม คำสั่งถัดไปเริ่มจากจุดนั้น
- ตัดจุดซ้ำติดกัน (ระยะ < 1e-9)

**ข้อจำกัด (ป้องกันงานใหญ่เกินจาก input ภายนอก)**
- `d` ยาวไม่เกิน 8,000 ตัวอักษร (zod)
- จุดหลัง flatten รวมต่อ path ไม่เกิน 4,000 ถ้าเกิน throw พร้อมแนะนำให้แบ่ง path หรือลดรายละเอียด
- ตัวเลขทุกตัวต้อง finite

### B. ระบายรูปหลาย subpath — `packages/patterns/src/geometry.ts`

```ts
export function fillPolygons(polys: readonly Pt[][], color: string, opts: FillOptions & { rule?: 'nonzero' | 'evenodd' }): BrushStroke[]
```
- scanline แบบเดียวกับ `fill()` แต่เก็บขอบจากทุก polygon พร้อมทิศ (ขึ้น +1 / ลง −1) ต่อแถว
  - `evenodd`: จับคู่จุดตัดเรียงตาม u เหมือนเดิม
  - `nonzero`: เดินตามจุดตัดสะสม winding แล้วระบายช่วงที่ winding ≠ 0 (ค่าเริ่มต้นตาม SVG)
- ปิดท้ายด้วยเส้นขอบของทุก polygon (เหมือน `fill()` เพื่อลบขั้นบันได)
- เปลี่ยน `fill(poly, …)` ให้เรียก `fillPolygons([poly], …, { rule: 'evenodd' })`
  **ผลต้องเหมือนเดิมทุก byte** เพราะ preset ทั้งหมดพึ่งมันอยู่ (มีเทสต์ snapshot/ตัวเลขใน `patterns.test.ts` อยู่แล้ว ต้องผ่านโดยไม่แก้)
- ความซับซ้อน: O(R · E log E) โดย R = จำนวนแถว, E = จำนวนขอบ
  - ลดเป็น O(R · k log k) ได้ด้วยการเรียงขอบตาม v แล้วเลื่อนชุดขอบที่ตัดแถว (active edge list)
  - ต้องทำ เพราะ path ของมังกรมีขอบได้เป็นพัน

### C. ชนิดลาย `path` — `packages/patterns/src/patterns.ts`

```ts
{
  type: 'path',
  d: string,                                  // SVG path data (≤ 8000 ตัวอักษร)
  viewBox: [number, number, number, number],  // ค่าเริ่มต้น [0, 0, 1, 1] — ระบบพิกัดที่ใช้เขียน d
  region: { u0, v0, u1, v1 },                 // ค่าเริ่มต้น { 0, 0, 1, 1 } — วาง viewBox ลงตรงไหนของเล็บ
  fill?: hex, fillRule: 'nonzero' | 'evenodd' (ค่าเริ่มต้น 'nonzero'),
  stroke?: hex, strokeWidth: number (หน่วยเดียวกับ viewBox, ค่าเริ่มต้น 1% ของด้านกว้างของ viewBox),
  opacity: number 0–1 (ค่าเริ่มต้น 1, ใช้กับ stroke เท่านั้น),
}
```
- ต้องมี `fill` หรือ `stroke` อย่างน้อยหนึ่งค่า (zod `.refine` ที่บอกข้อความชัด)
- **แปลงพิกัด:** `u = u0 + (x − vx) / vw × (u1 − u0)` และ `v = v0 + (y − vy) / vh × (v1 − v0)`
  - ไม่รักษาสัดส่วน (เหมือน `preserveAspectRatio="none"`) — AI เลือก region ให้สัดส่วนตรงเอง
  - แกน y ของ SVG ชี้ลง ตรงกับ v (0 = ปลายเล็บอยู่บน) จึงไม่ต้องกลับแกน
  - ต้องมี `vw, vh > 0` และ `u0 < u1`, `v0 < v1`
  - ยอมให้พิกัดล้นกรอบ texture ได้: `line()` clamp ไว้แล้ว และ lint จะเตือนเมื่อส่วนชิ้นตกนอกเล็บ
- **tolerance ของการ flatten:** 0.001 หน่วย UV (≈ 1 px บน texture 1024) แปลงกลับเป็นหน่วย viewBox ก่อนเรียก
- **ความหนาแปรงที่ใช้ระบาย:** `clamp(ด้านสั้นของกรอบรูป / 6, 0.004, 0.02)` หน่วย UV แล้วขยายถ้าแถวจะเกิน 200
  (`brush ≥ ความสูงของรูป / (0.45 × 200)`)
  - รูปเล็กได้แปรงเล็ก รายละเอียดคม ส่วนรูปใหญ่ใช้ stroke ไม่เกินราว 200 แถว
- **เส้นขอบ:** `line()` ต่อ subpath (ปิดรูปให้ต่อจุดแรกท้ายสุด) ความหนา = strokeWidth แปลงเป็น UV
  ด้วยค่าเฉลี่ยของสเกลแกน u และ v
  - ถ้า subpath มีจุดเกิน `MAX_POINTS_PER_STROKE` ให้แบ่งเป็นหลาย stroke ที่ต่อกัน 1 จุด
- ลำดับ: ระบายก่อน แล้ววาดเส้นขอบทับ
- เพิ่มคำอธิบายของชนิดนี้ใน `.describe()` ให้ AI เห็นใน `list_patterns` ว่าเขียน d แบบไหน
  และแนะนำ `viewBox: [0, 0, 100, 100]` เพราะเขียนเป็นจำนวนเต็มง่ายกว่า
- `path` ไม่ถูกนับเป็นลายหนาแน่น (ไม่อยู่ใน `DENSE_PATTERN_TYPES`) เทสต์ใน `dense.test.ts` ต้องเติม `d` ใน `OVERRIDES`

### D. tool `add_path` — `apps/mcp/src/server.ts`

```ts
add_path({
  projectId, nails: nailTarget[],
  paths: PathSpec[] (1–40, แต่ละชิ้นคือฟิลด์ของลาย path ยกเว้น type),
  mirrorLeft: boolean = true,   // ชื่อนิ้ว (index) → มือซ้ายกลับซ้ายขวาให้แบบเดียวกับ recipe
  dryRun, preview,
})
```
- แปลงแต่ละ path เป็น stroke ด้วยฟังก์ชันเดียวกับ C แล้วต่อเข้าเล็บด้วย `addStrokes` เดิม
- มือซ้ายจากคีย์ชื่อนิ้วใช้ `mirrorStroke` เหมือน `buildFromRecipe` ส่วนคีย์เต็ม (`left.index`) ไม่กลับ
- stroke รวมต่อครั้งไม่เกิน 3,000 ต่อเล็บ (เพดานเอกสาร) ถ้าเกิน error ก่อนอ่าน API
- `PathSyntaxError` / ข้อจำกัดใน A → `errorResult` ที่บอก index ของ path ที่ผิด เช่น `paths[2]: path ผิดที่ตำแหน่ง 42 …`
- ใช้ `updateDesign` เดิม จึงได้ dryRun ภาพ และคำเตือน lint อัตโนมัติ
- อัปเดต `instructions` และ `PREVIEW_GUIDE`
  - ให้รู้ว่ามี `add_path` / ลาย `path` สำหรับลายที่ไม่มีใน catalog
  - วิธีที่แนะนำ: วางโครงใน viewBox 0–100 ภายในพื้นที่มองเห็น (u 0.2–0.8, v 0.05–0.95)
  - เลี่ยงรายละเอียดสำคัญช่วงปลายเล็บทรงยาว
  - ใช้ dryRun + zoom nail วนปรับ

### E. ตัวอย่างในคู่มือ

เพิ่ม preset ตัวอย่าง `fire-dragon` ใน `packages/patterns/src/presets.ts` ที่ใช้ `path` จริง
(ตัวมังกรสีดำขอบทอง พาดตามแนวยาว + เปลวไฟด้วย `flame` + พื้น `gradient` แดง-ส้ม + เพชรตา)
เพื่อให้ AI เห็นรูปแบบที่ใช้ได้จริง และเป็นภาพทดสอบด้วยตา
Claude จะออกแบบ path ของ preset นี้ตอนรีวิว **Codex ใส่โครงด้วย path ง่าย ๆ ที่ผ่านเทสต์ไว้ก่อน**

## ไฟล์ที่กระทบ

| ไฟล์ | การเปลี่ยน |
|---|---|
| `packages/patterns/src/svgPath.ts` (+ test) | ใหม่ (A) |
| `packages/patterns/src/geometry.ts` (+ test) | `fillPolygons`, `fill` เรียกผ่าน (B) |
| `packages/patterns/src/patterns.ts` | ลาย `path` (C) |
| `packages/patterns/src/presets.ts` | preset `fire-dragon` (E) |
| `packages/patterns/src/dense.test.ts` | `OVERRIDES` ของ path |
| `apps/mcp/src/server.ts` (+ test) | tool `add_path`, คู่มือ (D) |
| `apps/mcp/src/httpApp.test.ts` | จำนวน tool 21 → 22 |

ห้ามแตะ `packages/contracts`, rasterizer ของเว็บ, `apps/api`, `apps/ai`
และไฟล์ของงานอื่นที่ค้างอยู่ใน working tree (`NailScene.tsx`, `PaintController.tsx`, `NailFocus.tsx`,
`DecorationInstances.tsx`, `useHandProportions.ts`, `docs/tasks/fill-smooth-edges.md`, `mobile-paint-perf.md`,
`tools/render-keep-alive.gs`)

## ความซับซ้อน

- parse: O(n) ตามความยาวของ `d`
- flatten: O(P) จุดผลลัพธ์ (≤ 4,000 ต่อ path, ความลึกการแบ่งจำกัด)
- ระบาย: O(R · k log k + E log E) ด้วย active edge list (R ≤ 200 แถว)
- ทั้งหมดต่อการเรียก: O(Σ ความยาว d + Σ จุด) — ไม่มีส่วนไหนแย่กว่า n log n

## Edge cases

- path ว่าง / มีแต่ `M` → ไม่มีรูปให้ระบาย: path นั้นได้ stroke ว่าง แต่ถ้าทั้งชุด `paths` ว่างทั้งหมดให้ error `ไม่มีรูปที่วาดได้`
- subpath ที่ไม่ปิดแต่สั่ง `fill` → ปิดให้อัตโนมัติ (ตาม SVG) แต่เส้นขอบไม่ปิด
- รูปที่ตัดตัวเอง → ใช้ fillRule ตามที่ระบุ
- รูปเล็กกว่าแปรงขั้นต่ำ (เช่นจุดตาขนาด 0.003) → ระบายเป็นเม็ดเดียวตรงกลาง (กรณี `a ≥ b` ใน `fill()` เดิม)
- สามจุดเรียงเป็นเส้นตรง / ขอบแนวนอน → ไม่นับเป็นจุดตัด (กฎครึ่งเปิด `v1 <= v < v2` แบบเดิม)
- arc รัศมี 0 หรือจุดเริ่ม = จุดจบ → ข้ามตาม spec
- ตัวเลขแบบ `-.5e-2`, `1-2` (= 1, −2), `.5.5`
- viewBox/region ผิด (กว้าง 0, กลับด้าน) → zod error
- มือซ้ายกับ `mirrorLeft`: เทียบ stroke ของ `left.index` = `mirrorStroke` ของ `right.index`

## เทสต์ที่ต้องมี

**svgPath**
1. ทุกคำสั่งทั้งตัวใหญ่/ตัวเล็กให้จุดปลายถูกต้อง (เทียบค่าที่คำนวณด้วยมือ)
2. ตัวเลขรูปแบบพิเศษ + พารามิเตอร์ซ้ำ + `M` ตามด้วยหลายคู่ + flag ของ `A` ติดกัน
3. `S`/`T` สะท้อนจุดควบคุมถูก (เทียบกับ `C`/`Q` ที่เขียนเต็ม)
4. arc: ครึ่งวงกลม `M 0 0.5 A 0.5 0.5 0 0 1 1 0.5` ทุกจุดห่างจากศูนย์กลาง 0.5 ± tolerance; กรณีรัศมีเล็กเกินถูกขยาย
5. ความคลาดของ flatten ≤ tolerance (สุ่ม cubic 50 เส้นด้วย seed คงที่ เทียบจุดกึ่งกลางจริง)
6. error ระบุตำแหน่ง: `M 0 0 C 1`, `X 1 2`, ตัวเลข `NaN`/`1e999`, เกิน 4,000 จุด

**geometry**
7. `fill()` เดิมได้ผลเหมือนเดิมทุก byte (เทียบกับผลก่อนแก้ของรูปทดสอบ 5 แบบ) และเทสต์เดิมผ่านโดยไม่แก้
8. donut (วงนอก + วงในทิศกลับ): `evenodd` และ `nonzero` เป็นรูมีรู; วงในทิศเดียวกัน: `nonzero` เต็ม `evenodd` มีรู
9. ความครอบคลุมจริง: rasterize ด้วย `renderLayer` ที่ 512 แล้วพื้นที่ที่ทาสีต่างจากพื้นที่จริงของรูป
   (วงกลม, ดาว, รูปเว้า) ไม่เกิน 4%

**ลาย path**
10. viewBox/region แปลงพิกัดถูก (มุมทั้งสี่ของ viewBox ตกที่มุมของ region)
11. strokeWidth แปลงหน่วยถูก, `opacity` ใช้กับเส้นขอบเท่านั้น, ไม่มีทั้ง fill/stroke → error
12. จำนวนแถวไม่เกิน 200 กับรูปสูงเต็มเล็บ และใช้แปรงเล็กกับรูปเล็ก
13. ผ่าน `buildFromRecipe` ได้ และเอกสารผ่าน `designDocumentSchema`

**MCP**
14. `add_path` บันทึกด้วย `expectedVersion` เดิม, `dryRun` ไม่บันทึก, มีภาพ + คำเตือน
15. ชื่อนิ้ว + `mirrorLeft` ได้ stroke มือซ้ายเป็น mirror ของมือขวา
16. path ผิดได้ `errorResult` ที่มี `paths[i]` และตำแหน่ง โดยไม่เรียก API
17. schema ของ tool ผ่านเทสต์ "ประกาศทุก array ด้วย items แบบ object" เดิม
18. preset `fire-dragon` ผ่าน `buildFromRecipe`, อยู่ในเพดาน 4 MB ของ API (เทสต์เดิมของ preset ทั้งชุด)

คำสั่งที่ต้องผ่าน: typecheck และ test ของ `apps/mcp`, `apps/web`, `packages/patterns`

## Acceptance criteria

- [ ] AI เขียน SVG path (รวม arc) แล้วได้ลายบนเล็บตามรูปที่เขียน ทั้งระบายและเส้นขอบ
- [ ] ใช้ได้ทั้งเป็นลายใน recipe และผ่าน `add_path` พร้อม dryRun / ภาพ / คำเตือน
- [ ] path ผิดได้ข้อความที่บอกตำแหน่งให้ AI แก้ได้
- [ ] `fill()` เดิมไม่เปลี่ยนผล (preset ทั้งหมดเหมือนเดิม)
- [ ] ไม่แก้ schema ของเอกสาร ไม่เพิ่ม dependency
- [ ] typecheck และ test ผ่านทุก workspace ที่แก้

## สิ่งที่ Claude จะทำตอนรีวิว

- ออกแบบลายมังกรไฟจริงผ่าน `add_path` (dryRun + zoom nail) บนทรงต่าง ๆ แล้วปรับ preset `fire-dragon`
- เทียบภาพ preview กับฉาก 3D ในเบราว์เซอร์

## ข้อค้นพบนอกขอบเขต (ไม่แก้ในงานนี้)

- `addStrokes` (`packages/patterns/src/edit.ts`) รวม stroke ของทุกเลเยอร์แล้วเรียก `packLayers` ใหม่
  ค่า `opacity` / `blend` / `visible` / ชื่อของเลเยอร์เดิมจึงหายไปทุกครั้งที่ AI เพิ่ม stroke หรือ path
  บนงานที่ผู้ใช้ตั้งเลเยอร์ไว้ (ระดับ MEDIUM) — ควรแก้เป็นงานแยกโดยต่อท้ายเลเยอร์บนสุดแทนการแบ่งใหม่

## ความเสี่ยงที่เหลือ

- ระบายด้วยแถวของแปรงกลม ขอบโค้งคมได้ราวความหนาแปรง (≥ 4 px บน texture 1024) ยังไม่คมเท่าเวกเตอร์จริง (ระยะ 2.1)
- ลายจาก path ถูกยืดที่ปลายเล็บทรงยาวเหมือนลายอื่น (ระยะ 0) — lint จะเตือนแต่ไม่แก้ให้
- AI อาจเขียน path ที่มีจุดมากเกินจนชนเพดาน 3,000 stroke ต่อเล็บ — ต้องแบ่งรายละเอียดหรือใช้รูปที่เรียบกว่า
