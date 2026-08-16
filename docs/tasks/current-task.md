# Task: Slice 6 — TemplateComposer (A-20 Poisson-disk + A-21 point-in-hull + A-22 ΔE)

## บริบท / ทำไมต้องทำ

`docs/implementation-plan.md` Slice 6 ข้อ 6 อธิบาย pipeline ที่ประกาศว่าทำแล้ว:

> LLM → Recipe 8 ฟิลด์ (D-22) → `TemplateComposer` (TS) → Poisson-disk (A-20) +
> point-in-hull (A-21) + ΔE (A-22) → **3 ตัวเลือก**

ตรวจโค้ดจริงแล้วพบว่า **`TemplateComposer` ไม่มีอยู่เลย** — `apps/web/src/features/ai/AiAssistantPanel.tsx::applyRecipe`
(บรรทัด 83-89) แค่ map `baseColor`/`finish`/`shape`/`length` ไปที่เล็บที่เลือกอยู่ตัวเดียวตรง ๆ
ทิ้ง `accentNails` และ `decorations` ทั้งหมดโดยไม่ใช้เลย ไม่มี Poisson-disk sampling, ไม่มี ΔE
color-distance ที่ไหนในโค้ดเลย — `apps/ai/app/schemas.py` docstring ของ `Recipe` เขียนไว้ชัดว่า
`"The compact LLM output; TS owns full DesignDocument composition."` ยืนยันว่าฝั่ง TS ยังไม่ได้ทำส่วนนี้

สเปกอัลกอริทึมเต็มอยู่ที่ `docs/algorithms.md` A-20 (บรรทัด 1085-1124), A-21 (1128-1174, มีโค้ดอยู่แล้ว),
A-22 (1178-1224) — **ต้องทำตามสเปกนี้เป๊ะ** ไม่ใช่คิดใหม่

## Recipe contract (สิ่งที่ TS ต้องรับมือ — มาจาก `apps/ai/app/schemas.py`)

```ts
interface AiRecipe {
  archetype: string       // 1 ใน 7: french-tip · ombre · accent-nail · negative-space · marble · geometric · glitter-gradient
  paletteId: string       // 1 ใน 8: pal-nude-rose · pal-berry-night · pal-sage-sky · pal-sunset-coral ·
                           //          pal-lavender-milk · pal-mocha-gold · pal-monochrome-ink · pal-clear-gold
  baseColor: string       // #RRGGBB
  accentNails: number[]   // ดัชนี 0-4 ไม่ซ้ำกัน (5 นิ้วของมือขวา — ดู D-23 ทำไมมีแค่มือเดียว)
  finish: string          // glossy · matte · chrome · glitter
  shape: string           // round · oval · square · squoval · almond · coffin · stiletto
  length: string          // short · medium · long
  decorations: Array<{ catalogId: string; zone: string; density: number }>
  // catalogId: 1 ใน 30 id ใน apps/web/src/3d/decorations/decorationCatalog.ts (Python enum คือ ground truth ที่แน่นอน)
  // zone: nail-plate | free-edge | accent-nail | negative-space (มีแค่ 4 ค่านี้ — ตรวจใน Python แล้ว)
  // density: 0..1
}
```

ที่มาของ `AiRecipe` type ฝั่ง TS: `apps/web/src/features/ai/aiClient.ts:29-38` (มีอยู่แล้ว ไม่ต้องแก้)

`NailKey` = `right.thumb|index|middle|ring|little` × `left.*` (10 ค่ารวม แต่ปัจจุบันแสดงผลแค่มือขวา
ตาม D-23 — `accentNails` index 0-4 หมายถึงลำดับใน `FINGERS = ['thumb','index','middle','ring','little']`
บนมือขวา ให้ map เป็น `right.${FINGERS[i]}`)

## ขอบเขตงาน — ไฟล์ที่ต้องสร้าง/แก้

### 1. `apps/web/src/3d/generation/colorRules.ts` (ใหม่) — A-22

