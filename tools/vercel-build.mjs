/**
 * build สำหรับ Vercel — สร้าง .vercel/output ตาม Build Output API v3 เอง
 *
 * ทำไมไม่ใช้ zero-config ของ Vercel: โค้ด API import ด้วยนามสกุล .ts และอาศัย type stripping
 * ของ Node ซึ่ง builder ของ Vercel ไม่รับประกัน — bundle เองด้วย rolldown ได้ผลลัพธ์ที่ทดสอบ
 * บนเครื่องได้จริง (`node tools/vercel-smoke.mjs`) ก่อน deploy
 *
 * ขั้นตอน: prisma generate → (production) migrate deploy → build เว็บ → bundle API → ประกอบ output
 */
import { execSync } from 'node:child_process'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { rolldown } from 'rolldown'

const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, '.vercel/output')
const fn = path.join(output, 'functions/api.func')
const mcpFn = path.join(output, 'functions/mcp.func')

function run(command, env = {}) {
  console.log(`> ${command}`)
  execSync(command, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
}

run('npx prisma generate')

if (process.env.VERCEL_ENV === 'production') {
  // migrate ต้องใช้ connection ตรง — advisory lock ของ Prisma ใช้ผ่าน pooler โหมด transaction ไม่ได้
  // ถ้า migrate ล้ม build ล้มทั้งก้อน ไม่ deploy โค้ดที่ schema ไม่ตรงกับ DB
  run('npx prisma migrate deploy', { DATABASE_URL: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL })
} else {
  console.log('ข้าม prisma migrate deploy (ไม่ใช่ production)')
}

// VITE_API_URL ว่าง = เว็บเรียก /api/v1 แบบ relative บนโดเมนเดียวกัน (cookie เป็น first-party)
run('npm run build --workspace @nail-studio/web', { VITE_API_URL: '' })

await rm(output, { recursive: true, force: true })

async function bundleFunction(input, dir, external) {
  await mkdir(dir, { recursive: true })
  const bundle = await rolldown({ input: path.join(root, input), platform: 'node', external, logLevel: 'warn' })
  await bundle.write({
    dir,
    format: 'esm',
    entryFileNames: 'index.mjs',
    chunkFileNames: 'chunks/[name]-[hash].mjs',
    // dependency แบบ CJS ใน bundle ESM ยังเรียก require() ของ built-in อยู่
    banner: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  })
  await bundle.close()
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }))
  await writeFile(path.join(dir, '.vc-config.json'), JSON.stringify({
    runtime: 'nodejs24.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
    maxDuration: 300,
  }, null, 2))
}

/** native addon โหลดจาก node_modules ข้าง function — คัดลอกแพ็กเกจหลักและแพ็กเกจของแพลตฟอร์ม (เช่น canvas-linux-x64-gnu) */
async function copyNative(dir, scope, base) {
  const source = path.join(root, 'node_modules', scope)
  for (const name of readdirSync(source).filter((entry) => entry.startsWith(base))) {
    await cp(path.join(source, name), path.join(dir, 'node_modules', scope, name), { recursive: true, dereference: true })
  }
}

// pg-native เป็น optional ที่ไม่ได้ใช้
await bundleFunction('apps/api/src/vercel.ts', fn, [/^@node-rs\/argon2/, 'pg-native'])
await copyNative(fn, '@node-rs', 'argon2')

await bundleFunction('apps/mcp/src/vercel.ts', mcpFn, [/^@napi-rs\/canvas/])
await copyNative(mcpFn, '@napi-rs', 'canvas')
await cp(path.join(root, 'apps/web/public/models/hand.glb'), path.join(mcpFn, 'hand.glb'))

const webDist = path.join(root, 'apps/web/dist')
if (!existsSync(path.join(webDist, 'index.html'))) throw new Error('ไม่พบ apps/web/dist/index.html')
await cp(webDist, path.join(output, 'static'), { recursive: true })

// ต้องตรงกับ helmet ใน apps/api/src/app.ts (production) — หน้าเว็บไม่ได้วิ่งผ่าน Express แล้ว
const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'", "base-uri 'self'", "font-src 'self' https: data:", "form-action 'self'",
    "frame-ancestors 'none'", "img-src 'self' data: blob:", "object-src 'none'", "script-src 'self' 'wasm-unsafe-eval'",
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'", 'upgrade-insecure-requests',
    "connect-src 'self' blob: data:",
  ].join(';'),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0',
}

await writeFile(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    // API ส่ง header ความปลอดภัยของตัวเองผ่าน helmet อยู่แล้ว
    { src: '^/api/(.*)$', dest: '/api' },
    // MCP + OAuth ของ MCP — helmet ของ MCP ตั้ง CSP เอง (form-action ไป claude.ai/chatgpt.com) จึงต้องอยู่ก่อน securityHeaders
    { src: '^/(mcp|consent|authorize|token|revoke)/?$', dest: '/mcp' },
    // GET /register เป็นหน้าสมัครสมาชิกของ SPA — DCR ของ MCP ใช้แค่ POST
    { src: '^/register/?$', methods: ['POST'], dest: '/mcp' },
    { src: '^/\\.well-known/(oauth-authorization-server|oauth-protected-resource)(/.*)?$', dest: '/mcp' },
    { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/(.*)$', headers: securityHeaders, continue: true },
    { handle: 'filesystem' },
    // SPA fallback — index.html ห้าม cache ไม่งั้นผู้ใช้ค้างกับ build เก่าที่อ้างไฟล์ซึ่งถูกลบแล้ว
    { src: '^/(.*)$', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
  ],
}, null, 2))

console.log(`สร้าง ${path.relative(root, output)} เรียบร้อย`)
