-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "draft_base_version" INTEGER,
ADD COLUMN     "draft_document" JSONB,
ADD COLUMN     "draft_updated_at" TIMESTAMPTZ;
