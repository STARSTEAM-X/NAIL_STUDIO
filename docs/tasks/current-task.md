# Task: ระบบ Loading UI กลางของเว็บ (splash / spinner / skeleton / top progress bar)

## บริบท / ทำไมต้องทำ

ผู้ใช้รายงานว่าหน้า loading ที่ `/community` เห็นเป็นจอขาวเปล่ากับข้อความ `กำลังโหลดหน้า…`
กลางจอ ไม่มีอะไรบอกว่าเว็บกำลังทำงานอยู่

ตรวจโค้ดจริงพบว่า:

1. `apps/web/src/app/router.tsx:36` — Suspense fallback ของ lazy route ทุกหน้า
   (`CommunityPage`, `TemplatePreviewPage`, `EditorPage`, `AppointmentsPage`,
   `AppointmentDetailPage`) เป็นแค่ `<div className="center">กำลังโหลดหน้า…</div>`
   ตัวหนังสือล้วน ไม่มี spinner / โครงหน้า / แบรนด์
2. `apps/web/index.html` มีแค่ `<div id="root"></div>` เปล่า → ระหว่างที่ browser ยัง
   ดาวน์โหลด/พาร์ส bundle ผู้ใช้เห็น **จอขาวล้วน** (ไม่ใช่แม้แต่สีครีม `--ground` ของแบรนด์)
3. ข้อความ `กำลังโหลด…` กระจายอยู่ **13 จุด** ใน 9 ไฟล์ ทุกจุดเขียนสไตล์ของตัวเอง
   ไม่มีคอมโพเนนต์กลาง
4. `apps/web/src/styles/index.css` ทั้งไฟล์ (1805 บรรทัด) **ไม่มี `@keyframes` เลยสักอัน** —
   มีแค่ `* { animation: none !important }` ในบล็อก `prefers-reduced-motion` ที่
   บรรทัด 1128-1130 ยืนยันว่าไม่เคยมีระบบ animation/loading กลางมาก่อน

ผู้ใช้เลือก scope = **ทั้งระบบ** และสไตล์ = **ผสม A+B+C**
(A = spinner + แบรนด์, B = skeleton ตามโครงหน้า, C = top progress bar)

ไม่แตะ `apps/api`, `packages/contracts`, Prisma, หรือ logic การดึงข้อมูลใดๆ —
งานนี้เป็นชั้น presentation ล้วน

---

## หลักการออกแบบ (ตัดสินใจไว้ก่อน เพื่อกันการเดา)

**เลือก loader ตามสิ่งที่ผู้ใช้กำลังรอ ไม่ใช่ตามความสะดวกของโค้ด**

| สถานการณ์ | ใช้ |
| --- | --- |
| ยังไม่มี JS (ก่อน React mount) | boot splash ใน `index.html` |
| เปลี่ยน route / ตรวจสิทธิ์ / ยังไม่รู้โครงหน้า | `<LoadingScreen>` (A) |
| รู้โครงหน้าอยู่แล้ว (การ์ด, ลิสต์, กริด) | `<SkeletonGrid>` / `<SkeletonList>` (B) |
| ข้อมูลเสริมชิ้นเล็กในกล่องเล็ก | `<InlineLoading>` (dots + ข้อความ) |
| refetch เบื้องหลัง / โหลดหน้าถัดไป | `<TopProgressBar>` (C) — ไม่บังหน้า |

**กัน flash:** loader ทุกตัว (ยกเว้น boot splash) ต้อง**ไม่ปรากฏทันที** — หน่วง `220ms`
ด้วย `animation-delay` บน CSS opacity ถ้าข้อมูลมาก่อน 220ms ผู้ใช้จะไม่เห็นอะไรกระพริบเลย
ใช้ CSS ล้วน ไม่ต้องใช้ `setTimeout`/state ใน React

**Reduced motion — จุดที่ต้องระวังที่สุด:** บล็อกที่มีอยู่แล้ว
(`index.css:1128-1130`) ใช้ `* { animation: none !important }` ซึ่งจะทำให้ทุก element ที่พึ่ง
`animation: … forwards` เพื่อ fade เข้า **ค้างอยู่ที่ `opacity: 0` มองไม่เห็นถาวร**
ดังนั้นต้องเพิ่ม override ในบล็อกเดียวกันให้ทุก class ที่ใช้ fade-in กลับมา `opacity: 1 !important`
และให้ spinner/shimmer/bar แสดงเป็นสถานะนิ่งที่ยังสื่อความหมายได้ (ดู §CSS ข้อ 6)

---

## ไฟล์ที่แตะ

