# Source Code Audit — NAIL STUDIO 3D

เอกสารนี้คือผลการตรวจสอบซอร์สต้นทางทั้งสองชุด **ก่อน** เริ่มเขียนโค้ดใด ๆ
ทุกข้อความในเอกสารนี้อ้างอิงจากการอ่านไฟล์จริง ตัวเลขที่เป็น "ค่าที่วัดได้" ระบุวิธีวัดไว้ด้วย
ค่าที่ยังไม่ได้วัดจะเขียนกำกับว่า `ยังไม่ได้วัด` เสมอ — ไม่มีการเดาตัวเลขประสิทธิภาพ

- วันที่ตรวจ: 2026-08-12
- ผู้ตรวจ: ทีมพัฒนา (audit ครั้งที่ 1)
- สถานะ repo ราก: ไม่ใช่ git repository (มีแต่ `Source/` และ `backup/`)

---

## 0. สรุปผู้บริหาร (Executive Summary)

| หัวข้อ | ข้อสรุป |
|---|---|
| `NailDesine-TEST` | เป็นระบบ 3D ที่**คุณภาพสูงเกินคาด** ไม่ใช่ prototype — มี TypeScript strict, unit test ครบเกือบทุกโมดูล, มีคอมเมนต์อธิบายเหตุผลเชิงวิศวกรรมละเอียด **ควรใช้เป็นแกนหลักของระบบ 3D** |
| `CEPP-KMITL-68-NailStudio/Frontend` | เป็นงาน UI/UX ที่สมบูรณ์ในระดับ mock — JavaScript ล้วน ไม่มี test ไม่มี backend จริง ระบบวาดเล็บเป็น **SVG 2 มิติ 100%** ต้องถอดทิ้งทั้งระบบตามโจทย์ |
| ทิศทาง | ยก **UI/UX/หน้าเว็บ/ธีม/นำทาง** จาก CEPP + ยก **เครื่องยนต์ 3D** จาก NailDesine-TEST + เขียน **backend/DB/persistence ใหม่ทั้งหมด** |
| ความเสี่ยงสูงสุด | (1) ไฟล์ `hand.glb` 11.7 MB ไม่บีบอัด (2) React 19 vs @react-three/fiber v8 เข้ากันไม่ได้ (3) undo/redo ปัจจุบันเป็น full snapshot ซึ่งขัดกับข้อกำหนดโครงงาน |

---

## 1. Source 1 — `Source/NailDesine-TEST`

### 1.1 เทคโนโลยีที่ใช้อยู่

อ่านจาก `package.json`, `vite.config.ts`, `tsconfig.json`:

```
Vite + React 18.3 + TypeScript (strict) + Three.js 0.185
@react-three/fiber 8.18   @react-three/drei 9.122
Zustand 5.0               Vitest 4 (environment: node)
```

