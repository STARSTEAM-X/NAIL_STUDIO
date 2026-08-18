# Task: เอาแถบนำทางซ้ายของหน้า /community ออก

## บริบท

หน้า `/community` ตอนนี้เป็น grid 3 คอลัมน์ `15.5rem | 1fr | 19rem`

- ซ้าย `<nav class="nc-nav">` — `CommunityNav`
- กลาง `<main class="nc-main">` — ฟีด
- ขวา `<aside class="nc-rail">` — `CommunityRail`

ผู้ใช้ขอให้เอา**ฝั่งซ้ายออก** เหลือฟีด + rail ขวา

ตรวจแล้วว่าปลอดภัย: `CommunityToolbar` มีปุ่มซ้ำกับ nav ซ้ายครบทุกตัว — sort
(`ล่าสุด`/`ยอดนิยม`), view (`feed`/`grid`) และ chip หมวดหมู่ทั้งหมด — **ฟังก์ชันกรองจึงไม่หาย**

สิ่งที่หายจริงคือทางลัด 3 ลิงก์ (ผลงานของฉัน / โปรไฟล์สาธารณะ / การนัดหมาย) ซึ่งมีใน
navbar หลักอยู่แล้ว และปุ่ม "แชร์ผลงานใหม่" ซึ่งบนมือถือถูก `display: none` อยู่แล้ว
และมี `CommunityComposer` อยู่ในฟีดทำหน้าที่เดียวกัน — ยอมรับได้ ไม่ต้องหาที่ใหม่ให้

## ไฟล์ที่แตะ

### 1. `apps/web/src/pages/CommunityPage.tsx`

- ลบบรรทัด 8: `import { CommunityNav } from '@/features/community/components/CommunityNav.tsx'`
- ลบบรรทัด 77: `<CommunityNav state={state} buildHref={buildHref} currentUserId={currentUser?.id} />`

`buildHref` และ `currentUser` **ยังใช้ต่อ** ที่ `<CommunityRail>` บรรทัด 209 และที่
`nc-header-me` / `CommunityComposer` — ห้ามลบตัวแปรพวกนี้ทิ้ง

### 2. ลบไฟล์ `apps/web/src/features/community/components/CommunityNav.tsx`

`grep -rn "CommunityNav" apps/web/src` ต้องไม่เหลือผลลัพธ์เลยหลังแก้

### 3. `apps/web/src/styles/community.css`

**3.1** `.nc-layout` (บรรทัด ~31)

```css
grid-template-columns: 15.5rem minmax(0, 1fr) 19rem;
```
→
```css
grid-template-columns: minmax(0, 1fr) 19rem;
```

**3.2** บล็อก `@media (max-width: 1200px)` (บรรทัด ~769-773)

```css
.nc-layout { grid-template-columns: 14.5rem minmax(0, 1fr); }
```
→
```css
.nc-layout { grid-template-columns: minmax(0, 1fr); }
```

ถ้าไม่แก้ข้อนี้ ช่วงจอ 960-1200px จะเหลือคอลัมน์ซ้ายว่างเปล่ากว้าง 14.5rem
เพราะ rail ถูกซ่อนไปแล้วแต่ grid ยังจองที่ให้ nav ที่ไม่มีอยู่จริง

แก้คอมเมนต์ไทยเหนือบล็อกนี้ (`/* เดสก์ท็อปแคบ: ซ่อนแผงขวา แต่ยังคงเมนูซ้าย */`)
ให้ตรงกับพฤติกรรมใหม่ด้วย

**3.3** ลบกฎ `.nc-nav*` ที่ตายแล้วทั้งหมด

- บล็อก base: บรรทัด ~49-95 รวมหัวข้อคอมเมนต์ `/* ---------- แถบนำทางซ้าย ---------- */`
  ครอบคลุม `.nc-nav`, `.nc-nav-scroll`, `.nc-nav-group`, `.nc-nav-label`,
  `.nc-nav-item` (+ `svg` / `:hover` / `:focus-visible`), `.nc-nav-on`,
  `.nc-nav-item.active`, `.nc-nav-cta`
- ในบล็อก `@media (max-width: 960px)`: บรรทัด ~778-794 ทุกกฎที่ขึ้นต้นด้วย `.nc-nav`
  รวม `.nc-nav-scroll::-webkit-scrollbar`
- แก้คอมเมนต์ `/* แท็บเล็ต: เมนูซ้ายกลายเป็นแถบแนวนอนเหนือฟีด */` ให้ตรงกับของจริง

ระวังอย่าลบ `.nc-main`, `.nc-card`, `.nc-rail*` หรือกฎอื่นในช่วงบรรทัดเดียวกันโดยพลาด

## Acceptance criteria

1. `grep -rn "CommunityNav\|nc-nav" apps/web/src` ไม่เหลือผลลัพธ์
2. จำนวน `{` เท่ากับ `}` ใน `apps/web/src/styles/community.css`
3. หน้า `/community` บนจอกว้าง เหลือ 2 คอลัมน์: ฟีด + rail ขวา ไม่มีช่องว่างด้านซ้าย
4. ช่วงจอ 960-1200px เหลือคอลัมน์เดียว ไม่มีช่องว่างค้าง
5. จอ 375px ยังไม่ล้นแนวนอน
6. sort / view / หมวดหมู่ ยังกรองได้ครบผ่าน `CommunityToolbar`
7. `npm.cmd run typecheck --workspace apps/web` ผ่าน
8. `npm.cmd run test --workspace apps/web` ผ่าน
9. `npm.cmd run build --workspace apps/web` ผ่าน

## ห้ามทำ

- ห้าม commit
- ห้ามแตะ `CommunityRail`, `CommunityToolbar`, `CommunityComposer`
- ห้ามย้ายทางลัด/ปุ่ม CTA ไปไว้ที่อื่น — ตกลงกันแล้วว่าตัดทิ้งได้
- ห้ามติดตั้ง dependency ใหม่
