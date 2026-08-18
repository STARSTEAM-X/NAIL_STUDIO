# Task: ยุบปุ่มใน editor topbar เป็น split button ของ "บันทึก"

## เป้าหมาย

`apps/web/src/features/design/NailEditor.tsx` แถบบนขวาตอนนี้มีปุ่มเรียงกัน 6 ตัว:

```
[PNG] [JSON] [แชร์] [ชุมชน] [นัดหมาย] [🔔] [โปรไฟล์] [✓ บันทึก]
```

ต้องการให้เหลือ:

```
[undo/redo] [🔔] [โปรไฟล์] [✓ บันทึก][▾]
```

- **PNG / JSON / แชร์** ย้ายเข้าเมนู dropdown ที่เปิดจากปุ่ม `▾` ซึ่งติดกับปุ่มบันทึก
- **ชุมชน / นัดหมาย** ลบทิ้ง (เข้าถึงได้จาก navbar หลักนอกหน้า editor อยู่แล้ว)
- ปุ่มบันทึกทำงานเหมือนเดิมทุกอย่าง

---

## 1. คอมโพเนนต์ใหม่ `apps/web/src/features/design/EditorSaveMenu.tsx`

Split button — ปุ่มสองตัวติดกันเป็นก้อนเดียว

```tsx
interface EditorSaveMenuProps {
  saving: boolean
  shareDisabled: boolean
  onSave: () => void
  onExportPng: () => void
  onExportJson: () => void
  onShare: () => void
}
```

โครง:

```tsx
<div className="editor-save-split" ref={rootRef}>
  <button className="editor-topbar-primary editor-save-main" disabled={saving} onClick={onSave}>
    <Icon name="check" size={15} />
    <span>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</span>
  </button>
  <button
    ref={triggerRef}
    className="editor-topbar-primary editor-save-caret"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label="เมนูส่งออกและแชร์"
    title="ส่งออกและแชร์"
    onClick={() => setOpen((v) => !v)}
  >
    <Icon name="chevron-down" size={14} />
  </button>

  {open && (
    <div className="editor-save-menu" role="menu" aria-label="ส่งออกและแชร์">
      … 3 รายการ …
    </div>
  )}
</div>
```

รายการในเมนู (`role="menuitem"`, class `editor-save-menu-item`):

| ไอคอน | ข้อความ | action | disabled |
| --- | --- | --- | --- |
| `image` | ส่งออกเป็นภาพ PNG | `onExportPng` | ไม่ |
| `layers` | ส่งออกไฟล์งาน JSON | `onExportJson` | ไม่ |
| `arrow-up-right` | แชร์ลงชุมชน | `onShare` | `shareDisabled` |

ทุกรายการต้อง `setOpen(false)` ก่อนเรียก callback

**เหตุผลที่ PNG/JSON ไม่ disable ตอนกำลังบันทึก:** สองอันนี้อ่านจาก canvas
และ store ตรง ๆ ไม่พึ่งผลการบันทึก ส่วน **แชร์ต้อง disable** เพราะโค้ดเดิมบันทึกก่อนแชร์
และมีข้อความ `'กำลังบันทึกงานอยู่ กรุณาลองแชร์อีกครั้ง'` รออยู่แล้ว

**a11y — ยกรูปแบบจาก `EditorProfileDropdown.tsx` มาทั้งชุด ห้ามคิดใหม่:**

- `useEffect` ที่ทำงานเฉพาะตอน `open`
- ปิดเมื่อ `pointerdown` นอก `rootRef`
- ปิดเมื่อกด `Escape` แล้ว `triggerRef.current?.focus()`
- ถอด listener ใน cleanup

## 2. `NailEditor.tsx`

**2.1** แยก logic ออกจาก `onClick` เดิมเป็นฟังก์ชันตั้งชื่อ (วางใกล้ handler อื่นในคอมโพเนนต์)

- `exportPng` — ยก body จาก `onClick` ของปุ่ม PNG (บรรทัด ~347-358) มาทั้งก้อน
  รวม try/catch, `store.setState({ notice: … })` และ `console.error` เดิม
- `exportJson` — ยก body จาก `onClick` ของปุ่ม JSON (บรรทัด ~367-375) มาทั้งก้อน
- `openShareDialog` — `setShareError(null)` + `setShareDialogOpen(true)`

