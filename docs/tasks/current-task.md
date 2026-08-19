# Task: ระบบแชท (รอบ A) — ห้องสนทนาระหว่างผู้ใช้ + บล็อก + รายงานข้อความ

> สถานะ: **PHASE 5 — ผ่าน** (ดูผลการทำงานท้ายไฟล์)
>
> สเปกงาน editor รอบก่อนย้ายไป `docs/tasks/archive/2026-08-19-editor-ux.md`
> **ยังมี MEDIUM ค้าง 4 ข้อที่ยังไม่ได้แก้** (ดูหัวข้อ 13)

---

## 1. ขอบเขต

สร้างระบบแชทที่ยืนอยู่ได้ด้วยตัวเอง ไม่ผูกกับการนัดหมาย พร้อมกลไกความปลอดภัย
ขั้นต่ำที่จำเป็นเมื่อผู้ใช้คนไหนก็ทักหากันได้

**รอบนี้ทำ:** ห้องสนทนา 1:1 · กล่องข้อความรวมทั้งสองฝั่ง · บล็อกผู้ใช้ ·
รายงานข้อความเข้าคิว moderation เดิม · ย้ายข้อความจาก `appointment_messages`

**รอบนี้ยังไม่ทำ** (ดูหัวข้อ 12): การ์ดข้อเสนอเวลาในสายแชท · เวลาทำการร้าน ·
quick reply · แดชบอร์ดร้าน

---

## 2. บริบทที่มีอยู่ (หลักฐานจากโค้ด)

ระบบแชท จัดการร้าน และนัดหมาย **มีอยู่แล้วและทำงานได้** สิ่งที่ขาดคือแชทที่แยกจากนัดหมาย

| ของที่มีอยู่ | ที่ตั้ง |
|---|---|
| ข้อความในนัดหมาย | `AppointmentMessage` (`prisma/schema.prisma:526`) |
| API ข้อความ | `listMessages`/`sendMessage`/`markMessagesRead` (`apps/api/src/appointments/service.ts:353-373`) |
| UI ฟองซ้าย-ขวา | `apps/web/src/features/appointments/components/AppointmentChat.tsx` |
| แจ้งเตือน | `createNotification` (`apps/api/src/notifications/repository.ts:14`), kind `appointment_message` |
| คิว moderation | `POST /templates/:id/report`, `GET /templates/moderation/reports` (`apps/api/src/templates/routes.ts:72,86`) |
| ตัวจำกัดอัตรา | `createRateLimiter` (`apps/api/src/middleware/rateLimit.ts`) |
| ตรวจสิทธิ์คู่สนทนา | `findForParticipant` (`apps/api/src/appointments/service.ts:84`) |

**ข้อจำกัดที่ต้องแก้:**

1. `AppointmentMessage.appointmentId` เป็น NOT NULL → ไม่มีทางส่งข้อความก่อนสร้างนัดหมาย
2. `ContentReportTarget` มีแค่ `template | comment` → ช่องทางส่วนตัวที่กำลังจะเปิดจะไม่มีใครรายงานได้
3. `appointmentInclude` ดึงข้อความด้วย `take: 100` ตายตัว (`service.ts:16`) → ห้องถาวรที่โตไม่จำกัดใช้แบบนี้ไม่ได้
4. `AppointmentChat.tsx:40-41` เรียก `onSend()` แล้ว `setDraft('')` ทันทีโดยไม่รอผล —
   ส่งไม่สำเร็จเมื่อไรข้อความที่พิมพ์หายทันที

---

## 3. Data model

### 3.1 `Conversation` (ใหม่)

```prisma
model Conversation {
  id             String   @id @default(uuid()) @db.Uuid
  participantAId String   @map("participant_a_id") @db.Uuid
  participantBId String   @map("participant_b_id") @db.Uuid
  createdById    String   @map("created_by_id") @db.Uuid
  lastMessageAt  DateTime @default(now()) @map("last_message_at") @db.Timestamptz
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  participantA User                  @relation("ConversationA", fields: [participantAId], references: [id], onDelete: Cascade)
  participantB User                  @relation("ConversationB", fields: [participantBId], references: [id], onDelete: Cascade)
  messages     ConversationMessage[]

  @@unique([participantAId, participantBId], map: "conversations_pair_key")
  @@index([participantAId, lastMessageAt(sort: Desc)], map: "conversations_a_recent_idx")
  @@index([participantBId, lastMessageAt(sort: Desc)], map: "conversations_b_recent_idx")
  @@map("conversations")
}
```

**`participantAId` ต้องเก็บ uuid ที่เรียงน้อยกว่าเสมอ** บังคับด้วย CHECK constraint
ในไฟล์ migration (Prisma schema เขียน CHECK ไม่ได้):

