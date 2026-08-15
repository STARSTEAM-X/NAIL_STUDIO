# สเปก — Exporters: PNG + JSON (Slice 4 ข้อ 7)

## 1 · ทำไมต้องมีรอบนี้

Slice 4 เหลือข้อสุดท้าย หลังจาก Thumbnail (ข้อ 6) เสร็จแล้ว `docs/architecture.md:217-221`
วางแผนไว้ว่ามี 3 exporter: `exportSnapshot.ts` (PNG), `exportProjectJson.ts` (.nail.json),
`exportGlb.ts` (GLTFExporter — **ระบุไว้ว่า "ถ้าเหมาะสมทางเทคนิค"** ไม่ใช่ข้อบังคับ)
`docs/implementation-plan.md:344` เขียนเงื่อนไขเดียวกัน ("ถ้าประเมินแล้วเหมาะสม")

### D-39 · ตัด GLB export ออกจากรอบนี้

**อะไร**: ทำแค่ PNG + JSON รอบนี้ ไม่ทำ GLTFExporter

**ทำไม**: สำรวจแล้วพบว่า GLTFExporter จาก `three/examples/jsm/exporters/GLTFExporter.js`
import ได้จริงในโปรเจกต์นี้โดยไม่ต้องแก้ config (three's package.json export map รองรับ
`three/addons/...` อยู่แล้ว) แต่**เป็นการใช้ addon จาก `three/examples` ครั้งแรกในโค้ดเบสนี้ทั้งหมด**
ไม่มี precedent ให้อ้างอิง และ `MeshPhysicalMaterial` ที่ใช้ทำผิวเล็บ (`finishes.ts`) มี property
ขั้นสูง (clearcoat, sheen ฯลฯ) ที่ GLTFExporter แม็ปเข้า glTF PBR spec ได้ไม่ครบ — ผิวเล็บบางแบบ
(โครม/กลิตเตอร์ตาม `FINISHES` ใน `design.ts`) อาจไม่ round-trip สวยเป๊ะ ต้องมีรอบทดสอบแยกต่างหาก
ก่อนฟันธงว่า "เหมาะสมทางเทคนิค" จริงตามเงื่อนไขที่ `architecture.md` ตั้งไว้เอง — ตัดสินใจแล้วว่า
ยังตอบเงื่อนไขนั้นไม่ได้ในรอบนี้ จึงตัดออก ไม่ใช่การมองข้าม แต่เป็นการเคารพเงื่อนไข "conditional"
ตามที่เขียนไว้แต่แรก

**ทางเลือกที่ปฏิเสธ**: ทำทั้ง 3 exporter ในรอบเดียว — เพิ่มความเสี่ยงจากการรวมงานที่ยังไม่ชัวร์ทาง
เทคนิค (GLB) เข้ากับงานที่ตรงไปตรงมา (PNG/JSON) ในสเปกเดียว ถ้า GLB มีปัญหาจะดึงทั้งรอบให้ช้าไป
ด้วยโดยไม่จำเป็น

**สิ่งที่ยกไว้ทำทีหลัง**: GLB export ต้อง evaluate ก่อนว่า decorations (`InstancedMesh` ต่อ
catalog entry ตาม `nail-decoration-design.md`, **ไม่ใช่ pixel ในเท็กซ์เจอร์** — ยืนยันแล้วจาก
`DecorationInstances.tsx`) กับ `CanvasTexture` ของเล็บ round-trip ผ่าน GLTFExporter ถูกต้องไหม
ก่อนเขียนสเปกจริง

## 2 · การตัดสินใจอื่นที่ตกลงกันแล้ว

### D-40 · PNG capture จากมุมกล้องปัจจุบันของผู้ใช้ ไม่บังคับ "ดูทั้งมือ"

**อะไร**: `exportSnapshot.ts` จับภาพจากมุมกล้องที่ผู้ใช้อยู่ ณ ขณะนั้นตรงๆ **ไม่เรียก
`focusHome()`** ต่างจาก `ThumbnailCapture.tsx` (Slice 4 ข้อ 6) ที่บังคับจัดกล้องไปตำแหน่ง home
ก่อนเสมอ

**ทำไม**: Thumbnail เป็น auto-capture ที่ต้อง framing สม่ำเสมอเพื่อเทียบกันได้ในหน้ารายการ
แต่ PNG export เป็นการกดขอผู้ใช้เองโดยตรง ("export สิ่งที่เห็นอยู่") การบังคับขยับกล้องจะขัดกับ
ความคาดหวัง (ผู้ใช้ซูมเข้าไปดูเล็บนิ้วเดียวแล้วกด export ควรได้ภาพเล็บนิ้วนั้น ไม่ใช่ภาพมือทั้งก้อน
ที่ไม่ได้ขอ)

