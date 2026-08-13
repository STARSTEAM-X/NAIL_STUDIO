# Spike S1 — React 19 + @react-three/fiber v9 + drei v10

| | |
|---|---|
| **ความเสี่ยงที่ตรวจ** | R-1 (React 19 vs R3F v8 เข้ากันไม่ได้) และบางส่วนของ R-3 (เวอร์ชัน TS/Vite) |
| **คำถามที่ต้องตอบ** | render `<Canvas>` + โหลด GLB + OrbitControls + Environment ภายใต้ React 19 ได้หรือไม่ |
| **วันที่** | 2026-08-12 |
| **โค้ด** | `spikes/s1-react19-r3f9/` — **โค้ดทิ้ง ห้ามนำเข้าโปรเจกต์จริงโดยตรง** |
| **สถานะ** | ✅ **ผ่าน — R-1 ปิดแล้ว** (ยืนยันด้วยตาเมื่อ 2026-08-12) |

---

## 1 · สภาพแวดล้อมที่ใช้ทดสอบ

```
Windows 11 Home Single Language 10.0.26200
Node    v24.19.0
npm     11.17.0
git     2.55.0.windows.3
pnpm    ยังไม่ได้ติดตั้ง  ← ดู §5 ข้อค้นพบเพิ่มเติม
```

---

## 2 · เวอร์ชันที่มีอยู่จริงบน npm (ตรวจ 2026-08-12)

| แพ็กเกจ | latest | peerDependencies ที่เกี่ยวข้อง |
|---|---|---|
| `@react-three/fiber` | **9.7.0** | `react: >=19 <19.3`, `react-dom: >=19 <19.3`, `three: >=0.156` |
| `@react-three/drei` | **10.7.8** | `react: ^19`, `@react-three/fiber: ^9.0.0`, `three: >=0.159` |
| `react` | 19.2.8 | — |
| `three` | 0.185.1 | — |
| `vite` | 8.2.1 | — |
| `typescript` | 7.0.2 | — |

**ข้อสรุปแรก**: R3F v9 รองรับ React 19 อย่างเป็นทางการ และ drei v10 บังคับ R3F v9 พอดี
→ **ทางออกของ R-1 คือ React 19 + R3F v9 + drei v10** ไม่ต้องถอยไป React 18

**ผลต่อ R-3**: `typescript@7.0.2` และ `vite@8.2.1` **มีอยู่จริง** ไม่ใช่เลขเวอร์ชันที่พิมพ์ผิด
ใน `package.json` ของ `NailDesine-TEST` → ความเสี่ยง R-3 ลดระดับจาก "กลาง" เป็น "ต่ำ"

---

## 3 · การออกแบบ spike (จงใจแยกตัวแปร)

spike นี้ตรึง **TypeScript 5.9 + Vite 7** ไว้โดยตั้งใจ ทั้งที่ TS 7 / Vite 8 มีให้ใช้แล้ว

เหตุผล: ถ้าเปลี่ยนสามตัวแปรพร้อมกัน (React, TS, Vite) แล้วพัง จะไม่รู้ว่าตัวไหนเป็นสาเหตุ
S1 มีหน้าที่ตอบคำถามเรื่อง **React 19 + R3F v9** เท่านั้น
→ การทดสอบ TS 7 / Vite 8 แยกเป็น **spike S1b** ทำหลังจาก S1 ได้ผลชัดเจนแล้ว

สิ่งที่ spike ต้องพิสูจน์ 6 ข้อ:

1. `<Canvas>` สร้าง WebGL context ได้ภายใต้ **StrictMode** (React mount/unmount สองรอบ)
2. `useGLTF` โหลด `hand.glb` 11.23 MiB ได้
3. `OrbitControls` (drei) ทำงาน
4. `Environment` + `Lightformer` (drei) เรนเดอร์ได้ — ใช้ `WebGLRenderTarget` ภายใน
   ซึ่งเป็นจุดที่ R3F v9 เปลี่ยน API มากที่สุด
5. traverse หา mesh เล็บครบ 5 ชิ้น (รูปแบบ `PartsRegistry` ของระบบจริง)
6. `useFrame` ทำงานทุกเฟรมโดย **ไม่** ทำให้ React re-render

---

## 4 · ผลการทดสอบ

