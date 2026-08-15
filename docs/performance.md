# Performance Measurements — NAIL STUDIO 3D

## Slice 8 · repeatable web bundle baseline

`npm run profile:web` builds the production web bundle and records the total
emitted bytes plus the ten largest assets. This is intentionally separate from
GPU profiling: BVH, proxy meshes, LOD, texture adaptation, and instancing are
only changed after Chrome Performance, `renderer.info`, React Profiler, and a
heap snapshot are captured on the same browser/device. The script reports the
asset baseline without inventing FPS or heap numbers when a browser session is
not available.

### 2026-08-15 · initial-route code split

| Measurement | Before split | After split | Environment |
|---|---:|---:|---|
| initial JS entry | 1,501,274 B | 233,212 B | Node v24.19.0, Vite production build |
| emitted files | 5 | 15 | same workspace/build command |
| total emitted bytes | 14,129,962 B | 14,132,156 B | includes `hand.glb` |

The editor's `useNailTextures` chunk remains 1,069,244 B and is loaded only
when the editor route is opened. GPU FPS, renderer draw calls, and heap remain
unmeasured in this run, so no BVH/LOD/texture-quality claim is made from this
bundle measurement.

เอกสารบันทึกผลการวัดประสิทธิภาพทั้งหมดของโครงงาน

**กฎของเอกสารนี้**

1. ทุกตัวเลขต้องระบุ **สภาพแวดล้อมที่วัด** ครบ ไม่งั้นเปรียบเทียบกันไม่ได้
2. ตัวเลขที่ได้มาในเงื่อนไขที่ไม่ถูกต้อง **ต้องบันทึกไว้ว่าใช้ไม่ได้และทำไม** ไม่ใช่ลบทิ้งเงียบ ๆ
3. ห้ามอ้าง "เร็วขึ้น X%" โดยไม่มีตัวเลขก่อน/หลังในสภาพแวดล้อมเดียวกัน
4. การเปลี่ยนแปลงที่วัดแล้ว **ไม่ได้ช่วย** ต้องบันทึกไว้ด้วย — มีค่าทางวิชาการเท่ากับที่ช่วย

---

## M4 · ขนาดโครงสร้าง history — Command เทียบ full-document snapshot (A-10)

**วันที่วัด**: 2026-08-13

### สภาพแวดล้อมและวิธีวัด

| รายการ | ค่า |
|---|---|
| ระบบปฏิบัติการ | Windows 11 Home Single Language 10.0.26200 |
| Node | v24.19.0 (`win32` / x64) |
| คำสั่ง | `node --expose-gc tools/measure-history-memory.mjs` |
| เอกสารตัวแทน | schema v2, เล็บ 10 นิ้ว, นิ้วละ 3 เลเยอร์, เลเยอร์ละ 12 strokes, stroke ละ 24 points (รวม 360 strokes / 8,640 points) |
| ขนาดเอกสารตัวแทน | 593,741 bytes เมื่อ serialize เป็น JSON UTF-8 |
| การแก้ไข | เปลี่ยน `baseColor` ของ `right.index` ต่อเนื่อง 100 ครั้ง โดย snapshot และ Command เริ่มจากเอกสารเดียวกันและใช้ลำดับสีก่อน/หลังเดียวกัน |
| วิธีนับ | เก็บ full-document clone 100 ชุด หรือ delta Command 100 ชุด แล้วนับ `Buffer.byteLength(JSON.stringify(retainedEntries), 'utf8')` |

สคริปต์เรียก `global.gc()` ก่อนสร้างโครงสร้างและก่อน serialize และจะหยุดพร้อม error ถ้าไม่ได้เปิด
`--expose-gc` อย่างไรก็ตามค่าที่รายงานมาจาก serialized structure โดยตรง จึงไม่แปรตามเวลาที่ GC ทำงาน

### ผลที่วัดได้

```json
{"node":"v24.19.0","commands":100,"snapshotBytes":59374201,"commandBytes":10901,"ratio":5446.67}
```