### สร้างใหม่

| ไฟล์ | หน้าที่ |
| --- | --- |
| `apps/web/src/components/Loading.tsx` | คอมโพเนนต์กลางทั้งหมด: `Spinner`, `LoadingScreen`, `InlineLoading`, `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonGrid` |
| `apps/web/src/components/TopProgressBar.tsx` | แถบ progress บนสุด ผูกกับ `useIsFetching()` ของ react-query |

### แก้ไข

| ไฟล์ | สิ่งที่แก้ |
| --- | --- |
| `apps/web/index.html` | เพิ่ม boot splash (inline CSS + markup) |
| `apps/web/src/main.tsx` | ลบ splash หลัง React mount |
| `apps/web/src/styles/index.css` | เพิ่มหมวด loading + `@keyframes` + แก้บล็อก reduced-motion |
| `apps/web/src/components/AppShell.tsx` | ใส่ `<TopProgressBar />` |
| `apps/web/src/app/router.tsx` | Suspense fallback + `Protected`/`GuestOnly` |
| `apps/web/src/pages/ProjectsPage.tsx` | `.project-loading` → `SkeletonGrid` |
| `apps/web/src/pages/CommunityPage.tsx` | `กำลังโหลดดีไซน์จากชุมชน…` → `SkeletonGrid`, ปุ่ม "โหลดเพิ่ม" → `Spinner` ในปุ่ม |
| `apps/web/src/pages/ProfilePage.tsx` | → `LoadingScreen` |
| `apps/web/src/pages/PublicProfilePage.tsx` | → `LoadingScreen` + ปุ่มโหลดเพิ่ม |
| `apps/web/src/pages/EditorPage.tsx` | → `LoadingScreen` |
| `apps/web/src/pages/AppointmentDetailPage.tsx` | → `LoadingScreen` |
| `apps/web/src/pages/TemplatePreviewPage.tsx` | → `LoadingScreen` |
| `apps/web/src/components/NotificationBell.tsx` | → `InlineLoading` |
| `apps/web/src/features/design/VersionHistoryPanel.tsx` | → `InlineLoading` |

---

## สเปกรายส่วน

### 1. Boot splash (`index.html` + `main.tsx`)

`index.html`:

```html
<body>
  <div id="boot-splash" aria-hidden="true">
    <div class="boot-ring"></div>
    <p class="boot-word">NAIL STUDIO <span>3D</span></p>
  </div>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

- CSS ของ splash ต้องเป็น `<style>` **inline ใน `<head>`** เท่านั้น (ห้าม import จาก
  `index.css` — ไฟล์นั้นยังไม่ถูกโหลดตอนนั้น จึงจะไม่มีผล)
- ใช้ค่าสี hardcode ตรงกับ token: พื้น `#f8f4ec`, วง `#e3d6c6`, ส่วนหมุน `#b5314c`,
  ตัวอักษร `#6b1e2b`
- `position: fixed; inset: 0; z-index: 9999` + `transition: opacity .3s`
- ต้องมี `@media (prefers-reduced-motion: reduce)` ใน inline style นี้ด้วย: หยุดหมุน
  แต่คงวงกับ wordmark ไว้

`main.tsx` — ลบหลัง React วาดเสร็จจริง:

```ts
createRoot(container).render(<StrictMode>…</StrictMode>)

const splash = document.getElementById('boot-splash')
if (splash) {
  requestAnimationFrame(() => {
    splash.style.opacity = '0'
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
    // กัน transitionend ไม่ยิงเมื่อผู้ใช้เปิด reduced-motion
    setTimeout(() => splash.remove(), 500)
  })
}
```

**เหตุผลที่ splash เป็น sibling ของ `#root` ไม่ใช่ลูกของ `#root`:** `createRoot().render()`
จะล้าง children ของ container ทิ้งเมื่อ render ครั้งแรก ถ้าวางไว้ข้างในจะหายก่อนที่ React
จะวาดเนื้อหาจริงเสร็จ ทำให้เห็นจอขาวแวบหนึ่งอยู่ดี

### 2. `Loading.tsx`

```tsx
export function Spinner({ size = 20 }: { size?: number })
export function LoadingScreen({ label, brand = true }: { label: string; brand?: boolean })
export function InlineLoading({ label }: { label: string })
export function Skeleton({ width, height, radius, className }: {...})
export function SkeletonText({ lines = 3 })
export function SkeletonCard()
export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string })
```

ข้อกำหนด:

- `LoadingScreen` = `<div className="loading-screen" role="status" aria-live="polite">`
  → ring + wordmark (`brand`) + `<p>{label}</p>`; `min-height: 50vh`