```sql
ALTER TABLE conversations
  ADD CONSTRAINT conversations_ordered_pair CHECK (participant_a_id < participant_b_id);
```

ถ้าไม่มีข้อนี้ `@@unique` กันห้องซ้ำไม่ได้เลย เพราะ (A,B) กับ (B,A) เป็นคนละแถวในสายตา
ฐานข้อมูล — คู่เดียวกันจะได้สองห้องทันทีที่ทั้งสองฝั่งกดทักพร้อมกัน

**`lastMessageAt` เก็บซ้ำไว้ที่ห้อง** เพื่อให้เรียงกล่องข้อความด้วย index เดียว
ถ้าไม่เก็บ ต้อง join `conversation_messages` แล้ว aggregate ทุกครั้งที่เปิดกล่อง

ต้องมี index สองตัวเพราะกล่องข้อความของคนหนึ่งคือ
`WHERE participant_a_id = me OR participant_b_id = me` ซึ่ง Postgres จะทำ bitmap OR
ของสอง index — index ตัวเดียวครอบไม่ได้

**`createdById` มีไว้เพื่อกฎ "ห้องเปล่าไม่โผล่ในกล่องของอีกฝ่าย"** — เมื่อ
`participantAId` ถูกจัดเรียงตาม uuid แล้ว ไม่มีทางรู้อีกเลยว่าใครเป็นคนเปิดห้อง
ถ้าไม่เก็บไว้ และยังใช้ตามรอยคนที่เปิดห้องเปล่ารัว ๆ ได้ด้วย

### 3.2 `ConversationMessage` (ใหม่)

```prisma
model ConversationMessage {
  id             String    @id @default(uuid()) @db.Uuid
  conversationId String    @map("conversation_id") @db.Uuid
  senderId       String?   @map("sender_id") @db.Uuid
  content        String    @db.Text
  readAt         DateTime? @map("read_at") @db.Timestamptz
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User?        @relation("ConversationMessageSender", fields: [senderId], references: [id], onDelete: SetNull)

  @@index([conversationId, createdAt(sort: Desc), id(sort: Desc)], map: "conversation_messages_thread_idx")
  @@index([conversationId, readAt], map: "conversation_messages_unread_idx")
  @@map("conversation_messages")
}
```

`senderId` nullable และ `SetNull` — ผู้ใช้ถูกลบแล้วข้อความยังอยู่ แสดงเป็น "ผู้ใช้ที่ถูกลบ"
เหมือนที่ `AppointmentMessage` ทำอยู่ ส่วน `id` ใน index ตัวแรกมีไว้ให้ cursor
เรียงได้เสถียรเมื่อ `createdAt` ชนกัน

### 3.3 `UserBlock` (ใหม่)

```prisma
model UserBlock {
  blockerId String   @map("blocker_id") @db.Uuid
  blockedId String   @map("blocked_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  blocker User @relation("BlockAuthor", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked User @relation("BlockTarget", fields: [blockedId], references: [id], onDelete: Cascade)

  @@id([blockerId, blockedId])
  @@index([blockedId], map: "user_blocks_target_idx")
  @@map("user_blocks")
}
```

composite PK — ไม่ต้องมี surrogate id และทำให้ "A บล็อก B อยู่ไหม" เป็นการค้น PK ตรง

### 3.4 แก้ enum เดิม

```prisma
enum ContentReportTarget {
  template
  comment
  message         // เพิ่ม
}

enum NotificationKind {
  post_like
  post_comment
  template_remix
  appointment_status
  appointment_message
  direct_message   // เพิ่ม
}
```

`direct_message` ต้องเป็นค่าใหม่ ไม่ใช่ยืม `appointment_message` — ข้อความในห้องแชท
ไม่ได้อยู่ในนัดหมายอีกแล้ว และปลายทางของการกดแจ้งเตือนคนละหน้า
(`/chat/:id` ไม่ใช่ `/appointments/:id`) การยืมค่าเดิมจะทำให้แจ้งเตือนเก่าที่ยัง
ค้างอยู่ในฐานข้อมูลลิงก์ผิดหน้าทันที

### 3.5 ลบ

`AppointmentMessage` ทั้ง model และ relation `User.sentAppointmentMessages`,
`Appointment.messages`

---

## 4. Migration

`prisma/migrations/<timestamp>_add_conversations/migration.sql`

ลำดับที่ต้องเป็น:

1. `CREATE TABLE conversations` + CHECK constraint + unique + สอง index
2. `CREATE TABLE conversation_messages` + สอง index
3. `CREATE TABLE user_blocks`
4. `ALTER TYPE content_report_target ADD VALUE 'message'` และ
   `ALTER TYPE notification_kind ADD VALUE 'direct_message'`
   — **ต้องไม่อยู่ transaction เดียวกับการใช้ค่านั้น** ถ้า `prisma migrate` บ่น
   ให้แยกเป็น migration ของตัวเอง
