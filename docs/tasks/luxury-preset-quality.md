# Task: ยกคุณภาพ luxury preset 5 ชุดให้ใกล้รูปตัวอย่าง + เพิ่มลายที่ยังขาด

> spec ก่อนหน้า (ขอบขั้นบันไดของ `fill()`) ย้ายไปอยู่ที่ `docs/tasks/fill-smooth-edges.md`

## บริบท

ผู้ใช้ส่งรูปอ้างอิง 5 รูป ทุกรูปมี preset อยู่แล้วใน `packages/patterns/src/luxuryPresets.ts`
แต่ผล render ยังห่างจากรูปมาก (ตรวจจาก `node tools/render-pattern-catalog.mjs <out>`)

| รูป | preset | ที่เห็นในรูป | ผลปัจจุบัน / ช่องว่าง |
|---|---|---|---|
| 1 | `emerald-marble-foil` | malachite เขียวเข้ม มีแถบควันเขียวอ่อนไหลวนเป็นชั้น ทองฟอยล์เป็น **เครือข่ายรอยแตก** แตกกิ่ง หนาบางไม่เท่ากัน มีเกล็ดทองจับกลุ่มตามรอย เล็บนู้ดมีเส้นทองไหลเฉียงตามขอบและเกล็ดทองหนาที่ปลาย | หินอ่อนเป็นเส้นคลื่นจางขนานกัน ฟอยล์เป็นแค่จุดเรียงเส้นเดียว ไม่มีเครือข่าย |
| 2 | `black-gold-couture` | ปลายดำเงา เส้นยิ้มโค้งลึกตามทรงอัลมอนด์ / โค้งเฉียงข้างเดียว ขอบเป็น **เส้นกลิตเตอร์ทองหนา** มีเส้นทองโค้งตัดกันเป็นรูป X เม็ดทองเรียงเป็นแถว เพชรเม็ดเล็ก | ขอบทองเป็นเส้นบางเรียบ ฟอยล์เป็นจุดเส้นตรง เส้นยิ้มเป็นเส้นตรงหรือ chevron มุมแหลม ไม่มีเม็ดทอง |
| 3 | `peach-blush` | เจลลี่ใส ออร่าทรงรียาวตามเล็บ แกนกลางชมพูเข้มผสมส้มพีชอิ่ม ขอบจางเป็นนู้ดใส | ออร่ากลม เล็ก จางเกินไป สีเดียว |
| 4 | `plum-cat-eye` | พลัมเข้มสลับมอฟอ่อน **แถบแสงคมแคบสว่าง** เฉียง มีขอบฟุ้ง ชิมเมอร์ละเอียดหนาแน่นทั้งเล็บ | แถบกว้างทึบไม่คม ชิมเมอร์บางมาก |
| 5 | `bridal-crystal-lace` | พื้นชมพูใส ปลายขาวนมไล่ขึ้นมาราว 45% ชิมเมอร์เงินละเอียด **ช่อเพชร**: เม็ดกลมใหญ่ตรงกลาง กลีบเพชรทรง marquise เรียงรอบ มีมุกแทรก **สายลูกปัดเงิน** ขดโค้ง | ปลายขาวจาง เพชรเป็นเม็ดกลมกระจาย เส้นโค้งเทาเรียบ ไม่มีลูกปัด ไม่มี marquise |

### ขอบเขตที่ทำได้จริง (บอกผู้ใช้ตรง ๆ)

ระบบวาดลายเป็น stroke 2D บน texture แล้วแปะลงโมเดล 3D ส่วนของนูนใช้ decoration 3D แบบเรียบง่าย
จึงทำให้ "เหมือนเมื่อมองที่ระยะใช้งานจริง" ได้ แต่ไม่ใช่เหมือนรูปถ่าย 100% สิ่งที่ทำไม่ได้ในงานนี้:

- ความใสแบบเจลลี่จริง (แสงทะลุเนื้อเล็บ / subsurface)
- เหลี่ยมเพชรหักเหแสงแบบเพชรจริง
- พื้นผิวฟอยล์นูนยับ (ทำได้แค่สีและแสงเงาที่วาดลงไป)

## การออกแบบ

### A. ลายใหม่ใน `packages/patterns/src/referencePatterns.ts`

ทุกลายเป็นแบบ deterministic ตาม `seed` ค่าทุกตัวมีขอบเขตด้วย Zod และใช้ helper เดิม
(`line`, `dot`, `fill`, `bezier`, `rng`, `tint`, `clipSegment`)

1. **`gold_vein`** — เครือข่ายรอยแตกฟอยล์ทอง (แบบ kintsugi)
   - schema: `color` (default `#c9a24e`), `angle` (ทิศการไหล, default -20),
     `veins` จำนวนเส้นหลัก int 1–4 (default 2), `branches` 0–1 (default 0.6),
     `width` 0.003–0.03 (default 0.012), `flakes` 0–1 (default 0.6),
     `region` enum `full | edge` (default `full`; `edge` = ไหลชิดขอบเล็บข้างเดียว แบบเล็บนู้ดในรูป 1),
     `side` enum `left | right`, `tipCluster` 0–1 (default 0; ความหนาแน่นเกล็ดกองที่ปลายเล็บ), `seed`
   - อัลกอริทึม:
     1. เส้นหลักแต่ละเส้นเดินแบบ random walk ตามทิศ `angle` ทีละช่วง 0.03–0.06 UV
        เบี่ยงมุมไม่เกิน ±35° ต่อช่วง ตัดด้วย `clipSegment` ให้อยู่ในกรอบ
     2. แตกกิ่งที่จุดสุ่มตามความน่าจะเป็น `branches` ลึกไม่เกิน 2 ชั้น
        กิ่งสั้นกว่าและบางลง ×0.6 ต่อชั้น บางกิ่งวกกลับมาชนเส้นอื่นจนเกิดเป็นช่องหลายเหลี่ยม
     3. แต่ละช่วงวาด 3 ชั้น ได้แก่ เงาทองเข้ม (`tint(color,'#5a3d12',0.35)`, กว้าง ×1.4, opacity 0.5)
        → ทองหลัก (ความกว้างแกว่ง 0.5–1.3× ตาม rng) → ไฮไลต์ (`tint(color,'#fff6d0',0.6)`, กว้าง ×0.35)
     4. เกล็ดทองหลายเหลี่ยม (ใช้โค้ด fragment แบบ `foil`) จับกลุ่มที่จุดแตกกิ่งและตลอดเส้น
        ตามค่า `flakes` และกองหนาที่ v < 0.18 ตามค่า `tipCluster`
   - เพดาน: segment ≤ 220, flake ≤ 160 → ≤ ~820 stroke อยู่ใน 2 layer
   - Complexity: O(segments + flakes) ทั้งเวลาและหน่วยความจำ

2. **`malachite`** — เนื้อหินเขียวเป็นชั้นควันไหลวน
   - schema: `colors` 2–4 (default `['#0c3b2e','#1f6b50','#3f9a76','#86c9a8']` เรียงจากเข้มไปอ่อน),
     `angle` (default 25), `bands` int 4–12 (default 8), `contrast` 0.2–1 (default 0.6), `seed`
   - อัลกอริทึม:
     1. ปูพื้นด้วย airbrush จุดใหญ่ 6 จุด ใช้สีเข้มสองสีแรก
     2. แถบโค้งขนานกันเป็นชั้นเหมือนวงปีหิน: path แต่ละเส้นมาจาก
        sin ซ้อน 2 ความถี่ + domain warp เบา ๆ (offset ด้วย sin ของพิกัดอีกแกน)
        ไล่สีจากเข้มไปอ่อน แต่ละแถบเป็น 2 stroke คือแถบกว้างฟุ้ง (opacity 0.18–0.35 ตาม contrast)
        ทับด้วยเส้นขอบคมบาง (สีอ่อนสุด, opacity 0.25–0.5)
     3. เส้นสว่างสั้นแบบ "ควัน" 10–16 เส้น ตามทิศแถบ
   - เพดาน ≤ 120 stroke