- `InlineLoading` = 3 จุดกระพริบเหลื่อมเวลา + ข้อความ, `role="status"`
- `SkeletonGrid` = `<div className="skeleton-grid" role="status" aria-label="กำลังโหลด…" aria-busy="true">`
  ข้างในเป็น `SkeletonCard` × count, การ์ดลูกทุกใบ `aria-hidden="true"` (กัน screen reader
  อ่านกล่องเปล่าซ้ำ ๆ)
- `Spinner` รับ `size` แล้วส่งเป็น inline `style={{ width: size, height: size }}`
  ความหนาขอบคุมด้วย CSS var `--spinner-weight` เพื่อไม่ต้องคำนวณใน JS
- ทุกคอมโพเนนต์ **ไม่มี state, ไม่มี effect, ไม่มี timer** — pure presentational

### 3. `TopProgressBar.tsx`

```tsx
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

export function TopProgressBar() {
  const busy = useIsFetching() + useIsMutating()
  if (busy === 0) return null
  return <div className="top-progress" role="presentation"><span /></div>
}
```

- วางใน `AppShell` เป็นลูกแรกของ `.shell` (ทั้งโหมดปกติและโหมด editor)
- `position: fixed; top: 0; z-index: 50` — ต้อง **สูงกว่า** `.navbar` (`z-index: 10`)
- ไม่ใส่ `role="status"` / `aria-live` โดยตั้งใจ: มันเป็นสัญญาณเสริมเชิงภาพ ถ้า
  announce ทุกครั้งที่ refetch เบื้องหลังจะรบกวน screen reader
- หน่วง 220ms เหมือนตัวอื่น → refetch เร็ว ๆ จะไม่เห็นแถบกระพริบ

### 4. `router.tsx`

```tsx
<Suspense fallback={<LoadingScreen label="กำลังเปิดหน้า…" />}>
```

`Protected` / `GuestOnly` → `<LoadingScreen label="กำลังตรวจสอบสิทธิ์…" brand={false} />`

(`brand={false}` เพราะสองจุดนี้เกิดเร็วมากและอาจเกิดซ้อนกับ boot splash — ไม่ต้องโชว์
wordmark สองรอบ)

### 5. หน้าที่เป็นกริด — ใช้ skeleton ให้ตรงโครงจริง

- `ProjectsPage:71-76` — แทน `.project-loading` ด้วย `<SkeletonGrid count={6} className="project-grid" />`
  ให้ skeleton ใช้ `.project-grid` ตัวเดียวกับของจริง เพื่อให้จำนวนคอลัมน์และ gap
  ตรงกันเป๊ะ ไม่มีการกระโดดของ layout ตอนข้อมูลมา
- `CommunityPage:163` — `<SkeletonGrid count={6} className="community-grid community-feed-grid" />`
- ปุ่ม "โหลดเพิ่ม" (`CommunityPage:259`, `PublicProfilePage:100`) — เปลี่ยนจากสลับข้อความ
  เป็น `<Spinner size={14} />` + คงข้อความ "โหลดเพิ่ม" ไว้ (ปุ่มไม่เปลี่ยนความกว้าง)

### 6. CSS (`index.css`)

เพิ่มหมวดใหม่ `/* ---------- loading ---------- */` ท้ายไฟล์ ประกอบด้วย:

1. `@keyframes ns-spin` — `to { transform: rotate(360deg) }`
2. `@keyframes ns-shimmer` — `100% { transform: translateX(100%) }`
3. `@keyframes ns-dot` — opacity/scale 3 จังหวะ
4. `@keyframes ns-progress` — width จาก 8% → 96% แบบ ease-out (indeterminate
   แต่ให้ความรู้สึกคืบหน้า ไม่วิ่งวน)
5. `@keyframes ns-appear` — `to { opacity: 1 }` ใช้กับทุก loader:
   `opacity: 0; animation: ns-appear .18s ease .22s forwards;`
6. **แก้บล็อก `prefers-reduced-motion` ที่บรรทัด 1128-1130** เพิ่มต่อท้ายภายในบล็อกเดิม:
   ```css
   .loading-screen, .inline-loading, .skeleton, .top-progress { opacity: 1 !important; }
   .spinner, .boot-ring { border-top-color: var(--accent); }
   .skeleton::after { display: none; }
   .top-progress span { width: 40%; }
   ```
   เพื่อไม่ให้ loader หายไปทั้งหมดเมื่อผู้ใช้เปิดโหมดลดการเคลื่อนไหว