5. Backfill ห้องจากคู่ที่มีอยู่ใน `appointments` — ต้องเรียงคู่ให้ตรงกับ CHECK
   และตั้ง `created_by_id` เป็นลูกค้าเสมอ เพราะทุกนัดหมายเดิมลูกค้าเป็นฝ่ายเริ่ม:

```sql
INSERT INTO conversations (id, participant_a_id, participant_b_id, created_by_id, created_at, last_message_at)
SELECT
  gen_random_uuid(),
  LEAST(a.customer_id, a.shop_id),
  GREATEST(a.customer_id, a.shop_id),
  a.customer_id,
  MIN(a.created_at),
  MAX(a.created_at)
FROM appointments a
GROUP BY a.customer_id, a.shop_id;
```

6. ย้ายข้อความ join กลับผ่าน `appointments`:

```sql
INSERT INTO conversation_messages (id, conversation_id, sender_id, content, read_at, created_at)
SELECT m.id, c.id, m.sender_id, m.content, m.read_at, m.created_at
FROM appointment_messages m
JOIN appointments a ON a.id = m.appointment_id
JOIN conversations c
  ON c.participant_a_id = LEAST(a.customer_id, a.shop_id)
 AND c.participant_b_id = GREATEST(a.customer_id, a.shop_id);
```

คง `m.id` เดิมไว้ เพื่อให้ `content_reports.target_id` ที่อาจอ้างถึงในอนาคตและ
การตรวจนับก่อน/หลังเทียบกันได้ตรง ๆ

7. อัปเดต `last_message_at` ให้เป็นเวลาข้อความล่าสุดจริง (ห้องที่ไม่มีข้อความคงค่าจากขั้น 5)
8. `DROP TABLE appointment_messages`

**ระวัง:** ขั้น 5 `GROUP BY a.customer_id, a.shop_id` ไม่ใช่ `GROUP BY LEAST/GREATEST`
เพราะต้องได้ `created_by_id` ที่แน่นอนต่อกลุ่ม — และเนื่องจากลูกค้ากับร้าน
เป็นคนละบทบาทเสมอ คู่ (customer, shop) จึงไม่มีทางสลับด้านกันเองอยู่แล้ว

**ไม่มีแถวกำพร้า** เพราะ `appointments.shop_id` มี FK ไป `shop_profiles` แบบ cascade
และ `customer_id` ไป `users` อยู่แล้ว

---

## 5. API — โมดูลใหม่ `apps/api/src/conversations/`

ไฟล์: `routes.ts`, `blocks.routes.ts`, `service.ts`, `repository.ts`, `service.test.ts`
ลงทะเบียนที่ `apps/api/src/app.ts` เป็น `/api/conversations` และ `/api/blocks`

การบล็อกอยู่ในโมดูลเดียวกันไม่แยกออกไป เพราะกติกาบล็อกมีอยู่ที่เดียวคือ
"ส่งข้อความได้ไหม" — แยกเป็นโมดูลของตัวเองจะได้โมดูลที่มีผู้ใช้รายเดียว

| Method | Path | ทำอะไร |
|---|---|---|
| GET | `/api/conversations` | กล่องข้อความ — ห้อง + คู่สนทนา + ข้อความล่าสุด + unread |
| POST | `/api/conversations` | `{ userId }` → หา-หรือ-สร้าง คืนห้อง |
| GET | `/api/conversations/:id` | ห้อง + ข้อความ (`?before=<ISO>&limit=`) |
| POST | `/api/conversations/:id/messages` | `{ content }` → ข้อความใหม่ + แจ้งเตือน |
| POST | `/api/conversations/:id/read` | ทำเครื่องหมายอ่านแล้ว |
| POST | `/api/conversations/messages/:id/report` | `{ reason, detail? }` |
| POST | `/api/blocks` | `{ userId }` บล็อก |
| DELETE | `/api/blocks/:userId` | เลิกบล็อก |
| GET | `/api/blocks` | รายชื่อที่ตัวเองบล็อกไว้ |

ทุกเส้นผ่าน `requireUser`

### กติกาที่ service ต้องบังคับ

- **ตรวจสิทธิ์ห้อง** — ไม่ใช่คู่สนทนาให้ `404` ไม่ใช่ `403` เพื่อไม่บอกว่าห้องนั้นมีอยู่
  (ตามแบบ `findForParticipant` เดิม)
- **ห้ามคุยกับตัวเอง** — `POST /conversations { userId: ตัวเอง }` → 422
- **หา-หรือ-สร้างต้องกัน race** — ใช้ `upsert` บน `conversations_pair_key`
  ไม่ใช่ `findFirst` แล้ว `create` การกดสองแท็บพร้อมกันจะชน P2002 ให้จับแล้วคืนห้องที่มีอยู่
