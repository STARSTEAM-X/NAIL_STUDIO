# Realistic Hand v2 — สเปกแก้ให้มือเหมือนมือคนจริง

สถานะ: DESIGN (ยังไม่ implement)
อ้างอิงผลรีวิว: `realistic-hand-v1` (2026-10-18)
ไฟล์ที่เกี่ยวข้อง: `tools/realistic_hand_anatomy.py`, `tools/create_realistic_hand.py`,
`tools/verify_realistic_hand.py`, `apps/web/src/features/handStudio/*`,
`apps/web/public/models/realistic-hand-v1.*`, `docs/hand-studio/*.png`

---

## 1. ผลรีวิว v1 (สิ่งที่เห็นจริงจากภาพเรนเดอร์และไฟล์)

ข้อมูลจาก GLB: ผิวมือ 88,525 verts / 164,888 tris (voxel remesh 0.65 mm),
เล็บ 2,050 verts ต่อชิ้น, cuticle ~1,000 verts ต่อชิ้น, texture 3 แผ่น
(basecolor / normal / roughness)

### CRITICAL — สาเหตุหลักที่มือดูเป็นหุ่น

| # | ปัญหา | หลักฐาน | สาเหตุในโค้ด |
|---|---|---|---|
| C1 | นิ้วเป็นท่อตรงเกือบเท่ากันตลอด ไม่มีหน้าตัดแบบนิ้วจริง | `hand-overview-2048.png` | `build_skin()` sweep วงกลม 64 ด้าน ตาม `radius_at()` ซึ่งเป็น shaft เรียวเชิงเส้น + gaussian bump |
| C2 | โคนนิ้ว (MCP) มีก้อนกลมนูนแปลกๆ ระหว่างนิ้วชี้-กลาง-นาง และไม่มีพังผืดระหว่างนิ้ว (webbing) | ภาพรวม บริเวณโคนนิ้ว | ท่อนิ้วถูกฝังเข้าฝ่ามือ (`buried_root`) แล้ว union ด้วย voxel remesh → เกิด blob ตรงรอยต่อ |
| C3 | นิ้วโป้งเหมือนแท่งที่แปะข้างฝ่ามือ ไม่มีกล้าม thenar / ไม่มีพังผืดนิ้วโป้ง-นิ้วชี้ | ภาพรวม | ฝ่ามือเป็น lofted profile ทรงรี ไม่มีมวล thenar; นิ้วโป้งเริ่มจาก `(-.024,.030)` เป็นท่อเดี่ยว |
| C4 | เล็บดูเป็น "ฝาครอบ" วางบนปลายนิ้ว กว้างเท่านิ้ว ไม่มีร่องข้างเล็บ (lateral nail fold) | `nail-fit-2048.png` | nail bed ray-cast ทาบผิว แต่ไม่มีการกดผิวรอบเล็บให้เป็นร่อง; ผิวด้านข้างไม่ห่อขอบเล็บ |

### HIGH

| # | ปัญหา | หลักฐาน / สาเหตุ |
|---|---|---|
| H1 | basecolor แทบเป็นสีเทาเดียว (lum ≈ .75) ไม่มีโซนสี — ข้อนิ้วไม่แดง, ปลายนิ้ว/ฝ่ามือไม่ชมพู, ไม่มีเส้นเลือด | `basecolor.png`; `sculpt_detail()` ใส่ redness .045 / vein .016 ซึ่งน้อยเกินจะมองเห็น |
| H2 | ผิวไม่มี subsurface scattering → ดูเป็นพลาสติก/ดินน้ำมัน | `createSkinMaterial()` ใช้ MeshPhysicalMaterial ไม่มี transmission/SSS, sheen .025 |
| H3 | UV แตกเป็นเกาะเล็กหลายร้อยเกาะ (มุมบนและขวาของ texture) → texel density ต่ำ, รอยต่อ normal map | `basecolor.png` |
| H4 | รอยย่นข้อนิ้วเป็นเส้นแนวนอนขนานกันเหมือนวงแหวน ไม่ใช่กลุ่มรอยย่นรูปวงรีบนข้อ PIP/DIP | ภาพรวม; รอยย่นถูก displace แบบ procedural ตาม `s` ของนิ้ว |
| H5 | topology หลัง voxel remesh เป็นสามเหลี่ยมไม่เป็นระเบียบ ไม่มี edge loop ที่ข้อต่อ → งอนิ้วแล้วผิวยุบ/ย่นผิดรูป | GLB `Hand_Mesh` 165k tris |
| H6 | เล็บนิ้วโป้งสีไม่ตรงกับนิ้วอื่น (ม่วงเข้มกว่า) | ภาพรวม — น่าจะเป็น material/normal ของ thumb nail หันผิดทิศหรือได้ env ต่างกัน |

