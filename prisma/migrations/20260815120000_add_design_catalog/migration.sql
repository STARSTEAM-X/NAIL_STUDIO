-- CreateEnum
CREATE TYPE "palette_harmony" AS ENUM ('analogous', 'complementary', 'triadic', 'monochrome');

-- CreateEnum
CREATE TYPE "palette_source" AS ENUM ('curated', 'extracted');

-- CreateTable
CREATE TABLE "brand_colors" (
    "id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" VARCHAR(7) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "brand_colors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "brand_colors_hex_check" CHECK ("hex" ~ '^#[0-9A-Fa-f]{6}$')
);

-- CreateTable
CREATE TABLE "color_palettes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "harmony" "palette_harmony" NOT NULL,
    "source" "palette_source" NOT NULL DEFAULT 'curated',
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "color_palettes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "color_palettes_colors_array_check" CHECK (jsonb_typeof("colors") = 'array'),
    CONSTRAINT "color_palettes_popularity_check" CHECK ("popularity" >= 0)
);

-- CreateTable
CREATE TABLE "design_archetypes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "composer_key" TEXT NOT NULL,
    "default_params" JSONB NOT NULL DEFAULT '{}',
    "supported_zones" TEXT[] NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "design_archetypes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "design_archetypes_composer_key_check" CHECK (length(trim("composer_key")) > 0),
    CONSTRAINT "design_archetypes_default_params_object_check" CHECK (jsonb_typeof("default_params") = 'object'),
    CONSTRAINT "design_archetypes_supported_zones_check" CHECK (cardinality("supported_zones") > 0),
    CONSTRAINT "design_archetypes_popularity_check" CHECK ("popularity" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_colors_brand_hex_key" ON "brand_colors"("brand", "hex");
CREATE INDEX "brand_colors_brand_is_available_idx" ON "brand_colors"("brand", "is_available");
CREATE UNIQUE INDEX "color_palettes_code_key" ON "color_palettes"("code");
CREATE INDEX "color_palettes_is_active_popularity_idx" ON "color_palettes"("is_active", "popularity" DESC);
CREATE UNIQUE INDEX "design_archetypes_code_key" ON "design_archetypes"("code");
CREATE INDEX "design_archetypes_is_active_popularity_idx" ON "design_archetypes"("is_active", "popularity" DESC);