**ผลที่ตามมา**: ไม่ต้องมี settle-timeout เหมือน `ThumbnailCapture` (ไม่มีการขยับกล้องเอง จึงจับภาพ
ได้ทันทีที่กดปุ่ม — เร็วกว่าและง่ายกว่า)

### D-41 · ปุ่ม export เป็นปุ่มแบนใน `editor-actions` ไม่ทำ dropdown

**อะไร**: เพิ่มปุ่ม "ดาวน์โหลด PNG" และ "ดาวน์โหลด JSON" เป็นปุ่มแบนสองปุ่มใน
`<div className="editor-actions">` ของ `NailEditor.tsx` ข้างปุ่ม "บันทึกเป็นเวอร์ชัน" ที่มีอยู่แล้ว
ไม่สร้าง dropdown/menu component ใหม่

**ทำไม**: ทั้งแอปไม่มี dropdown/menu pattern อยู่เลย (`grep role="menu"|Dropdown|Popover` ทั้ง
`apps/web/src` ไม่เจอ) ทุก action ในหน้านี้เป็นปุ่มแบนอยู่แล้ว (`HistoryControls`, ปุ่มบันทึก)
การเพิ่มปุ่มแบนสองปุ่มตรงกับ convention เดิม ตัด GLB ออกแล้ว (D-39) เหลือ export แค่ 2 แบบ ยังไม่ถึง
จุดที่ต้องมี dropdown เพื่อประหยัดพื้นที่ (จะพิจารณาใหม่ตอนเพิ่ม GLB ทีหลังถ้าจำเป็น)

**ทางเลือกที่ปฏิเสธ**: สร้าง dropdown ตัวแรกของแอป — เป็นการลงทุนสร้าง UI pattern ใหม่สำหรับ
ปุ่มแค่ 2 ปุ่ม ไม่คุ้มในรอบนี้ (YAGNI)

## 3 · ไฟล์ใหม่

### 3.1 `apps/web/src/utils/downloadBlob.ts`

Helper กลางสำหรับ "บันทึกไฟล์ลงเครื่องผู้ใช้" — **ไม่มี precedent ในโค้ดเบสนี้เลย**
(`grep createObjectURL|download=` ทั้ง `apps/web/src` ไม่เจอ) เป็นของใหม่ทั้งหมด:

```ts
/**
 * ดาวน์โหลด Blob ลงเครื่องผู้ใช้ผ่าน <a download> ชั่วคราว
 *
 * ไม่มี precedent ในโปรเจกต์นี้มาก่อน — เป็น primitive กลางที่ exporter ทุกตัว
 * (PNG, JSON, และ GLB ในอนาคต) เรียกร่วมกัน แทนที่จะ duplicate 5 บรรทัดนี้ทุกที่
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
```

### 3.2 `apps/web/src/3d/scene/SnapshotCapture.tsx`

Ref-exposing component แพทเทิร์นเดียวกับ `ThumbnailCapture.tsx` (Slice 4 ข้อ 6) เป๊ะ —
ต่างกันแค่ไม่เรียก `focusHome()` (D-40) และ mime type เป็น `image/png`:

```tsx
import { forwardRef, useImperativeHandle } from 'react'
import { useThree } from '@react-three/fiber'

export interface SnapshotCaptureHandle {
  capture: () => Promise<Blob>
}

/**
 * Component ลูกใน <NailScene> — ไม่ render อะไรเอง แค่ expose ฟังก์ชัน capture ผ่าน ref
 * ให้ NailEditor.tsx เรียกได้ (แพทเทิร์นเดียวกับ ThumbnailCapture.tsx) ต่างจาก
 * ThumbnailCapture ตรงที่ไม่เรียก focusHome() — จับภาพจากมุมกล้องปัจจุบันตรงๆ (D-40)
 * จึงไม่ต้องรอ settle timeout ด้วย
 */
export const SnapshotCapture = forwardRef<SnapshotCaptureHandle>((_props, ref) => {
  const gl = useThree((state) => state.gl)

  useImperativeHandle(ref, () => ({
    capture: async () => {
      const canvas = gl.domElement
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })
      if (!blob) throw new Error('สร้างภาพไม่สำเร็จ')
      return blob
    },
  }), [gl])

  return null
})
SnapshotCapture.displayName = 'SnapshotCapture'
```

### 3.3 `apps/web/src/3d/scene/exporters/exportProjectJson.ts`

Pure function ล้วน ไม่แตะ DOM/canvas — แยกไฟล์จาก `SnapshotCapture` เพราะไม่เกี่ยวกับ R3F/canvas
เลย ทดสอบได้ตรงไปตรงมาแบบ pure function:

```ts
import { designDocumentSchema, type DesignDocument } from '@nail-studio/contracts'

/**
 * แปลงเอกสารงานเป็น JSON string สำหรับดาวน์โหลดเป็น .nail.json
 *
 * parse ผ่าน schema ก่อนเสมอ แม้เอกสารในสโตร์ควรจะถูกต้องอยู่แล้ว (ผ่าน schema มาตั้งแต่
 * โหลด) — เพราะ export คือจุดที่ข้อมูลออกจากระบบไปสู่ผู้ใช้ ไม่อยากให้เอกสารเพี้ยนหลุด
 * ออกไปเงียบๆ ถ้ามันเพี้ยนจริงอยากให้ throw ตรงนี้ทันทีดีกว่าให้ไฟล์เสียหลุดออกไป
 */
export function exportProjectJson(document: DesignDocument): string {
  const validated = designDocumentSchema.parse(document)
  return JSON.stringify(validated, null, 2)
}
```

### 3.4 ชื่อไฟล์ที่ดาวน์โหลด

ทั้งสอง exporter ใช้ชื่อโปรเจกต์เป็นฐาน (`detail.project.name` ที่มีอยู่แล้วใน `NailEditor.tsx`)
sanitize อักขระที่ไฟล์ระบบไม่รองรับก่อนใช้เป็นชื่อไฟล์:

```ts
// ใน NailEditor.tsx หรือ utils/downloadBlob.ts (เพิ่มเป็น export ที่สอง)
function sanitizeFilename(name: string): string {
  // ตัดอักขระที่ Windows/macOS/Linux ห้ามใช้ในชื่อไฟล์ทั้งหมด (\/:*?"<>|) เหลือ
  // ช่องว่างและอักขระไทยไว้ตามเดิม — เกิด edge case ชื่อว่างได้ถ้าชื่องานเป็นอักขระ
  // ต้องห้ามล้วนๆ (หายาก แต่ป้องกันไว้)
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '').trim()
  return cleaned.length > 0 ? cleaned : 'nail-studio-design'
}
```

PNG: `${sanitizeFilename(detail.project.name)}.png` · JSON: `${sanitizeFilename(detail.project.name)}.nail.json`

## 4 · แก้ไฟล์เดิม

### 4.1 `apps/web/src/3d/scene/NailScene.tsx` หรือจุดที่ render `<NailScene>`

เพิ่ม `<SnapshotCapture ref={snapshotRef} />` เป็นลูกของ `<NailScene>` ใน `NailEditor.tsx`
ข้าง `<ThumbnailCapture ref={thumbnailRef} />` ที่มีอยู่แล้ว (จุดเดียวกัน, sibling component)

### 4.2 `apps/web/src/features/design/NailEditor.tsx`

1. เพิ่ม `const snapshotRef = useRef<SnapshotCaptureHandle>(null)` ข้าง `thumbnailRef` ที่มีอยู่แล้ว
2. เพิ่มปุ่ม 2 ปุ่มใน `<div className="editor-actions">` ก่อนปุ่ม "บันทึกเป็นเวอร์ชัน":

```tsx
<button
  type="button"
  className="btn btn-ghost"
  onClick={async () => {
    try {
      if (!snapshotRef.current) return
      const blob = await snapshotRef.current.capture()
      downloadBlob(blob, `${sanitizeFilename(detail.project.name)}.png`)
    } catch (error) {
      store.setState({ notice: 'ดาวน์โหลดภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
      console.error('[export] PNG capture failed', error)
    }
  }}
>
  ดาวน์โหลด PNG
</button>
<button
  type="button"
  className="btn btn-ghost"
  onClick={() => {
    try {
      const json = exportProjectJson(store.getState().document)
      const blob = new Blob([json], { type: 'application/json' })
      downloadBlob(blob, `${sanitizeFilename(detail.project.name)}.nail.json`)
    } catch (error) {
      store.setState({ notice: 'ดาวน์โหลดไฟล์งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
      console.error('[export] JSON export failed', error)
    }
  }}
>
  ดาวน์โหลด JSON
</button>
```

`store` คือ `useDesignStoreApi()` ที่มีอยู่แล้วในไฟล์นี้ — คืนค่าเป็น `DesignStore` (type
`StoreApi<DesignState & DesignActions>` ตาม `designStore.ts`) ซึ่งมีเมธอด `.getState()` และ
`.setState()` ตรงตัวจาก Zustand vanilla API (ยืนยันแล้วจาก `DesignStoreProvider.tsx:28`) —
เรียก `store.getState().document` และ `store.setState({ notice: '...' })` ได้ตรงๆ ไม่ต้องผ่าน
React hook `useDesign` เพราะทั้งสอง handler นี้ทำงานนอก render cycle (event handler)

## 5 · Error handling

- PNG capture คืน `null` (WebGL context lost หรือ canvas ใช้งานไม่ได้) → throw ใน
  `SnapshotCapture.capture()` → catch ที่ปุ่ม → ตั้ง `notice` เดียวกับระบบ notice ที่มีอยู่แล้ว
  (แสดงผ่าน `{notice && ...}` block ที่ `NailEditor.tsx` render อยู่แล้วบรรทัด 200)
