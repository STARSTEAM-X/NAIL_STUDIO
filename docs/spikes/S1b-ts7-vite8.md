# Spike S1b — TypeScript 7 + Vite 8

| | |
|---|---|
| **ความเสี่ยงที่ตรวจ** | R-3 · `typescript ^7.0.2` / `vite ^8.1.5` ใน `NailDesine-TEST` เป็นเวอร์ชันล้ำหน้า อาจไม่เสถียร |
| **คำถามที่ต้องตอบ** | อัปจากฐาน TS 5.9 + Vite 7 ของ S1 แล้วยัง typecheck/build ผ่านไหม |
| **วันที่** | 2026-08-12 |
| **โค้ด** | `spikes/s1b-ts7-vite8/` — `run-passes.ps1` รันเมทริกซ์ 3 แบบอัตโนมัติ |
| **สถานะ** | ✅ **ผ่าน — แนะนำให้ใช้ทั้ง TS 7 และ Vite 8** |

---

## 1 · การออกแบบ — เมทริกซ์แยกตัวแปร

S1 ตรึง TS 5.9 + Vite 7 ไว้เพื่อให้คำตอบเรื่อง React 19 + R3F v9 ชัดเจน
S1b เปลี่ยนทีละตัวจากฐานเดียวกันนั้น ถ้าพังจะรู้ทันทีว่าตัวไหนเป็นสาเหตุ

| Pass | TypeScript | Vite | `@vitejs/plugin-react` |
|---|---|---|---|
| **A** | 7.0.2 | 7.3.6 | 5.1.x |
| **B** | 5.9.3 | 8.2.1 | 6.0.5 |
| **C** | 7.0.2 | 8.2.1 | 6.0.5 |

**ข้อจำกัดที่ค้นพบตั้งแต่ก่อนรัน**: `@vitejs/plugin-react@6` ประกาศ peer `vite: ^8.0.0`
ส่วนรุ่น 5 คู่กับ Vite 7 → **การอัป Vite พ่วงการอัป plugin เสมอ แยกกันไม่ได้**
(Vite 8 เปลี่ยน bundler จาก Rollup เป็น **Rolldown**)

---

## 2 · ผลรอบแรก — พังทั้งหมด และหนึ่งในนั้นเป็นความผิดของผมเอง

| Pass | Install | Typecheck | Build |
|---|---|---|---|
| A · TS7 + Vite7 | PASS | **FAIL** | **FAIL** |
| B · TS5.9 + Vite8 | PASS | PASS | **FAIL** |
| C · TS7 + Vite8 | PASS | **FAIL** | **FAIL** |

### 2.1 · Build พังทุก pass — เป็นบั๊กของสคริปต์ ไม่ใช่ของ Vite

```
[vite:css] Failed to load PostCSS config:
[SyntaxError] Unexpected token '﻿', "﻿{ "n"... is not valid JSON
```

`run-passes.ps1` เขียน `package.json` ด้วย `Out-File -Encoding utf8` ซึ่งใน
**Windows PowerShell 5.1 ใส่ BOM มาด้วย** แล้ว PostCSS config loader ของ Vite
อ่าน `package.json` ผ่าน `JSON.parse` ซึ่งไม่ยอมรับ BOM

**บทเรียนที่ต้องเข้าโปรเจกต์จริง**: สคริปต์เครื่องมือทุกตัวที่สร้างไฟล์ JSON บน Windows
ต้องเขียนแบบไม่มี BOM เสมอ

```powershell
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))
```

อาการที่เกิดหลอกมาก — ข้อความ error ชี้ไปที่ `src/index.css` และ PostCSS
ทั้งที่ไฟล์ที่มีปัญหาคือ `package.json`

### 2.2 · Typecheck พังเฉพาะ pass ที่ใช้ TS 7 — เป็นพฤติกรรมที่เปลี่ยนจริง

```
src/main.tsx(4,8): error TS2882:
Cannot find module or type declarations for side-effect import of './index.css'.
```

**TypeScript 7 เข้มกว่า 5.x เรื่อง side-effect import ของไฟล์ที่ไม่ใช่โค้ด**
(`import './index.css'`) ส่วน TS 5.9 ปล่อยผ่านเงียบ ๆ