3. **`glitter_line`** — เส้นกลิตเตอร์ทองหนาตามเส้นโค้ง (ขอบ French และเส้นสาย X)
   - schema: `color` (default `#d4ab52`), `points` 2–4 จุด [u,v] (bezier), `width` 0.006–0.04 (default 0.016),
     `density` 0.2–1 (default 0.8), `taper` boolean (default true; ปลายเรียว), `seed`
   - อัลกอริทึม: เส้นทองรองพื้น opacity 0.85 → เกล็ดละเอียด `round(80+density*220)` จุด
     กระจายแบบ gaussian ในแถบกว้าง `width` ใช้ 3 เฉด (เข้ม/หลัก/ไฮไลต์) → จุดประกายสว่างทุก ~25 จุด
     ความกว้างคูณ `sin(πt)^0.35` เมื่อเปิด taper
   - เพดาน ≤ 330 stroke

4. **`bead_line`** — แถวลูกปัดโลหะ (เม็ดทองในรูป 2 / สายลูกปัดเงินในรูป 5)
   - schema: `color` (default `#d4ab52`), `points` 2–4, `size` 0.004–0.02 (default 0.008),
     `spacing` 1.2–4 (คูณกับ size, default 1.6), `taper` 0–1 (default 0.5; เม็ดเล็กลงไปทางปลาย),
     `curl` 0–1 (default 0; ม้วนปลายเป็นก้นหอยแบบสายเงินในรูป 5)
   - อัลกอริทึม: สุ่มตำแหน่งตามความยาวโค้ง (arc length) ทีละ `size*spacing`
     ลูกปัดแต่ละเม็ด = ฐานสีเข้ม + ตัวลูก + จุดไฮไลต์เยื้องซ้ายบน
     ทำให้ดูนูนในภาพแบน
   - เพดาน ≤ 80 เม็ด × 3 = 240 stroke

### B. ปรับลายเดิม (เพิ่มพารามิเตอร์ใหม่ ค่า default เดิมต้องให้ผลเหมือนเดิม)

5. **`french`** เพิ่ม `style: 'almond'` และ `style: 'swoop'`
   - `almond`: เส้นยิ้มเป็นโค้ง U ลึกตามทรงปลายเล็บ ไม่ใช่มุมแหลมแบบ chevron
     โดยมี `depth` ที่ขอบและ `depth+smile*3` ตรงกลาง
   - `swoop`: โค้งเฉียงข้างเดียว (cubic bezier) ใช้ร่วมกับ `side`
   - เพิ่ม `borderStyle: 'solid' | 'glitter'` (default `solid`) ถ้าเป็น `glitter` ให้เรียก renderer
     ของ `glitter_line` ตามเส้นขอบแทนเส้นเรียบ
6. **`aura`** เพิ่ม `aspect` 0.6–2.5 (default 1 = กลมเหมือนเดิม), `inner` color optional
   (สีแกนกลาง เช่น ส้มพีชใต้ชมพู), `rotation` (default 0)
7. **`cat_eye`** เพิ่ม `core` 0–1 (default 0 = เหมือนเดิม; ความคม/สว่างของแกนแสง),
   `shimmer` 0–1 (default 0.25 ≈ 240 จุดเหมือนเดิม; สูงสุด 900 จุด), `glow` color optional
   - เมื่อ `core > 0`: เพิ่มเส้นแกนแคบ `width*0.12` สีขาวอมสี opacity สูง + ฟุ้งชั้นกลาง
   - ชิมเมอร์ใช้สองขนาด: ฝุ่นละเอียดทั้งเล็บ + เกล็ดสว่างกระจุกในแถบ