ทำตาม `docs/algorithms.md` A-22 เป๊ะ:
- แปลง hex → sRGB → CIELAB (สูตรมาตรฐาน: linearize sRGB ด้วย gamma correction → XYZ (D65 illuminant)
  → Lab)
- `deltaE76(labA, labB): number` — ระยะยุคลิดใน Lab space
- `hueHarmony(hexA, hexB): 'analogous'|'complementary'|'triadic'|'monochrome'|'clashing'` —
  คำนวณ hue จาก HSL แล้วจัดกลุ่มตามเกณฑ์ในเอกสาร: analogous <40°, complementary 150–210°,
  triadic 110–130°, monochrome = hue ต่างกัน <2° (ใช้ ΔE จาก lightness/chroma แทน)
- กฎบังคับใช้ (ค่าคงที่ตั้งชื่อไว้ ห้าม magic number ลอย ๆ):
  `PATTERN_CONTRAST_MIN_DE = 15`, `DECORATION_CONTRAST_MIN_DE = 10`
- `evaluateColorHarmony(input: { base: string; pattern?: string; decoration?: string }): { patternOk: boolean; decorationOk: boolean; hue: ReturnType<typeof hueHarmony> | null }`
- unit test คู่ (`colorRules.test.ts`): ทดสอบคู่สีที่รู้คำตอบล่วงหน้า (เช่น สีเดียวกัน ΔE=0, ขาว-ดำ ΔE สูงมาก)
  และเคส hue ทั้ง 4 กลุ่ม + กรณี clashing

### 2. `apps/web/src/3d/generation/scatter.ts` (ใหม่) — A-20

Bridson's Poisson-disk sampling ตามสเปก A-20 เป๊ะ (grid ขนาดเซลล์ = r/√2, seeded PRNG
เพื่อให้ recipe เดียวกันได้ผลเดิมเสมอ — **ห้ามใช้ `Math.random()` ตรง ๆ** ใช้ mulberry32 หรือ PRNG
seeded แบบง่ายที่ deterministic จาก seed string/number):

```ts
export function poissonDiskInHull(
  hull: readonly Pt2[],
  options: { radius: number; maxPoints: number; seed: number; vRange?: [number, number] },
): Pt2[]
```

- จำกัดการวางอยู่ใน `hull` ด้วย `isPointInHull` (`@/3d/geometry/pointInHull.ts`, มีอยู่แล้ว ห้ามเขียนใหม่)
- `vRange` optional — ใช้กรอง candidate point ก่อนตรวจ hull สำหรับ zone ที่ต้องการแถบเฉพาะ
  (เช่น free-edge = ปลายเล็บ) ดู mapping โซนในข้อ 3
- คืนค่า ≤ `maxPoints` จุด ห่างกันอย่างน้อย `radius` ทุกคู่ (spatial grid ต้องมีจริง — ห้าม O(n²)
  brute force เพราะเอกสารอ้าง Θ(n) ไว้ชัดเจน)
- unit test (`scatter.test.ts`): seed เดียวกัน → ผลเหมือนเดิมทุกครั้ง (determinism) · ทุกคู่จุดห่างกัน
  ≥ radius · ทุกจุดอยู่ใน hull จริง (สุ่ม hull รูปทรงต่าง ๆ แล้วตรวจด้วย brute-force เทียบ)

### 3. `apps/web/src/3d/generation/composer.ts` (ใหม่) — TemplateComposer

```ts
export interface ComposedNailChange {
  baseColor: string
  finish: Nail['finish']
  shape: Nail['shape']
  length: Nail['length']
  decorations: Decoration[]   // Decoration ชนิดเต็มจาก @nail-studio/contracts พร้อม id/u/v/rotation/scale
}

export function composeFromRecipe(
  recipe: AiRecipe,
  hulls: ReadonlyMap<NailKey, Pt2[]>,
  seed: number,
): Map<NailKey, ComposedNailChange>
```