รันคำสั่งซ้ำสองครั้งได้ JSON ตรงกันทุก field: full snapshots ใช้โครงสร้างที่ serialize ได้
59,374,201 bytes ส่วน Command deltas ใช้ 10,901 bytes หรือ snapshot มากกว่า **5,446.67 เท่า**
ในเอกสารตัวแทนและชุดแก้ไขนี้ ผลนี้สนับสนุน A-10 ว่าการเก็บ delta ไม่ทำสำเนาเนื้อหาเอกสารซ้ำใน history

### ข้อจำกัด — ห้ามตีความเป็น browser heap snapshot

- ตัวเลขนี้เป็น **repeatable serialized retained-size structural comparison** ไม่ใช่ heap snapshot ของ V8
  และไม่ใช่ heap snapshot ของเบราว์เซอร์ จึงห้ามอ้างว่าเป็นจำนวน bytes ที่ JavaScript heap ใช้จริง
- JSON ไม่นับ object/array headers, pointers, closures, prototypes, allocator overhead, string interning,
  Zustand subscribers หรือข้อมูลภายใน runtime; ในทางกลับกัน JSON อาจนับข้อความที่ engine แชร์ไว้เพียงครั้งเดียวซ้ำ
- ฝั่ง snapshot ในการทดลองเป็น full `structuredClone` ทุก revision ตามแบบที่ A-10 ต้องการเปรียบเทียบ
  ถ้าระบบ snapshot อื่นใช้ persistent data structures หรือ structural sharing ผลจะต่างออกไป
- การเก็บ heap snapshot ใน Node แล้วหาส่วนที่เป็นของ history อย่างน่าเชื่อถือมี noise จาก runtime,
  module loader และ GC; การทดลองนี้จึงเลือก proxy ที่กำหนด input และวิธีนับได้แน่นอน
  งาน profiling ภายหลังต้องใช้ browser DevTools heap snapshot แยกต่างหากถ้าต้องการยืนยันการใช้ heap จริง

---

## M15 · วัด M0 ใหม่หลังแบ่งย่อยเล็บ (Task 3) — ในเว็บแอปจริง ไม่ใช่ spike

**วันที่วัด**: 2026-08-14
**ที่มา**: `apps/web` ที่รันจริงด้วย `npm run dev:web` + `npm run dev:api` (ไม่ใช่ `spikes/s1-react19-r3f9/`)

**ทำไมต้องวัดใหม่**: Task 3 แบ่งย่อยเมชเล็บแต่ละชิ้นใน `hand.glb` ให้มีอย่างน้อย 300
vertices (เดิมต่ำสุด 81 vertices) เพื่อให้พอสำหรับการเปลี่ยนรูปทรง (deformation) ในงานถัดไป
การแบ่งย่อยนี้เพิ่มจำนวนสามเหลี่ยมของโมเดลทั้งก้อน ตัวเลข M0 (121,956 tris) จึงไม่ตรงกับ
โมเดลปัจจุบันอีกต่อไป **ตัวเลขนี้ไม่ได้ลบหรือแทนที่ M0** — M0 ยังคงถูกต้องในฐานะ baseline
ของโมเดลก่อน Task 3 (ดูกฎข้อ 2 ของเอกสารนี้) ส่วน M15 คือค่าเดียวกันวัดใหม่ **หลัง** Task 3

### สภาพแวดล้อมและวิธีวัด

