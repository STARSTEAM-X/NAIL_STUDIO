# Performance Measurements — NAIL STUDIO 3D

เอกสารบันทึกผลการวัดประสิทธิภาพทั้งหมดของโครงงาน

**กฎของเอกสารนี้**

1. ทุกตัวเลขต้องระบุ **สภาพแวดล้อมที่วัด** ครบ ไม่งั้นเปรียบเทียบกันไม่ได้
2. ตัวเลขที่ได้มาในเงื่อนไขที่ไม่ถูกต้อง **ต้องบันทึกไว้ว่าใช้ไม่ได้และทำไม** ไม่ใช่ลบทิ้งเงียบ ๆ
3. ห้ามอ้าง "เร็วขึ้น X%" โดยไม่มีตัวเลขก่อน/หลังในสภาพแวดล้อมเดียวกัน
4. การเปลี่ยนแปลงที่วัดแล้ว **ไม่ได้ช่วย** ต้องบันทึกไว้ด้วย — มีค่าทางวิชาการเท่ากับที่ช่วย

---

## M0 · Baseline — ก่อนการ optimize ใด ๆ

**วันที่วัด**: 2026-08-12
**ที่มา**: Spike S1 (`spikes/s1-react19-r3f9/`) — ดู [spikes/S1-react19-r3f9.md](spikes/S1-react19-r3f9.md)

### สภาพแวดล้อม

| รายการ | ค่า |
|---|---|
| ระบบปฏิบัติการ | Windows 11 Home Single Language 10.0.26200 |
| Node | v24.19.0 |
| เบราว์เซอร์ | Chromium (Browser pane ในเครื่องมือพัฒนา) |
| WebGL | WebGL 2.0 (OpenGL ES 3.0 Chromium) |
| devicePixelRatio | 1.25 |
| ขนาด canvas (CSS) | 502 × 694 px |
| ขนาด framebuffer | 627 × 868 px |
| `dpr` ที่ตั้งไว้ | `[1, 2]` |
| โมเดล | `hand.glb` — 11,770,384 bytes, 120,356 tris, ไม่บีบอัด |
| กล้อง | position `[0, 0.03, 0.85]`, fov 35, target `[0, 0.03, 0.13]` |
| ฉาก | ambientLight + directionalLight + `Environment` (resolution 256) + Lightformer × 2 |
| สแตก | React 19.2.8 · R3F 9.7.0 · drei 10.7.8 · three 0.185.1 |

### ผลที่วัดได้ (เชื่อถือได้)

| ตัวชี้วัด | ค่า | ที่มา |
|---|---|---|
| **สามเหลี่ยมต่อเฟรม** | **121,956** | `renderer.info.render.triangles` |
| **draw calls** | **11–12** | `renderer.info.render.calls` |
| geometries ใน GPU | 19 | `renderer.info.memory.geometries` |
| textures ใน GPU | 9 | `renderer.info.memory.textures` |
| shader programs ที่คอมไพล์ | 6 | `renderer.info.programs.length` |
| `hand.glb` transferSize | 11,770,684 bytes | Resource Timing API |
| `hand.glb` encodedBodySize | 11,770,384 bytes | Resource Timing API |
| `hand.glb` decodedBodySize | 11,770,384 bytes | Resource Timing API |
| เวลาดาวน์โหลด GLB (localhost) | 47 ms | Resource Timing `duration` |
| `domContentLoadedEventEnd` | 489 ms | Navigation Timing |
| bundle หลัง build | 1,237.67 kB (gzip 349.16 kB) | `vite build` |

### การตรวจสอบไขว้

`renderer.info.render.triangles` = **121,956**
เทียบกับการวิเคราะห์ GLB header แบบ static ตอน audit = **120,356** (mesh มือ + เล็บ 5 ชิ้น)
ส่วนต่าง ~1,600 สามเหลี่ยม = geometry ของ `Environment` และ `Lightformer`

