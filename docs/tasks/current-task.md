# Task: ย้ายทั้งระบบ (เว็บ + API) ไปรันบน Vercel

> spec งานก่อนหน้า (ขอบรูป `fill()` เป็นขั้นบันได) ย้ายไปอยู่ที่ `docs/tasks/smooth-fill-edges.md`

## บริบท

ตอนนี้ระบบ deploy เป็น service เดียวบน Render (`nail-studio-nkmi.onrender.com`):
Express API ส่งหน้าเว็บ Vite build เอง (`WEB_DIST`) + Postgres + เก็บไฟล์ลงดิสก์
(`LocalDiskProvider`) — ณ 2026-10-27 service นี้ตอบ 503 ทุกเส้นทาง

ผู้ใช้ต้องการย้ายทั้งระบบมา Vercel (team `starsteam-xs-projects`)

## สิ่งที่ไม่เข้ากับ Vercel (และทางแก้)

| ส่วน | ปัญหาบน Vercel | ทางแก้ |
|---|---|---|
| `server.ts` (`app.listen`) | Function ไม่มี long-running server | entry ใหม่ export Express app เป็น Vercel Function |
| `LocalDiskProvider` | ดิสก์ของ function เป็น ephemeral / read-only | เพิ่ม driver `vercel-blob` ใน `StorageProvider` |
| `projects/events.ts` (EventEmitter ในโปรเซส) | หลาย instance → editor ไม่ได้รับ event ที่ instance อื่น publish | เปลี่ยน bus เป็น PostgreSQL `LISTEN/NOTIFY` (interface เดิม) |
| SSE `/projects/:id/events` | function มีเพดานเวลา | ตั้ง `maxDuration`, ปิด stream ก่อนหมดเวลา, `EventSource` ต่อใหม่เอง |
| `pg.Pool({ max: 10 })` | แต่ละ instance เปิด pool ของตัวเอง → connection ล้น | ใช้ pooled URL + `max` เล็ก |
| Postgres | Render DB ไม่ได้มากับ Vercel | Neon ผ่าน Vercel Marketplace (preview ได้ branch แยกอัตโนมัติ) |
| Helmet CSP | หน้าเว็บ static ไม่ผ่าน Express แล้ว → ไม่มี CSP | ใส่ header เดียวกันใน `vercel.json` |
| AI service (Python + Ollama) | รันบน Vercel ไม่ได้ (ต้องการ GPU/โมเดล 8B) | **นอกขอบเขต** — route `/ai` ต้องตอบ error สะอาด ไม่ crash |
| MCP HTTP service (`apps/mcp`) | — | **นอกขอบเขต** รอบนี้ (ยังชี้ API ตามเดิม ต้องแก้ `NAIL_STUDIO_API_URL` ทีหลัง) |

## สถาปัตยกรรมเป้าหมาย

Vercel project เดียว root = repo root, โดเมนเดียว (cookie ล็อกอินเป็น first-party, ไม่ต้องพึ่ง CORS):

```
https://<project>.vercel.app/
  /assets/*, /index.html, /models/*   → static จาก apps/web/dist (CDN)
  /api/v1/*                           → Vercel Function (Express app เดิมทั้งก้อน)
  /* อื่น ๆ                            → index.html (SPA fallback)
```

## การเปลี่ยนแปลงทีละไฟล์

### 1. Function entry — `api/index.ts` (ใหม่, ที่ repo root)
- `import { createApp } from '../apps/api/src/app.ts'` แล้ว `export default createApp({ webDist: undefined })`
- ไม่เรียก `listen()`, ไม่ผูก SIGTERM
- **ความเสี่ยงที่ต้องพิสูจน์:** โค้ด API import ด้วยนามสกุล `.ts` และอาศัย Node type-stripping
  ถ้า builder ของ Vercel compile แล้ว import `.ts` พังตอน runtime ให้ใช้ทางสำรอง:
  pre-bundle ด้วย esbuild (`--bundle --platform=node --format=esm`, external: `@node-rs/argon2`, `pg-native`)
  เป็น `api/index.mjs` ใน build step — Codex ต้องเลือกทางที่ **พิสูจน์ได้ว่ารันได้** และรายงานว่าใช้ทางไหน

### 2. `vercel.json` (ใหม่)
- `installCommand`: `npm ci`
- `buildCommand`: `prisma generate` → (production เท่านั้น) `prisma migrate deploy` → build เว็บ
  ด้วย `VITE_API_URL=` (ค่าว่าง = เรียก API แบบ relative path)
  - migrate เฉพาะเมื่อ `VERCEL_ENV=production` — preview ใช้ Neon branch ของตัวเอง ห้ามแตะ DB production
  - ถ้า migrate ล้ม build ต้องล้ม (ไม่ deploy โค้ดที่ schema ไม่ตรง)