**ทางแก้** — เพิ่ม `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

เป็นแนวปฏิบัติมาตรฐานของโปรเจกต์ Vite อยู่แล้ว (ซอร์ส `NailDesine-TEST` ก็มีไฟล์นี้)
S1 ไม่มีเพราะผมสร้างโปรเจกต์เปล่าขึ้นมาเอง → **TS 7 จับข้อบกพร่องที่ TS 5.9 ปล่อยผ่าน**

---

## 3 · ผลรอบสอง — ผ่านทั้งหมด

| Pass | Install | tsc | vite | Typecheck | Build |
|---|---|---|---|---|---|
| **A · TS7 + Vite7** | PASS | 7.0.2 | 7.3.6 | ✅ **PASS** | ✅ **PASS** |
| **B · TS5.9 + Vite8** | PASS | 5.9.3 | 8.2.1 | ✅ **PASS** | ✅ **PASS** |
| **C · TS7 + Vite8** | PASS | 7.0.2 | 8.2.1 | ✅ **PASS** | ✅ **PASS** |

**ไม่มีคู่ผสมใดที่ใช้ไม่ได้** — ทั้ง TS 7 และ Vite 8 ทำงานกับ React 19 + R3F v9 +
drei v10 + three 0.185 ได้ทั้งเดี่ยวและพร้อมกัน

---

## 4 · ตัวเลขที่วัดได้

### 4.1 · Build — Vite 7 (Rollup) เทียบ Vite 8 (Rolldown)

| | Vite 7.3.6 (S1) | Vite 8.2.1 (S1b pass C) | ส่วนต่าง |
|---|---|---|---|
| modules transformed | 589 | 568 | −21 |
| JS bundle | 1,237.67 kB | 1,216.10 kB | **−21.57 kB (−1.7%)** |
| JS bundle (gzip) | 349.16 kB | 339.31 kB | **−9.85 kB (−2.8%)** |
| CSS | 0.79 kB | 0.79 kB | เท่ากัน |
| **เวลา build** | **2.78 s** | **399 ms** | **เร็วขึ้น ~7 เท่า** |

### 4.2 · Typecheck — TypeScript 5.9 เทียบ 7.0

วิธีวัด: `node node_modules/typescript/bin/tsc --noEmit` 3 รอบ รายงานค่ามัธยฐาน
โปรเจกต์เดียวกัน (3 ไฟล์ต้นทาง + type ของ React 19 / R3F v9 / drei v10 / three)

| | เวลา (median) | รอบที่วัดได้ |
|---|---|---|
| TypeScript 5.9.3 | **1,039 ms** | 1,027 · 1,039 · 1,150 |
| TypeScript 7.0.2 | **182 ms** | 182 · 170 · 186 |
| **ส่วนต่าง** | **เร็วขึ้น 5.7 เท่า** | |

> โปรเจกต์นี้มีไฟล์ต้นทางแค่ 3 ไฟล์ — ส่วนต่างมาจากการอ่าน `.d.ts` ของไลบรารีเป็นหลัก
> เมื่อโปรเจกต์จริงมีไฟล์ 100+ ไฟล์ ส่วนต่างจะยิ่งชัดขึ้น เพราะ TS 7 เป็น native port
> ที่ทำงานแบบขนานได้ **แต่ยังไม่ได้วัดที่ขนาดนั้น — จะวัดซ้ำใน Slice 2**

---

## 5 · ข้อสรุปและคำแนะนำ

> **R-3 ปิดสำหรับฝั่ง frontend** — ใช้ **TypeScript 7.0.2 + Vite 8.2.1 +
> `@vitejs/plugin-react` 6.0.5** ได้ และควรใช้ เพราะเร็วกว่าอย่างมีนัยสำคัญ
> ทั้ง typecheck (5.7×) และ build (7×) โดย bundle เล็กลงเล็กน้อย

**เงื่อนไขบังคับที่มาพร้อมกัน**

1. ต้องมี `src/vite-env.d.ts` ที่มี `/// <reference types="vite/client" />`
   ไม่งั้น TS 7 จะ error ที่ทุก `import './x.css'`
2. อัป Vite 8 ต้องอัป `@vitejs/plugin-react` เป็น 6 พร้อมกัน
3. สคริปต์เครื่องมือบน Windows ต้องเขียน JSON แบบไม่มี BOM

**ความเสี่ยงที่ยังเหลือ (ต้องปิดใน Slice 1)**

| เรื่อง | เหตุผล |
|---|---|
| **TS 7 กับ Prisma Client** | Prisma สร้าง `.d.ts` ที่ใหญ่และซับซ้อนมาก (ในซอร์สเดิม `models/User.ts` เพียงไฟล์เดียว 55,981 bytes) ยังไม่ได้ทดสอบกับ TS 7 |
| **TS 7 กับ Express / Zod** | ยังไม่ได้ทดสอบ |
| **Vitest กับ Vite 8** | ยังไม่ได้ทดสอบ — Vitest ผูกกับเวอร์ชันของ Vite |

→ ถ้าฝั่ง backend มีปัญหา ทางออกคือ **ตรึง TS คนละเวอร์ชันต่อ workspace** ได้
(pnpm/npm workspaces ยอมให้แต่ละแพ็กเกจมี devDependency ของตัวเอง)
ไม่จำเป็นต้องถอยทั้งโปรเจกต์

---

## 6 · สิ่งที่ยกเข้าระบบจริง

| จาก spike | ไปที่ |
|---|---|
| `src/vite-env.d.ts` | ทุกแพ็กเกจ frontend |
| การเขียน JSON แบบไม่มี BOM | สคริปต์ใน `tools/` ทุกตัว + บันทึกใน README |
| ตัวเลข build/typecheck | `docs/performance.md` |
| เมทริกซ์ทดสอบแบบแยกตัวแปร | รูปแบบที่ควรใช้กับ spike อื่นที่มีหลายตัวแปร |
