# Task: แก้ 3 ช่องโหว่ที่พบจากการตรวจ Slice 7 (Claude code review)

## บริบท / ทำไมต้องทำ

ตรวจโค้ดจริงของ Slice 7 (ระบบร้าน · แชท) เทียบกับ DoD ใน `docs/implementation-plan.md`
บรรทัด 425-450 ด้วยการอ่านโค้ดตรงๆ (ไม่ใช่แค่เชื่อ checklist [x]) พบ 3 จุดที่ไม่ตรงกับที่อ้างไว้:

1. **Race condition ใน `accept()`** (`apps/api/src/appointments/service.ts:181-202`) — DoD บอกว่า
   "สองฝ่ายกดพร้อมกัน → คนที่สองได้ 409" แต่โค้ดจริงเช็ค pending proposal นอก transaction
   (`row.proposals.find(...)` จาก `findFirst` ที่อ่านมาก่อนหน้า) แล้วอัปเดตด้วย
   `tx.appointmentProposal.update({ where: { id: proposal.id } })` โดยไม่มีเงื่อนไข `status: 'pending'`
   กำกับหรือ optimistic lock ใดๆ — สอง request ที่กดยอมรับพร้อมกันจะผ่านการเช็คนอก transaction
   ทั้งคู่แล้ว update สำเร็จทั้งคู่ (last-write-wins) แทนที่ตัวที่สองจะได้ 409 ตามที่เอกสารอ้าง
   ผลคือลูกค้า/ร้านได้รับ notification "ยืนยันแล้ว" ซ้ำ

2. **ไม่มี endpoint ลบรีวิว** — DoD บอกว่า "ลบรีวิว → `rating_avg` ถูกต้อง" แต่ไม่มี route ลบรีวิว
   อยู่เลยทั้งใน `appointments/routes.ts` และ `shops/routes.ts` เป็นฟีเจอร์ที่ยังไม่ได้ทำ
   ไม่ใช่แค่ยืนยันไม่ได้ — ตรวจแล้วว่า schema มี `ShopReview.deletedAt` (soft-delete) อยู่แล้ว
   และ `shops/service.ts` ก็ filter `deletedAt: null` ในการ list/detail และ `replyToReview` อยู่แล้ว
   (บรรทัด 36, 147) แปลว่าโครงสร้าง DB เตรียมไว้แล้วแต่ service function ที่ลบจริงยังไม่มี

3. **ไม่มี "แสดงนัดวันเดียวกันตอนร้านกดยอมรับ"** — Slice 7 ข้อ 7 อ้างอิง **DECISION DB-07**
   ใน `docs/database.md:708-717` ซึ่งระบุชัดว่าตั้งใจ**ไม่ทำ**การกันจองซ้อนที่ระดับ DB/business-logic
   ("ระบบไม่ต้องรู้ว่าร้านว่างเมื่อไร ... ไม่ต้องกันการจองซ้อน") โดยสิ่งที่ต้องชดเชยคือ
   **"แสดงนัดที่ยืนยันแล้วในวันเดียวกันให้ร้านเห็นตอนกดยอมรับ (งาน UI ไม่ใช่งาน DB)"** —
   ดังนั้นนี่คืองาน**แจ้งข้อมูลประกอบการตัดสินใจ** ไม่ใช่งานปฏิเสธการจองซ้อน — ตรวจแล้วว่า
   ไม่มีทั้ง endpoint และ UI ส่วนนี้อยู่เลยในปัจจุบัน

**ขอบเขตงานนี้จำกัดเฉพาะ 3 จุดข้างต้น** — ไม่แตะโค้ดอื่นที่ตรวจผ่านแล้วใน Slice 4-8
(ดูหมายเหตุ "นอกขอบเขต" ท้ายเอกสาร สำหรับปัญหาที่พบแต่ไม่ทำในรอบนี้)

---

## 1. แก้ race condition ใน `accept()`

### ปัญหาเชิงลึก