- **บล็อกมีผลสองทาง** — ก่อนสร้างห้องและก่อนส่งข้อความ ต้องเช็คว่ามี `UserBlock`
  แถวใดแถวหนึ่งของคู่นี้หรือไม่ (ทั้ง A→B และ B→A) มีแล้วห้ามทั้งคู่
- **ข้อความแจ้งฝั่งที่ถูกบล็อกต้องกลาง ๆ** — `403 "ส่งข้อความในห้องนี้ไม่ได้"`
  ไม่บอกว่าถูกบล็อก ส่วนฝั่งที่เป็นคนบล็อกให้ `409` พร้อมข้อความชัดเจนว่าตัวเองบล็อกอยู่
  (UI จะแสดงปุ่มเลิกบล็อกให้)
- **ส่งข้อความต้องสร้างแจ้งเตือนใน transaction เดียวกัน** — `createNotification`
  ด้วย `kind: 'direct_message'`, `sourceType: 'conversation'`, `sourceId: conversationId`
  ตามแบบที่ `sendMessage` เดิมทำ (`service.ts:358`)
- **รายงานข้อความ** — ผู้รายงานต้องเป็นคู่สนทนาในห้องนั้น ไม่ใช่ → 404
  บันทึกลง `ContentReport` ด้วย `targetType: 'message'`, `targetId: messageId`
  รายงานข้อความของตัวเองไม่ได้ → 422
- **rate limit** — `POST /conversations` (เปิดห้องใหม่) จำกัดแน่นกว่า
  `POST /:id/messages` เพราะการเปิดห้องหาคนแปลกหน้าคือช่องทางกวนหลัก
  ไม่ใช่การพิมพ์ในห้องที่คุยกันอยู่แล้ว ใช้ `createRateLimiter` ที่มีอยู่

### กล่องข้อความ (`GET /conversations`)

- คืนห้องที่ **มีข้อความอย่างน้อยหนึ่งข้อความ หรือ `createdById` เป็นตัวผู้เรียกเอง**
  — กันคนเปิดห้องเปล่ารัว ๆ ใส่คนอื่น แต่คนเปิดยังเห็นห้องที่ตัวเองเพิ่งเปิด
- unread ทั้งกล่องต้องใช้ `groupBy` ครั้งเดียว **ห้ามยิงต่อห้อง (N+1)**
- "ฝั่งไหนเป็นร้าน" ดูจากว่า participant คนนั้นมี `ShopProfile` หรือไม่ —
  ใช้ตั้งชื่อห้อง (ชื่อร้าน) และให้รอบ B รู้ว่าห้องนี้เสนอนัดหมายได้

### moderation

- `ContentReport` ที่ `targetType: 'message'` เข้าคิวเดียวกับ template
- `templateModerationReportSchema` ปัจจุบันผูกกับ template ตรง ๆ
  ต้องแยกเป็น discriminated union ตาม `target` — ตัวแปร `message` พก
  `{ excerpt, senderName, sentAt }`
- **แอดมินเห็นเฉพาะข้อความที่ถูกรายงาน ห้ามเปิดทั้งห้อง** — ไม่ให้การรายงาน
  หนึ่งข้อความกลายเป็นใบเบิกทางอ่านบทสนทนาส่วนตัวทั้งหมด

---

## 6. Contracts

ไฟล์ใหม่ `packages/contracts/src/conversation.ts` + export ที่ `index.ts`

- `startConversationSchema` — `{ userId: uuid }`
- `conversationMessageSchema` — `{ content: string 1..2000 }` (คัดลอกกติกาเดิม)
- `conversationMessageResponseSchema` — `{ id, conversationId, senderId (nullable), content, readAt, createdAt }`
- `conversationSummarySchema` — `{ id, otherParty: { id, displayName, shopName? }, lastMessage, unreadCount, lastMessageAt, blocked }`
- `conversationDetailSchema` — summary + `messages` + `hasMore`
- `blockUserSchema` — `{ userId: uuid }`
- `reportMessageSchema` — ใช้ชุด `reason`/`detail` เดียวกับรายงาน template

**เปลี่ยน contract เดิม:** ลบ `messages` ออกจาก `appointmentDetailSchema`
และลบ `appointmentMessageSchema` / `appointmentMessageResponseSchema`

---

## 7. Web

### ไฟล์ใหม่ `apps/web/src/features/chat/`

- `client.ts` — เรียก API ตามแบบ `features/appointments/client.ts`
- `useChat.ts` — `chatKeys`, `useConversations`, `useConversation`,
  `useStartConversation`, `useSendMessage`, `useMarkRead`, `useBlockUser`, `useReportMessage`
