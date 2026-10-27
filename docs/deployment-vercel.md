# Deploy บน Vercel

ทั้งเว็บและ API อยู่ใน Vercel project เดียว โดเมนเดียว:

```
/assets/*, /index.html, /models/*   → static จาก apps/web/dist (CDN)
/api/*                              → Vercel Function (Express app เดิม, bundle ด้วย rolldown)
/* อื่น ๆ                            → index.html (SPA fallback)
```

build ทำโดย `tools/vercel-build.mjs` ซึ่งสร้าง `.vercel/output` (Build Output API v3) เอง:
prisma generate → `prisma migrate deploy` (เฉพาะ `VERCEL_ENV=production`) → build เว็บ → bundle API

## ตรวจบนเครื่องก่อน deploy

```bash
node tools/vercel-build.mjs
```

```bash
node tools/vercel-smoke.mjs
```

smoke test โหลด function ที่ bundle แล้วด้วยค่าใน `.env` แล้วเรียก `/health` และ `/auth/login`

## Environment variables (Vercel → Project → Settings → Environment Variables)

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (LISTEN/NOTIFY + migrate) |
| `DB_POOL_MAX` | `3` |
| `NODE_ENV` | `production` |
| `WEB_ORIGIN` | โดเมน production เช่น `https://nail-studio.vercel.app` |
| `SESSION_SECRET` | สุ่มใหม่ ≥ 32 ตัวอักษร — ห้ามใช้ค่าเดียวกับเครื่อง dev |
| `STORAGE_DRIVER` | `vercel-blob` |
| `BLOB_READ_WRITE_TOKEN` | จาก Blob store แบบ **private** ที่เชื่อมกับ project |

## ข้อจำกัดที่ทราบ

- **AI service** (`apps/ai`, Ollama) รันบน Vercel ไม่ได้ — route `/api/v1/ai/*` จะตอบ error
- **MCP HTTP service** (`apps/mcp`) ยังไม่ได้ย้าย — ถ้าจะใช้ต้องชี้ `NAIL_STUDIO_API_URL` มาที่โดเมน Vercel
- **rate limit** นับในหน่วยความจำต่อ instance — เมื่อมีหลาย instance เพดานจริงจะหลวมกว่าที่ตั้งไว้
- **SSE** (`/projects/:id/events`) ปิดเองทุก 270 วินาที (เพดาน function 300 วินาที) แล้ว `EventSource` ต่อใหม่
- preview deployment ไม่รัน migration — ต้องชี้ไปที่ฐานข้อมูล/branch แยก ห้ามใช้ DB production
