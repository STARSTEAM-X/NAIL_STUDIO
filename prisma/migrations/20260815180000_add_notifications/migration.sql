-- CreateEnum
CREATE TYPE "notification_kind" AS ENUM ('post_like', 'post_comment', 'template_remix', 'appointment_status', 'appointment_message');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "notification_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_title_check" CHECK (char_length("title") BETWEEN 1 AND 200)
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx"
  ON "notifications"("user_id", "created_at" DESC);
CREATE INDEX "notifications_unread_idx"
  ON "notifications"("user_id", "created_at" DESC)
  WHERE "is_read" = false;

-- AddForeignKey
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