Logic:
- palette lookup: hardcode ตาราง 8 `paletteId` → array ของสี hex (**คัดลอกค่าจริงจาก
  `apps/api/src/designCatalog/seedData.ts`** อย่าเดาสีขึ้นใหม่ — เป็น source of truth เดียวกับที่ seed
  ลง DB จริง). ไม่ต้องเรียก API เพราะยังไม่มี endpoint สำหรับ palette (พบว่าเป็น gap แยกต่างหาก
  — ไม่ต้องแก้ในงานนี้ ดูหัวข้อ "นอกขอบเขต" ด้านล่าง)
- นิ้วที่ไม่อยู่ใน `accentNails`: ใช้ `recipe.baseColor` ตรง ๆ, `finish`/`shape`/`length` ตาม recipe
- นิ้วที่อยู่ใน `accentNails`: เลือกสีจาก palette ของ `paletteId` ที่ผ่าน `evaluateColorHarmony`
  (ΔE ≥ `PATTERN_CONTRAST_MIN_DE` เทียบกับ baseColor + hue harmony ไม่ใช่ `clashing`) — วนหาตัวแรก
  ที่ผ่าน ถ้าไม่มีตัวไหนผ่านเลยใน palette ให้ fallback เป็นการหมุน hue ของ baseColor 180°
  (complementary แบบคำนวณเอง) แล้วบันทึกเหตุผลไว้ใน return value (เพิ่ม field `warnings: string[]`
  ใน return ของ `composeFromRecipe` ถ้าจำเป็น)
- decorations: สำหรับแต่ละ `RecipeDecoration` ในทุกนิ้ว (loop ทุกนิ้วที่มีเล็บแสดงอยู่ — มือขวาเท่านั้น
  ตาม D-23) map `zone` → พื้นที่วาง:
  - `nail-plate`: `poissonDiskInHull(hull, { radius, maxPoints, seed })` ทั้ง hull, ไม่จำกัด vRange
  - `free-edge`: `vRange: [0.75, 1.0]` (ปลายเล็บ — เช็คทิศทาง UV จริงจาก `hull.test.ts`/โมเดลก่อน
    เผื่อสลับด้าน — ถ้า UV กลับด้านให้ปรับเป็น `[0, 0.25]`)
  - `accent-nail`: ไม่ใช้ Poisson-disk — วางชิ้นเดียวตรงกลาง hull (centroid) ขนาดใหญ่กว่าปกติ
    (`scale` เพิ่มจาก `defaultScale` ตาม `density`) ไม่สนใจ `maxPoints` จาก density
  - `negative-space`: `vRange: [0, 0.25]` (โคนเล็บ) ความหนาแน่นต่ำกว่าปกติ (`maxPoints` ลดสัดส่วน)
  - `radius` และ `maxPoints` คำนวณจาก `density` (0..1): `maxPoints = Math.max(1, Math.round(density * MAX_DECORATIONS_PER_NAIL))`
    (import `MAX_DECORATIONS_PER_NAIL` จาก `@nail-studio/contracts` มีอยู่แล้ว = 30, แต่ต้อง cap
    ต่อ decoration entry ไม่ใช่ต่อเล็บทั้งหมด ถ้า recipe มีหลาย decoration ต่อเล็บต้องรวมกันไม่เกิน
    `MAX_DECORATIONS_PER_NAIL`) `radius` เริ่มจากค่าคงที่แล้วลดถ้าจุดที่ขอเยอะเกินไปไม่พอที่ในพื้นที่
    hull (Bridson จะคืนน้อยกว่า maxPoints เองถ้าที่ไม่พอ — ไม่ต้อง retry ด้วย radius ใหม่)
  - ตรวจ `evaluateColorHarmony({ base: nailBaseColor, decoration: catalogEntry.defaultColor })
    .decorationOk` — ถ้าไม่ผ่าน (ΔE < 10) ให้ข้ามการวางของตกแต่งชิ้นนั้น (ไม่ commit decoration
    ที่จมกับพื้น) — เพิ่มเข้า `warnings`
  - แต่ละ `Decoration` ที่สร้างต้อง `id` unique (`crypto.randomUUID()` หรือ deterministic จาก seed+index
    เพื่อให้ผลซ้ำได้ — แนะนำ deterministic เพื่อให้ unit test เทียบผลได้ตรง ๆ)
