-- Slice 7: shop profiles, appointment negotiation, reviews, and scoped chat.
CREATE TYPE "appointment_status" AS ENUM (
  'pending', 'counter_offered', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show'
);
CREATE TYPE "proposal_actor" AS ENUM ('customer', 'shop');
CREATE TYPE "proposal_status" AS ENUM ('pending', 'accepted', 'rejected', 'superseded');

CREATE TABLE "shop_profiles" (
  "user_id" UUID NOT NULL,
  "shop_name" TEXT NOT NULL,
  "description" TEXT,
  "location_text" TEXT,
  "phone_numbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "opening_hours" JSONB,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "rating_avg" NUMERIC(3,2) NOT NULL DEFAULT 0,
  "rating_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "shop_profiles_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "shop_profiles_name_check" CHECK (char_length("shop_name") BETWEEN 1 AND 160),
  CONSTRAINT "shop_profiles_rating_check" CHECK ("rating_avg" >= 0 AND "rating_avg" <= 5 AND "rating_count" >= 0)
);

CREATE TABLE "shop_services" (
  "id" UUID NOT NULL,
  "shop_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_thb" NUMERIC(10,2) NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "shop_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shop_services_name_check" CHECK (char_length("name") BETWEEN 1 AND 160),
  CONSTRAINT "shop_services_price_check" CHECK ("price_thb" >= 0),
  CONSTRAINT "shop_services_duration_check" CHECK ("duration_minutes" BETWEEN 15 AND 480)
);

CREATE TABLE "appointments" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "shop_id" UUID NOT NULL,
  "service_id" UUID,
  "design_version_id" UUID,
  "status" "appointment_status" NOT NULL DEFAULT 'pending',
  "agreed_start_at" TIMESTAMPTZ,
  "duration_minutes" INTEGER NOT NULL,
  "price_quoted_thb" NUMERIC(10,2),
  "customer_note" TEXT,
  "shop_note" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_duration_check" CHECK ("duration_minutes" BETWEEN 15 AND 480),
  CONSTRAINT "appointments_notes_check" CHECK (
    ("customer_note" IS NULL OR char_length("customer_note") <= 1000) AND
    ("shop_note" IS NULL OR char_length("shop_note") <= 1000)
  ),
  CONSTRAINT "appointments_price_check" CHECK ("price_quoted_thb" IS NULL OR "price_quoted_thb" >= 0)
);

CREATE TABLE "appointment_proposals" (
  "id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "proposed_by" "proposal_actor" NOT NULL,
  "proposed_start_at" TIMESTAMPTZ NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "message" TEXT,
  "status" "proposal_status" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_proposals_duration_check" CHECK ("duration_minutes" BETWEEN 15 AND 480),
  CONSTRAINT "appointment_proposals_message_check" CHECK ("message" IS NULL OR char_length("message") <= 500)
);

CREATE TABLE "shop_reviews" (
  "id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "shop_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "rating" SMALLINT NOT NULL,
  "comment" TEXT,
  "shop_reply" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "shop_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shop_reviews_appointment_key" UNIQUE ("appointment_id"),
  CONSTRAINT "shop_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "shop_reviews_text_check" CHECK (
    ("comment" IS NULL OR char_length("comment") <= 2000) AND
    ("shop_reply" IS NULL OR char_length("shop_reply") <= 2000)
  )
);

CREATE TABLE "appointment_messages" (
  "id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "sender_id" UUID,
  "content" TEXT NOT NULL,
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_messages_content_check" CHECK (char_length("content") BETWEEN 1 AND 2000)
);

CREATE INDEX "shop_profiles_recommendation_idx"
  ON "shop_profiles"("is_verified", "rating_avg" DESC, "rating_count" DESC);
CREATE INDEX "shop_services_active_idx"
  ON "shop_services"("shop_id", "sort_order") WHERE "is_active" = true;
CREATE INDEX "appointments_customer_created_idx"
  ON "appointments"("customer_id", "created_at" DESC);
CREATE INDEX "appointments_shop_status_created_idx"
  ON "appointments"("shop_id", "status", "created_at" DESC);
CREATE INDEX "appointment_proposals_timeline_idx"
  ON "appointment_proposals"("appointment_id", "created_at" DESC);
CREATE UNIQUE INDEX "appointment_proposals_one_pending_idx"
  ON "appointment_proposals"("appointment_id") WHERE "status" = 'pending';
CREATE INDEX "shop_reviews_shop_created_idx"
  ON "shop_reviews"("shop_id", "created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "appointment_messages_thread_idx"
  ON "appointment_messages"("appointment_id", "created_at" DESC);
CREATE INDEX "appointment_messages_unread_idx"
  ON "appointment_messages"("appointment_id", "read_at") WHERE "read_at" IS NULL;

ALTER TABLE "shop_profiles"
  ADD CONSTRAINT "shop_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_services"
  ADD CONSTRAINT "shop_services_shop_id_fkey"
  FOREIGN KEY ("shop_id") REFERENCES "shop_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "appointments_shop_id_fkey"
  FOREIGN KEY ("shop_id") REFERENCES "shop_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "appointments_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "shop_services"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "appointments_design_version_id_fkey"
  FOREIGN KEY ("design_version_id") REFERENCES "design_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointment_proposals"
  ADD CONSTRAINT "appointment_proposals_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_reviews"
  ADD CONSTRAINT "shop_reviews_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "shop_reviews_shop_id_fkey"
  FOREIGN KEY ("shop_id") REFERENCES "shop_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "shop_reviews_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_messages"
  ADD CONSTRAINT "appointment_messages_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "appointment_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