- `outputDirectory`: `apps/web/dist`
- `rewrites`: `/api/(.*)` → `/api` ; `/((?!api/).*)` → `/index.html`
- `functions`: `api/index.ts` → `maxDuration: 300`, `includeFiles` ที่ Prisma ต้องใช้ (ถ้ามี)
- `headers`: CSP / HSTS / `X-Content-Type-Options` / `frame-ancestors 'none'` ให้ตรงกับ helmet ใน `app.ts`;
  `Cache-Control: public, max-age=31536000, immutable` สำหรับ `/assets/*`, `no-cache` สำหรับ `index.html`
- ใช้ Node 22.x หรือ 24.x (ตรง `engines` `>=22.12.0`)

### 3. `apps/api/src/config/env.ts`
- `STORAGE_DRIVER: z.enum(['local', 'vercel-blob'])`
- `BLOB_READ_WRITE_TOKEN`: บังคับเมื่อ driver = `vercel-blob` (superRefine)
- `DATABASE_URL_UNPOOLED`: optional — ใช้กับ LISTEN (pooler โหมด transaction ไม่รองรับ LISTEN)
- `DB_POOL_MAX`: default 10 (local), บน Vercel ตั้ง 3
- เมื่อรันบน Vercel (`process.env.VERCEL` มีค่า) และ `STORAGE_DRIVER=local` → fail fast พร้อมข้อความชัดเจน

### 4. `apps/api/src/storage/VercelBlobProvider.ts` (ใหม่) + `storage/index.ts`
- ใช้ `@vercel/blob` — **ต้องเป็น private access** (thumbnail/asset ของผู้ใช้ต้องผ่านการตรวจสิทธิ์ของ API
  ห้ามมี public URL ที่เดาได้) Codex ต้องตรวจ docs ปัจจุบันของ `@vercel/blob` ว่ารองรับ private store;
  ถ้าไม่รองรับ ให้หยุดและรายงาน ห้ามเปลี่ยนเป็น public เอง
- `put(key)`: เขียนที่ pathname = `key` (key สร้างจากฝั่ง service อยู่แล้ว) `addRandomSuffix: false`, `allowOverwrite: true`
- `get(key)`: อ่านกลับเป็น `Buffer`; key ไม่มี → โยน error ชนิดเดียวกับ `LocalDiskProvider` (service map เป็น 404 ได้เหมือนเดิม)
- `delete(key)`: ลบ; ไม่มีอยู่ไม่ถือเป็น error (idempotent เหมือน local)
- ห้ามเปลี่ยน `StorageProvider` interface และ service ที่เรียกใช้

### 5. `apps/api/src/db.ts`
- `max: env.DB_POOL_MAX`, เพิ่ม `idleTimeoutMillis` สั้น (เช่น 10s) ให้ instance ที่ว่างคืน connection
- คง `statement_timeout: 5_000`

### 6. `apps/api/src/projects/events.ts` — LISTEN/NOTIFY
- `publishVersionSaved`: `SELECT pg_notify('project_events', $1)` payload = JSON event (มีขนาดเล็ก < 8000 bytes; ถ้าเกินให้ log แล้วข้าม ไม่ทำให้การบันทึกล้ม)
- `subscribeProject`: ใช้ `pg.Client` ตัวเดียวต่อ instance (lazy) ต่อด้วย `DATABASE_URL_UNPOOLED ?? DATABASE_URL`
  `LISTEN project_events` แล้วกระจายเข้า EventEmitter ภายในตาม `projectId`
  - ปิด client เมื่อไม่มี listener เหลือ; reconnect เมื่อ connection หลุด
  - signature `publishVersionSaved` / `subscribeProject` ต้องเหมือนเดิม → `routes.ts` ไม่ต้องแก้ส่วนนี้
- publish ต้อง await ไม่ได้ทำให้ request บันทึกงานล้มถ้า notify ล้ม (log เท่านั้น — event เป็น best-effort)

### 7. `apps/api/src/projects/routes.ts` — SSE
- ปิด stream เองก่อนเพดาน function (เช่นที่ 270s) ด้วย `response.end()` ให้ `EventSource` ต่อใหม่
- คง heartbeat 25s

### 8. `.env.example`
- เพิ่ม `STORAGE_DRIVER=vercel-blob`, `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL_UNPOOLED`, `DB_POOL_MAX` พร้อมคำอธิบาย (ไม่มีค่าจริง)