→ **ตัวเลขสองวิธีสอดคล้องกัน** ยืนยันว่าการนับจาก GLB header ใน `docs/source-audit.md §1.3` ถูกต้อง

### ข้อสังเกตที่มีผลต่อแผนงาน

| ข้อสังเกต | ผล |
|---|---|
| `encodedBodySize == decodedBodySize` | ไฟล์ถูกส่งแบบ **ไม่บีบอัด** — คาดไว้แล้วเพราะ GLB มี JPEG/PNG ฝังในราว 6.37 MB ซึ่ง gzip แทบไม่ช่วย → ทางแก้จริงคือ **Draco (geometry) + KTX2 (texture)** ไม่ใช่ compression ระดับ HTTP |
| 121,956 tris ทุกเฟรม | ทั้งฉากถูกวาดใหม่ทุกเฟรมโดยไม่มีการ cull ที่มีความหมาย (มี mesh แค่ 6 ชิ้น) → **เป้าหมายของการ optimize อยู่ที่ราคาต่อสามเหลี่ยม ไม่ใช่จำนวน draw call** |
| draw calls = 11–12 จาก 6 mesh | ส่วนเกินมาจาก Environment/Lightformer → ไม่ใช่คอขวด ยังไม่ต้องทำ instancing/batching |
| bundle 349 kB (gzip) โดยยังไม่มีโค้ดแอป | ยืนยันความจำเป็นของ **code splitting** (Slice 8) — หน้า Home/Login/Community ไม่ควรโหลดก้อนนี้ |

### ตัวเลขที่ได้มาแต่ **ใช้ไม่ได้** (บันทึกไว้เพื่อความโปร่งใส)

| ตัวเลขที่อ่านได้ | ทำไมใช้ไม่ได้ |
|---|---|
| "เวลาโหลด GLB = 161,140 ms" | ตัวจับเวลาเริ่มตอน component ถูกสร้าง แต่แท็บถูกซ่อน (`document.hidden = true`) นาน ~161 วินาทีก่อน render loop จะกลับมาเดิน → **ตัวเลขนี้วัดระยะเวลาที่แท็บถูกซ่อน ไม่ใช่เวลาโหลด** ค่าที่ถูกต้องคือ 47 ms จาก Resource Timing |
| "FPS = 240" และ "FPS = 1" | อ่านได้สองค่าในเวลาไล่เลี่ยกัน เพราะ compositing ถูกพัก/ปลุกสลับกันเมื่อ Browser pane ถูกซ่อน/แสดง → `requestAnimationFrame` ไม่ได้เดินสม่ำเสมอ **fps และ frame time วัดในสภาพแวดล้อมนี้ไม่ได้** |

**สิ่งที่ต้องทำเพื่อวัด fps ให้ถูกต้อง**: เปิดในหน้าต่างเบราว์เซอร์ปกติที่แสดงผลค้างไว้
อย่างน้อย 30 วินาที เก็บ frame time ทุกเฟรมแล้วรายงาน median / p95 / p99
พร้อมล็อก `dpr` และขนาด viewport ให้คงที่ — จะทำใน Slice 1 (§ DoD "บันทึก baseline benchmark ครั้งแรก")

---

## M0b · Build tooling — Vite 7 (Rollup) เทียบ Vite 8 (Rolldown), TS 5.9 เทียบ TS 7

**วันที่วัด**: 2026-08-12 · **ที่มา**: [Spike S1b](spikes/S1b-ts7-vite8.md)
**สภาพแวดล้อม**: เหมือน M0 · โปรเจกต์เดียวกัน 3 ไฟล์ต้นทาง + type ของ React 19 / R3F v9 / drei v10 / three

### Build

| | Vite 7.3.6 (Rollup) | Vite 8.2.1 (Rolldown) | ส่วนต่าง |
|---|---|---|---|
| modules transformed | 589 | 568 | −21 |
| JS bundle | 1,237.67 kB | 1,216.10 kB | −21.57 kB (−1.7%) |
| JS bundle (gzip) | 349.16 kB | 339.31 kB | **−9.85 kB (−2.8%)** |
| เวลา build | 2.78 s | **399 ms** | **เร็วขึ้น ~7 เท่า** |