7. สีทั้งหมดใช้ token เดิม (`--ground`, `--surface`, `--rule`, `--accent`, `--muted`,
   `--chip`) ห้าม hardcode hex ยกเว้นใน inline style ของ `index.html`
8. `.skeleton` shimmer ใช้ `::after` + `linear-gradient` + `overflow: hidden` บน parent

---

## Acceptance criteria

1. เปิด `/community` ครั้งแรก (hard reload) — ไม่เห็นจอขาวเลย: เห็นพื้นครีม + วงหมุน +
   wordmark ตั้งแต่เฟรมแรกที่ HTML มาถึง
2. หลัง React mount แล้วยังโหลด chunk ของ route อยู่ → เห็น `LoadingScreen`
   (ไม่ใช่ข้อความเปล่า)
3. หน้า Projects / Community ตอนรอ API → เห็น skeleton การ์ดที่มีจำนวนคอลัมน์และระยะห่าง
   **ตรงกับการ์ดจริง** และเมื่อข้อมูลมาถึง layout ไม่กระโดด
4. refetch เบื้องหลัง (เช่น หลัง mutate) → เห็นเฉพาะแถบบนสุด เนื้อหาเดิมไม่หายไป
5. โหลดเร็วกว่า ~220ms → ไม่เห็น loader กระพริบเลย
6. เปิด `prefers-reduced-motion: reduce` → loader ทุกตัว **ยังมองเห็นได้** (ไม่ใช่ค้างที่
   opacity 0) เพียงแต่ไม่ขยับ
7. ไม่มีข้อความ `กำลังโหลด` ที่ยังใช้ `<p className="muted">` เปล่า ๆ เหลืออยู่ใน 9 ไฟล์ข้างต้น
8. `npm run typecheck --workspace apps/web` ผ่าน
9. `npm run test --workspace apps/web` ผ่าน (ไม่มี regression)
10. `npm run build --workspace apps/web` ผ่าน

---

## Edge cases

| เคส | พฤติกรรมที่ต้องได้ |
| --- | --- |
| `prefers-reduced-motion` เปิด | loader มองเห็นได้ (ข้อ 6 ของ CSS) — **นี่คือ trap หลักของงานนี้** |
| React mount เร็วมาก (cache ครบ) | splash ถูกลบภายใน 1 frame ไม่ค้าง |
| `transitionend` ไม่ยิง (reduced-motion ปิด transition) | `setTimeout` 500ms ลบ splash เป็น fallback |
| JS พัง / bundle โหลดไม่ได้ | splash ค้างถาวร → **ยอมรับได้ในสโคปนี้** (ไม่ทำ error boundary เพิ่ม) |
| Editor route (`.shell-editor`) | top progress bar ต้องยังอยู่ และต้องไม่ทับ toolbar ของ editor |
| StrictMode double-render | โค้ดลบ splash อยู่นอก React tree จึงไม่ถูกเรียกซ้ำ |
| กริดว่าง (0 รายการ) | ยังต้องแสดง empty state เดิม ไม่ใช่ skeleton ค้าง |

---

## ความซับซ้อน

ทุกอย่างเป็น O(1) ต่อการ render; `SkeletonGrid` เป็น O(count) โดย count ≤ 6 คงที่
ไม่มี timer, ไม่มี state, ไม่มี re-render loop; `TopProgressBar` re-render เฉพาะตอนที่
จำนวน query ที่ fetch อยู่เปลี่ยนจาก 0 ↔ >0 (react-query จัดการให้แล้ว)

---

## เทสต์

โปรเจกต์นี้**ไม่มี** React Testing Library / jsdom setup (เทสต์ที่มีทั้งหมดเป็น unit test
ของ `src/utils` และ `src/3d`) — **ห้ามติดตั้ง dependency ใหม่เพื่อเขียน component test**

การตรวจสอบใช้:

1. `npm run typecheck --workspace apps/web`
2. `npm run test --workspace apps/web` (ยืนยันไม่มี regression)
3. `npm run build --workspace apps/web`
4. ตรวจด้วยตาบน `localhost:5173` ตาม acceptance criteria ข้อ 1-7
   (throttle network เป็น Slow 3G เพื่อให้เห็น loader จริง)

---

## สิ่งที่ไม่ทำในงานนี้ (YAGNI)

- ไม่ทำ error boundary / retry UI
- ไม่ทำ progress จริงแบบรู้เปอร์เซ็นต์
- ไม่ทำธีมมืด
- ไม่แตะ loading ภายใน 3D viewport (`src/3d/`)
- ไม่ทำ route prefetch / preload