### MEDIUM

| # | ปัญหา |
|---|---|
| M1 | ผิวเล็บเห็นแถบแสงสะท้อนเป็นริ้วแนวตั้ง (faceting) — normal ของ nail bed 41×25 ไม่เรียบพอ / ไม่มี C-curve ที่ต่อเนื่อง |
| M2 | ขอบ cuticle เป็นเส้นสันบางมีรอยหักที่มุมโคนเล็บทั้งสองข้าง (จุดหยักใน `nail-fit-2048.png`) |
| M3 | ขอบเล็บมีเส้นดำ (outline) — น่าจะเกิดจาก `polygonOffset` + ด้านข้าง shell ที่บางมาก |
| M4 | ปลายนิ้ว (pulp) ไม่ป่องออกด้านข้าง/ด้านล่างเล็บ ปลายนิ้วตัดตรงแบบท่อ |
| M5 | แขนเป็นท่อทรงกระบอก ไม่มีปุ่มกระดูกข้อมือ (ulnar styloid), ปลายแขนตัดเรียบ |
| M6 | แสงในฉากเป็นแสงหน้าแบนๆ ไม่มีเงา/AO ระหว่างนิ้ว → มิติหาย |

### สิ่งที่ v1 ทำได้ดี (เก็บไว้)
- rig 23 bones, socket เล็บที่ distal bone, กลไก nail shape/length ที่ล็อกโคนเล็บ 40%
- ระบบ material ของเล็บ (finish / pattern / decoration) และ test ฝั่ง web
- สัดส่วนความยาวนิ้วโดยรวม (นิ้วก้อยต่ำกว่า, นิ้วกลางยาวสุด) ใช้ได้

---

## 2. ข้อสรุปเชิงสถาปัตยกรรม

**ข้อจำกัดหลักอยู่ที่วิธีสร้างรูปทรง** ไม่ใช่ค่าพารามิเตอร์:
ท่อ procedural + voxel union จะไม่มีวันได้ webbing, thenar, ร่องเล็บ และ topology
สำหรับการงอที่ดี การจูนค่า `FINGERS` / `radius_at()` ต่อไปจะได้ผลน้อย

ทางเลือก (เรียงตามที่แนะนำ):

1. **Sculpt + Retopo ใน Blender (แนะนำ)** — ใช้ mesh v1 เป็นฐาน sculpt มือเต็ม
   (multires) แล้ว retopo เป็น quad ~12–20k faces มี edge loop รอบข้อทุกข้อ
   bake รายละเอียดเป็น normal/displacement คงหลัก "authored from scratch" ใน README
2. **ฐานจาก scan ที่มี license ชัดเจน** (เช่น hand scan เชิงพาณิชย์) + retopo —
   สมจริงที่สุดแต่ต้องเปลี่ยนเงื่อนไข provenance ใน `meta.json`/README และตรวจ license
3. **ปรับ procedural ต่อ** (เพิ่ม web/thenar/nail groove ด้วย SDF blend แทน voxel union)
   — ถูกที่สุดแต่เพดานความสมจริงต่ำ ใช้ได้ถ้าเป้าหมายแค่ "ดีขึ้น" ไม่ใช่ "เหมือนจริง"