### C. Decoration 3D ใหม่

แก้ทั้ง `apps/web/src/3d/decorations/decorationCatalog.ts` และ `packages/patterns/src/catalog.ts`
ให้ id ตรงกัน (เทส MCP มีตรวจอยู่แล้ว) แล้วแก้คอมเมนต์ที่ระบุจำนวน "30 รูปทรง"

8. `gem-marquise` — เพชรทรงเรือ: `OctahedronGeometry(1,0)` scale (0.45, 1.15, 0.35) ทำผ่าน `.scale()` บน geometry
9. `gem-chaton` — เพชรกลมเจียระไน: `LatheGeometry` แบบ table แบน + crown + pavilion ทรงกรวย 16 ด้าน
   ใช้แทน `gem-round` ที่ดูเป็นลูกบอลเหลี่ยม
10. `metal-bead` — ลูกปัดทอง/เงินกลมเล็ก `SphereGeometry(0.5,12,8)` metalness 0.95

### D. ปรับ preset 5 ชุดให้ตรงรูปทีละนิ้ว (มือขวา; มือซ้ายถูก mirror)

- **emerald-marble-foil**: thumb/index/ring = `malachite` + `gold_vein` (full, veins 2–3, flakes 0.7)
  ส่วน middle/little = นู้ดน้ำนม `#ead2c6` + `gradient` ขาวจางที่ปลาย + `gold_vein` (edge, veins 1, tipCluster 0.8)
  ใช้ seed/angle ต่างกันทุกนิ้ว
- **black-gold-couture**: ทุกนิ้วเป็น `french` ดำ `#0e0e12` แบบ almond/swoop สลับกัน + `borderStyle:'glitter'`
  index/ring เพิ่ม `glitter_line` ตัดกันเป็น X บนปลายดำ
  middle/thumb เพิ่ม `bead_line` เม็ดทองโค้งใต้เส้นยิ้ม + `gem-chaton` 1 เม็ด
- **peach-blush**: base `#efd2c6` + `aura` aspect 1.8, color `#ec6f86`, inner `#f39a62`, radius 0.36, strength 0.95
  สลับโทนชมพู/พีชระหว่างนิ้ว + `gradient` นู้ดใสที่ปลาย + ชิมเมอร์ละเอียดมาก
  finish ยังเป็น glossy
- **plum-cat-eye**: เพิ่ม `core 0.8`, `shimmer 0.8`, `width 0.12`
  สลับพลัมเข้ม `#4a2236` กับมอฟ `#9a6a78` และเปลี่ยนมุมแถบให้ต่างกันทีละนิ้ว
- **bridal-crystal-lace**: base `#e7c7c0`, `gradient` ขาวนม `#fbf6f1` reach 0.5 strength 1.4,
  glitter full เงินละเอียด density 0.15
  - index/middle: ช่อเพชร = `gem-chaton` ใหญ่ตรงกลาง + `gem-marquise` 5–6 กลีบเรียงรัศมี + มุก 2–3 เม็ด
  - thumb/ring/little: `pearl-single` 1–2 เม็ด + `bead_line` สีเงิน curl 0.6

### E. เครื่องมือรีวิว

- `tools/render-pattern-catalog.mjs`: เพิ่ม `gold_vein`, `malachite`, `glitter_line`, `bead_line`,
  french almond/swoop และ cat_eye core ในแถว new-patterns
- อัปเดต `docs/pattern-reference-quality.md` (จำนวนลาย/decoration และข้อจำกัด)

## ไฟล์ที่ได้รับผลกระทบ