| รายการ | ค่า |
|---|---|
| ระบบปฏิบัติการ | Windows 11 Home Single Language 10.0.26200 |
| Node | v24.19.0 |
| เบราว์เซอร์ | Chrome 151.0.7922.138 (ควบคุมผ่าน Chrome DevTools Protocol โดยตรง ไม่ใช่ extension) |
| WebGL | WebGL 2.0 (OpenGL ES 3.0 Chromium) |
| devicePixelRatio | 1.25 |
| ขนาด canvas (CSS) | 744 × 523.05 px |
| ขนาด framebuffer | 930 × 653 px |
| `dpr` ที่ตั้งไว้ | `[1, 2]` (เหมือน M0 — ดู `apps/web/src/3d/scene/NailScene.tsx`) |
| โมเดล | `apps/web/public/models/hand.glb` — 12,601,584 bytes (M0: 11,770,384 bytes — ใหญ่ขึ้นเพราะมี vertex/index data เพิ่มจาก Task 3) |
| เส้นทางที่วัด | หน้า editor จริง `/editor/:projectId` หลังสมัครสมาชิกทดสอบและสร้างโปรเจกต์ผ่าน flow ปกติของแอป |
| กล้อง/ฉาก/สแตก | เหมือน M0 ทุกประการ — `NailScene.tsx` ไม่ถูกแก้ไขในงานนี้ (React 19.2.8 · R3F 9.7.0 · drei 10.7.8 · three 0.185.1 — เวอร์ชันเดียวกับ M0 เป๊ะ) |

**วิธีเข้าถึงหน้า editor**: สมัครสมาชิกทดสอบผ่าน `POST /api/v1/auth/register` (เรียกจาก JS
ในบริบทของหน้าเว็บเอง ผ่าน CDP `Runtime.evaluate` เพื่อให้ cookie CSRF/session ถูกจัดการ
เหมือนเบราว์เซอร์จริง — เรียกตรงจากภายนอกหน้าเว็บด้วย `curl` ใช้ไม่ได้เพราะติด CSRF
double-submit cookie ตามที่ตั้งใจออกแบบไว้) จากนั้นสร้างโปรเจกต์ด้วย `POST /api/v1/projects`
แล้ว navigate ไป `/editor/<projectId>`

**วิธีอ่านค่า — ต่างจาก M0**: มาตรฐานการอ่าน `document.querySelector('canvas').__r3f...`
ที่ใช้ได้ใน spike ของ M0 **ใช้ไม่ได้กับแอปจริงใน R3F 9.7.0 เวอร์ชันนี้** เพราะ
`__r3f` ถูกผูกไว้กับอินสแตนซ์ของ Three.js object (เช่น mesh/scene) ไม่ใช่กับ DOM
`<canvas>` element เอง (ตรวจสอบจากซอร์สใน
`node_modules/@react-three/fiber/dist/events-*.cjs.dev.js` บรรทัด `object.__r3f = instance`)
ส่วน `_roots` ที่เก็บ store จริงเป็นตัวแปรภายในโมดูล ไม่ได้ export ออกมาให้ global scope
เข้าถึงได้ จึงอ่าน `renderer.info` ตรง ๆ ไม่ได้จากภายนอกโดยไม่แก้โค้ดแอป

แก้ด้วยการฉีดสคริปต์ผ่าน CDP `Page.addScriptToEvaluateOnNewDocument` **ก่อน** โหลดหน้าเว็บ
(รันก่อนสคริปต์ของแอปทุกตัว) เพื่อครอบ (wrap) `HTMLCanvasElement.prototype.getContext` และ
`WebGL2RenderingContext.prototype.{drawArrays,drawElements,drawArraysInstanced,drawElementsInstanced}`
แล้วนับสามเหลี่ยมด้วยสูตรเดียวกับที่ `THREE.WebGLInfo.update()` ใช้ภายใน (`count / 3` สำหรับ
`gl.TRIANGLES`, คูณด้วย `instanceCount` สำหรับ instanced draw) — เก็บผลไว้ที่ `window.__triCounters`
แล้ว reset ทุกครั้งที่ `requestAnimationFrame` ยิง (ครอบ `window.requestAnimationFrame` ด้วย)
เพื่อให้ตัวเลขที่อ่านได้คือของเฟรมล่าสุดเฟรมเดียว ไม่ใช่ยอดสะสมข้ามเฟรม

### ผลที่วัดได้