| # | รายการ | ผล | หลักฐาน |
|---|---|---|---|
| 4.1 | `npm install` | ✅ ผ่าน | 130 packages, ไม่มี peer dependency conflict |
| 4.2 | เวอร์ชันที่ติดตั้งจริง | ✅ ผ่าน | `react@19.2.8` · `@react-three/fiber@9.7.0` · `@react-three/drei@10.7.8` · `three@0.185.1` |
| 4.3 | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`) | ✅ **PASS** | ไม่มี error — type ของ R3F v9 ใช้กับ React 19 ได้โดยไม่ต้อง cast |
| 4.4 | `vite build` | ✅ **PASS** | 589 modules transformed ใน 2.78 s |
| 4.5 | โหลด `/models/hand.glb` | ✅ ผ่าน | `GET /models/hand.glb → 200 OK` |
| 4.6 | **WebGL2 context ภายใต้ StrictMode** | ✅ **PASS** | `WebGL2RenderingContext`, `WebGL 2.0 (OpenGL ES 3.0 Chromium)` |
| 4.7 | console errors | ✅ ไม่มี | มีแต่ข้อความ vite connect และ React DevTools |
| 4.8 | เรนเดอร์เห็นภาพจริง | ✅ **PASS** | screenshot แสดงมือ 3 มิติพร้อมเล็บ แสงและวัสดุถูกต้อง |
| 4.9 | traverse เจอ mesh เล็บ 5 ชิ้น | ✅ **PASS** | **5 / 5** — รูปแบบ `PartsRegistry` ใช้ได้จริงกับ R3F v9 |
| 4.10 | `Environment` + `Lightformer` (drei v10) | ✅ **PASS** | เรนเดอร์ได้ ไม่มี error — 6 shader programs คอมไพล์สำเร็จ |
| 4.11 | fps / frame time | ❌ **วัดไม่ได้ในสภาพแวดล้อมนี้** | ดู §4.1 ด้านล่าง |

**ข้อ 4.6 คือคำตอบหลักของ spike นี้** — `<Canvas>` ของ R3F v9 สร้าง WebGL2 context สำเร็จ
ภายใต้ React 19 StrictMode โดยไม่มี error ซึ่งเป็นจุดที่ R3F v8 + React 19 จะพัง

### 4.1 · ตัวเลขที่วัดได้ (นำเข้า `docs/performance.md` เป็น baseline M0)

| ตัวชี้วัด | ค่า | แหล่ง |
|---|---|---|
| mesh เล็บที่จับได้ | **5 / 5** | traverse + `parseNailName` |
| สามเหลี่ยมต่อเฟรม | **121,956** | `renderer.info.render.triangles` |
| draw calls | 11–12 | `renderer.info.render.calls` |
| geometries / textures / programs | 19 / 9 / 6 | `renderer.info.memory` |
| `hand.glb` transferSize | 11,770,684 bytes | Resource Timing |
| เวลาดาวน์โหลด GLB (localhost) | 47 ms | Resource Timing `duration` |
| `domContentLoadedEventEnd` | 489 ms | Navigation Timing |
| devicePixelRatio / framebuffer | 1.25 / 627 × 868 | DOM |

**การตรวจสอบไขว้ที่สำคัญ**: `renderer.info` รายงาน **121,956** สามเหลี่ยม
เทียบกับที่นับจาก GLB header ตอน audit ได้ **120,356** (มือ + เล็บ 5 ชิ้น)
ส่วนต่าง ~1,600 คือ geometry ของ `Environment`/`Lightformer`
→ **การวิเคราะห์ GLB แบบ static ใน `source-audit.md §1.3` ถูกต้อง**

### 4.2 · ตัวเลขที่ต้องทิ้ง (บันทึกไว้เพื่อความโปร่งใส)

| ค่าที่ HUD แสดง | ทำไมใช้ไม่ได้ |
|---|---|
| "เวลาโหลด GLB = 161,140 ms" | ตัวจับเวลาเริ่มตอนสร้าง component แต่แท็บถูกซ่อนไว้ ~161 วินาทีก่อน render loop จะเดิน → **วัดระยะเวลาที่แท็บถูกซ่อน ไม่ใช่เวลาโหลด** ค่าจริง = 47 ms |
| "FPS = 240" แล้ว "FPS = 1" | อ่านได้สองค่าในเวลาไล่เลี่ยกัน เพราะ compositing ถูกพัก/ปลุกสลับกัน → rAF ไม่เดินสม่ำเสมอ |

**บทเรียนสำหรับการวัดครั้งต่อไป**: การจับเวลาด้วย `performance.now()` ข้าม lifecycle
ของ React ไม่น่าเชื่อถือเมื่อแท็บอาจถูกซ่อน — **ให้ใช้ Resource Timing / Navigation Timing
สำหรับเวลาโหลด และวัด fps เฉพาะในหน้าต่างที่แสดงผลค้างไว้เท่านั้น**
บันทึกเป็นข้อกำหนดของ harness ใน `docs/performance.md`

---

## 5 · ข้อค้นพบเพิ่มเติม (นอกเหนือจากคำถามหลัก)

### 5.1 ขนาด bundle — ยืนยันความจำเป็นของ code splitting

```
dist/assets/index-*.js   1,237.67 kB │ gzip: 349.16 kB
```

**เฉพาะ React + three + drei โดยยังไม่มีโค้ดแอปเลย** ก็ 349 kB (gzip) แล้ว
→ ยืนยันว่าแผน "แยก bundle ของ editor ออกจากหน้าอื่นด้วย `React.lazy`" (Slice 8) จำเป็นจริง
ไม่ใช่การ optimize เชิงคาดเดา หน้า Home / Login / Community ไม่ควรต้องโหลดก้อนนี้

### 5.2 `pnpm` ยังไม่ได้ติดตั้งบนเครื่องนี้

แผนงานระบุ pnpm workspaces (D-01) แต่เครื่องมีแค่ npm 11.17
→ ทางเลือก: `corepack enable` (Node 24 มีมาให้) หรือเปลี่ยนไปใช้ **npm workspaces**
→ **ต้องตัดสินใจก่อนเริ่ม Slice 1** — บันทึกเป็นจุดตัดสินใจใหม่

### 5.3 npm 11 บล็อก install script โดยค่าเริ่มต้น

```
npm warn allow-scripts esbuild@0.28.2 (postinstall: node install.js)
```

npm 11 ไม่รัน postinstall script จนกว่าจะอนุมัติ — ในกรณีนี้ `@esbuild/win32-x64`
ถูกติดตั้งเป็น optional dependency อยู่แล้ว build จึงผ่าน **แต่ต้องบันทึกไว้ใน README**
เพราะเป็นสิ่งที่คนอื่นจะเจอตอน setup (เกณฑ์ P5)

---

## 6 · สถานะรายการตรวจ

- [x] เปิด Browser pane แล้วยืนยันข้อ 4.8 และ 4.9 ด้วยตา — **ภาพขึ้น เจอเล็บครบ 5 ชิ้น**
- [x] บันทึก baseline → `docs/performance.md` §M0
- [ ] **spike S1b**: ทดสอบ TypeScript 7.0.2 + Vite 8.2.1 แยกต่างหาก (ตัวแปรละตัว)
- [ ] ตัดสินใจเรื่อง pnpm vs npm workspaces (§5.2) — **ต้องตอบก่อนเริ่ม Slice 1**
- [ ] วัด fps ให้ถูกต้องในหน้าต่างเบราว์เซอร์ปกติ → `docs/performance.md` §M1 (Slice 1)

---

## 7 · ข้อสรุป

> **R-1 ปิดแล้ว** — React 19.2.8 + R3F 9.7.0 + drei 10.7.8 + three 0.185.1
> ติดตั้ง typecheck (strict + `noUncheckedIndexedAccess`) build สร้าง WebGL2 context
> ภายใต้ StrictMode โหลด GLB 11.23 MiB เรนเดอร์เห็นภาพจริง และ traverse เจอ mesh เล็บครบ 5 ชิ้น
> **ไม่ต้องถอยไป React 18 และไม่ต้องแก้สถาปัตยกรรม**

**ผลต่อเอกสารอื่น**

| เอกสาร | การเปลี่ยนแปลง |
|---|---|
| `source-audit.md` R-1 | สูง → **ปิดแล้ว** |
| `source-audit.md` R-3 | กลาง → **ต่ำ** (TS 7 / Vite 8 มีอยู่จริง เหลือแค่ยืนยันว่าใช้ได้ใน S1b) |
| `architecture.md` | ยืนยันสแตกที่เลือกไว้ ไม่ต้องแก้ |
| `performance.md` | เพิ่ม baseline M0 |
| `implementation-plan.md` | เพิ่มจุดตัดสินใจ #15 (pnpm vs npm) |