### Typecheck

วิธีวัด: `node node_modules/typescript/bin/tsc --noEmit` 3 รอบ รายงานค่ามัธยฐาน

| | median | รอบที่วัดได้ |
|---|---|---|
| TypeScript 5.9.3 | 1,039 ms | 1,027 · 1,039 · 1,150 |
| TypeScript 7.0.2 | **182 ms** | 182 · 170 · 186 |
| ส่วนต่าง | **เร็วขึ้น 5.7 เท่า** | |

**ข้อจำกัดของการวัดนี้**: โปรเจกต์มีไฟล์ต้นทางเพียง 3 ไฟล์ ส่วนต่างจึงมาจากการอ่าน
`.d.ts` ของไลบรารีเป็นหลัก ไม่ใช่การตรวจโค้ดของเราเอง
→ **ต้องวัดซ้ำใน Slice 2** เมื่อโปรเจกต์มีไฟล์ 100+ ไฟล์ จึงจะรู้ส่วนต่างที่แท้จริง

---

## M1 · Raycast — baseline เทียบ BVH เทียบ baked proxy

**วันที่วัด**: 2026-08-12 · **ที่มา**: [Spike S3](spikes/S3-bvh-skinnedmesh.md)

### สภาพแวดล้อม

| | |
|---|---|
| เหมือน M0 | + three-mesh-bvh 0.9.14 |
| เป้าหมาย | `Hand` (**SkinnedMesh 118,756 tris**) + เล็บ 5 ชิ้น (1,600 tris) |
| ชุดรังสี | 40 รังสีจาก PRNG seed 20260812 · **ชนจริง 22/40** |
| วิธี | warmup 5 รังสี → วัด 3 รอบ → รายงานค่ามัธยฐาน |

### ผล

| วิธี | ต่อรังสี | เทียบ baseline | **ความถูกต้อง** |
|---|---|---|---|
| A · `three.js` ปกติ (skin-aware) | **113,282 µs** | 1× | ค่าอ้างอิง |
| B · ใส่ `boundsTree` ให้ SkinnedMesh | 92,352 µs | 1.2× ⚠️ | 100% |
| **D · bake + static Mesh + BVH** | **7.5 µs** | **15,104×** | **100%** ✅ |
| F · แพตช์ `SkinnedMesh.prototype.raycast` | 2.5 µs | 45,313× | **22.5%** ❌ |

⚠️ **B ไม่ใช่ผลของ BVH** — 1.2× คือความแปรปรวนระหว่างรอบ BVH ไม่เคยถูกเรียกใช้เลย
เพราะ `SkinnedMesh.prototype` มีเมธอด `raycast` เป็นของตัวเองที่บดบัง `Mesh.prototype.raycast`

### ต้นทุนของทางที่เลือก (D)

| | |
|---|---|
| bake ตำแหน่งที่ skin แล้ว | 22.6 ms |
| สร้าง `MeshBVH` | 32.2 ms |
| **รวมต่อการเปลี่ยนท่าบอร์น 1 ครั้ง** | **54.8 ms** |
| หน่วยความจำ BVH | 1.04 MB |
| หน่วยความจำ position buffer | ~0.77 MB (64,074 verts × 3 × 4 bytes) |

### ข้อสรุปเชิงวิธีการ

**benchmark ที่วัดแค่เวลาจะเลือกทางผิด** — ทางเลือก F เร็วกว่าทางที่ถูกต้องถึง 3 เท่า
แต่ให้ผลผิด 77.5% ของรังสี ทุกตารางวัดผลในเอกสารนี้จึงต้องมีคอลัมน์ **"ความถูกต้อง"**
ควบคู่กับเวลาเสมอ

---

## งบหน่วยความจำของชั้นเท็กซ์เจอร์ (Slice 2)