- `components/ConversationList.tsx` — รายการห้อง + unread badge
- `components/ConversationRoom.tsx` — ย้ายโครงมาจาก `AppointmentChat.tsx`
- `components/BlockedComposer.tsx` — ช่องพิมพ์ที่ถูกแทนที่เมื่อบล็อกอยู่

### หน้าและเส้นทาง

- `apps/web/src/pages/ChatPage.tsx` — master-detail
- `router.tsx` เพิ่ม `/chat` และ `/chat/:conversationId`
- `AppShell.tsx` เพิ่มเมนู "ข้อความ" พร้อม badge unread รวม
- `ShopDetailPage` ปุ่ม "ทักร้าน" → `POST /conversations` → navigate
- `PublicProfilePage` ปุ่ม "ส่งข้อความ" แบบเดียวกัน
- `AppointmentDetailPage` **ลบแผงแชททิ้ง** เปลี่ยนเป็นลิงก์ "เปิดห้องแชทกับร้าน"
- `ModerationPage` รองรับรายงานชนิด `message`
- `NotificationBell.tsx:16-17` เพิ่มเส้นทาง `sourceType === 'conversation'`
  → `/chat/${sourceId}` — ถ้าไม่เพิ่ม แจ้งเตือนข้อความใหม่จะกดแล้วไม่พาไปไหน
  ซึ่งเป็นบั๊กเดิมที่ไฟล์นี้เคยแก้มาแล้วครั้งหนึ่ง
- `NOTIFICATION_KINDS` ใน `packages/contracts/src/notification.ts:3` เพิ่ม `direct_message`

### พฤติกรรม

- polling: ห้องที่เปิดอยู่ 10 วิ · กล่องข้อความ 30 วิ ·
  `refetchIntervalInBackground: false` ตามแบบที่แอปใช้อยู่ **ไม่เพิ่ม WebSocket**
- **ล้างช่องพิมพ์เมื่อ mutation สำเร็จเท่านั้น** — แก้บั๊กในหัวข้อ 2 ข้อ 4
- เลื่อนลงล่างเฉพาะเมื่อมีข้อความใหม่จริง (คงพฤติกรรมเดิมของ `AppointmentChat`)
- ปุ่ม "โหลดข้อความเก่ากว่า" เมื่อ `hasMore`

---

## 8. เกณฑ์ผ่าน (Acceptance Criteria)

- [ ] ทักร้านหรือผู้ใช้คนอื่นได้โดยไม่ต้องมีนัดหมายก่อน
- [ ] เปิดห้อง A→B แล้ว B→A ได้ห้องเดิมเสมอ (ยืนยันด้วยเทสต์ ไม่ใช่ด้วยตา)
- [ ] กดปุ่มทักพร้อมกันสองแท็บแล้วยังได้ห้องเดียว
- [ ] บล็อกแล้วส่งไม่ได้ทั้งสองทาง เลิกบล็อกแล้วกลับมาส่งได้
- [ ] ฝั่งที่ถูกบล็อกไม่เห็นข้อความที่บอกว่าถูกบล็อก
- [ ] รายงานข้อความแล้วโผล่ในคิว moderation และแอดมินเห็นเฉพาะข้อความนั้น
- [ ] คนนอกเรียก `GET /conversations/:id` ได้ 404 ไม่ใช่ 403
- [ ] กล่องข้อความยิง query จำนวนคงที่ ไม่โตตามจำนวนห้อง
- [ ] ข้อความเดิมทั้งหมดย้ายครบ — นับก่อนและหลัง migration ต้องเท่ากัน
- [ ] `npm run typecheck` และ `npm run test` ผ่านทุก workspace
- [ ] ไม่มี `appointment_messages` เหลือทั้งใน schema, โค้ด และ contract

---

## 9. กรณีขอบ

- **CHECK constraint กับ uuid ที่เท่ากัน** — ห้ามคุยกับตัวเองต้องกันที่ service ก่อนถึง DB
  ไม่งั้นได้ error จาก constraint แทนข้อความที่อ่านรู้เรื่อง
- **`ALTER TYPE ... ADD VALUE` ใน transaction** — Postgres บางรุ่นไม่ยอม
  ถ้าติดให้แยกเป็น migration ของตัวเอง
- **ผู้ใช้ถูกลบ** — `Conversation` cascade หายทั้งห้อง แต่ `senderId` เป็น SetNull
  ทั้งสองอย่างไม่ขัดกันเพราะห้องหายไปก่อนแล้ว
- **ร้านลบโปรไฟล์ร้านแต่บัญชียังอยู่** — ห้องต้องไม่หาย เพราะ FK ผูกกับ `users`
  ไม่ใช่ `shop_profiles` (ต่างจาก `Appointment` ที่ผูกกับ `shop_profiles`)