- `tsconfig.json` เปิด `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — เข้มกว่ามาตรฐาน Vite template
- มี path alias `@/*` → `src/*`
- **ไม่มี** backend, ไม่มี router, ไม่มี TanStack Query — เป็น SPA หน้าเดียว (`DesignPage`)
- มี Python toolchain สำหรับสร้างโมเดล: `tools/build_model.py` (25 KB), `tools/verify_model.py` (23 KB), `tools/nail_unwrap.py`, `tools/preview_render.py` — ใช้ Blender pipeline สร้าง `hand.glb` และมี **ด่านตรวจโมเดลอัตโนมัติ**

> หมายเหตุเวอร์ชัน: `package.json` ระบุ `typescript ^7.0.2`, `vite ^8.1.5`, `vitest ^4.1.10` ซึ่งเป็นเวอร์ชันที่ใหม่มาก ต้องยืนยันความเข้ากันได้ตอน bootstrap โปรเจกต์จริง (ดู §5 ความเสี่ยง R-3)

### 1.2 สถาปัตยกรรม 3D ปัจจุบัน

```
src/
├── nail/      ← โดเมนล้วน ไม่พึ่ง React ไม่พึ่ง Three.js (ยกเว้น type)
│   ├── types.ts        นิยามข้อมูลกลาง (NailId, Stroke, Layer, Design)
│   ├── nailStore.ts    คลาส NailStore — สถานะงาน + undo/redo + pub/sub
│   ├── serialize.ts    สร้าง/แปลง/ตรวจไฟล์งาน (validation ละเอียดถึงระดับจุด)
│   ├── storage.ts      DesignStorage — persistence บน localStorage
│   ├── brush.ts        แปลงเส้น → dabs (จุดแต้มสี)
│   ├── rasterizer.ts   วาด dabs/stroke/layer ลง Canvas2D
│   ├── layers.ts       composite เลเยอร์ (blend mode)
│   ├── textures.ts     NailTextureSet — แคช/ประกอบเท็กซ์เจอร์ 5 เล็บ
│   ├── uvMapping.ts    แปลงพิกัด UV ↔ pixel ↔ client rect
│   ├── simplify.ts     ลดจำนวนจุดของเส้น (Douglas–Peucker)
│   └── hull.ts         convex hull ของ UV (Andrew monotone chain)
├── three/     ← ชั้นเชื่อม React ↔ Three.js
│   ├── Stage.tsx           <Canvas>, แสง, Environment, OrbitControls
│   ├── HandModel.tsx       โหลด GLB + จับ mesh เล็บ/ผิว/บอร์น
│   ├── PaintController.tsx raycast + pointer → ลงสีบนเล็บ
│   ├── NailFocus.tsx       เคลื่อนกล้องไปจ่อเล็บที่เลือก
│   ├── nailViews.ts        คำนวณ center/normal/radius ของเล็บในพิกัดโลก
│   ├── handProportions.ts  ปรับสัดส่วนมือผ่านบอร์น + refresh bounds
│   ├── handBones.ts        เก็บ reference บอร์น
│   ├── finishes.ts         preset วัสดุ (glossy/matte/chrome/glitter)
│   ├── NailMaterial.ts     สร้าง MeshPhysicalMaterial + canvas factory
│   └── useNailTextures.ts  ผูก NailTextureSet ↔ CanvasTexture ↔ material
├── ui/        ← แผงควบคุม (ColorPanel, LayerPanel, Toolbar, ...)
├── state/     ← uiStore (Zustand) — เฉพาะค่าตั้งค่า UI
├── shell/     ← SplitLayout
└── pages/     ← Design.tsx (405 บรรทัด — ใหญ่เกินไป ดู §1.6)
```

**การแยกความรับผิดชอบดีมาก**: `src/nail/` ทั้งโฟลเดอร์ไม่รู้จัก React และแทบไม่รู้จัก Three.js → ทดสอบด้วย Vitest ใน `environment: node` ได้ตรง ๆ (ใช้ `@napi-rs/canvas` แทน Canvas ของเบราว์เซอร์) นี่คือรูปแบบที่เราจะรักษาไว้และขยายต่อ

### 1.3 รูปแบบโมเดล 3D และค่าที่วัดได้จริง

**วิธีวัด**: อ่าน GLB header + JSON chunk ด้วยสคริปต์ PowerShell (`BinaryReader` → parse chunk 0) นับ `accessors[primitive.indices].count / 3`

ไฟล์: `public/models/hand.glb`

| รายการ | ค่าที่วัดได้ |
|---|---|
| ขนาดไฟล์ | **11,770,384 bytes (11.2 MiB)** |
| glTF version | 2.0 |
| `extensionsUsed` | **(ว่าง)** — ไม่มี Draco, ไม่มี meshopt, ไม่มี KTX2 |
| จำนวน mesh | 6 |
| `Hand_Mesh` | **118,756 triangles / 64,074 vertices** |
| `Nail_thumb` | 320 tris / 203 verts |
| `Nail_index` | **128 tris** / 81 verts |
| `Nail_middle` | 320 tris / 197 verts |
| `Nail_ring` | 512 tris / 289 verts |
| `Nail_little` | 320 tris / 201 verts |
| **รวม** | **120,356 triangles** |
| nodes / skins | 29 / 1 (มี skinning) |
| materials | 2 |
| textures ฝังในไฟล์ | jpeg 66 KB, jpeg 2.49 MB, jpeg 2.02 MB, png 1.80 MB → **รวม ~6.37 MB** |

**ข้อสรุปสำคัญจากตัวเลขนี้**

1. **98.7% ของสามเหลี่ยมทั้งหมดอยู่ที่ mesh มือ ไม่ใช่เล็บ** — เล็บทั้งห้ารวมกันแค่ 1,600 tris
2. mesh มือถูกใส่ใน raycast ในฐานะ *occluder* (`PaintController.tsx:49`) ทุกครั้งที่ pointer ขยับ → **การยิงรังสีแต่ละครั้งต้องตรวจ 118,756 สามเหลี่ยม** นี่คือจุดที่ BVH จะให้ผลจริง ไม่ใช่ที่เล็บ (ดู `docs/algorithms.md` A-08)
3. เท็กซ์เจอร์ 6.37 MB ฝังใน GLB แบบไม่บีบอัด GPU → ควรแปลงเป็น KTX2/Basis
4. ในโฟลเดอร์ `.worktrees/nail-3d-phase-0-2/public/models/hand.glb` มีไฟล์ขนาดเพียง **559 KB** ซึ่งเป็นโมเดลรุ่นก่อน — ยืนยันว่าความอ้วนมาจากรุ่นใหม่ที่เพิ่ม texture เข้าไป

### 1.4 อัลกอริทึมที่มีอยู่แล้ว (นำไปใช้ต่อได้)

| # | อัลกอริทึม | ไฟล์ | Time | หมายเหตุ |
|---|---|---|---|---|
| 1 | Andrew monotone chain (convex hull) | `nail/hull.ts` | O(n log n) | ใช้หาเส้นขอบเล็บใน UV space สำหรับ Canvas2D panel |
| 2 | Douglas–Peucker (แบบมี pressure weight) | `nail/simplify.ts` | O(n log n) เฉลี่ย / O(n²) worst | ลดจำนวนจุดก่อน commit เส้น — เวอร์ชันนี้**ดัดแปลงเอง** ให้ถ่วงน้ำหนักความต่างของแรงกดด้วย ไม่ใช่ระยะเรขาคณิตล้วน |
| 3 | Arc-length resampling (path → dabs) | `nail/brush.ts` | O(n + L/step) | เดินตามเส้นแล้วแต้มทุก `spacing × size` พิกเซล มี `carry` ข้ามช่วงเพื่อไม่ให้ระยะห่างเพี้ยนตรงหัวมุม |
| 4 | Incremental layer render (append-only) | `nail/textures.ts:190` | O(Δstrokes) | ถ้า array `strokes` เป็นตัวเดิมและยาวขึ้น → วาดเฉพาะเส้นใหม่ ไม่ replay ทั้งเลเยอร์ |
| 5 | Dirty-nail rebuild | `nail/nailStore.ts` + `textures.ts` | O(k) | `commit()` ส่งรายชื่อเล็บที่เปลี่ยนออกไป ไม่ rebuild ทั้ง 5 |
| 6 | LRU-ish surface eviction | `nail/textures.ts:216` | O(N log N) ต่อครั้ง | เก็บ `clock` เป็น logical timestamp แล้ว sort หา coldest — จุดที่ปรับได้ (ดู §1.6) |
| 7 | Rigid skin matrix folding | `three/nailViews.ts:52` | O(V) | เล็บผูกบอร์นเดียวเต็มน้ำหนัก → พับ skinning เหลือเมทริกซ์เดียวต่อเล็บ ไม่ต้องคิดทีละ vertex |
| 8 | Camera framing จาก fov | `three/nailViews.ts:26` | O(1) | `d = r / tan(fov/2) / fill` — สูตรจัดเฟรมให้เล็บกินจอตามสัดส่วนที่กำหนด |
| 9 | Normal-matrix averaging | `three/nailViews.ts:116` | O(V) | ใช้ normal matrix (ไม่ใช่ `transformDirection`) เพราะสเกลไม่เท่ากันทุกแกน |

### 1.5 ส่วนที่ **นำมาใช้ต่อได้ทันที** (reuse)

| โมดูล | เหตุผล |
|---|---|
| `nail/brush.ts`, `nail/rasterizer.ts`, `nail/layers.ts`, `nail/simplify.ts`, `nail/hull.ts`, `nail/uvMapping.ts` | pure function ล้วน มี unit test ครบ ไม่ผูกกับ React/Three — ย้ายเข้า `3d/geometry/` และ `3d/painting/` ได้ตรง ๆ |
| `nail/textures.ts` (`NailTextureSet`) | กลไกแคชเท็กซ์เจอร์ + wet-layer + dirty rebuild เป็นหัวใจของ performance ทั้งระบบ |
| `three/nailViews.ts`, `three/handProportions.ts`, `three/handBones.ts` | คณิตศาสตร์ skinning/กล้องที่แก้บั๊กมาแล้วหลายรอบ (มีคอมเมนต์อธิบายบั๊กเดิมไว้ครบ) เขียนใหม่มีแต่เสีย |
| `three/finishes.ts`, `three/NailMaterial.ts` | preset วัสดุ PBR ใช้ได้เลย ขยายเพิ่มได้ |
| `three/PaintController.tsx` | ตรรกะ raycast + pointer capture + guard ตอนวาด — reuse โครง แต่ refactor (ดู §1.7) |
| `tools/*.py` | pipeline สร้าง/ตรวจโมเดล มีค่ามาก เก็บไว้ทั้งชุด โดยเฉพาะ `verify_model.py` ที่บังคับ invariant "เล็บผูกบอร์นเดียว" ซึ่งโค้ด TypeScript พึ่งพาอยู่ |
| `nail/serialize.ts` (ตรรกะ validation) | ระดับความละเอียดของการตรวจไฟล์ดีมาก — แต่จะย้ายไปใช้ Zod ในแพ็กเกจ contracts ร่วมกับ backend |

### 1.6 ปัญหาประสิทธิภาพ & หนี้ทางเทคนิค (technical debt)

| รหัส | ปัญหา | ตำแหน่ง | ผลกระทบ | แนวทาง |
|---|---|---|---|---|
| **TD-1** | **Undo/Redo ใช้ `structuredClone` ของ `Design` ทั้งก้อนทุก commit** | `nailStore.ts:182` | ทุกการลากเส้น 1 เส้น = clone ข้อมูลเล็บทั้ง 5 นิ้ว × 6 เลเยอร์ × ทุก stroke ที่เคยวาด ยิ่งวาดมากยิ่งช้าแบบ O(total strokes) ต่อการกระทำ 1 ครั้ง และ `MAX_HISTORY = 50` ทำให้ heap โตแบบ O(50 × ขนาดงาน) | **เขียนใหม่เป็น Command Pattern (delta-based)** — ข้อกำหนดบังคับของโครงงาน |
| **TD-2** | ไม่มี BVH — raycast ตรวจ 118,756 tris ของ mesh มือทุก pointermove | `PaintController.tsx:49` | **วัดแล้ว: ~113 ms ต่อรังสีหนึ่งครั้ง** ([Spike S3](spikes/S3-bvh-skinnedmesh.md)) — `Raycaster.intersectObjects` ไม่มี early-out จึงไล่ทุกสามเหลี่ยมของมือทุกครั้งเสมอ **การลากเส้นในซอร์สเดิมน่าจะหน่วงระดับ 100 ms ต่อการขยับนิ้วหนึ่งครั้ง** (ต้องยืนยันซ้ำในแอปจริงที่ Slice 2) | **baked raycast proxy + BVH** (D-06) — ไม่ใช่การใส่ BVH ให้ SkinnedMesh ตรง ๆ ซึ่งพิสูจน์แล้วว่าไม่ทำงาน |
| **TD-3** | GLB 11.2 MB ไม่บีบอัด, texture 6.37 MB ฝังใน | `public/models/hand.glb` | เวลาโหลดครั้งแรก (ยังไม่ได้วัด) | Draco/meshopt + KTX2, ย้ายไป object storage |
| **TD-4** | `pages/Design.tsx` 405 บรรทัด ทำ 8 หน้าที่ในไฟล์เดียว (session, error boundary, WebGL detect, proportions effect, rAF poll, layout, sidebar) | `pages/Design.tsx` | แก้ยาก ทดสอบยาก ขัด SRP | แตกเป็น hooks + components |
| **TD-5** | rAF polling loop ที่เรียก `bumpRevision()` เพื่อชดเชยกรณี pointercancel | `Design.tsx:216-231` | มี `requestAnimationFrame` วนตลอดเวลาแม้ไม่ได้ทำอะไร + ตรรกะเทียบ revision ซับซ้อนมาก (คอมเมนต์อธิบาย 15 บรรทัด) | แก้ที่ต้นเหตุ: ให้ controller ยิง event `strokeEnd` ตรง ๆ ทั้ง commit และ cancel |
| **TD-6** | `evictColdSurfaces()` sort ทุกครั้งที่ cache เกินเพดาน | `textures.ts:218` | O(N log N) โดยที่ N = 5 (เล็บ) → ในทางปฏิบัติไม่เป็นปัญหา **แต่** เมื่อขยายเป็น 10 เล็บ + decoration textures ต้องทบทวน | เปลี่ยนเป็น min-heap หรือ clock algorithm ถ้าวัดแล้วเป็นคอขวด — **ห้ามเปลี่ยนก่อนวัด** |
| **TD-7** | รองรับแค่ **5 เล็บ (มือเดียว)** — `NAIL_IDS` มี 5 ค่า | `nail/types.ts:1` | โจทย์ต้องการ **10 เล็บ** | ขยายเป็น `hand: 'left'\|'right'` × 5 นิ้ว |
| **TD-8** | persistence อยู่บน `localStorage` เท่านั้น มี `StorageFullError` เป็นสัญญาณว่าชนเพดานจริง | `nail/storage.ts` | ไม่มี multi-device, ไม่มีบัญชีผู้ใช้ | ย้ายไป REST API + PostgreSQL (คงไว้เป็น offline draft cache) |
| **TD-9** | `console.log('เล็บที่จับได้:', ...)` ค้างอยู่ใน production path | `Design.tsx:234` | log รก | ลบ |
| **TD-10** | ไม่มี **decoration/สติกเกอร์/อัญมณีแบบ 3D** — `Gem` มีใน type แต่ไม่มีโค้ดเรนเดอร์เลย | `types.ts:66` (`Gem`), `MAX_GEMS` | ฟีเจอร์หลักตามโจทย์ยังไม่มี | สร้างระบบ decoration ใหม่ (instanced mesh + transform gizmo) |
| **TD-11** | ไม่มีระบบ "ทรงเล็บ/ความยาว" ทำงานจริง — `NailDesign.length` มีในไทป์ แต่ `parseDesign` มีบรรทัด `delete nail.shape` ระบุว่า "ถอดระบบทรงเล็บออกแล้ว" | `serialize.ts:141` | CEPP มี UI ทรงเล็บ 5 แบบ + ความยาว 4 ระดับ ที่ผู้ใช้คาดหวัง | ออกแบบใหม่ด้วย morph target หรือ geometry variant |
| **TD-12** | `.env` ถูก commit เข้ามาในโฟลเดอร์ซอร์ส | `NailDesine-TEST/.env` | ความเสี่ยงด้านความปลอดภัย | โปรเจกต์ใหม่ใช้ `.env.example` + `.gitignore` เท่านั้น |
| **TD-13** | `.worktrees/` มีโค้ดซ้ำ 2 ชุด + ไฟล์ diff รวมกันหลาย MB + `playwright-report/index.html` 522 KB + `__pycache__/` | ทั้งโฟลเดอร์ | ทำให้ repo อ้วนและสับสน | ไม่ยกมาที่โปรเจกต์ใหม่ |

### 1.7 ส่วนที่ควร refactor / rewrite / remove

| การกระทำ | รายการ |
|---|---|
| **Reuse ตามเดิม** | `brush.ts`, `rasterizer.ts`, `layers.ts`, `simplify.ts`, `hull.ts`, `uvMapping.ts`, `finishes.ts`, `handBones.ts`, `handProportions.ts`, `nailViews.ts`, `tools/*.py` |
| **Refactor** | `textures.ts` (ขยายเป็น 10 เล็บ + แยก cache policy ออกมา), `PaintController.tsx` (แยก raycast service ออกจาก event binding), `HandModel.tsx` (แยก loader + parts registry), `Stage.tsx` (แยก lighting preset ออกเป็น config) |
| **Rewrite** | `nailStore.ts` → Command Pattern + Zustand slices, `Design.tsx` → แตกเป็น `EditorPage` + hooks, `storage.ts` → repository ฝั่ง client ที่คุยกับ TanStack Query, `serialize.ts` → Zod schema ใน `packages/contracts` |
| **Remove** | `.worktrees/` ทั้งหมด, `__pycache__/`, `.env`, `console.log`, `public/models/preview_*.png` (10 ไฟล์ ~6 MB ใช้แค่ตอน dev), `.superpowers/` |

---

## 2. Source 2 — `Source/CEPP-KMITL-68-NailStudio/Frontend`

### 2.1 เทคโนโลยีที่ใช้อยู่

```
Vite 7 + React 19.2 + react-router-dom 7.17 + Tailwind CSS 4.3 (@tailwindcss/vite)
JavaScript ล้วน (.jsx) — ไม่มี TypeScript
ESLint 9 — ไม่มี test runner, ไม่มี test แม้แต่ไฟล์เดียว
```

โฟลเดอร์พี่น้อง (นอกขอบเขตงานนี้แต่บอกเจตนาของระบบเดิม): `AI_CHAT_BOT/` (Flask + RAG), `AI_JSON_Generation/` (FastAPI + Ollama), `BACKEND/` (Express 230 บรรทัดไฟล์เดียว), `vLLM/`

### 2.2 โครงหน้าเว็บและการนำทาง

จาก `App.jsx`:

| Route | ไฟล์ | ขนาด | สถานะ |
|---|---|---|---|
| `/` | `Pages/Home.jsx` | 228 B | **stub** |
| `/design-studio` | `Pages/DesignStudio.jsx` | 1.1 KB | ทำงานจริง (2D) |
| `/ai-recommend` | `Pages/AIRecommend.jsx` | 3.5 KB | ทำงานจริง (mock data) |
| `/community` | `Pages/Community.jsx` | 197 B | **stub** |
| `/vr-preview` | `Pages/VRPreview.jsx` | 193 B | **stub** |
| `/login` `/signup` `/forgot-password` | 2.2 / 6.3 / 2.2 KB | | ทำงานจริง (mock auth) |
| `/profile` | `Pages/Profile.jsx` + 14 components | 521 B + ~30 KB | ทำงานจริง (mock data) |

Layout ราก: `h-screen flex flex-col overflow-hidden` + `Navbar` sticky + พื้นหลัง `#f8f4ec`

### 2.3 Design language (ต้องรักษาไว้)

| องค์ประกอบ | ค่า |
|---|---|
| ฟอนต์ | **Pridi** (Google Fonts) — โหลดผ่าน `<link>` ใน `Navbar.jsx` (ต้องย้ายไป `index.html` หรือ self-host) |
| พื้นหลังหลัก | `#f8f4ec` (ครีม) |
| เส้นขอบ navbar | `#b18d88` |
| สีเน้น/active | `#b5314c` (แดงเชอร์รี) |
| พื้น hover / active chip | `#e8ddd0` |
| แถบหัว Design Studio | `#6b1e2b` (แดงเข้ม) |
| พื้น Design Studio | `bg-orange-50` |
| ข้อความปกติ | `#3a3a3a` |

### 2.4 ระบบ 2D ที่ **ต้องลบทิ้งทั้งหมด**

| ไฟล์ | ขนาด | เหตุผลที่ต้องลบ |
|---|---|---|
| `DesignStudio/DesignCanvas.jsx` | 26 KB | วาด Hand-SVG เป็นภาพพื้นหลังแล้วซ้อนทรงเล็บ SVG ทับตาม `FINGER_ANCHORS` — ผูกกับพิกัด 2 มิติ 100% (คอมเมนต์ในไฟล์ยอมรับเองว่า "โหมด 3D ยังเป็น placeholder") |
| `DesignStudio/data/nailShapePaths.js` | 10.9 KB | SVG path ของทรงเล็บ 5 แบบ + ระบบยืด 3 ช่วง — เป็น 2D ล้วน |
| `DesignStudio/data/designStudioData.js` | 7.8 KB | `FINGER_ANCHORS` (x/y/rotation บนพิกัด SVG 59.5×67.3), `HAND_SVG_VIEWBOX` |
| `img/Nail-Shape-SVG/*.svg` | 6 ไฟล์ | ภาพมือ + ทรงเล็บ 2D |
| `DesignStudio/components/NailArtworkContent.jsx` | 10.6 KB | เรนเดอร์เลเยอร์ลงใน `<svg>` |
| `DesignStudio/components/ItemDragHitLayer.jsx` | 9.5 KB | ลากของตกแต่งด้วยพิกัดหน้าจอ 2D |
| `DesignStudio/components/PenPanel.jsx` + `PenStrokes.jsx` + `data/penStrokes.js` | 15.4 KB | ระบบวาดเส้นแบบ SVG path |
| `state/designStudioReducer.js` | 17.2 KB | **ตรรกะโดเมนดี แต่ผูกกับโครงข้อมูล 2D** (ดู §2.6) |
| `img/ShapeNail*.png` | 5 ไฟล์ ~330 KB | ภาพพรีวิวทรงเล็บ 2D |

### 2.5 ส่วนที่ **นำมาใช้ต่อได้** (reuse / adapt)

| กลุ่ม | ไฟล์ | การจัดการ |
|---|---|---|
| **Navigation** | `Navbar.jsx`, `Auth/components/NavbarAuthSection.jsx`, `AccountMenu.jsx`, `AccountPill.jsx`, `NotificationBell.jsx` | แปลงเป็น `.tsx` ใช้ต่อได้เกือบทั้งหมด |
| **UI primitives** | `UI/Dropdown.jsx`, `Modal.jsx`, `SegmentedToggle.jsx`, `SimpleDropdown.jsx`, `SwatchDropdown.jsx`, `Toggle.jsx`, `IconPlaceholder.jsx` | แปลงเป็น TSX + เพิ่ม type props → กลายเป็น design system ของโปรเจกต์ |
| **Auth UI** | `AuthLayout.jsx`, `AuthTabs.jsx`, `PasswordField.jsx`, `PolicyCheckbox.jsx`, `SocialLoginRow.jsx`, `Submit.jsx` + `Pages/Login.jsx`, `Signup.jsx`, `ForgotPassword.jsx` | **UI ใช้ต่อ / ตรรกะเขียนใหม่** — ปัจจุบัน `AuthProvider.jsx` เก็บรหัสผ่านเป็น plaintext ใน array (`accountsData.js`) และเก็บ user ใน `localStorage` ซึ่งใช้ใน production ไม่ได้เด็ดขาด |
| **Profile** | `Profile/components/*` (14 ไฟล์) + `ProfileHeader`, `DesignCard`, `DesignGrid`, `ReviewCard`, `StarRating`, filter dropdowns ทั้ง 3 ตัว | ใช้ต่อได้ทั้งชุด เปลี่ยนแค่แหล่งข้อมูลจาก mock → TanStack Query |
| **AI Recommend** | `AIRecommend/components/RecommendationCard.jsx`, `RecommendationSection.jsx` | ใช้ต่อเป็นหน้า catalog/แรงบันดาลใจ (ตัดส่วน AI ออกได้ถ้าไม่อยู่ในขอบเขต) |
| **Panel shell** | `DesignStudio/ToolPanel.jsx`, `LayerPanel.jsx`, `components/SidePopover.jsx`, `ColorPickerPopup.jsx`, `LayerRow.jsx`, `ItemLibraryPopup.jsx`, `LibraryPreview.jsx` | **โครง UI ใช้ต่อ เนื้อในต่อกับ 3D store ใหม่** — layout 3 คอลัมน์ (ToolPanel / Canvas / LayerPanel) คือ UX ที่โจทย์ต้องการ |
| **Data catalog** | `data/decorationLibrary.js`, `designLibraries.js`, `presetPalettes.js` | ย้ายเนื้อหาเข้า **ตาราง catalog ใน PostgreSQL** (decoration items, palettes) |
| **Assets** | `img/*.png` ไอคอน ~40 ไฟล์ | ใช้ต่อ แต่ต้อง optimize — ไอคอนหลายตัวใหญ่เกินเหตุ เช่น `ProfileIcon.png` **304 KB**, `BG.png` 161 KB, `CopyIcon.png` 111 KB สำหรับไอคอนขนาดจิ๋ว → แปลงเป็น SVG หรือ WebP |
| **Shortcuts** | `state/useDesignStudioShortcuts.js` | ตรรกะคีย์ลัด (Ctrl+Z/Y/C/V) ใช้ต่อได้ ต่อกับ command history ใหม่ |

### 2.6 แนวคิดจาก `designStudioReducer.js` ที่ควร "ยกความคิด ไม่ยกโค้ด"

ไฟล์นี้เป็น **โค้ดที่ออกแบบมาดี** แม้จะเป็น JS และผูกกับ 2D — แนวคิดที่ควรยกไปใช้ในระบบ 3D:

1. **แยก `coreLayersReducer` (pure, รู้แค่ layer map) ออกจาก `designStudioReducer` (รู้ selection/clipboard/history)** → ตรงกับหลัก SRP ที่โจทย์ต้องการ
2. **`SINGLETON_LAYER_KINDS`** — บาง layer มีได้ชิ้นเดียวต่อเล็บ (สีพื้น, ลาย geometry) การ paste ต้อง "ทับ" ไม่ใช่ "ต่อท้าย"
3. **`UNDOABLE_ACTION_TYPES`** — การเลือกนิ้ว/copy ไม่ควรเข้า history (UX ถูกต้อง) เราจะใช้หลักเดียวกันกับ Command Pattern
4. **`selectedFingers` เป็น `Set`** + `getPrimarySelectedFinger` = ตัวสุดท้ายที่ `.add()` → **เลือกหลายนิ้วพร้อมกันแล้วสั่งงานทีเดียว** เป็น UX ที่ดีมากและต้องคงไว้ในเวอร์ชัน 3D
5. **`activeSide: "Left" | "Right"`** — CEPP รองรับสองมือ (10 เล็บ) อยู่แล้ว ในขณะที่ NailDesine-TEST รองรับแค่ 5 → **โครงข้อมูล 10 เล็บให้ยึดตาม CEPP**
6. **`APPLY_TO_ALL_FINGERS`** ตรงกับ `copyToAllNails()` ของ NailDesine-TEST → รวมเป็นคำสั่งเดียว

### 2.7 หนี้ทางเทคนิคของ CEPP Frontend

| รหัส | ปัญหา | ผลกระทบ |
|---|---|---|
| **CD-1** | `App.jsx` import `"./pages/Home"` แต่โฟลเดอร์จริงชื่อ `Pages/` | ทำงานได้บน Windows/macOS (case-insensitive) แต่ **build พังบน Linux/Docker** — ความเสี่ยง deployment โดยตรง |
| **CD-2** | รหัสผ่านเก็บเป็น plaintext ใน `accountsData.js` และ login เทียบสตริงตรง ๆ | ไม่มี security เลย ต้องเขียนใหม่ทั้งหมดฝั่ง server |
| **CD-3** | `<link href="fonts.googleapis.com">` และ `<title>`/`<link rel=icon>` อยู่ใน component | render-blocking ซ้ำทุกครั้งที่ Navbar mount; ควรอยู่ใน `index.html` |
| **CD-4** | inline `onMouseEnter`/`onMouseLeave` แก้ `style` โดยตรง (Navbar) ทั้งที่ใช้ Tailwind อยู่ | ขัดกับ design system, ทำ dark mode/ธีมไม่ได้ |
| **CD-5** | ไม่มี TypeScript, ไม่มี test แม้แต่ไฟล์เดียว | ขัดข้อกำหนดโครงงานโดยตรง |
| **CD-6** | `createLayerId()` ใช้ counter ในหน่วยความจำ (`nextLayerId = 1000`) | id ชนกันทันทีเมื่อโหลดงานที่บันทึกไว้กลับมา — ต้องใช้ UUID |
| **CD-7** | `package-lock.json` 123 KB แต่ `node_modules` ไม่ได้ commit — ปกติ; แต่ `img/test.png` 133 KB เป็นไฟล์ขยะ | ทำความสะอาด |
| **CD-8** | `/community`, `/vr-preview`, `/` เป็น stub | ต้องตัดสินใจว่าอยู่ในขอบเขตหรือไม่ (ดู §6 สมมติฐาน A-4) |

---

## 2B. Source 3 — บริการ AI ที่มีอยู่ (อยู่ในขอบเขต — ยืนยันแล้ว 2026-08-12)

ผู้ใช้ยืนยันแล้วว่า **AI Recommend, AI จริง (chatbot/LLM) และ Community อยู่ในขอบเขต**
จึงตรวจซอร์สสามโฟลเดอร์นี้เพิ่ม (แก้สมมติฐาน A-3/A-4 เดิมที่ผมตั้งไว้ผิด)

### 2B.1 `AI_CHAT_BOT/` — แชตบอตแบบ RAG

```
Flask + flask-cors + python-dotenv + requests
Ollama (local LLM)  model: scb10x/llama3.1-typhoon2-8b-instruct  ← โมเดลไทย
PostgreSQL + pgvector  (embedding 384 มิติ)
```

| ไฟล์ | หน้าที่ |
|---|---|
| `app.py` (2.9 KB) | 4 endpoint: `/api/session/create`, `/api/chat`, `/api/knowledge/add`, `/api/history/<id>` |
| `knowledge.py` (2.5 KB) | เพิ่ม/ค้นหาความรู้ด้วย vector similarity |
| `message_service.py` | บันทึก/ดึงข้อความล่าสุด |
| `session_service.py` | สร้าง session |
| `db.py` | การเชื่อมต่อ |
| `SQL.sql` | schema: `users`, `chat_sessions_ai`, `messages_ai`, `knowledge` |

**สถาปัตยกรรม RAG ที่ใช้อยู่** (อ่านจาก `app.py:46-111`)

```
ข้อความผู้ใช้
  → save_message()
  → search_knowledge()  ค้นความรู้ที่ใกล้เคียงด้วย pgvector
  → fetch_recent_messages()  ประวัติแชต
  → ประกอบ prompt (system + KNOWLEDGE + CHAT HISTORY + User)
  → Ollama /api/generate (stream: false)
  → save_message() + ตอบกลับ
```

**สิ่งที่นำมาใช้ต่อได้**

- **แนวคิด RAG ทั้งหมด** — ประกอบ prompt จาก knowledge + history เป็นรูปแบบที่ถูกต้อง
- **schema `knowledge` ที่ใช้ `vector(384)`** — ย้ายเข้า PostgreSQL หลักของเราได้เลย (pgvector)
- **การเลือกโมเดล `typhoon2-8b-instruct`** — เป็นโมเดลที่ปรับสำหรับภาษาไทยโดยเฉพาะ ตรงกับ UI ภาษาไทย
- Prompt template (ต้องปรับให้เข้มขึ้น)

**หนี้ทางเทคนิค**

| รหัส | ปัญหา | ผลกระทบ |
|---|---|---|
| **AD-1** | ไม่มี auth เลยทุก endpoint — ส่ง `user_id` มาใน body ตรง ๆ | ใครก็อ่านประวัติแชตของคนอื่นได้ด้วยการเดา `session_id` |
| **AD-2** | `/api/knowledge/add` เปิดสาธารณะ | ใครก็ยัดความรู้ปลอมเข้าฐาน RAG ได้ → **prompt injection ถาวร** |
| **AD-3** | ไม่มีการ validate input (ตรวจแค่ว่ามีค่าหรือไม่) | ข้อความยาวไม่จำกัด → ต้นทุน token / DoS |
| **AD-4** | `timeout=300` วินาที และ `stream: False` | ผู้ใช้รอหน้าค้างได้ 5 นาที ไม่มี feedback |
| **AD-5** | `app.run(debug=True)` | ถ้าหลุดขึ้น production = เปิด Werkzeug debugger = **รันโค้ดจากระยะไกลได้** |
| **AD-6** | ไม่มีการป้องกัน prompt injection จากข้อความผู้ใช้ | ผู้ใช้สั่งบอทให้ทำนอกขอบเขตได้ |
| **AD-7** | ไม่มี rate limit | LLM เป็นทรัพยากรแพงที่สุดในระบบ |
| **AD-8** | ตาราง `users` ซ้ำกับระบบหลัก (`BIGSERIAL` คนละชนิดกับ `uuid` ของเรา) | ต้องรวมเป็นตารางเดียว |

### 2B.2 `AI_JSON_Generation/` — สร้างดีไซน์จากข้อความ

```
FastAPI + Pydantic + requests + Ollama
```

| ไฟล์ | หน้าที่ |
|---|---|
| `app/main.py` | FastAPI app |
| `app/routes/ai_routes.py` | endpoint สร้าง JSON |
| `app/routes/design_routes.py` | endpoint ดีไซน์ |
| `app/services/ollama_service.py` | ประกอบ prompt + เรียก Ollama + `clean_json()` |
| `app/schemas/nail_design_schema.py` | **Pydantic schema ของดีไซน์เล็บ** |

**การค้นพบที่สำคัญที่สุดของการตรวจครั้งนี้**

schema ที่ระบบนี้ให้ LLM สร้าง **ใกล้เคียงกับ `DesignDocument` ที่เราออกแบบไว้มาก**:

```python
Nail: fingerIndex(0-4), shape, length, baseColor, finish,
      patterns[{type, colors}], materials{glitter},
      assets[{type, name, x, y, size, rotation, layer, opacity}]
```

เทียบกับของเรา: `shape`, `length`, `finish`, `baseColor`, `layers[]`, `decorations[{uv, rotation, scale}]`

→ **ของตกแต่งเก็บเป็น `x, y ∈ [0,1]` ซึ่งก็คือพิกัด UV** — ตรงกับ DECISION D-10 ที่เราตัดสินใจไว้พอดี
→ **ทำให้ "ให้ AI สร้างดีไซน์แล้วเปิดใน 3D editor ได้ทันที" เป็นไปได้จริง** ไม่ใช่แค่แนวคิด

**สิ่งที่ต้องแก้**

| รหัส | ปัญหา | แนวทาง |
|---|---|---|
| **AD-9** | `fingerIndex: 0-4` — **5 เล็บ** | ขยายเป็น `nailKey: "left.thumb" \| ... ` 10 ค่า |
| **AD-10** | `shape`, `length`, `finish`, `type` เป็น `str` อิสระ | เปลี่ยนเป็น enum ที่ปิดรายการ — ไม่งั้น LLM แต่ง `"shape": "unicorn"` มาแล้วระบบพัง |
| **AD-11** | `asset_id`/`name` ไม่ผูกกับคลังจริง | ต้อง validate กับตาราง `decoration_items` และ **ปฏิเสธ id ที่ไม่มีจริง** |
| **AD-12** | `clean_json()` ใช้ regex ลบ ```` ```json ```` แล้ว `json.loads` ถ้าพังคืน `{"error": ...}` | เปลี่ยนเป็นวงจร validate + repair (ดู `algorithms.md` A-17) |
| **AD-13** | schema ใน prompt กับ Pydantic model **ไม่ตรงกัน** (`asset_id` vs `name`) | ต้องสร้าง prompt จาก schema เดียว ไม่เขียนซ้ำสองที่ |

### 2B.3 `BACKEND/index.js` + `vLLM/`

- `BACKEND/index.js` (230 บรรทัด) — Express ไฟล์เดียว ทำทุกอย่าง → **ถูกแทนที่ด้วย `apps/api` ทั้งหมด**
- `vLLM/Readme.md` (200 B) — เป็นแค่บันทึก ไม่มีโค้ด → ไม่มีอะไรให้ยกมา

### 2B.4 `AIRecommend` ฝั่ง frontend

`Pages/AIRecommend.jsx` (3.5 KB) + `RecommendationCard.jsx` + `RecommendationSection.jsx`
+ `data/recommendationData.js` (3.7 KB, mock)

→ **UI ใช้ต่อได้ทั้งหมด** เปลี่ยนแค่แหล่งข้อมูลจาก mock เป็น API

### 2B.5 สรุปการตัดสินใจสำหรับส่วน AI

| หัวข้อ | การตัดสินใจ |
|---|---|
| ภาษา/รันไทม์ | **คงเป็น Python แยก service** ไม่พอร์ตเป็น TypeScript |
| ทำไม | RAG/embedding/LLM มี ecosystem ที่โตเต็มที่ใน Python; การเขียนใหม่เป็น TS ไม่ให้ประโยชน์ใดนอกจากความเป็นเอกภาพของภาษา และเสียเวลาไปกับปัญหาที่แก้แล้ว |
| ทางเลือกที่ปฏิเสธ | (ก) พอร์ตเป็น TS ทั้งหมด (ข) เรียก Ollama จาก Express ตรง ๆ |
| ทำไมไม่เลือก | (ก) ต้นทุนสูงประโยชน์ต่ำ (ข) ทำได้ แต่จะเสีย pgvector client/embedding pipeline ที่มีอยู่ และผูก event loop ของ API เข้ากับ request ที่ใช้เวลาเป็นนาที |
| การรวม 2 service | **รวม `AI_CHAT_BOT` + `AI_JSON_Generation` เป็น service เดียว** (`apps/ai`, FastAPI) เพราะทั้งคู่คุย Ollama เหมือนกัน ต่างกันแค่ prompt — ปัจจุบันแยกกันโดยไม่มีเหตุผลทางเทคนิค (ตัว `AI_CHAT_BOT` ยังใช้ Flask ส่วนอีกตัวใช้ FastAPI) |
| การเข้าถึง | **frontend ไม่คุยกับ AI service โดยตรง** — ต้องผ่าน `apps/api` เสมอ เพื่อให้ auth/rate limit/audit อยู่ที่เดียว และไม่เปิด Ollama สู่อินเทอร์เน็ต |
| ฐานข้อมูล | ใช้ PostgreSQL **ก้อนเดียวกัน** + pgvector (ไม่แยก DB) |

---

## 3. ตารางเปรียบเทียบสองซอร์ส

| มิติ | NailDesine-TEST | CEPP Frontend | ผู้ชนะ → ระบบใหม่ |
|---|---|---|---|
| ภาษา | TypeScript strict | JavaScript | **NailDesine** |
| 3D | R3F + Three.js จริง | placeholder | **NailDesine** |
| จำนวนเล็บ | 5 (มือเดียว) | 10 (2 มือ) | **CEPP** |
| UI/UX | ใช้งานได้แต่เป็น dev tool | สมบูรณ์ตาม Figma | **CEPP** |
| Routing / หลายหน้า | ไม่มี | react-router 7 | **CEPP** |
| Auth | ไม่มี | mock (ไม่ปลอดภัย) | **เขียนใหม่** |
| Persistence | localStorage + validation ดี | localStorage + mock | **เขียนใหม่ (PostgreSQL)** |
| Undo/Redo | snapshot ทั้งก้อน | snapshot ทั้ง layer map | **เขียนใหม่ (Command)** |
| เลือกหลายนิ้ว | ไม่มี | มี (`Set`) | **CEPP** |
| Layer system | strokes + blend + opacity | layer kinds (baseColor/glitter/decoration/...) | **ผสม** — เอาโครง kind ของ CEPP มาใช้กับ raster ของ NailDesine |
| Decoration 3D | มีแต่ type ไม่มีโค้ด | 2D image overlay | **สร้างใหม่** |
| Test | Vitest ครบเกือบทุกโมดูล | ไม่มี | **NailDesine** |
| Build tooling | Vite + Python model pipeline | Vite + Tailwind | **ผสม** |

---

## 4. สิ่งที่ "ยังไม่มีเลย" และต้องสร้างใหม่ทั้งหมด

1. **Backend** — Node.js + Express + TypeScript แบบ layered (route → controller → service → repository)
2. **ฐานข้อมูล** — PostgreSQL + Prisma (มีต้นแบบใน `.worktrees/full-stack-nail-studio/prisma/schema.prisma` ให้ศึกษา แต่ schema แค่ 4 ตารางและเก็บงานทั้งหมดเป็น JSONB ก้อนเดียว ยังไม่พอกับโจทย์)
3. **Object storage abstraction** — สลับ local disk ↔ S3-compatible ได้
4. **Authentication/Authorization จริง** — argon2id + session cookie httpOnly + CSRF
5. **TanStack Query layer** — แยก server state ออกจาก client state
6. **Command Pattern history**
7. **ระบบ decoration 3D** (วาง/หมุน/ย่อขยายบนผิวเล็บ)
8. **ระบบ 10 เล็บ** (สองมือ)
9. **BVH acceleration + Web Worker**
10. **E2E test (Playwright)** — มีต้นแบบใน worktree แต่ต้องเขียนใหม่ให้ตรงกับ flow ใหม่
11. **เอกสารทั้งหมด** (ที่กำลังเขียนอยู่นี้)
12. **AI service ที่ปลอดภัย** — ซอร์สเดิมมีตรรกะ RAG/generation ที่ใช้ได้ แต่ **ไม่มี auth,
    ไม่มี validation, ไม่มี rate limit, เปิด debug mode** ต้องเขียนชั้นความปลอดภัยใหม่ทั้งหมด
13. **วงจร validate-repair ของ JSON จาก LLM** — ซอร์สเดิมยอมแพ้ทันทีที่ parse ไม่ผ่าน
14. **Community ทั้งระบบ** — หน้าเดิมเป็น stub 197 bytes ไม่มีอะไรให้ยกมาเลย
15. **pipeline generate schema ข้ามภาษา** (Zod → JSON Schema → Pydantic → prompt)

---

## 5. ความเสี่ยงทางเทคนิค

| รหัส | ความเสี่ยง | ระดับ | หลักฐาน | แผนรับมือ |
|---|---|---|---|---|
| ~~R-1~~ | ~~React 19 ใช้กับ R3F 8.18 ไม่ได้~~ | ✅ **ปิดแล้ว 2026-08-12** | [Spike S1](spikes/S1-react19-r3f9.md) | ใช้ **React 19.2.8 + R3F 9.7.0 + drei 10.7.8 + three 0.185.1** — ทดสอบแล้วว่า typecheck/build/WebGL2 context ภายใต้ StrictMode/โหลด GLB/traverse เจอเล็บครบ 5 ชิ้น ทำงานได้จริงทั้งหมด |
| **R-2** | GLB 11.2 MB ทำให้เปิด editor ครั้งแรกช้ามาก โดยเฉพาะบนมือถือ/เน็ตช้า | **สูง** | วัดได้จริง §1.3 | Draco/meshopt + KTX2 + progressive loading + วัดก่อน/หลัง (Phase 11) |
| ~~R-3~~ | ~~`typescript ^7.0.2` / `vite ^8.1.5` อาจไม่เสถียร~~ | ✅ **ปิดฝั่ง frontend 2026-08-12** | [Spike S1b](spikes/S1b-ts7-vite8.md) — เมทริกซ์ 3 แบบผ่านหมด | **ใช้ TS 7.0.2 + Vite 8.2.1 + plugin-react 6.0.5** — typecheck เร็วขึ้น 5.7× build เร็วขึ้น 7× bundle เล็กลง 2.8% · **เงื่อนไข**: ต้องมี `vite-env.d.ts` · **ยังไม่ปิดฝั่ง backend** (Prisma/Express/Vitest ยังไม่ทดสอบกับ TS 7 → ปิดใน Slice 1) |
| ~~R-4~~ | ~~`three-mesh-bvh` กับ `SkinnedMesh`~~ | ✅ **ปิดแล้ว 2026-08-12** | [Spike S3](spikes/S3-bvh-skinnedmesh.md) | **คำตอบตรงข้ามกับที่ออกแบบไว้**: `three-mesh-bvh` ใช้กับ SkinnedMesh **ไม่ได้เลยและล้มเหลวเงียบ ๆ** (`SkinnedMesh.prototype` มี `raycast` ของตัวเองที่บดบัง) → ทางแก้คือ **baked raycast proxy** (D-06 ฉบับแก้ไข) วัดได้ **7.5 µs/รังสี เร็วขึ้น 15,104 เท่า ถูกต้อง 100%** · **ห้าม**แพตช์ `SkinnedMesh.prototype.raycast` — วัดแล้วถูกต้องแค่ 22.5% |
| **R-5** | เท็กซ์เจอร์ 1024² × 10 เล็บ × สูงสุด 6 เลเยอร์ = แคนวาสสูงสุด 60 ใบ ≈ 240 MB RAM | **สูง** | `MAX_LAYER_SURFACES = 18` ในโค้ดเดิมคุมไว้ที่ ~3 เล็บ | คงเพดาน eviction + พิจารณาลด `TEX_SIZE` เป็น 512 บนมือถือ + วัด `performance.memory` จริง |
| **R-6** | Import path case-sensitivity (CD-1) ทำ build บน Linux พัง | **กลาง** | `App.jsx:5` | ตั้งกฎ lint + CI build บน Linux container ตั้งแต่ Phase 2 |
| ~~R-7~~ | ~~ระบบทรงเล็บยังไม่มีทางออกใน 3D~~ | ✅ **ปิดเชิงเทคนิค 2026-08-12** | [Spike S2](spikes/S2-nail-shapes.md) | **morph target ใช้ได้จริง** — ดัด geometry ตามแกนที่หาด้วย PCA, ทำงานร่วมกับ skinning ได้, โคนเล็บไม่ขยับ (0.000), เพิ่มขนาดไฟล์ +0.83% เหลืองานปรับค่าเชิงศิลป์ของ square/squoval ใน Slice 4 |
| **R-8** | โมเดล `hand.glb` มีลิขสิทธิ์/ที่มาที่ต้องตรวจสอบ (มีแผน `2026-08-10-documentation-model-rights.md` ในซอร์สเดิม) | **กลาง** | ชื่อไฟล์แผนงาน | ตรวจสอบสิทธิ์ก่อน deploy จริง บันทึกใน `docs/assets-license.md` |
| **R-9** | ไม่มี PostgreSQL/Docker ในเครื่องพัฒนา (ยังไม่ตรวจ) | **กลาง** | — | เตรียม `docker-compose.yml` + สคริปต์ตรวจใน Phase 3 (มีต้นแบบ `tools/check-postgres.ps1`) |
| **R-10** | Canvas2D painting ไม่ทำงานใน Web Worker ตรง ๆ (ต้องใช้ `OffscreenCanvas` ซึ่ง Safari รองรับช้า) | **กลาง** | — | ตรวจ feature detection + fallback บน main thread |
| **R-11** | **LLM สร้าง JSON ที่ไม่ถูกต้อง** | **กลาง** (ลดจากสูง) | [Spike S5](spikes/S5-llm-recipe.md) — วัดแล้ว | **Recipe 8 ฟิลด์ (D-22) ได้ 73.3% เทียบ Document เต็มรูป 13.3%** และเร็วกว่า 30 เท่า · JSON parse ผ่าน 100% ทุกเงื่อนไข · **`format:"json"` ไม่ช่วยอะไรเลย** (A เท่ากับ C เป๊ะ) · ยังไม่ถึงเกณฑ์ 85% แต่สาเหตุคือ prompt ที่ไม่ได้บอกให้ใส่ `[]` เมื่อ array ว่าง — แก้แล้ววัดใหม่ที่ Slice 6 |
| **R-12** | **Prompt injection ผ่านฐานความรู้ RAG** — `/api/knowledge/add` เปิดสาธารณะ (AD-2) | **สูง** | `app.py:114` | ให้เฉพาะ admin เพิ่มความรู้; แยกข้อความผู้ใช้ออกจากคำสั่งระบบอย่างชัดเจน; ถือว่าเนื้อหาที่ดึงมาจาก RAG เป็น **ข้อมูล ไม่ใช่คำสั่ง** |
| **R-13** | **Ollama เป็นคอขวดและจุดล้มเหลวเดี่ยว** — โมเดล 8B ใช้ VRAM หลาย GB, request หนึ่งใช้เวลาหลายวินาทีถึงนาที | **สูง** | `timeout=300` | คิว + rate limit ต่อผู้ใช้ + streaming response + timeout ที่สั้นลง + graceful degradation (ถ้า AI ล่ม แอปหลักต้องยังใช้ได้) |
| **R-14** | **เนื้อหาที่ผู้ใช้แชร์ใน Community** อาจไม่เหมาะสม | **กลาง** | — | รายงานเนื้อหา + ซ่อนอัตโนมัติเมื่อถูกรายงานถึงเกณฑ์ + หน้า moderation |
| **R-15** | **WebXR รองรับจำกัด** — `immersive-vr` ใช้ได้บน Chromium (Quest Browser, Chrome Android) แต่ Safari/iOS ยังไม่รองรับ | **กลาง** | — | feature detection + fallback เป็นโหมด "หมุนดูรอบ ๆ" บนจอปกติ (ไม่ใช่หน้าพัง) |
| **R-16** | **งบประสิทธิภาพของ VR สูงกว่า editor ~3 เท่า** (2 ตา × 72–90 Hz เทียบกับ 1 ภาพ × 60 Hz) | **สูง** | — | VR budget แยก: ปิด clearcoat, texture 512, Environment ต่ำ — **ต้องวัดบนแว่นจริง ไม่ใช่จำลอง** (Phase 10E/14) |
| **R-17** | **ร้านรับนัดซ้อนกันเอง** เพราะระบบไม่มีปฏิทิน (ผลจาก DB-07 ที่ตั้งใจไม่ทำ) | **กลาง** | ข้อกำหนดของผู้ใช้ | แสดงนัดที่ยืนยันแล้วในวันเดียวกันให้ร้านเห็นตอนกดยอมรับ — แก้ที่ UI ไม่ใช่ที่ schema |

---

## 6. สมมติฐานที่ตั้งไว้ (ต้องยืนยันกับผู้ใช้)

| รหัส | สมมติฐาน | ผลถ้าผิด |
|---|---|---|
| **A-1** | ระบบใหม่รองรับ **10 เล็บ (สองมือ)** โดยใช้โมเดลมือเดียวแล้ว mirror ทางแกน X (วิธีเดียวกับที่ CEPP ใช้ `scaleX(-1)`) — ไม่ต้องมีโมเดลมือซ้ายแยก | ถ้าต้องมีโมเดลมือซ้ายจริง จะเพิ่มงาน asset pipeline และ 11.2 MB อีกก้อน |
| **A-2** | ระบบวาดยังใช้แนวทาง **texture painting บน UV** ของ NailDesine-TEST (ไม่ใช่การแก้ geometry) — "3D model editing" ตามโจทย์หมายถึงการแก้สัดส่วนมือ/ทรงเล็บ/วางของตกแต่ง 3D ไม่ใช่ sculpting ระดับ vertex | ถ้าต้องการ vertex sculpting จริง ขอบเขตงานจะใหญ่ขึ้นมาก |
| ~~A-3~~ | ~~ฟีเจอร์ AI อยู่นอกขอบเขต~~ → **ผิด แก้แล้ว 2026-08-12**: ผู้ใช้ยืนยันว่า **AI Recommend + chatbot/LLM จริง อยู่ในขอบเขต** ดู §2B | — |
| ~~A-4~~ | ~~`/community` และ `/vr-preview` เป็น stub~~ → **ผิดทั้งข้อ แก้แล้ว**: **ทั้ง Community และ VR Preview อยู่ในขอบเขต** → Phase 10C + 10E | — |
| ~~A-6~~ | ~~ผู้ใช้มี 2 บทบาท~~ → **ยืนยันและขยาย**: role `shop` ต้องมี **นัดหมาย + รีวิว** โดย**ไม่ล็อกเวลา** ร้านกดยอมรับเองและเสนอเวลาอื่นกลับได้ → Phase 10D + 5 ตาราง | — |
| ~~A-8~~ | ~~ไม่แน่ใจว่ามี GPU~~ → **ยืนยัน 2026-08-12: เครื่อง deploy มี GPU** → ใช้ `typhoon2-8b-instruct` ได้เต็มรูปแบบ ไม่ต้องลดขนาดโมเดล | — |
| **A-9** | Community/Template = แชร์ + ❤️ ไลก์ + ↗ แชร์ + 🔁 remix + คอมเมนต์ + รายงาน (ไม่มี follow/notification) | ถ้าต้องการ follow/feed ส่วนตัว เพิ่ม ~1 สัปดาห์ |
| **A-10** | ตัวเลขที่ 3 บนการ์ด nail template = **remix (จำนวนคนที่เอาไปแก้ต่อ)** — อนุมานจาก `RecommendationCard.jsx:36` (`edits`) + badge `"copy"` ใน `DesignCard.jsx` **เพราะไม่เห็นรูปที่ผู้ใช้แนบ** | ถ้าตัวที่ 3 คืออย่างอื่น (เช่น จำนวนคนบันทึก/ยอดวิว) เปลี่ยนแค่ชื่อคอลัมน์ + ตารางกิจกรรม 1 ตัว |
| **A-11** | ร้านรับชำระเงินนอกระบบ (จ่ายหน้าร้าน) — ไม่มี payment gateway | ถ้าต้องมี เพิ่ม ~2 สัปดาห์ + ข้อกำหนด PCI DSS |
| **A-5** | ภาษาหลักของ UI คือ **ภาษาไทย** (ตามซอร์สทั้งสอง) โดยเตรียมโครง i18n ไว้แต่ยังไม่ทำหลายภาษา | — |
| **A-6** | ผู้ใช้มีบทบาท 2 แบบ (`user` / `shop`) ตามที่ CEPP `AuthProvider` ออกแบบไว้ | มีผลต่อ schema ตาราง `users` และ authorization |
| **A-7** | เป้าหมายการ deploy คือ Docker (frontend static + api container + Postgres) ไม่ใช่ serverless | มีผลต่อ storage abstraction และ session strategy |

---

## 7. ข้อสรุปและคำแนะนำ

1. **อย่าเขียน 3D ใหม่** — `src/nail/` และ `src/three/` ของ NailDesine-TEST ผ่านการแก้บั๊กเชิงลึกมาแล้ว (skinning matrix, bounding sphere ของ SkinnedMesh, pointer capture, texture cache key ชนกัน) การเขียนใหม่คือการเดินซ้ำรอยบั๊กเดิมทั้งหมด
2. **อย่าเก็บสถาปัตยกรรม 2D ของ CEPP ไว้แม้แต่ไฟล์เดียว** — `FINGER_ANCHORS`, `nailShapePaths`, `NailArtworkContent`, `ItemDragHitLayer`, `PenStrokes` ต้องถูกลบ ไม่ใช่ comment ทิ้งไว้
3. **สิ่งที่ต้องเขียนใหม่จริง ๆ มี 3 อย่างเท่านั้น**: (ก) Command Pattern history (ข) ระบบ decoration 3D (ค) backend + database ทั้งชุด — ที่เหลือคือการ**ย้าย + แปลงเป็น TypeScript + ต่อสาย**
4. **สิ่งที่ต้องวัดก่อนแตะ**: raycast latency, GLB load time, FPS ตอนลากเส้น, memory ของ texture cache — ห้าม optimize ก่อนมีตัวเลข (`docs/performance.md` Phase 11)
5. **ซอร์ส AI มีของดีที่คาดไม่ถึง**: schema ใน `AI_JSON_Generation` เก็บตำแหน่งของตกแต่ง
   เป็น `x, y ∈ [0,1]` ซึ่งคือพิกัด UV — ตรงกับ DECISION D-10 ที่เราตัดสินใจไว้อิสระ
   → **"ให้ AI สร้างดีไซน์แล้วเปิดใน 3D editor ทันที" ทำได้จริง** เป็นจุดขายเชิงวิชาการที่ดี
   แต่ต้องแก้ 5 จุด (AD-9 ถึง AD-13) โดยเฉพาะ **schema ที่เขียนซ้ำสองที่แล้วไม่ตรงกัน**
6. **ส่วน AI ต้องถือว่าไม่ปลอดภัยทั้งหมดจนกว่าจะเขียนชั้นป้องกันใหม่** — ทุก endpoint
   ไม่มี auth, `/api/knowledge/add` เปิดสาธารณะ (prompt injection ถาวร), `debug=True`

---

เอกสารต่อเนื่อง: [architecture.md](architecture.md) · [algorithms.md](algorithms.md) · [database.md](database.md) · [implementation-plan.md](implementation-plan.md)