`accept()` ปัจจุบัน:
```ts
const row = await findForParticipant(userId, appointmentId)          // อ่านนอก tx
const proposal = row.proposals.find((item) => item.status === 'pending')  // เช็คนอก tx
...
await tx.appointmentProposal.update({ where: { id: proposal.id }, data: { status: 'accepted' } })
```
ระหว่างช่วงเวลาจากอ่าน `row` ถึง `tx` เริ่ม อีก request หนึ่งอาจ accept/supersede proposal เดียวกันไปแล้ว
`update` ด้วย `where: { id }` (ไม่กรอง `status`) จะสำเร็จเสมอไม่ว่าสถานะปัจจุบันจะเป็นอะไร (Prisma
`update` ที่ match `id` ไม่ throw ถ้าไม่ตรง `status` เพราะไม่ได้กรองด้วย field นั้น) — เป็น
check-then-act แบบ TOCTOU ทั่วไป

### แนวทางแก้ (Compare-And-Swap ผ่าน conditional `updateMany`)

Postgres รับประกันว่า `UPDATE ... WHERE` หนึ่งคำสั่งเป็น atomic ระดับแถว จึงไม่ต้องใช้
row-level lock (`SELECT FOR UPDATE`) เพิ่ม — เปลี่ยนทั้ง proposal-update และ appointment-update
ให้เป็น conditional `updateMany` ที่กรองด้วยสถานะปัจจุบัน แล้วเช็ค `result.count`:

```ts
export async function accept(userId: string, appointmentId: string): Promise<AppointmentDetail> {
  const row = await findForParticipant(userId, appointmentId)
  const actor = actorFor(row, userId)
  const proposal = row.proposals.find((item) => item.status === 'pending')
  if (!proposal) throw AppError.conflict('ไม่มีข้อเสนอเวลาที่รอการตอบรับ')
  if (!allowedTransition(row.status, 'confirmed') || proposal.proposedBy === actor) {
    throw AppError.conflict('คุณไม่สามารถตอบรับข้อเสนอนี้ได้ในสถานะปัจจุบัน')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const proposalResult = await tx.appointmentProposal.updateMany({
      where: { id: proposal.id, status: 'pending' },
      data: { status: 'accepted' },
    })
    if (proposalResult.count === 0) throw AppError.conflict('ข้อเสนอนี้ถูกตอบรับหรือเปลี่ยนสถานะไปแล้ว')

    const appointmentResult = await tx.appointment.updateMany({
      where: { id: appointmentId, status: row.status },
      data: { status: 'confirmed', agreedStartAt: proposal.proposedStartAt, durationMinutes: proposal.durationMinutes },
    })
    if (appointmentResult.count === 0) throw AppError.conflict('สถานะการนัดหมายถูกเปลี่ยนไปแล้วระหว่างทำรายการ')

    await tx.appointmentProposal.updateMany({ where: { appointmentId, status: 'pending', id: { not: proposal.id } }, data: { status: 'superseded' } })
    await createNotification(tx, { userId: actor === 'customer' ? row.shopId : row.customerId, kind: 'appointment_status', title: 'การนัดหมายได้รับการยืนยันแล้ว', sourceType: 'appointment', sourceId: appointmentId })
    return tx.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: appointmentInclude })
  })
  return detailFromRow(updated)
}
```

- `AppError.conflict` ที่ throw ข้างใน `$transaction` callback ต้อง**ไม่ถูก catch โดย Prisma**
  (Prisma จะ rollback แล้ว re-throw error เดิมออกมา — ตรวจสอบว่า error handler กลาง
  (`errorHandler.ts`) จับ `AppError` ที่โยนจากใน transaction ได้ปกติเหมือน error อื่น — ไม่ต้องแก้
  ถ้า pattern เดิมของโค้ด (เช่น `propose()`/`review()` ที่มี `.catch` ครอบ `$transaction` อยู่แล้ว)
  ทำงานถูกอยู่แล้วสำหรับ error ที่โยนจากนอก callback แต่ `accept()` โยนจาก**ใน**callback ซึ่งเป็นคนละ
  เคส — ต้องทดสอบว่า error propagate ออกมาเป็น 409 จริงไม่ใช่ 500)
- ผลลัพธ์: request ที่สองที่มาถึง transaction ทีหลังจะได้ `proposalResult.count === 0` (เพราะ
  request แรก update สถานะเป็น `accepted` ไปแล้ว ทำให้เงื่อนไข `status: 'pending'` ไม่ match) →
  409 ทันที ไม่มี double notification ไม่มี double state transition