ยังไม่ใช่การวัดจากเครื่องจริง แต่เป็น **เพดานที่คำนวณได้จากโค้ด** — บันทึกไว้เพราะ
เป็นตัวเลขที่ต้องเอาไปเทียบกับ heap snapshot จริงใน M2/M3

แคนวาส 1 ใบ = `TEX_SIZE² × 4 ไบต์` = 1024² × 4 = **4.19 MB**

| ส่วน | จำนวนใบ (เพดาน) | หน่วยความจำ |
|---|---|---|
| composite ของเล็บที่มองเห็น | 5 (มือเดียว — D-23) | 21 MB |
| แคนวาสเลเยอร์ (`MAX_LAYER_SURFACES`) | 12 | 50 MB |
| wet + scratch | 2 | 8 MB |
| **รวมสูงสุด** | 19 | **≈ 80 MB** |

การใช้งานจริงใน Slice 2 อยู่ที่ 5 composite + 5 เลเยอร์ + 2 = 12 ใบ ≈ **50 MB**
เพราะแต่ละเล็บมีเลเยอร์เดียว

ที่มาของการเลือก **12** (เดิม 18): จำนวนเล็บที่มองเห็นลดจาก 10 เหลือ 5 ตาม D-23
เพดานเดิมจึงกว้างเกินความจำเป็น ตัวเลขใหม่ยังเหลือที่ให้ Slice 3 เปิดหลายเลเยอร์
ต่อนิ้วได้ราวสองนิ้วเต็มเพดานโดยไม่ต้อง evict

> **ยังไม่ได้พิสูจน์**: ตัวเลขข้างบนมาจากการนับ ไม่ใช่จากการวัด heap จริง
> ต้องยืนยันด้วย M2/M3 ก่อนจะอ้างอิงเป็นข้อเท็จจริง

---

## รายการวัดที่ยังไม่ได้ทำ

อ้างอิง [algorithms.md §17](algorithms.md) — ยังไม่ได้วัดทั้งหมด 17 รายการ
เอกสารนี้จะถูกเติมตามลำดับต่อไปนี้:

| รหัส | การวัด | ทำใน |
|---|---|---|
| M1 | fps / frame time ที่ถูกต้อง ในหน้าต่างเบราว์เซอร์ปกติ | Slice 1 |
| M2 | เวลา rebuild เท็กซ์เจอร์ 1 เล็บ ที่ 1 / 6 เลเยอร์ | Slice 2 |
| M3 | เวลา commit stroke ที่ลำดับ 1 / 50 / 200 (พิสูจน์ A-04) | Slice 2 |
| M4 | heap: Command history vs snapshot (พิสูจน์ A-10) | Slice 3 |
| M5 | raycast latency: baseline / BVH / proxy mesh (A-08) | Slice 8 |
| M6 | เวลาสร้าง BVH + หน่วยความจำที่ใช้ | Slice 8 |
| M7 | เวลาโหลด GLB: ปัจจุบัน / Draco / Draco+KTX2 | Slice 8 |
| M8 | `EXPLAIN (ANALYZE, BUFFERS)` ของ Q1–Q13 หลัง seed 100,000 แถว | Slice 10 |
| M9 | recall@5: vector / lexical / RRF / keyword filter เดิม (A-18) | Slice 10 |
| M10 | accuracy ของ intent routing (A-19) | Slice 10 |
| M11 | อัตราผ่าน schema: Recipe 8 ฟิลด์ vs document เต็ม (D-22) | Slice 10 |
| M12 | การประเมินโดยมนุษย์ของกฎสี A-22 | Slice 10 |
| M13 | fps ใน VR บนแว่นจริง | Slice 9 |
| M14 | เวลา Argon2id hash บนเครื่อง deploy จริง | Slice 8 |

---

เอกสารต่อเนื่อง: [algorithms.md](algorithms.md) · [implementation-plan.md](implementation-plan.md) · [source-audit.md](source-audit.md)
