-- Independent conversations replace appointment-scoped messages.
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "participant_a_id" UUID NOT NULL,
    "participant_b_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversations_pair_key" UNIQUE ("participant_a_id", "participant_b_id"),
    CONSTRAINT "conversations_ordered_pair" CHECK ("participant_a_id" < "participant_b_id")
);
CREATE INDEX "conversations_a_recent_idx" ON "conversations"("participant_a_id", "last_message_at" DESC);
CREATE INDEX "conversations_b_recent_idx" ON "conversations"("participant_b_id", "last_message_at" DESC);

CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversation_messages_content_check" CHECK (char_length("content") BETWEEN 1 AND 2000)
);
CREATE INDEX "conversation_messages_thread_idx" ON "conversation_messages"("conversation_id", "created_at" DESC, "id" DESC);
CREATE INDEX "conversation_messages_unread_idx" ON "conversation_messages"("conversation_id", "read_at");

CREATE TABLE "user_blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id")
);
CREATE INDEX "user_blocks_target_idx" ON "user_blocks"("blocked_id");

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_participant_a_id_fkey" FOREIGN KEY ("participant_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversation_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_blocks"
  ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ต้องจัดกลุ่มด้วย "คู่ที่เรียงตาม uuid" ไม่ใช่ (customer_id, shop_id)
--
-- เจ้าของร้านก็เป็นผู้ใช้ธรรมดาที่จองร้านอื่นได้ กติกาเดียวที่กันไว้คือห้ามจองร้านตัวเอง
-- ดังนั้นถ้าเจ้าของร้าน X เคยจองร้าน Y และ Y เคยจองร้าน X จะได้สองกลุ่มที่ยุบลงมาเป็น
-- ordered pair เดียวกัน แล้วชน conversations_pair_key จน migration ล้มกลางคัน
--
-- created_by_id เลือกจากลูกค้าของนัดที่เก่าที่สุด — เป็นค่าที่กำหนดผลได้ ไม่ขึ้นกับ
-- ลำดับที่ Postgres คืนแถว
INSERT INTO "conversations" ("id", "participant_a_id", "participant_b_id", "created_by_id", "created_at", "last_message_at")
SELECT
  gen_random_uuid(),
  pair."participant_a_id",
  pair."participant_b_id",
  (array_agg(pair."customer_id" ORDER BY pair."created_at", pair."id"))[1],
  MIN(pair."created_at"),
  MAX(pair."created_at")
FROM (
  SELECT
    a."id",
    a."customer_id",
    a."created_at",
    LEAST(a."customer_id", a."shop_id") AS "participant_a_id",
    GREATEST(a."customer_id", a."shop_id") AS "participant_b_id"
  FROM "appointments" a
) pair
GROUP BY pair."participant_a_id", pair."participant_b_id";
INSERT INTO "conversation_messages" ("id", "conversation_id", "sender_id", "content", "read_at", "created_at")
SELECT m."id", c."id", m."sender_id", m."content", m."read_at", m."created_at"
FROM "appointment_messages" m
JOIN "appointments" a ON a."id" = m."appointment_id"
JOIN "conversations" c ON c."participant_a_id" = LEAST(a."customer_id", a."shop_id") AND c."participant_b_id" = GREATEST(a."customer_id", a."shop_id");
UPDATE "conversations" c SET "last_message_at" = latest."created_at" FROM (SELECT "conversation_id", MAX("created_at") AS "created_at" FROM "conversation_messages" GROUP BY "conversation_id") latest WHERE c."id" = latest."conversation_id";
DROP TABLE "appointment_messages";