- seed: ใช้ `archetype+paletteId+baseColor` แฮชเป็นตัวเลข (recipe เดียวกัน = ผลเดียวกันเสมอ ตาม A-20
  requirement) — อย่าใช้ `Date.now()`

unit test (`composer.test.ts`) ด้วย hull fixture ง่าย ๆ (สี่เหลี่ยม/ห้าเหลี่ยมสมมุติ ไม่ต้องพึ่ง 3D):
- recipe เดียวกัน → ผลเดียวกันทุกครั้ง (determinism end-to-end)
- ของตกแต่งทุกชิ้นที่ออกมาอยู่ใน hull จริง (`isPointInHull`)
- accent nail สีผ่าน ΔE ≥ 15 กับ base เสมอ (หรือมี warning ถ้า fallback)
- decoration สีที่ผ่านเกณฑ์ ΔE ≥ 10 เท่านั้นที่ถูกวาง (ทดสอบด้วย catalog entry สีใกล้ base มาก ๆ ว่าถูกข้าม)
- จำนวน decoration ต่อนิ้วไม่เกิน `MAX_DECORATIONS_PER_NAIL`

### 4. Wiring เข้า UI — `apps/web/src/features/ai/AiAssistantPanel.tsx` + store

ปัญหา: `AiAssistantPanel` ปัจจุบันไม่มี hull ของแต่ละเล็บ (hull คำนวณอยู่ใน
`TransformController.tsx` จาก mesh UV ของ `parts: HandParts` เท่านั้น) และ store actions
(`setBaseColor`/`setFinish`/`setShape`/`setLength`) แก้แค่เล็บที่ `selection` อยู่ ไม่รับ `NailKey`
ตรง ๆ — ต้องแก้ 3 จุด:

a. Extract การคำนวณ hull ออกจาก `TransformController.tsx` (บรรทัด 39-51) เป็นฟังก์ชัน pure ที่ใช้ร่วมกันได้
   เช่น `apps/web/src/3d/geometry/nailHulls.ts::computeNailHulls(parts: HandParts): Map<NailKey, Pt2[]>`
   แล้วให้ `TransformController` เรียกใช้แทนโค้ดเดิม (ต้องยังผ่านเทส/พฤติกรรมเดิมทุกอย่าง — นี่คือ
   refactor ล้วน ๆ ห้ามเปลี่ยน behavior)

b. เพิ่ม store action ใหม่ `applyComposedRecipe(changes: Map<NailKey, ComposedNailChange>): void` ใน
   `apps/web/src/features/design/designStore.ts` — สร้าง Command ต่อเล็บ (reuse
   `SetBaseColorCommand`/`SetFinishCommand`/`SetShapeCommand`/`SetLengthCommand`/`AddDecorationCommand`
   ที่มีอยู่แล้วใน `@/3d/history/commands/*`) ห่อรวมด้วย `CompositeCommand` เดียว (pattern เดียวกับ
   "ใช้กับทุกเล็บ" ที่มีอยู่แล้วใน Slice 3) แล้ว `execute()` ครั้งเดียว — กด Ctrl+Z ครั้งเดียวต้องย้อน
   ทั้ง recipe กลับหมด ไม่ใช่ย้อนทีละนิ้ว