- `packages/patterns/src/referencePatterns.ts` — ลายใหม่ 4 แบบ, ปรับ aura/cat_eye
- `packages/patterns/src/patterns.ts` — french almond/swoop/borderStyle
- `packages/patterns/src/luxuryPresets.ts` — 5 preset
- `packages/patterns/src/catalog.ts`, `apps/web/src/3d/decorations/decorationCatalog.ts` — decoration 3 ชิ้น
- `packages/patterns/src/patterns.test.ts` — เทสใหม่
- `tools/render-pattern-catalog.mjs`, `docs/pattern-reference-quality.md`

ไม่ต้องแก้ contracts, API, DB หรือ AI service (ลายเป็น recipe → stroke ตาม schema เดิม)

## Acceptance criteria

1. ลายใหม่ 4 แบบผ่าน `patternSchema.parse({ type })` ด้วยค่า default ล้วน และ render ได้ ≥ 1 stroke
2. ทุกลายใหม่ deterministic: seed เดียวกันได้ stroke เท่ากันทุกตัว
3. ทุก preset ใน `PRESETS` ผ่าน `buildFromRecipe` ไม่เกิน 6 layer ต่อเล็บ และ body ไม่เกิน 4 MB (เทสเดิม)
4. ทุก stroke อยู่ในกรอบ UV [0,1] (ลายใหม่ทั้งหมด)
5. ค่า default เดิมของ `french`, `aura`, `cat_eye` ให้ stroke เหมือนก่อนแก้ทุกตัว (snapshot เทียบ
   output ของ preset เดิมที่ไม่ได้แตะ เช่น `graphic-french`, `cherry-blush`, `champagne-cherry`)
6. id ของ decoration ฝั่งเว็บกับ `catalog.ts` ตรงกัน (เทส MCP เดิมผ่าน)
7. `gold_vein` แบบ `full` มีจุดแตกกิ่งอย่างน้อย 1 จุดเมื่อ `branches ≥ 0.5`
8. รีวิวด้วยตา: render catalog แล้ววางเทียบกับรูปทั้ง 5 ใน 3D review (`tools/review-patterns.mjs`)
   Claude ตรวจและแนบภาพให้ผู้ใช้ดู
9. lint, typecheck และเทสทั้ง repo ผ่าน

## Edge cases

- `gold_vein` region `edge` บนเล็บแคบ (little) ต้องไม่หลุดออกนอกพื้นที่มองเห็น u 0.2–0.8
- `glitter_line` / `bead_line` ที่มี 2 จุด (เส้นตรง) และจุดซ้ำกัน (ความยาว 0) ต้องไม่หารศูนย์
- `bead_line` curl 1 กับเส้นสั้น ต้องไม่ม้วนเป็นวงซ้อนจนเกินกรอบ (clamp)
- `cat_eye` shimmer 1 + `glitter` บนเล็บเดียวกันต้องไม่เกิน 6 layer
- `french` almond ที่ smile ติดลบ ต้องยังเป็นรูปปิดที่ fill ได้
- รวมทุกลายบนเล็บเดียวต้องไม่เกิน 3,000 stroke (6×500) ถ้าเกิน recipe จะ throw (ใช้กลไกเดิม)

## Complexity

ทุกลายใช้เวลา O(n) ตามจำนวน stroke ที่สร้าง และ n มีเพดานคงที่ตามตารางข้างบน
`fill()` เดิมใช้ O(rows × edges) ต่อรูป ส่วนเกล็ดฟอยล์มี 4 ขอบ จึงถือเป็นค่าคงที่
ไม่เพิ่ม dependency

## เทสที่ต้องมี

- unit: default parse + render, determinism, กรอบ UV, เพดาน stroke ของแต่ละลายใหม่
- unit: backward compat ของ french/aura/cat_eye default
- unit: `gold_vein` มีกิ่ง, edge region อยู่ในช่วง u
- integration (เดิม): ทุก preset ผ่าน build + body limit, decoration id sync
- visual: render catalog + ภาพ 3D review เทียบรูปอ้างอิง