- **ห้องที่ไม่มีข้อความเลย** — ไม่โผล่ในกล่องของอีกฝ่าย แต่โผล่ในกล่องของคนเปิด
- **บล็อกขณะที่อีกฝ่ายกำลังพิมพ์** — ข้อความที่ส่งมาหลังบล็อกถูกปฏิเสธที่ server
  client แสดง error ไม่ใช่ยอมรับเงียบ ๆ
- **cursor pagination กับ `createdAt` ที่ชนกัน** — ต้องเรียงด้วย `(createdAt, id)`
  ไม่ใช่ `createdAt` อย่างเดียว ไม่งั้นข้อความที่สร้างในมิลลิวินาทีเดียวกันจะข้ามหรือซ้ำ
- **rate limit ไม่ควรกันคนที่คุยอยู่จริง** — จำกัดการเปิดห้อง ไม่ใช่การพิมพ์

---

## 10. เทสต์ที่ต้องมี

`apps/api/src/conversations/service.test.ts`

- หา-หรือ-สร้าง: A→B แล้ว B→A ได้ห้อง id เดียวกัน
- หา-หรือ-สร้าง: ยิงพร้อมกัน (จำลอง P2002) ยังได้ห้องเดียว
- ห้ามคุยกับตัวเอง → 422
- คนนอกเปิดห้อง → 404 ไม่ใช่ 403
- unread นับเฉพาะข้อความของอีกฝ่าย และ `read` ไม่แตะข้อความตัวเอง
- `lastMessageAt` ขยับเมื่อส่งข้อความ
- cursor pagination: ข้อความที่ `createdAt` เท่ากันไม่ข้ามและไม่ซ้ำ
- บล็อก: A บล็อก B แล้วทั้ง A→B และ B→A ส่งไม่ได้
- บล็อก: ฝั่งที่ถูกบล็อกได้ 403 ข้อความกลาง ๆ ฝั่งที่บล็อกได้ 409 ข้อความชัดเจน
- เลิกบล็อกแล้วส่งได้อีก
- รายงาน: คนนอกห้องรายงานไม่ได้ → 404
- รายงาน: รายงานข้อความของตัวเองไม่ได้ → 422
- รายงาน: บันทึกด้วย `targetType: 'message'` และเข้าคิว moderation
- ส่งข้อความสร้าง `Notification` ด้วย `kind: 'direct_message'` ให้อีกฝ่ายเท่านั้น
- กล่องข้อความ: ห้องเปล่าโผล่ให้คนเปิด แต่ไม่โผล่ให้อีกฝ่าย

`packages/contracts/src/conversation.test.ts` — schema ยอม/ไม่ยอมค่าขอบ (0, 2000, 2001 ตัวอักษร)

**เทสต์ migration:** รัน migration บนฐานที่มี seed แล้วยืนยันว่าจำนวนแถวใน
`conversation_messages` เท่ากับจำนวนใน `appointment_messages` ก่อนย้าย

---

## 11. ความซับซ้อน

| การทำงาน | index ที่ใช้ | ความซับซ้อน |
|---|---|---|
| กล่องข้อความ | `conversations_a_recent_idx` + `conversations_b_recent_idx` (bitmap OR) | O(log n + k) |
| unread ทั้งกล่อง | `conversation_messages_unread_idx` + `groupBy` ครั้งเดียว | O(log n + k) |
| ข้อความในห้อง | `conversation_messages_thread_idx` + cursor | O(log n + k) |
| เช็คบล็อก | PK ของ `user_blocks` | O(log n) |
| หา-หรือ-สร้างห้อง | `conversations_pair_key` | O(log n) |

ไม่มีอะไรแย่กว่า O(n) ตามเกณฑ์ `AGENTS.md`

---

## 12. ไม่อยู่ในรอบนี้ (รอบ B และ C)

**รอบ B — นัดหมายในแชท:** `Appointment.conversationId` · ข้อเสนอเวลาโผล่เป็นการ์ด
ในสายแชทเรียงร่วมกับข้อความ · ปุ่มยอมรับ/เสนอใหม่บนการ์ด · ปลดล็อกให้ลูกค้า
เสนอเวลาใหม่ได้ตอนสถานะ `pending` (ตอนนี้ `service.ts:272` บังคับให้ร้านเสนอก่อน)

**รอบ C — เครื่องมือร้าน:** `openingHours` เอามาใช้จริง + กันเสนอเวลานอกเวลาทำการ
และเวลาที่ชนนัดที่ยืนยันแล้ว · quick reply · แดชบอร์ดสรุปร้าน

---

## 13. หนี้ค้างจากงานก่อนหน้า (ยังไม่ได้แก้)

จากการรีวิวงาน editor รอบที่แล้ว — ยังมี MEDIUM ค้าง 4 ข้อ