**ห้ามเปลี่ยนพฤติกรรมหรือข้อความ error ใด ๆ** — เป็นการย้ายโค้ดล้วน

**2.2** ลบออกจาก JSX:

- ปุ่ม PNG ทั้งก้อน (`className="editor-topbar-action"` + label `PNG`)
- ปุ่ม JSON ทั้งก้อน
- ปุ่ม แชร์ ทั้งก้อน (`editor-topbar-action editor-topbar-share`)
- ปุ่ม `ชุมชน` และ `นัดหมาย` สองตัวใน `<div className="editor-topbar-nav">`
- `<span className="editor-topbar-divider" />` ที่อยู่ระหว่าง `HistoryControls` กับปุ่ม PNG
  (ถ้าหลังลบแล้วมันคั่นระหว่างอะไรไม่ได้อีก)

**เก็บ `<div className="editor-topbar-nav">` ไว้** เพราะยังห่อ `<NotificationBell />` อยู่
แต่เอา `aria-label="ทางลัด"` ออก เพราะไม่ใช่กลุ่มทางลัดอีกแล้ว

**2.3** แทนที่ปุ่ม `editor-topbar-primary` เดิม (บรรทัด ~419-444) ด้วย:

```tsx
<EditorSaveMenu
  saving={saveVersion.isPending || autosave.isVersionSavePending}
  shareDisabled={saveVersion.isPending || autosave.isVersionSavePending || createTemplate.isPending}
  onSave={handleSaveVersion}
  onExportPng={exportPng}
  onExportJson={exportJson}
  onShare={openShareDialog}
/>
```

ยก body ของ `onClick` เดิมไปเป็น `handleSaveVersion` — **ห้ามแก้ logic ข้างใน**
(`autosave.runVersionSave`, `saveVersion.mutateAsync`, `explicitSaveUi`,
`captureAndUploadThumbnail`, `.catch`)

**2.4** ตรวจ import ที่อาจไม่ได้ใช้แล้ว — `navigate` **ยังใช้อยู่** (ปุ่มแบรนด์ + `onViewProfile`)
ห้ามลบ ส่วน `Icon` ยังใช้ที่อื่นเช่นกัน อย่าลบ import ที่ยังมีคนเรียก และอย่าทิ้ง import ที่ตายแล้ว

## 3. `apps/web/src/styles/index.css`

**3.1 เพิ่ม style ของ split button**

- `.editor-save-split { position: relative; display: inline-flex; }`
- `.editor-save-main` — มุมขวาตัดตรง (`border-top-right-radius: 0; border-bottom-right-radius: 0`)
- `.editor-save-caret` — มุมซ้ายตัดตรง, กว้างพอดีไอคอน (`padding: 0.4rem 0.5rem`),
  คั่นด้วย `border-left: 1px solid rgb(255 255 255 / 25%)` ให้เห็นว่าเป็นสองปุ่ม
- `.editor-save-menu` — `position: absolute; top: calc(100% + 0.35rem); right: 0;`
  **ต้องชิดขวา** เพราะปุ่มอยู่ริมขวาสุดของ topbar ถ้าชิดซ้ายเมนูจะล้นออกนอกจอ
  ใช้ `z-index` สูงกว่า `.editor-topbar` (ดูค่าของ `.editor-profile-menu` แล้วใช้ระดับเดียวกัน)
- `.editor-save-menu-item` — ลอกหน้าตาจาก `.editor-profile-menu-item` ที่มีอยู่
  รวมสถานะ `:disabled`

ใช้ CSS custom property เดิมทั้งหมด ห้าม hardcode hex ยกเว้นสีขาวโปร่งบนพื้น accent
ที่โค้ดเดิมทำอยู่แล้ว

**3.2 ลบ CSS ที่ตายแล้ว — จุดนี้พลาดง่ายที่สุด อ่านให้ครบก่อนลบ**

ตัวที่ตาย: `.editor-topbar-action`, `.editor-topbar-action-icon`,
`.editor-topbar-action-label`, `.editor-topbar-share`, `.editor-topbar-link`

> **`.editor-topbar-actions` (มี s ท้าย) คือ container ที่ยังใช้อยู่ ห้ามลบเด็ดขาด**
> อย่าสับสนกับ `.editor-topbar-action` (ไม่มี s)

