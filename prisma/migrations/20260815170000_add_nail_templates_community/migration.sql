-- CreateEnum
CREATE TYPE "template_origin" AS ENUM ('original', 'ai', 'remix');

-- CreateEnum
CREATE TYPE "template_visibility" AS ENUM ('public', 'unlisted', 'hidden');

-- CreateEnum
CREATE TYPE "template_share_channel" AS ENUM ('link', 'facebook', 'line', 'instagram', 'copy');

-- CreateEnum
CREATE TYPE "content_report_target" AS ENUM ('template', 'comment');

-- CreateEnum
CREATE TYPE "content_report_reason" AS ENUM ('spam', 'inappropriate', 'copyright', 'harassment', 'other');

-- CreateEnum
CREATE TYPE "content_report_status" AS ENUM ('pending', 'reviewed', 'dismissed');

-- CreateTable
CREATE TABLE "nail_templates" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "design_version_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "caption" TEXT,
    "category" TEXT,
    "primary_color" TEXT,
    "origin" "template_origin" NOT NULL DEFAULT 'original',
    "source_template_id" UUID,
    "thumbnail_asset_id" UUID,
    "visibility" "template_visibility" NOT NULL DEFAULT 'public',
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "remix_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "recipe" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "nail_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "nail_templates_name_check" CHECK (char_length("name") BETWEEN 1 AND 120),
    CONSTRAINT "nail_templates_caption_check" CHECK ("caption" IS NULL OR char_length("caption") <= 2000),
    CONSTRAINT "nail_templates_counters_check" CHECK (
      "like_count" >= 0 AND "share_count" >= 0 AND "remix_count" >= 0 AND
      "view_count" >= 0 AND "comment_count" >= 0 AND "report_count" >= 0
    )
);

-- CreateTable
CREATE TABLE "template_likes" (
    "template_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_likes_pkey" PRIMARY KEY ("template_id", "user_id")
);

-- CreateTable
CREATE TABLE "template_shares" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "user_id" UUID,
    "channel" "template_share_channel" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_remixes" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_remixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_comments" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "template_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "template_comments_content_check" CHECK (char_length("content") BETWEEN 1 AND 1000)
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "target_type" "content_report_target" NOT NULL,
    "target_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "content_report_reason" NOT NULL,
    "detail" TEXT,
    "status" "content_report_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nail_templates_author_id_created_at_idx"
  ON "nail_templates"("author_id", "created_at" DESC);
CREATE INDEX "nail_templates_source_template_id_idx"
  ON "nail_templates"("source_template_id");
CREATE INDEX "nail_templates_feed_latest_idx"
  ON "nail_templates"("created_at" DESC, "id" DESC)
  WHERE "visibility" = 'public' AND "deleted_at" IS NULL;
CREATE INDEX "nail_templates_feed_popular_idx"
  ON "nail_templates"("like_count" DESC, "created_at" DESC, "id" DESC)
  WHERE "visibility" = 'public' AND "deleted_at" IS NULL;
CREATE INDEX "nail_templates_filter_idx"
  ON "nail_templates"("category", "primary_color", "created_at" DESC)
  WHERE "visibility" = 'public' AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "template_likes_template_id_user_id_key"
  ON "template_likes"("template_id", "user_id");
CREATE INDEX "template_likes_user_id_created_at_idx"
  ON "template_likes"("user_id", "created_at" DESC);
CREATE INDEX "template_shares_template_id_created_at_idx"
  ON "template_shares"("template_id", "created_at" DESC);
CREATE INDEX "template_shares_user_id_created_at_idx"
  ON "template_shares"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX "template_remixes_template_id_project_id_key"
  ON "template_remixes"("template_id", "project_id");
CREATE INDEX "template_remixes_user_id_created_at_idx"
  ON "template_remixes"("user_id", "created_at" DESC);
CREATE INDEX "template_comments_template_id_created_at_idx"
  ON "template_comments"("template_id", "created_at" DESC);
CREATE UNIQUE INDEX "content_reports_target_type_target_id_reporter_id_key"
  ON "content_reports"("target_type", "target_id", "reporter_id");
CREATE INDEX "content_reports_status_created_at_idx"
  ON "content_reports"("status", "created_at" DESC)
  WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "nail_templates"
  ADD CONSTRAINT "nail_templates_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nail_templates"
  ADD CONSTRAINT "nail_templates_design_version_id_fkey"
  FOREIGN KEY ("design_version_id") REFERENCES "design_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "nail_templates"
  ADD CONSTRAINT "nail_templates_source_template_id_fkey"
  FOREIGN KEY ("source_template_id") REFERENCES "nail_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nail_templates"
  ADD CONSTRAINT "nail_templates_thumbnail_asset_id_fkey"
  FOREIGN KEY ("thumbnail_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "template_likes"
  ADD CONSTRAINT "template_likes_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "nail_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_likes"
  ADD CONSTRAINT "template_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_shares"
  ADD CONSTRAINT "template_shares_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "nail_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_shares"
  ADD CONSTRAINT "template_shares_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "template_remixes"
  ADD CONSTRAINT "template_remixes_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "nail_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_remixes"
  ADD CONSTRAINT "template_remixes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_remixes"
  ADD CONSTRAINT "template_remixes_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_comments"
  ADD CONSTRAINT "template_comments_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "nail_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_comments"
  ADD CONSTRAINT "template_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_reports"
  ADD CONSTRAINT "content_reports_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