1. `CameraZoom` ไม่ล้าง `goal.current` เมื่อ `focus` ถูกตั้งใหม่ → กล้องถูกสองตัวลากพร้อมกัน
2. tooltip `[data-tooltip]::after` ถูก `.editor-inspector-scroll` / `.editor-right-panel-scroll` ตัดขอบ
3. `LayerPanel` เปลี่ยนชื่อเลเยอร์ด้วยคีย์บอร์ดไม่ได้ (มีแต่ double-click ส่วนปุ่มดินสอไม่ได้ถูกสร้าง)
4. `SliderField` ล้างช่องแล้ว blur ทำให้ค่าเด้งไปต่ำสุดแทนที่จะคงค่าเดิม

สเปกเดิมอยู่ที่ `docs/tasks/archive/2026-08-19-editor-ux.md`

---

# ผลการทำงาน (2026-08-19)

Codex เป็นผู้ implement รอบแรก จากนั้น Claude รีวิวและแก้ finding เองตามที่ผู้ใช้สั่ง
(session ของ Codex หมดเวลาไปก่อนคืน thread id จึงใช้ codex-reply ต่อไม่ได้)

## Finding จากรีวิวและการแก้

| # | ระดับ | เรื่อง | สถานะ |
|---|---|---|---|
| 1 | CRITICAL | backfill ใน migration `GROUP BY (customer_id, shop_id)` แต่ INSERT ด้วยคู่ที่เรียงตาม uuid → เจ้าของร้านสองคนที่จองกันไปกลับทำให้ชน `conversations_pair_key` | แก้แล้ว |
| 2 | MEDIUM | `loadOlder` ยัดประวัติลงแคช react-query ที่ถูก poll ทับทุก 10 วิ | แก้แล้ว — ย้ายไปเก็บใน state ของหน้า |
| 3 | MEDIUM | ส่งข้อความไม่สำเร็จแล้วเงียบ + unhandled rejection | แก้แล้ว — toast ที่หน้า, catch ในห้อง, คงข้อความที่พิมพ์ |
| 4 | MEDIUM | รายงานข้อความใช้ `window.prompt` ให้พิมพ์รหัสอังกฤษ | แก้แล้ว — ใช้ `ReportDialog` ร่วมกับชุมชน |
| 5 | MEDIUM | เทสต์ mock repository ทั้งก้อน ตรรกะที่ยากจริงไม่ถูกทดสอบ | แก้แล้ว — เพิ่ม integration test 12 ตัวยิงลง Postgres จริง |
| 6 | MEDIUM | โมดูลใหม่เขียนยัดบรรทัดเดียว ไม่มีคอมเมนต์ ต่างจากทั้ง repo | แก้แล้ว |
| 7 | LOW | เปิด `/chat` แล้วเด้งเข้าห้องบนสุดและทำเครื่องหมายอ่านแล้วอัตโนมัติ | แก้แล้ว — ตัดออก |
| 8 | LOW | อีกฝ่ายบล็อกก่อนแล้วบล็อกกลับไม่ได้ | แก้แล้ว — ดูจาก `blockedByMe` |
| 9 | LOW | `role="log"` ไม่มี `aria-label` | แก้แล้ว |
| 10 | LOW | `findBlocksForPairs` กาง OR 2N ก้อน | แก้แล้ว — สองสาขาที่ใช้ `IN` |
| 11 | LOW | CHECK ความยาวข้อความสร้างก่อน backfill | ไม่ใช่ข้อบกพร่อง — ถ้าไม่ผ่านจะ rollback ทั้ง transaction ก่อนถึง `DROP TABLE` |

## ไฟล์ที่เพิ่ม/แก้เพิ่มเติมจาก Codex

- `prisma/migrations/20260819090000_add_conversations/migration.sql` — แก้ backfill
- `apps/api/src/conversations/service.ts`, `repository.ts` — จัดรูปแบบใหม่ + คอมเมนต์
- `apps/api/src/__tests__/conversations.integration.test.ts` — ใหม่ 12 เทสต์
- `apps/web/src/components/ui/ReportDialog.tsx` — ย้ายมาจาก `features/community/components/`
- `apps/web/src/pages/ChatPage.tsx`, `features/chat/components/ConversationRoom.tsx`, `features/chat/useChat.ts`
- `apps/web/src/features/community/components/PostCard.tsx` — ตาม ReportDialog ที่ย้าย

## การตรวจสอบ

- `npm run typecheck` — ผ่านทั้ง 3 workspace
- `npm run test --workspace apps/api` — 129 ผ่าน / 2 ตก (ทั้งสองอยู่ใน
  `templates.feed.integration.test.ts` ซึ่งตกอยู่ก่อนงานนี้และไม่มีไฟล์ที่เกี่ยวข้องถูกแตะ)
