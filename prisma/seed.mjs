import pg from 'pg'
import { randomUUID } from 'node:crypto'
import {
  BRAND_COLORS,
  COLOR_PALETTES,
  DESIGN_ARCHETYPES,
  validateDesignCatalogSeed,
} from '../apps/api/src/designCatalog/seedData.ts'

validateDesignCatalogSeed()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the design catalog')
}

const pool = new pg.Pool({ connectionString, max: 2 })
const client = await pool.connect()

try {
  await client.query('BEGIN')

  for (const color of BRAND_COLORS) {
    await client.query(
      `INSERT INTO "brand_colors" ("id", "brand", "name", "hex", "is_available")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("brand", "hex") DO UPDATE
       SET "name" = EXCLUDED."name", "is_available" = EXCLUDED."is_available"`,
      [randomUUID(), color.brand, color.name, color.hex.toUpperCase(), color.isAvailable],
    )
  }

  for (const palette of COLOR_PALETTES) {
    await client.query(
      `INSERT INTO "color_palettes"
        ("id", "code", "name_th", "colors", "harmony", "source", "popularity", "is_active")
       VALUES ($1, $2, $3, $4::jsonb, $5::"palette_harmony", $6::"palette_source", $7, $8)
       ON CONFLICT ("code") DO UPDATE SET
         "name_th" = EXCLUDED."name_th",
         "colors" = EXCLUDED."colors",
         "harmony" = EXCLUDED."harmony",
         "source" = EXCLUDED."source",
         "popularity" = EXCLUDED."popularity",
         "is_active" = EXCLUDED."is_active"`,
      [
        randomUUID(),
        palette.code,
        palette.nameTh,
        JSON.stringify(palette.colors),
        palette.harmony,
        palette.source,
        palette.popularity,
        palette.isActive,
      ],
    )
  }

  for (const archetype of DESIGN_ARCHETYPES) {
    await client.query(
      `INSERT INTO "design_archetypes"
        ("id", "code", "name_th", "composer_key", "default_params", "supported_zones", "popularity", "is_active")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       ON CONFLICT ("code") DO UPDATE SET
         "name_th" = EXCLUDED."name_th",
         "composer_key" = EXCLUDED."composer_key",
         "default_params" = EXCLUDED."default_params",
         "supported_zones" = EXCLUDED."supported_zones",
         "popularity" = EXCLUDED."popularity",
         "is_active" = EXCLUDED."is_active"`,
      [
        randomUUID(),
        archetype.code,
        archetype.nameTh,
        archetype.composerKey,
        JSON.stringify(archetype.defaultParams),
        archetype.supportedZones,
        archetype.popularity,
        archetype.isActive,
      ],
    )
  }

  await client.query('COMMIT')
  console.log(
    `Seeded design catalog: ${BRAND_COLORS.length} brand colors, ${COLOR_PALETTES.length} palettes, ${DESIGN_ARCHETYPES.length} archetypes`,
  )
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