### Edge case ที่ต้องคุม
- สอง request ยิงพร้อมกันเป๊ะ — DB serialize คำสั่ง UPDATE ที่ชน row เดียวกันเองอยู่แล้ว (row lock
  ระดับ engine) ดังนั้นแค่เปลี่ยนจาก unconditional `update` เป็น conditional `updateMany` +
  เช็ค count ก็เพียงพอ ไม่ต้องเพิ่ม transaction isolation level
- request คู่แข่งไม่ใช่ accept ซ้ำ แต่เป็น `cancel`/`decline`/`propose` ที่ทำระหว่างกลาง — เงื่อนไข
  `status: row.status` บน `tx.appointment.updateMany` ครอบกรณีนี้ด้วย (ถ้าสถานะ appointment ถูก
  เปลี่ยนไปแล้วจาก action อื่น ผลจะเป็น count 0 → 409 เหมือนกัน)

---

## 2. เพิ่ม endpoint ลบรีวิว

### Service — `apps/api/src/appointments/service.ts`

เพิ่มฟังก์ชันใหม่ `deleteReview(userId, appointmentId)`:
- เฉพาะ**เจ้าของรีวิว** (`review.authorId === userId`) เท่านั้นที่ลบได้ — ไม่ใช่ร้าน ไม่ใช่ admin
  (ขอบเขตงานนี้ไม่รวม moderation flow)
- ต้องมีรีวิวอยู่จริงและยังไม่ถูกลบ (`deletedAt: null`) — ไม่งั้น 404
- ต้อง**คำนวณ `ratingAvg`/`ratingCount` ใหม่ด้วย `aggregate` บนแถวที่เหลือหลัง soft-delete**
  ในธุรกรรมเดียวกัน (ไม่ใช้วิธีลบค่าเดิมออกจาก average เดิมแบบ back-out เพราะเสี่ยง floating drift
  สะสมถ้ามีการลบ/สร้างสลับกันหลายรอบ — `aggregate` คำนวณจากข้อมูลจริงทุกครั้งแม่นยำกว่า)
- ถ้าลบรีวิวสุดท้ายของร้าน (`count` เหลือ 0) → `ratingAvg` ต้องกลับเป็น `0` (ค่า default ของ
  `ShopProfile.ratingAvg`) ไม่ใช่ `null`/`NaN`

```ts
export async function deleteReview(userId: string, appointmentId: string): Promise<void> {
  const row = await findForParticipant(userId, appointmentId)
  if (!row.review) throw AppError.notFound('ไม่พบรีวิวของการนัดหมายนี้')
  if (row.review.authorId !== userId) throw AppError.forbidden('เฉพาะเจ้าของรีวิวเท่านั้นที่ลบได้')

  await prisma.$transaction(async (tx) => {
    const result = await tx.shopReview.updateMany({
      where: { id: row.review!.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (result.count === 0) throw AppError.notFound('ไม่พบรีวิวของการนัดหมายนี้')

    const aggregate = await tx.shopReview.aggregate({
      where: { shopId: row.shopId, deletedAt: null },
      _avg: { rating: true },
      _count: true,
    })
    await tx.shopProfile.update({
      where: { userId: row.shopId },
      data: {
        ratingCount: aggregate._count,
        ratingAvg: aggregate._avg.rating?.toFixed(2) ?? '0',
      },
    })
  })
}
```

หมายเหตุ: `findForParticipant` ปัจจุบัน include `review: true` อยู่แล้ว (ดู `appointmentInclude`
บรรทัด 17) จึง `row.review` มีข้อมูลพร้อมใช้ ไม่ต้อง query เพิ่ม

### Route — `apps/api/src/appointments/routes.ts`

```ts
appointmentsRouter.delete('/:id/review', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await service.deleteReview(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})
```

### Frontend — `apps/web/src/features/appointments/client.ts` + `AppointmentDetailPage.tsx`

- เพิ่ม `deleteAppointmentReview(id: string): Promise<{ ok: true }>` เรียก
  `apiFetch('/appointments/${id}/review', { method: 'DELETE' })` ตาม pattern เดียวกับ
  `markAppointmentMessagesRead`
- ใน `AppointmentDetailPage.tsx` ถ้า `review` ที่แสดงอยู่เป็นของ user ปัจจุบัน (ลูกค้าที่ล็อกอิน)
  เพิ่มปุ่ม "ลบรีวิว" พร้อม confirm ก่อนยิง แล้ว refetch appointment detail ให้ UI อัปเดต

---

## 3. แสดงนัดวันเดียวกันตอนร้านกดยอมรับ (DB-07 compensating UI)