- `npm run test --workspace apps/web` — 39 ไฟล์ / 343 เทสต์ ผ่าน
- `npm run test --workspace packages/contracts` — 6 ไฟล์ / 21 เทสต์ ผ่าน
- `npm run build --workspace apps/web` — ผ่าน
- `npx prisma migrate deploy` — apply สำเร็จบน dev database (ตอน apply มี 0 นัดหมาย
  และ 0 ข้อความ การ backfill จึงถูกตรวจแค่ความถูกต้องของไวยากรณ์)
- พิสูจน์ CRITICAL ข้อ 1 ด้วยการรัน SQL เดิมและใหม่กับข้อมูลจำลองของเจ้าของร้าน
  สองคนที่จองกันไปกลับ — เดิมได้ 2 แถวสำหรับคู่เดียวกัน (ชน unique), ใหม่ได้ 1 แถว

---

# รอบเก็บงาน (2026-08-19)

## เทสต์ฝั่งเว็บของห้องแชท

repo นี้ไม่มี component test เลยสักตัว (39 ไฟล์เดิมเป็น logic ล้วน) การลาก jsdom
กับ testing-library เข้ามาจะขัด AGENTS.md ข้อ "avoid unnecessary dependencies"
จึงแยกตรรกะที่เสี่ยงจริงออกมาเป็นฟังก์ชันบริสุทธิ์แทน แบบเดียวกับ `toolShortcuts.ts`

- `features/chat/chatHistory.ts` — `mergeMessages`, `cursorOf`, `historyFor`
  พร้อมเทสต์ 9 ตัว ครอบการยุบ id ซ้ำ, การตัด tie ด้วย id,
  กรณีหน้าล่าสุดเลื่อนจนไม่ต่อกับประวัติ และการไม่ให้ประวัติรั่วข้ามห้อง
- `ChatPage` เรียกใช้ฟังก์ชันเหล่านี้แทนที่จะเขียน logic ในตัวหน้า

## หนี้ editor 4 ข้อ

1. **`CameraZoom`** — เพิ่ม effect ล้าง `goal.current` เมื่อ `focus` ถูกตั้งค่า
   สมมาตรกับที่ `NailFocus` ทำอยู่ ปุ่มเลือกนิ้วกับ "ดูทั้งมือ" เป็น HTML นอก Canvas
   จึงไม่ทริกเกอร์ `pointerdown` ที่ใช้ยกเลิกอยู่เดิม
2. **tooltip ถูกตัดขอบ** — เปลี่ยนจาก `::after` ที่ absolute ในตัวปุ่ม เป็น
   `TooltipLayer` ที่เรนเดอร์ฟองเดียวนอกลำดับชั้นด้วย `position: fixed`
   ตรรกะตำแหน่งแยกไว้ที่ `components/tooltipPlacement.ts` พร้อมเทสต์ 9 ตัว
   (พลิกขึ้นเมื่อข้างล่างไม่พอ, ดึงกลับไม่ให้ล้นทั้งสี่ขอบ)
3. **`LayerPanel`** — เพิ่มปุ่มดินสอที่โฟกัสด้วยคีย์บอร์ดได้ ตามที่สเปกเดิมระบุไว้
   แต่ไม่ได้ถูกสร้าง ดับเบิลคลิกอย่างเดียวทำให้คนใช้คีย์บอร์ดหรือจอสัมผัส
   เปลี่ยนชื่อเลเยอร์ไม่ได้เลย
4. **`SliderField`** — ช่องว่างคืนค่าเดิมแทนที่จะตีเป็นศูนย์แล้ว clamp ขึ้นค่าต่ำสุด
   และลากรางแล้วล้าง draft ที่ค้างอยู่

## การตรวจสอบรอบเก็บงาน

- `npm run typecheck` — ไม่มี error
- `npm run test --workspace apps/web` — **41 ไฟล์ / 361 เทสต์ ผ่าน** (เดิม 39/343)
- `npm run test --workspace apps/api` — 129 ผ่าน / 2 ตกเดิมที่ `templates.feed`
- `npm run test --workspace packages/contracts` — 21 ผ่าน
- `npm run build --workspace apps/web` — ผ่าน

## ความเสี่ยงที่เหลือ

- การ backfill ยังไม่เคยรันกับข้อมูลจริง เพราะ dev database ว่างเปล่า
- **`TooltipLayer` ยังไม่ได้ดูด้วยตาในเบราว์เซอร์** — ตรรกะตำแหน่งมีเทสต์ครอบ
  แต่การต่อ event เข้ากับ DOM ยังไม่ถูกยืนยัน ตัวมันถูก mount ใต้ `AppShell`
  ซึ่งเข้าถึงได้เฉพาะเมื่อล็อกอินแล้ว
- `ModerationPage` รองรับรายงานชนิดข้อความแล้วแต่ยังไม่ได้เปิดดูด้วยตาจริง