- JSON export: `designDocumentSchema.parse` throw ถ้าเอกสารผิด schema (ไม่ควรเกิดในทางปฏิบัติ)
  → catch ที่ปุ่มเช่นกัน ไม่ปล่อยให้ error หลุดขึ้นไปทำ component พัง

## 6 · การทดสอบ

- `downloadBlob.test.ts` — mock `URL.createObjectURL`/`URL.revokeObjectURL` (vitest `vi.fn()`)
  และ `document.createElement`/`appendChild`/`removeChild` ยืนยันว่าเรียกตามลำดับที่ถูกต้องและ
  `revokeObjectURL` ถูกเรียกด้วย url เดียวกับที่ `createObjectURL` คืนมา, `anchor.download`
  ตรงกับ filename ที่ส่งเข้าไป
- `sanitizeFilename` — เทส pure function: ชื่อที่มีอักขระต้องห้าม (`/`, `\`, `:`, ฯลฯ) ถูกตัดออก,
  ชื่อว่างหลังตัดแล้วได้ fallback `nail-studio-design`, ชื่อภาษาไทยผ่านไม่แตะต้อง
- `exportProjectJson.test.ts` — ป้อน `DesignDocument` ที่ถูกต้อง (จาก `createEmptyDocument()`)
  → `JSON.parse(result)` แล้วเทียบเท่ากับต้นฉบับ (deep equal), ป้อนเอกสารที่ผิด schema (เช่น cast
  แล้วลบ field บังคับออก) → throw
- `SnapshotCapture`/`exportSnapshot` เป็น browser canvas API ล้วน (`canvas.toBlob`,
  `HTMLCanvasElement`) — ไม่มี jsdom/WebGL test environment ในโปรเจกต์นี้ (ข้อจำกัดเดิมที่ระบุไว้
  ซ้ำในทุกสเปกก่อนหน้า) ทดสอบด้วยตาบนเบราว์เซอร์จริงตอนปิดงานแทน

## 7 · ผลกระทบที่ต้องยอมรับ

- PNG export ได้ความละเอียดเท่ากับ canvas ที่ render อยู่จริง (ขึ้นกับขนาดหน้าจอ/`dpr`) ไม่มี
  ตัวเลือกความละเอียดสูงกว่าที่จอแสดงในรอบนี้
- ไม่มี GLB export (D-39) — ผู้ใช้ที่ต้องการโมเดล 3D เต็มรูปแบบยังทำไม่ได้จนกว่าจะประเมินและทำรอบหน้า
- ชื่อไฟล์อิงจากชื่อโปรเจกต์เท่านั้น ไม่มีตัวเลือกตั้งชื่อไฟล์เองตอนดาวน์โหลด (ใช้ default ของ
  เบราว์เซอร์ที่ให้ผู้ใช้ save-as เปลี่ยนชื่อได้อยู่แล้วตามปกติ)

## 8 · สิ่งที่ไม่อยู่ในรอบนี้

- GLB export / GLTFExporter (D-39 ตัดออก — ต้อง evaluate ก่อนว่า InstancedMesh decorations +
  CanvasTexture round-trip ถูกต้องไหม)
- Dropdown/menu UI สำหรับปุ่ม export (D-41 ตัดออก — พิจารณาใหม่ตอนเพิ่ม GLB)
- ตัวเลือกความละเอียด PNG แบบกำหนดเอง
- ตั้งชื่อไฟล์เองตอนดาวน์โหลด

## 9 · เกณฑ์ว่าเสร็จ

- กด "ดาวน์โหลด PNG" → ได้ไฟล์ `.png` ที่ตรงกับสิ่งที่เห็นในมุมกล้องปัจจุบัน (ซูมเข้าเล็บนิ้วเดียว →
  ได้ภาพเล็บนิ้วนั้น ไม่ใช่ภาพมือทั้งก้อน) ชื่อไฟล์ตรงกับชื่อโปรเจกต์
- กด "ดาวน์โหลด JSON" → ได้ไฟล์ `.nail.json` ที่เปิดด้วย JSON parser ทั่วไปได้ และ parse กลับด้วย
  `designDocumentSchema` ผ่านสำเร็จ (round-trip ถูกต้อง)
- ทั้งสองปุ่มไม่บล็อก/รบกวนการทำงานปกติของ editor (ไม่ทำให้ document เปลี่ยน ไม่ทำให้ history
  เปลี่ยน ไม่ทำให้กล้องขยับ — เฉพาะ PNG ที่จงใจไม่ขยับกล้องตาม D-40)
- `npm run typecheck`, `npm run test` ผ่านสะอาด