### 9. เอกสาร `docs/deployment-vercel.md` (ใหม่)
- รายการ env ที่ต้องตั้งใน Vercel: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`,
  `WEB_ORIGIN` (= โดเมน production), `NODE_ENV=production`, `STORAGE_DRIVER=vercel-blob`,
  `BLOB_READ_WRITE_TOKEN`, `DB_POOL_MAX=3`
- ขั้นตอนย้ายข้อมูลจาก Render (ถ้ามี): `pg_dump` → `pg_restore` และคัดลอกไฟล์ใน `STORAGE_ROOT` ขึ้น Blob ตาม key เดิม

## ไม่เปลี่ยน (นอกขอบเขต)
- `server.ts` / การรัน local / `WEB_DIST` mode — ยังใช้ได้เหมือนเดิม
- AI service, MCP HTTP service, schema ฐานข้อมูล, contracts, โค้ดหน้าเว็บ

## Acceptance criteria
1. local dev (`npm run dev:api` + `npm run dev:web`) ทำงานเหมือนเดิมด้วย `STORAGE_DRIVER=local`
2. build ตามคำสั่งใน `vercel.json` ผ่านบนเครื่อง; `apps/web/dist` ไม่มีสตริง `localhost:4000`
3. Function entry รันได้จริง: โหลด handler แล้ว `GET /api/v1/health` ได้ `{ success: true }`
   (ทดสอบด้วย supertest หรือ node script กับ handler ที่ build แล้ว)
4. `VercelBlobProvider` ผ่าน unit test (mock `@vercel/blob`): put/get/delete, get key ไม่มี → error ชนิดเดิม, delete ซ้ำไม่ error
5. events: test ว่า publish จาก "instance" หนึ่ง (client A) ถึง subscriber ของอีก client (B) ผ่าน LISTEN/NOTIFY
   — ถ้าไม่มี Postgres ใน test env ให้ test ด้วย fake client และรายงานว่า integration ยังไม่ได้รันจริง
6. env validation: `vercel-blob` ไม่มี token → fail fast; บน Vercel + `local` → fail fast
7. `npm run typecheck` และ `npm test` ผ่านทั้ง repo
8. หลัง deploy: หน้าแรกโหลด, สมัคร/ล็อกอินได้ (cookie บนโดเมน vercel), สร้างงาน + บันทึก thumbnail ได้,
   เปิด editor สองแท็บ บันทึกแท็บหนึ่ง อีกแท็บได้ event

## Edge cases
- Cold start: instance แรกต้องเชื่อม DB ภายใน timeout — `statement_timeout` ไม่กระทบ connect
- LISTEN client หลุดกลางทาง (Neon scale-to-zero) → reconnect + re-LISTEN; SSE ที่ค้างอยู่ไม่ crash
- NOTIFY payload ใหญ่เกิน 8000 bytes → ข้าม + log
- Blob key มีอักขระพิเศษ → key มาจาก service ที่คุมรูปแบบอยู่แล้ว แต่ provider ต้องไม่ยอม `..` หรือ `/` นำหน้า
- request body: Vercel จำกัด 4.5MB — ค่า `express.json({ limit: '4mb' })` และ raw webp 2mb อยู่ในเพดาน
- rate limit เป็น in-memory ต่อ instance → เพดานจริงหลวมขึ้นเมื่อมีหลาย instance (ยอมรับได้รอบนี้, บันทึกใน limitations)
- `trust proxy 1` ยังถูกต้องหลัง proxy ของ Vercel (ให้ `req.ip` จาก `x-forwarded-for`) — ต้องตรวจ
- `@node-rs/argon2` ต้องได้ binary linux-x64-gnu จาก lockfile (สร้างบน Windows) — ตรวจว่า lockfile มี optional deps ครบ

## Complexity
- events: publish O(1) query; dispatch O(listeners ของ projectId นั้น); 1 LISTEN connection ต่อ instance
- storage: O(ขนาดไฟล์) ต่อ request เหมือนเดิม
- ไม่มีอัลกอริทึมใหม่ที่มีนัยสำคัญ

## Tests ที่ต้องมี
- `storage/VercelBlobProvider.test.ts`
- `projects/events.test.ts` (fake pg client: publish → notify → dispatch, reconnect, unsubscribe ปิด client)
- `config/env.test.ts` เพิ่มเคส driver ใหม่
- smoke test ของ function entry (`/api/v1/health`)

## การ deploy (หลัง implement + review ผ่าน)
Claude สร้าง Vercel project + เชื่อม Neon + Blob + ตั้ง env แล้ว deploy — วิธีส่งซอร์สขึ้น Vercel
ต้องให้ผู้ใช้เลือก: (ก) เชื่อม GitHub repo `STARSTEAM-X/NAIL_STUDIO` (ต้อง commit + push) หรือ
(ข) ผู้ใช้รัน `vercel login` เองครั้งเดียวแล้ว Claude ใช้ `vercel deploy` จากเครื่อง
