# Public User Profiles

## Goal

เพิ่ม public profile สำหรับผู้ใช้แต่ละคนในชุมชน โดยผู้ใช้คนอื่นสามารถเปิดดูชื่อ บทบาท วันที่เข้าร่วม และผลงาน nail template ที่เผยแพร่ได้ โดยไม่เปิดเผยอีเมลหรือข้อมูลบัญชีภายใน ส่วน `/profile` เดิมยังคงเป็นหน้าจัดการบัญชีของผู้ใช้ที่ล็อกอินอยู่

## Scope

- เพิ่ม public profile endpoint สำหรับ user UUID ที่ valid
- ส่งเฉพาะข้อมูล public: `id`, `displayName`, `role`, `createdAt`, จำนวน template และรายการ public templates
- ใช้ข้อมูล `User` และ `NailTemplate` เดิม ไม่เพิ่มตาราง profile ใหม่
- เพิ่มหน้า `/users/:userId` สำหรับดู public profile
- ทำให้ชื่อผู้สร้างใน Community และหน้า Template Preview เป็นลิงก์ไปยัง profile
- รองรับ pagination แบบ cursor สำหรับรายการ template ของ user
- คงการแก้ไขชื่อแสดงผลไว้ที่ `/profile` และ endpoint `PATCH /auth/me` เท่านั้น

## API design

### Contract

เพิ่ม schema/type ใน `packages/contracts/src/profile.ts`:

- `publicProfileSchema`: `id`, `displayName`, `role`, `createdAt`, `templateCount`, `templates`
- `publicProfileTemplateSchema`: ฟิลด์เดียวกับ `TemplateCard`
- `publicProfileQuerySchema`: `limit` 1–50 และ cursor ที่จำกัดความยาว

ส่งผลลัพธ์ในรูปแบบมาตรฐาน `{ success: true, data, meta: { nextCursor } }`

### Route

เพิ่ม `GET /api/v1/users/:id/profile` เป็น public read endpoint

- validate path ด้วย UUID schema
- อ่านเฉพาะ user ที่มีอยู่
- นับและโหลดเฉพาะ `NailTemplate` ที่ `visibility = public` และ `deletedAt = null`
- ถ้าไม่พบ user ให้ตอบ 404 โดยไม่เผยข้อมูลว่าอีเมลหรือข้อมูลภายในเป็นอะไร
- ไม่ส่ง `email`, `passwordHash`, session หรือข้อมูล private template

### Repository/service

- เพิ่ม module `apps/api/src/users/` แยก route, service และ repository ตาม architecture เดิม
- ใช้ keyset pagination `(createdAt, id)` และ index ที่มีอยู่ `[authorId, createdAt DESC]` เพื่อให้ query เป็น O(n) ตามจำนวนรายการที่ส่งกลับ
- นับ `templateCount` ด้วย query แยกหรือ aggregate ที่ scope ด้วย `authorId` และ public visibility
- map response ผ่าน contract type เพื่อกัน field หลุดจาก Prisma row

## Frontend design

- เพิ่ม `usePublicProfile(userId)` และ query key แยกใน `apps/web/src/features/users/`
- เพิ่ม `PublicProfilePage` และ route `/users/:userId` ภายใต้ protected app shell ตามรูปแบบปัจจุบัน
- แสดง avatar initials, display name, role, วันที่เข้าร่วม, จำนวนผลงาน และ grid ของ public templates
- ใช้ card preview pattern เดียวกับ Community โดยคลิก template ไปหน้า preview ได้
- แสดง loading, 404 และ API error state ที่เข้าใจง่าย
- ชื่อ author ใน `CommunityPage` และ `TemplatePreviewPage` ใช้ `<Link to={`/users/${author.id}`}>`
- แยก class CSS ของ public profile จาก account profile เพื่อไม่เปลี่ยน behavior ของ `/profile`

## Security and edge cases

- ห้ามใช้ `userId` จาก request body เพื่อกำหนดเจ้าของข้อมูล; ใช้ path UUID ที่ validate แล้ว
- ป้องกันการเปิดเผยอีเมลและ template ที่เป็น `unlisted`/`hidden`
- user ที่ไม่มี public template ต้องเห็น empty state ไม่ใช่ error
- cursor ผิดรูปแบบหรือใช้กับ user อื่นต้องตอบ 400
- user UUID ที่ไม่มีอยู่ต้องตอบ 404
- ชื่อผู้ใช้ที่มี whitespace หรืออักขระ Unicode ต้องแสดงผลได้และต้อง escape ตาม React default

## Acceptance criteria

1. เปิด `/users/:userId` แล้วเห็น public profile ของ user ที่มีอยู่
2. หน้า profile ไม่แสดง email, password หรือ private template
3. รายการ template เรียงล่าสุดก่อน และปุ่มโหลดเพิ่มทำงานด้วย cursor
4. ชื่อ author จาก Community และ Template Preview เปิดไปยัง public profile ได้
5. `/profile` และการแก้ชื่อเดิมยังทำงานเหมือนเดิม
6. API tests ครอบคลุม 200, 404, empty state, visibility filter, pagination และไม่เปิดเผย sensitive fields
7. Frontend typecheck, lint, build และ tests ผ่าน

## Files expected to change

- `packages/contracts/src/profile.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/users/routes.ts`
- `apps/api/src/users/service.ts`
- `apps/api/src/users/repository.ts`
- `apps/api/src/users/cursor.ts` (ถ้าจำเป็นตามรูปแบบ cursor ที่มีอยู่)
- `apps/api/src/__tests__/users.integration.test.ts` หรือ test ที่เหมาะสม
- `apps/web/src/features/users/usePublicProfile.ts`
- `apps/web/src/pages/PublicProfilePage.tsx`
- `apps/web/src/app/router.tsx`
- `apps/web/src/pages/CommunityPage.tsx`
- `apps/web/src/pages/TemplatePreviewPage.tsx`
- `apps/web/src/styles/index.css`

## Out of scope

- avatar upload, bio, social links หรือ privacy settings
- การแก้ไข public profile ของ user อื่น
- shop profile fields และระบบ follow/message
- การเปลี่ยน database schema หรือเพิ่ม dependency ใหม่