ข้อตัดสินใจที่ต้องให้ผู้ใช้เลือก: ทางเลือก 1 / 2 / 3 และยอมรับ asset ภายนอกได้หรือไม่

---

## 3. งานที่ต้องทำ (ตามลำดับความคุ้มค่า)

### Phase A — Runtime/วัสดุ (ไม่ต้องแตะ mesh, เห็นผลเร็ว)
แก้ใน `studioMaterials.ts`, `StudioCanvas.tsx`
- A1 ผิว: เพิ่ม SSS แบบประมาณ — `transmission` ต่ำ + `thickness` map หรือ
  `onBeforeCompile` wrap-lighting/สีแดงที่ terminator; sheen ~.15–.25 สีอุ่น;
  roughness ฐาน ~.45–.5 ให้ specular ผิวมัน (ปลายนิ้ว/ข้อนิ้ว) ต่างจากหลังมือ
- A2 แสง: เปิด shadow ของ key light (soft, bias เหมาะสม) + contact/AO (SSAO หรือ baked AO map)
- A3 เล็บ: แก้ thumb nail สีเพี้ยน (H6), ตัด outline ดำ (M3), ใช้ normal ที่ smooth ข้ามทั้ง bed (M1)

### Phase B — Texture (bake ใหม่จาก Blender)
แก้ใน `create_realistic_hand.py` (ส่วน bake) และ `realistic_hand_anatomy.py:sculpt_detail`
- B1 UV ใหม่: seam ด้านข้างนิ้ว/ใต้แขน, เกาะไม่เกิน ~10 ชิ้น, texel density สม่ำเสมอ (แก้ H3)
- B2 basecolor มีโซนสี: ข้อนิ้ว/ข้อ PIP แดงขึ้น, ปลายนิ้วและโคนเล็บชมพู, ฝ่ามือชมพูอ่อนกว่า,
  หลังมือเหลืองอุ่น, เส้นเลือดเขียวอมฟ้าจางๆ บนหลังมือ/ข้อมือ — ความต่างสีต้องเห็นได้ (ΔE ≥ 4) (แก้ H1)
- B3 roughness: ฝ่ามือ/ข้อนิ้วด้านกว่า, ปลายนิ้วมันกว่า
- B4 normal: pores + รอยย่นข้อนิ้วรูปวงรีเป็นกลุ่ม (แก้ H4), รอยลายนิ้วมือที่ pulp

### Phase C — รูปทรงและ topology (ทางเลือก 1 หรือ 2)
- C1 นิ้ว: หน้าตัดแบนด้านหลัง ป่องด้านฝ่ามือ, คอดเล็กน้อยระหว่างข้อ, ข้อ PIP กว้างกว่าข้อ DIP
- C2 พังผืดระหว่างนิ้ว สูงราว 1/3 ของ proximal phalanx ด้านฝ่ามือ; ไม่มี blob ที่ MCP (แก้ C2)
- C3 นิ้วโป้ง: กล้าม thenar, พังผืดนิ้วโป้ง-นิ้วชี้, นิ้วโป้งหมุน ~80–90° ให้เล็บหันออกด้านข้าง (แก้ C3)
- C4 ปลายนิ้วและเล็บ:
  - กดผิวเป็น nail groove: lateral fold ห่อขอบเล็บข้างละ ~0.5–1 mm, proximal fold ทับโคนเล็บ
  - ความกว้างเล็บ ≈ 75–85% ของความกว้างปลายนิ้วตรงนั้น (ตอนนี้ ≈ 100%)
  - pulp ป่องออกด้านข้างเลยขอบเล็บเล็กน้อย, hyponychium ใต้ปลายเล็บ
  - cuticle เป็นส่วนหนึ่งของผิว (ไม่ใช่ mesh แยกที่มีสัน) หรือถ้าแยก ต้องไม่มีรอยหักที่มุม (แก้ M2)
