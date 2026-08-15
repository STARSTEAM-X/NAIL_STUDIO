/**
 * พิสูจน์ว่าไฟล์ migration รันจากฐานข้อมูลเปล่าได้จริงและสร้างโครงสร้างครบตามที่ประกาศ
 *
 * ทำไมต้องมี: การมีไฟล์ migration ไม่ได้แปลว่ามันใช้ได้ ถ้า migration พังหรือไม่ครบ
 * จะรู้ตอน deploy ครั้งแรกซึ่งสายเกินไป เครื่องมือนี้ตรวจให้ก่อน
 *
 * ทำแบบไม่แตะข้อมูลจริง: สร้างฐานข้อมูลชั่วคราว apply migration ลงไป ตรวจโครงสร้าง
 * ที่เกิดขึ้นจริงจาก information_schema แล้วลบทิ้ง
 *
 * ข้อควรระวังด้านความปลอดภัย: connection string ต้องส่งผ่าน environment variable
 * เท่านั้น ห้ามใส่ใน argv เด็ดขาด เพราะ argv จะโผล่ในข้อความ error, ใน process list
 * และใน log ของ CI แบบถาวร
 *
 * รัน: node --env-file=.env tools/verify-migration.mjs
 */

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import pg from 'pg'

// เรียก entry point ของ Prisma ด้วย node ตรง ๆ ไม่ผ่าน npx
//
// เหตุผล: Node บน Windows ปฏิเสธการ spawn ไฟล์ .cmd (เช่น npx.cmd) โดยไม่มี shell
// (มาตรการความปลอดภัยตั้งแต่ Node 18.20) ส่วนการเปิด shell ก็เป็นความเสี่ยงอีกแบบ
// เพราะ argument ไม่ถูก escape — การเรียก .js ตรง ๆ เลี่ยงทั้งสองปัญหา
const require = createRequire(import.meta.url)
const PRISMA_CLI = require.resolve('prisma/build/index.js')

const SCRATCH_DB = 'nailstudio_migcheck'

/** ตารางและคอลัมน์ที่ migration ต้องสร้างให้ครบ */
const EXPECTED = {
  users: ['id', 'email', 'password_hash', 'role', 'display_name', 'created_at', 'updated_at'],
  sessions: ['id', 'user_id', 'token_hash', 'expires_at', 'last_seen_at', 'created_at', 'user_agent'],
  projects: [
    'id', 'user_id', 'name', 'status', 'version_count',
    'created_at', 'updated_at', 'deleted_at',
    'draft_document', 'draft_updated_at', 'draft_base_version',
    'thumbnail_asset_id',
  ],
  design_versions: ['id', 'project_id', 'version_number', 'schema_version', 'document', 'label', 'created_at'],
  assets: [
    'id', 'owner_id', 'kind', 'storage_key', 'mime_type',
    'size_bytes', 'checksum_sha256', 'metadata', 'created_at',
  ],
}

/**
 * ข้อจำกัดความไม่ซ้ำที่เป็นรากฐานของความถูกต้อง ไม่ใช่แค่ตรวจว่าตารางมีอยู่
 *
 * ทั้งสามข้อนี้คือสิ่งที่ทำให้ระบบถูกต้องแม้มีคำขอพร้อมกัน:
 *   users.email          — กันสมัครอีเมลซ้ำ แม้สองคำขอมาพร้อมกัน
 *   sessions.token_hash  — เป็นคีย์ค้นหาของทุก authenticated request
 *   design_versions      — (project_id, version_number) คือรากฐานของ optimistic concurrency
 *
 * ต้องอ่านจาก pg_index ไม่ใช่ information_schema.table_constraints
 * เพราะ Prisma สร้าง @unique เป็น "unique index" ไม่ใช่ "table constraint"
 * ซึ่งบังคับความไม่ซ้ำได้เหมือนกันแต่ไม่ปรากฏใน table_constraints
 */
const EXPECTED_UNIQUE = [
  { table: 'users', columns: ['email'] },
  { table: 'sessions', columns: ['token_hash'] },
  { table: 'design_versions', columns: ['project_id', 'version_number'] },
  { table: 'assets', columns: ['storage_key'] },
]

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[ล้มเหลว] ไม่พบ DATABASE_URL — รันด้วย node --env-file=.env tools/verify-migration.mjs')
  process.exit(1)
}