| ตัวชี้วัด | ค่า | M0 (ก่อน Task 3) | ส่วนต่าง |
|---|---|---|---|
| **สามเหลี่ยมต่อเฟรม** | **126,692** | 121,956 | **+4,736 (+3.88%)** |
| draw calls (นับจาก `gl.draw*` โดยตรง) | 6 | 11–12 | ดูข้อจำกัดด้านล่าง |
| lines / points | 0 / 0 | ไม่ได้บันทึกไว้ใน M0 | — |

วัดซ้ำสองรอบอิสระ (reload หน้าเว็บใหม่ทั้งหมดทั้งสองครั้ง คนละ session ของ CDP) ได้ค่า
สามเหลี่ยมตรงกันทุกครั้งที่ **126,692** และคงที่ตลอด 40+ วินาทีที่สังเกต (ไม่แกว่ง)
รวมถึงตัวอย่างต่อเนื่อง 5 ครั้งห่างกัน 300ms ในช่วงท้ายก็ได้ค่าเดียวกันทุกตัวอย่าง
→ ตัวเลขนี้เชื่อถือได้ในระดับเดียวกับ M0

### ข้อจำกัด — ทำไม draw calls ต่างจาก M0

- **draw calls = 6** ในการวัดนี้ตรงกับจำนวน mesh ในฉาก (มือ 1 + เล็บ 5 = 6) ตามที่ M0
  บันทึกไว้เองว่า "มี mesh แค่ 6 ชิ้น" — ตัวเลข 11–12 ของ M0 น่าจะรวม draw call ของ
  PMREM/`Environment`/`Lightformer` ที่เกิดครั้งเดียวตอนสร้าง environment map (ไม่เกิดซ้ำ
  ทุกเฟรมหลัง cache เสร็จ) ซึ่งวิธีวัดของ M15 (hook เฉพาะ `gl.draw*` แล้ว reset ทุก `rAF`)
  จับได้เฉพาะเฟรม steady-state หลังจากนั้น จึงเห็นแค่การวาดเนื้อหาจริง ไม่เห็น draw call
  ของการเตรียม environment map — **ไม่ใช่การขัดแย้งกับ M0 แต่เป็นช่วงเวลาที่วัดต่างกัน**
- geometries/textures/programs ใน GPU (ที่ M0 มี) **วัดไม่ได้ด้วยวิธีนี้** เพราะเป็นข้อมูล
  ที่ three.js เก็บ bookkeeping เองภายใน `WebGLRenderer`, hook ระดับ raw WebGL call
  เห็นแค่ draw call ไม่เห็นการนับ resource เหล่านี้ — ต้องเข้าถึง `renderer.info` จริงถึงจะวัดได้
  (เช่น แก้โค้ดแอปชั่วคราวให้ expose `renderer` ไปที่ `window` ระหว่างพัฒนา)
- ตัวเลข **สามเหลี่ยม** ไม่มีข้อจำกัดนี้ เพราะสูตรที่ใช้นับ (`count/3` ต่อ `gl.TRIANGLES` draw call)
  เหมือนกับที่ `THREE.WebGLInfo` ใช้ภายในทุกประการ — เป็นการคำนวณตรงจาก draw call ระดับ
  WebGL ไม่ใช่การประมาณ

### สรุป

การแบ่งย่อยเล็บใน Task 3 เพิ่มจำนวนสามเหลี่ยมของฉากจาก **121,956 → 126,692** (+3.88%)
เพิ่มขึ้นน้อยกว่าที่คาดตามสัดส่วน vertex ที่เพิ่ม (เล็บแต่ละชิ้นจาก 81 เป็นอย่างน้อย 300
vertices คือเพิ่มขึ้นหลายเท่า) เพราะเล็บทั้ง 5 ชิ้นรวมกันเป็นสัดส่วนเล็กของโมเดลทั้งหมด
เทียบกับเมชมือที่มี 118,756 tris (ดู M1) ซึ่งไม่ถูกแตะต้องในงานนี้ — ตัวเลขนี้ยืนยันว่า
**การแบ่งย่อยเล็บไม่ได้ทำให้ต้นทุนการ render เพิ่มขึ้นอย่างมีนัยสำคัญ** (+3.88% จาก baseline)

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