- C5 ข้อมือ/แขน: ulnar styloid, เอ็นข้อมือด้านฝ่ามือ, ปลายแขนจางหายหรือ crop นอกกล้อง (แก้ M5)
- C6 topology: quad, edge loop ≥ 3 วงรอบทุกข้อ, ≤ 25k faces (ลด GLB จาก 13 MB) (แก้ H5)
- C7 skin weights ใหม่ + corrective shape keys สำหรับงอ PIP/MCP ≥ 60°

### Phase D — เล็บ (หลัง C4)
- re-sample nail bed กับผิวใหม่, คง API socket/`nails` ใน `meta.json` เดิม
- C-curve ต่อเนื่อง, free edge มีความหนาเห็นได้, lunula/โคนเล็บโปร่งแสงได้สำหรับ finish ใส

---

## 4. Acceptance Criteria
1. ไม่มี blob/รอยต่อที่ MCP; มี webbing ระหว่างนิ้วทุกคู่และระหว่างนิ้วโป้ง-นิ้วชี้
2. ในภาพ `nail-fit` เห็นผิวทั้งสองข้างเล็บและร่องข้างเล็บ; เล็บแคบกว่าปลายนิ้ว
3. ไม่มีเส้นดำรอบเล็บ, ไม่มีรอยหักที่มุม cuticle, เล็บทุกนิ้วสีเดียวกันเมื่อใช้ finish เดียวกัน
4. basecolor มีโซนสีที่วัดได้ (ข้อนิ้ว vs หลังมือ ΔE ≥ 4); UV ≤ ~10 เกาะหลัก
5. ผิวมีความโปร่งแสง (ขอบเงาออกแดง) และมีเงา/AO ระหว่างนิ้วในโหมด studio
6. งอนิ้ว 5 pose เดิม ไม่มีผิวยุบ/ทะลุที่ข้อ (ตรวจภาพ + test)
7. API เดิม (`meta.json` nails/sockets, bone names, `handRig`, `attachmentLayout`) ไม่เปลี่ยน
8. GLB ≤ 13 MB (เป้า ≤ 8 MB)
9. web tests และ `tools/verify_realistic_hand.py` ผ่านทั้งหมด

## 5. Edge cases
- มือซ้าย mirror ข้าม X: normal/tangent ของ normal map ต้องถูกต้องหลัง mirror
- เล็บยาว/ทรง stiletto: ร่องข้างเล็บต้องไม่ดันเล็บส่วนที่ยื่นเกินปลายนิ้ว
- skin tone เข้ม/อ่อน (`updateSkinMaterial`): โซนสีต้องเป็น multiplier ไม่ใช่สีตายตัว
- quality `low`: ปิด SSS/AO ได้โดยไม่พัง material
- pose ที่นิ้วชิดกัน: เงา contact ต้องไม่กระพริบ (shadow acne)

## 6. Complexity / performance
- Runtime: ลด tris ~165k → ≤ 50k (รวมเล็บ) ลด skinning cost ~3×
- AO: SSAO เป็น O(pixels) ต่อเฟรม — เปิดเฉพาะ quality medium/high
- Nail re-sample: O(41×25) ray cast ต่อเล็บ ทำตอน bake เท่านั้น

## 7. Tests ที่ต้องเพิ่ม/ปรับ
- `verify_realistic_hand.py`: ตรวจจำนวนเกาะ UV, จำนวน faces, quad ratio, ความต่างสีโซนใน basecolor
- `nailGeometry.test.ts`: ความกว้างเล็บ/ความกว้างปลายนิ้ว ∈ [0.75, 0.85]; มีผิวเหนือขอบข้างเล็บ
- `handRig.test.ts`: ปริมาตรผิวรอบข้อไม่ลดเกิน X% เมื่องอ 60°
- material test: thumb nail ได้ material spec เดียวกับนิ้วอื่น
- ภาพ regression: เรนเดอร์ overview + nail-fit ใหม่และเก็บใน `docs/hand-studio/`