c. ใน `AiAssistantPanel.tsx` ต้องมี `parts: HandParts` เข้าถึงได้ (เช็คว่า component นี้ mount
   อยู่นอก `<Canvas>` หรือในนั้น — ถ้าอยู่นอก ให้ hull ถูกคำนวณใน component ที่อยู่ใน Canvas แล้วเก็บ
   ผลไว้ใน store หรือ context แทนที่จะ prop-drill ข้าม Canvas boundary — เลือกวิธีที่ตรงกับโครงสร้าง
   จริงของ `apps/web/src/app` ตอนนี้ ไม่ต้อง refactor โครงสร้างใหญ่เกินความจำเป็น) แล้วแก้
   `applyRecipe` (บรรทัด 83-89) ให้เรียก `composeFromRecipe(recipe, hulls, seedFromRecipe(recipe))`
   แล้วส่งผลเข้า `store.getState().applyComposedRecipe(...)` แทนโค้ดเดิมทั้งหมด

## Acceptance criteria (DoD)

- [ ] กด "สร้าง 3 แบบ" แล้วเลือก recipe หนึ่งอัน → **ทุกฟิลด์ของ recipe ถูกใช้จริง**: baseColor,
      finish, shape, length, accentNails (สีต่างจากนิ้วอื่นและผ่าน ΔE≥15), decorations (ปรากฏบนเล็บ
      จริง อยู่ในขอบเขตรูปเล็บ ไม่ลอยออกนอก, ตำแหน่งกระจายแบบ Poisson-disk ไม่ใช่สุ่มติดกันเป็นก้อน)
- [ ] Ctrl+Z ครั้งเดียวย้อน recipe ทั้งก้อนกลับเป็นสถานะก่อนกด (ไม่ใช่ย้อนทีละนิ้ว/ทีละของตกแต่ง)
- [ ] recipe เดียวกัน กดใช้ซ้ำ (บน state เดิม) → ได้ตำแหน่งของตกแต่งเดิมทุกครั้ง (deterministic seed)
- [ ] ของตกแต่งที่สีจมกับพื้น (ΔE < 10) ถูกข้ามไปเงียบ ๆ ไม่ crash ไม่ error ที่ผู้ใช้เห็น
- [ ] unit test ผ่านครบสำหรับ `colorRules.ts`, `scatter.ts`, `composer.ts` ตามที่ระบุในแต่ละหัวข้อ
- [ ] `TransformController.tsx` behavior เดิมไม่เปลี่ยน (hull extraction เป็น refactor ล้วน ๆ)
- [ ] typecheck + lint ผ่านทั้ง workspace `apps/web`
- [ ] ยืนยันบนเบราว์เซอร์จริง (`npm run dev:web` + `npm run dev:ai`): พิมพ์ prompt → "สร้าง 3 แบบ" →
      กด 1 การ์ด → เห็นของตกแต่งปรากฏบนเล็บจริงกระจายตัวเป็นธรรมชาติ ไม่ใช่แค่เปลี่ยนสี

## นอกขอบเขต (อย่าทำในงานนี้)

- ไม่ต้องสร้าง API endpoint สำหรับ `brand_colors`/`color_palettes` — hardcode ตารางสีใน `composer.ts`
  จาก `seedData.ts` พอ (เป็น gap แยกที่พบระหว่างตรวจโค้ด แต่ไม่ใช่สิ่งที่ Slice 6 พล็อตไว้ให้ทำ)
- ไม่ต้องทำ ΔE2000 (เอกสารเลือก ΔE76 ไว้แล้วโดยตั้งใจ — ดู "Why alternative was rejected" ใน A-22)
- ไม่ต้องแตะ `apps/ai` (Python ฝั่ง Recipe generation ทำงานถูกต้องอยู่แล้ว ตรวจแล้วในรอบก่อนหน้า)
- ไม่ต้องทำ benchmark ตัวเลขจริงของ A-20/A-21/A-22 (เอกสารเองบอกว่า "ยังไม่ได้วัด — Phase 14" คือ
  Slice 10 ไม่ใช่งานนี้)
- ไม่ต้องแก้ `NailDecoration` naming gap ที่พบใน Slice 4 (แยกงานคนละเรื่อง)
