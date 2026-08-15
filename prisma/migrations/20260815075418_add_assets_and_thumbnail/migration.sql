-- AlterTable
ALTER TABLE "projects" ADD COLUMN "thumbnail_asset_id" UUID;

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "kind" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" BYTEA NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_storage_key_key" ON "assets"("storage_key");

-- CreateIndex
CREATE INDEX "assets_owner_id_kind_created_at_idx" ON "assets"("owner_id", "kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "assets_checksum_sha256_idx" ON "assets"("checksum_sha256");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_thumbnail_asset_id_fkey" FOREIGN KEY ("thumbnail_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint (manually added — see spec §3.5: text+CHECK instead of enum so
-- future asset kinds don't require ALTER TYPE ... ADD VALUE outside a transaction)
ALTER TABLE "assets" ADD CONSTRAINT "assets_kind_check" CHECK (kind IN ('thumbnail'));
