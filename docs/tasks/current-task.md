# Task: จบ merge `claude/community-ui-redesign-us06jq` เข้า main (เก็บเฉพาะ loading ที่ยังมีค่า)

## สถานะปัจจุบัน

อยู่กลาง merge บน branch `merge/community-redesign` (merge-base = `f983750`)
conflict ทั้ง 9 ไฟล์ **resolve เชิงกลไปแล้ว** โดยเอาเวอร์ชันของ branch ทั้งหมด
และรับการลบ `apps/web/src/pages/ProfilePage.tsx` แล้ว — ตอนนี้ไม่มี conflict marker เหลือ
แต่ **ยังไม่ commit** เพราะยังต้องเอาของจาก main กลับมา 4 อย่าง

`git stash` / `git checkout` ทับไฟล์เหล่านี้ไม่ได้ — ระวังทำ merge state พัง

## บริบท

branch นี้ redesign frontend ทั้งระบบ (66 ไฟล์) และ**มีระบบ skeleton ของตัวเองอยู่แล้ว**
คือ `apps/web/src/components/ui/States.tsx` (`FeedSkeletonList`, `ListSkeleton`,
`PostCardSkeleton`, `TemplateCardSkeleton`) ใช้คลาส `.nc-skel*` ใน `community.css`
ถูกเรียกใช้ 13 จุดใน 10 หน้า

ดังนั้น `SkeletonGrid` / `SkeletonCard` / `Skeleton` / `SkeletonText` ใน
`apps/web/src/components/Loading.tsx` **ถูกแทนที่แล้ว ต้องลบทิ้ง** — งาน parity ที่เคยวัดไว้
อิงกับ `.template-card` / `.project-card` ซึ่ง branch ลบไปแล้ว จึงเป็นโมฆะ

ของจาก main ที่ยัง**ไม่ซ้ำกับ branch** และต้องเก็บไว้:

| ของ | สถานะ |
| --- | --- |
| boot splash (`index.html` + `main.tsx`) | รอดอยู่แล้ว branch ไม่เคยแตะ — **ห้ามแตะ** |
| `TopProgressBar.tsx` | ไฟล์ยังอยู่ แต่ AppShell ของ branch ไม่ได้เรียก → ต้องเติมกลับ |
| `LoadingScreen` / `Spinner` / `InlineLoading` | ยังใช้อยู่ใน EditorPage, NotificationBell, VersionHistoryPanel (auto-merge ผ่านแล้ว) |
| loading CSS | หายไปกับ `index.css` ของ branch → ต้องพอร์ตกลับบางส่วน |

---

## งานที่ต้องทำ 4 ข้อ

### 1. `apps/web/src/app/router.tsx`

ตอนนี้เป็นเวอร์ชันของ branch มี `<div className="center">กำลังตรวจสอบสิทธิ์…</div>`
อยู่ **3 จุด** ในฟังก์ชัน `Protected`, `GuestOnly`, `RoleOnly`

เปลี่ยนทั้งสามจุดเป็น:

```tsx
<LoadingScreen label="กำลังตรวจสอบสิทธิ์…" brand={false} />
```

เพิ่ม `import { LoadingScreen } from '@/components/Loading.tsx'`

**ห้ามแตะ Suspense fallback** — `<div className="page"><ListSkeleton count={2} lines={4} /></div>`
ของ branch ถูกแล้ว ให้คงไว้

### 2. `apps/web/src/components/AppShell.tsx`

เอาเวอร์ชันของ branch ไว้ทั้งหมด เพิ่มแค่ `<TopProgressBar />` เป็น**ลูกตัวแรก**ของ
`<div className={\`shell ...\`}>` (ก่อน `{!isEditor && (...)}`) พร้อม import

ต้องอยู่นอกเงื่อนไข `!isEditor` เพื่อให้แถบทำงานในหน้า editor ด้วย

### 3. `apps/web/src/components/Loading.tsx`

ลบ `Skeleton`, `SkeletonProps`, `SkeletonText`, `SkeletonCard`, `SkeletonGrid` ออกให้หมด
เหลือเฉพาะ `Spinner`, `LoadingScreen`, `InlineLoading`

ตรวจด้วย `grep -rn "SkeletonGrid\|SkeletonCard\|SkeletonText" apps/web/src` ว่าไม่มีที่ไหน
เรียกอีกแล้ว (ต้องไม่เจอ — หน้าที่เคยเรียกถูกแทนด้วยเวอร์ชัน branch หมดแล้ว)

### 4. `apps/web/src/styles/index.css` — งานหลัก

ตอนนี้เป็นเวอร์ชันของ branch: `@import` 5 ไฟล์ (`tokens`, `ui`, `appointments`,
`shops`, `community`) ตามด้วย base + editor styles

**4.1 แก้วงเล็บพัง (บั๊กของ branch ไม่เกี่ยวกับ merge)**

ราวบรรทัด 810-812 ปัจจุบันเป็น:

```css
  .conflict-actions, .recovery-actions { grid-template-columns: 1fr; }}}}}}

@media (prefers-reduced-motion: reduce) {{{{{
  * { animation: none !important; transition: none !important; }}}}}}
```

ยืนยันแล้วด้วย `new CSSStyleSheet().replaceSync()` ในเบราว์เซอร์จริง: parser **ทิ้งบล็อก
reduced-motion ทั้งบล็อก** (parse ได้ 3 rules ไม่มีบล็อกนี้) แปลว่าตอนนี้บน branch
`prefers-reduced-motion` ระดับ global ไม่ทำงานเลย

แก้เป็นวงเล็บที่ถูกต้อง — ปิด media query ก่อนหน้าด้วย `}` เดียว และบล็อก reduced-motion
เปิด `{` เดียว ปิด `}` เดียว หลังแก้ให้ตรวจว่าจำนวน `{` กับ `}` ทั้งไฟล์เท่ากัน

อย่าไปแตะบล็อก reduced-motion ใน `ui.css` (บรรทัด ~228) และ `community.css` (~647) —
สองอันนั้นเขียนถูกอยู่แล้ว

**4.2 พอร์ต loading CSS กลับมา**

ดูของเดิมได้จาก `git show main:apps/web/src/styles/index.css` (หมวด
`/* ---------- loading ---------- */` ท้ายไฟล์)

**เอามา:**
- `@keyframes ns-spin`, `ns-dot`, `ns-progress`, `ns-appear`
- `.spinner`
- `.loading-screen`, `.loading-wordmark`, `.loading-label`
- `.inline-loading`, `.inline-loading-dots` (+ `:nth-child` ทั้งสอง),
  `.notification-popover .inline-loading`
- `.top-progress`, `.top-progress span`
- กฎ fade-in รวม: `opacity: 0; animation: ns-appear .18s ease .22s forwards;`
  บน `.loading-screen`, `.inline-loading`, `.top-progress` (ตัด `.skeleton-grid` ออกจาก
  selector list)

**ไม่เอา:**
- `@keyframes ns-shimmer`
- `.skeleton`, `.skeleton::after`, `.skeleton-grid`, `.skeleton-card*`,
  `.skeleton-text*`, `.project-grid .skeleton-card-media`,
  `.community-grid .skeleton-card-media`
- `.community-load-more`, `.community-load-more-spinner` — ปุ่มโหลดเพิ่มของ branch
  เขียนใหม่แล้ว **แต่ต้องเช็คก่อน** ด้วย `grep -rn "community-load-more" apps/web/src`
  ถ้ายังมีคนใช้อยู่ให้เอากลับมาด้วย

**4.3 เติม override ใน reduced-motion ที่เพิ่งซ่อม**

พอวงเล็บถูก บล็อก `* { animation: none !important }` จะกลับมาทำงานจริงเป็นครั้งแรก
ซึ่งจะทำให้ loader ที่ใช้ `animation: … forwards` เพื่อ fade เข้า **ค้างที่ `opacity: 0`
มองไม่เห็นถาวร** ต้องเพิ่มในบล็อกเดียวกัน:

```css
.loading-screen, .inline-loading, .top-progress, .spinner { opacity: 1 !important; }
.spinner { border-top-color: var(--accent); }
.top-progress span { width: 40% !important; }
```

`!important` บน `.top-progress span` จำเป็น เพราะกฎฐาน `width: 8%` อยู่ท้ายไฟล์
และ `@media` ไม่เพิ่ม specificity — ตัวหลังจะชนะถ้าไม่ใส่

ใช้ CSS custom property เดิมทั้งหมด (`--accent`, `--rule`, `--muted`, `--deep`, `--chip`)
ห้าม hardcode hex

---

## Acceptance criteria

1. ไม่มี conflict marker เหลือในโปรเจกต์
2. `grep -rn "SkeletonGrid\|SkeletonCard\|SkeletonText\|\.skeleton" apps/web/src` ไม่เจอของเก่า
   (คลาส `.nc-skel*` ของ branch เป็นคนละตัว ไม่นับ)
3. จำนวน `{` เท่ากับ `}` ใน `apps/web/src/styles/index.css`
4. บล็อก `@media (prefers-reduced-motion: reduce)` ใน `index.css` parse ได้จริง
5. `TopProgressBar` ถูก render ทั้งหน้าปกติและหน้า editor
6. boot splash ใน `index.html` และโค้ดลบ splash ใน `main.tsx` **ไม่ถูกแตะเลย**
7. `npm.cmd run typecheck --workspace apps/web` ผ่าน
8. `npm.cmd run test --workspace apps/web` ผ่าน
9. `npm.cmd run build --workspace apps/web` ผ่าน

## ห้ามทำ

- ห้าม `git commit` — Claude จะรีวิวก่อน
- ห้าม `git merge --abort` / `git reset` — จะทำ merge state พัง
- ห้ามติดตั้ง dependency ใหม่
- ห้ามแก้ไฟล์อื่นนอกจาก 4 ไฟล์ข้างบน