จุดที่ต้องแก้แบบเลือกเฉพาะ selector ไม่ใช่ลบทั้งบล็อก:

- บรรทัด ~864 กลุ่ม `border: 0; background: transparent; …` —
  เอา `.editor-topbar-action,` และ `.editor-topbar-link,` ออก
  **เก็บ** `.editor-topbar-icon-button`, `.editor-topbar-user`,
  `.editor-topbar-brand`, `.editor-profile-trigger`
- บรรทัด ~888 กลุ่ม `:hover` — เอา `.editor-topbar-action:hover,`
  และ `.editor-topbar-link:hover,` ออก เก็บที่เหลือ
- บรรทัด ~892 กลุ่ม `:focus-visible` — เอา `.editor-topbar-action:focus-visible,`
  และ `.editor-topbar-link:focus-visible,` ออก เก็บที่เหลือ
- บรรทัด ~1042-1052 — ลบบล็อก `.editor-topbar-action`, `.editor-topbar-action-icon`,
  `.editor-topbar-action-label` ทั้งสามอัน
- บรรทัด ~1055 — ลบ `.editor-topbar-link { … }`
- ในบล็อก `@media (max-width: 1080px)` — เอา `.editor-topbar-nav .editor-topbar-link,`
  ออกจากกลุ่ม `display: none` **เก็บ** `.editor-topbar-brand-name`,
  `.editor-profile-trigger-copy`, `.editor-profile-chevron`
- ในบล็อก `@media (max-width: 720px)` — เอา `.editor-topbar-action-label` ออกจากกลุ่ม
  **เก็บ** `.editor-topbar-actions > .editor-topbar-divider { display: none }`
  และลบบล็อก `.editor-topbar-action { width: 2rem; … }`

**3.3 จอเล็ก**

บล็อก 720px มี `.editor-topbar-primary { width: 2.1rem; justify-content: center; padding: 0.4rem; }`
กับ `.editor-topbar-primary span:last-child { display: none; }` — ตอนนี้ `.editor-topbar-primary`
มีสองตัวในก้อนเดียว กฎ `width: 2.1rem` จะบีบทั้งคู่จนแคบผิด

แก้ให้ปุ่มบันทึกยังกดได้และ caret ไม่หาย: กำหนดกฎเฉพาะ `.editor-save-main` /
`.editor-save-caret` ในบล็อกนี้แทนการใช้กฎรวมของ `.editor-topbar-primary`
และตรวจว่า `span:last-child { display: none }` ไม่ไปซ่อนไอคอน caret

---

## Acceptance criteria

1. topbar เหลือ: undo/redo, 🔔, โปรไฟล์, `[บันทึก][▾]` — ไม่มี PNG / JSON / แชร์ /
   ชุมชน / นัดหมาย เป็นปุ่มเดี่ยวอีก
2. กด `▾` เปิดเมนู 3 รายการ · กดนอกเมนูปิด · กด Escape ปิดแล้วโฟกัสกลับที่ปุ่ม `▾`
3. PNG / JSON ยังดาวน์โหลดได้ ชื่อไฟล์เหมือนเดิม (`<ชื่องาน>.png`, `<ชื่องาน>.nail.json`)
4. แชร์ยังเปิด `ShareTemplateDialog` ได้ และ **disabled ตอนกำลังบันทึก**
5. ปุ่มบันทึกทำงานเหมือนเดิมทุกประการ รวม autosave, thumbnail และ error
6. เมนูไม่ล้นขอบขวาของจอ
7. `grep -rn "editor-topbar-action\b\|editor-topbar-share\|editor-topbar-link"` ไม่เจอ
   (ยกเว้นคอมเมนต์อธิบายใน `components/ui/Button.tsx` ที่พูดถึงประวัติ — ปล่อยไว้)
8. `.editor-topbar-actions` ยังอยู่ครบ
9. `{` เท่ากับ `}` ใน `index.css`
10. typecheck / test / build ผ่านทั้งหมด

## ห้ามทำ

- ห้าม commit
- ห้ามเปลี่ยน logic การบันทึก autosave หรือ share
- ห้ามเปลี่ยนข้อความ error / notice เดิม
- ห้ามติดตั้ง dependency ใหม่