const scratchUrl = new URL(databaseUrl)
const appDatabase = scratchUrl.pathname.slice(1)
scratchUrl.pathname = `/${SCRATCH_DB}`

function runPrisma(args, url) {
  return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
    encoding: 'utf8',
    // ส่ง connection string ทาง env เท่านั้น — ไม่มีทางหลุดไปอยู่ใน argv
    env: { ...process.env, DATABASE_URL: url },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function withClient(url, work) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

console.log(`ตรวจ migration ด้วยฐานข้อมูลชั่วคราว "${SCRATCH_DB}"`)
console.log(`(ฐานข้อมูลจริง "${appDatabase}" ไม่ถูกแตะต้อง)\n`)

let ok = true
const problems = []

await withClient(databaseUrl, async (client) => {
  await client.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`)
  await client.query(`CREATE DATABASE "${SCRATCH_DB}"`)
})
console.log('1. สร้างฐานข้อมูลชั่วคราวแล้ว')

try {
  runPrisma(['migrate', 'deploy'], scratchUrl.toString())
  console.log('2. apply migration ลงฐานข้อมูลเปล่าสำเร็จ')

  await withClient(scratchUrl.toString(), async (client) => {
    const { rows: tableRows } = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    )
    const tables = new Set(tableRows.map((row) => row.table_name))

    for (const [table, columns] of Object.entries(EXPECTED)) {
      if (!tables.has(table)) {
        problems.push(`ไม่พบตาราง ${table}`)
        continue
      }
      const { rows: columnRows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      )
      const actual = new Set(columnRows.map((row) => row.column_name))
      const missing = columns.filter((column) => !actual.has(column))
      if (missing.length > 0) problems.push(`ตาราง ${table} ขาดคอลัมน์: ${missing.join(', ')}`)
    }
    console.log(`3. ตรวจตารางและคอลัมน์แล้ว (พบ ${tables.size} ตาราง)`)

    // ต้อง cast เป็น text[] ไม่ใช่ปล่อยเป็น name[]
    // เพราะ driver pg ไม่มีตัวแปลงสำหรับ name[] จะคืนสตริงดิบ "{email}" มาแทน array
    // ทำให้โค้ดฝั่ง JS ที่คิดว่าได้ array ไปวนตัวอักษรทีละตัวโดยไม่มี error ให้จับ
    const { rows: uniqueRows } = await client.query(
      `SELECT t.relname::text AS table_name,
              array_agg(a.attname::text ORDER BY a.attname) AS columns
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
       WHERE i.indisunique AND t.relnamespace = 'public'::regnamespace
       GROUP BY t.relname, i.indexrelid`,
    )
    for (const expected of EXPECTED_UNIQUE) {
      const wanted = [...expected.columns].sort().join(',')
      const found = uniqueRows.some(
        (row) => row.table_name === expected.table && [...row.columns].sort().join(',') === wanted,
      )
      if (!found) {
        problems.push(`ตาราง ${expected.table} ไม่มีข้อจำกัดความไม่ซ้ำบน (${expected.columns.join(', ')})`)
      }
    }
    console.log(`4. ตรวจข้อจำกัดความไม่ซ้ำแล้ว (พบ ${uniqueRows.length} รายการ)`)

    const { rows: indexRows } = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'projects'`,
    )
    if (indexRows.length < 2) {
      problems.push('ตาราง projects ไม่มีดัชนีสำหรับหน้ารายการงาน')
    }
    console.log(`5. ตรวจดัชนีแล้ว (projects มี ${indexRows.length} ดัชนี)`)
  })
} catch (error) {
  ok = false
  // ตัดข้อความที่อาจมี connection string ปนออกก่อนพิมพ์
  const message = error instanceof Error ? error.message : String(error)
  problems.push(message.replaceAll(/postgres(?:ql)?:\/\/[^\s"']+/g, '<ซ่อน connection string>'))
} finally {
  await withClient(databaseUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`)
  })
  console.log('6. ลบฐานข้อมูลชั่วคราวแล้ว')
}

if (problems.length > 0) {
  ok = false
  console.error('\nปัญหาที่พบ:')
  for (const problem of problems) console.error(`  - ${problem}`)
}

console.log(ok ? '\n✔ migration รันจากศูนย์ได้จริงและโครงสร้างครบ' : '\n✘ migration มีปัญหา')
process.exit(ok ? 0 : 1)