**ย้ำ: นี่คือ feature แจ้งข้อมูล ไม่ใช่การปฏิเสธ/บล็อกการจอง** — ร้านยังคง accept ได้แม้มีนัดชนกัน
ตาม DECISION DB-07 ที่ตั้งใจไม่ทำระบบกันชนที่ backend

### Service — `apps/api/src/appointments/service.ts`

เพิ่ม `listSameDayConfirmed(userId, appointmentId)`:
- หา appointment ปัจจุบันผ่าน `findForParticipant` เหมือนเดิม, ต้องเป็น**ฝั่งร้าน**เท่านั้น
  (`actorFor(row, userId) === 'shop'`) — ถ้าลูกค้าเรียกให้ 403 (ข้อมูลนี้ไม่มีประโยชน์กับลูกค้า
  และเป็นรายการนัดของร้านคนอื่นที่ไม่เกี่ยวกับลูกค้ารายนี้)
- หา pending proposal ของ appointment นี้ (เวลาที่กำลังจะ accept) ใช้ `proposedStartAt` เป็นฐาน
  วันที่ (คำนวณเป็น UTC calendar day — โค้ดเบสนี้เก็บเวลาเป็น UTC timestamptz ทั้งหมดและยังไม่มี
  timezone utility ใดๆ อยู่แล้ว ดู `docs/database.md` DB-07 ที่ระบุชัดว่า "ไม่ต้องจัดการ timezone
  ของ business hours" จึงไม่เพิ่ม timezone library ใหม่ในงานนี้)
- query `appointment` ที่ `shopId` เดียวกัน, `status: 'confirmed'`, `agreedStartAt` อยู่ในช่วง
  `[startOfDay, endOfDay)` ของวันนั้น, **ไม่รวม appointment ปัจจุบัน** (`id: { not: appointmentId }`)

```ts
function utcDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function listSameDayConfirmed(userId: string, appointmentId: string) {
  const row = await findForParticipant(userId, appointmentId)
  if (actorFor(row, userId) !== 'shop') throw AppError.forbidden('เฉพาะร้านเท่านั้นที่ดูรายการนี้ได้')
  const pending = row.proposals.find((item) => item.status === 'pending')
  if (!pending) return []

  const { start, end } = utcDayRange(pending.proposedStartAt)
  const rows = await prisma.appointment.findMany({
    where: {
      shopId: row.shopId,
      status: 'confirmed',
      id: { not: appointmentId },
      agreedStartAt: { gte: start, lt: end },
    },
    select: { id: true, agreedStartAt: true, durationMinutes: true, customer: { select: { displayName: true } } },
    orderBy: { agreedStartAt: 'asc' },
  })
  return rows.map((r) => ({ id: r.id, agreedStartAt: r.agreedStartAt!.toISOString(), durationMinutes: r.durationMinutes, customerName: r.customer.displayName }))
}
```

- Query ใช้ index ที่มีอยู่แล้ว `appointments_shop_status_created_idx` บางส่วน (`shopId, status`) —
  ไม่ต้อง migration ใหม่ เพราะ `agreedStartAt` range scan บนผลลัพธ์ที่กรองด้วย `shopId+status`
  ก่อนแล้วมีขนาดเล็ก (นัดของร้านเดียวที่ confirmed) ไม่จำเป็นต้องมี index composite เพิ่มสำหรับ
  ขนาดข้อมูลระดับนี้

### Route — `apps/api/src/appointments/routes.ts`

```ts
appointmentsRouter.get('/:id/same-day', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.listSameDayConfirmed(currentUser(request).id, id) })
})
```

### Frontend — `apps/web/src/pages/AppointmentDetailPage.tsx` + `client.ts`

- เพิ่ม `fetchSameDayConfirmed(id): Promise<SameDayAppointment[]>`
- เมื่อหน้าแสดงปุ่ม "ยอมรับข้อเสนอปัจจุบัน" (บรรทัด 62 ปัจจุบัน) **และ user ปัจจุบันคือฝั่งร้าน**
  ให้ fetch รายการนี้คู่กันแล้วแสดงเป็นกล่องแจ้งเตือนเล็กๆ เหนือปุ่ม เช่น "ร้านมีนัดที่ยืนยันแล้ว
  วันเดียวกันอีก N รายการ: 10:00 (ลูกค้า A), 14:00 (ลูกค้า B)" — ไม่บล็อกปุ่ม ไม่ใช่ modal บังคับ
  confirm เพิ่ม (ตามเจตนา DB-07 ที่ให้ร้านตัดสินใจเอง)
- ถ้า `listSameDayConfirmed` คืน array ว่าง ไม่ต้องแสดงกล่องอะไรเลย (ไม่ใช่ "ไม่มีนัดชน" ที่โชว์เปล่าๆ)

---

## Acceptance criteria (DoD)

- [ ] ยิง `POST /appointments/:id/accept` สองครั้งพร้อมกัน (concurrent, proposal เดิม) →
      ครั้งหนึ่งได้ 200 (`status: confirmed`) อีกครั้งได้ **409** ไม่ใช่ 200 ทั้งคู่ ไม่มี
      notification ซ้ำ (integration test ใหม่ยิง request แบบ `Promise.all` สองอันพร้อมกัน)
- [ ] `cancel()`/`decline()` ที่ทำสำเร็จก่อน `accept()` เข้าถึง transaction → `accept()` ที่ตามมาได้
      409 ไม่ใช่ 200 ทับสถานะ `cancelled`/`declined`
- [ ] `DELETE /appointments/:id/review` โดยเจ้าของรีวิว → 200, รีวิวหายจากรายการ
      `GET /shops/:id` (ผ่าน `deletedAt` filter ที่มีอยู่แล้ว), `ratingAvg`/`ratingCount` ของร้าน
      ถูกคำนวณใหม่ถูกต้อง (ทดสอบกรณีร้านมีรีวิวอื่นเหลืออยู่ ผลเฉลี่ยต้องตรง และกรณีเป็นรีวิว
      สุดท้าย ผลต้องเป็น `0`/`0` ไม่ใช่ error)
- [ ] `DELETE /appointments/:id/review` โดยคนอื่นที่ไม่ใช่เจ้าของรีวิว (รวมถึงร้านของนัดนั้นเอง) →
      403
- [ ] `DELETE /appointments/:id/review` เมื่อไม่มีรีวิวอยู่ หรือถูกลบไปแล้ว → 404
- [ ] `GET /appointments/:id/same-day` โดยฝั่งร้านของนัดที่มี pending proposal → คืนรายการนัด
      `confirmed` อื่นของร้านเดียวกันในวันเดียวกัน (ไม่รวมตัวเอง) เรียงตามเวลา
- [ ] `GET /appointments/:id/same-day` โดยลูกค้า (ไม่ใช่ร้าน) → 403
- [ ] `GET /appointments/:id/same-day` เมื่อไม่มี pending proposal → คืน array ว่าง ไม่ error
- [ ] typecheck + lint ผ่านทั้ง `apps/api` และ `apps/web`
- [ ] unit/integration test ใหม่ผ่านครบตามข้อข้างต้น เพิ่มเข้าไฟล์เดิม
      `apps/api/src/__tests__/appointments.integration.test.ts`

## นอกขอบเขต (พบระหว่างตรวจ แต่ไม่ทำในงานนี้)

- `transition()` (decline/cancel/complete/no_show, `service.ts:241-261`) มี TOCTOU pattern
  คล้ายกับที่แก้ใน `accept()` (อ่าน `row.status` นอก transaction แล้ว update โดยไม่กรองสถานะซ้ำใน
  `tx`) — ความเสี่ยงต่ำกว่า `accept()` เพราะ action พวกนี้ปกติมาจากฝ่ายเดียว ไม่ใช่ race ระหว่างสอง
  ฝ่ายเหมือน accept แต่เป็นช่องโหว่ประเภทเดียวกันที่ควรแก้แยกเป็นงานถัดไป
- ไม่มีเทส CSRF/fake-upload/XSS/prompt-injection อัตโนมัติ (พบใน Slice 8) — งานแยกต่างหาก
- ไม่มี endpoint ให้ admin เพิ่มความรู้ AI (`knowledge_entries`, พบใน Slice 6) — งานแยกต่างหาก
- gitleaks ยังไม่ได้ตั้งค่า (พบใน Slice 8) — งานแยกต่างหาก
- ไม่ทำ moderation flow ให้ admin/ร้านลบรีวิวของคนอื่นได้ — เฉพาะเจ้าของเท่านั้นตามขอบเขตนี้
