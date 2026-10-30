# Task: ให้ MCP server (HTTP) รันบน Vercel deployment เดียวกับเว็บ

> spec ก่อนหน้า (ย้ายเว็บ + API ไป Vercel) ย้ายไปอยู่ที่ `docs/tasks/vercel-migration.md`

## บริบท

- `https://nail-studio-sand.vercel.app` มีแค่เว็บ (static) + API (`functions/api.func`)
- `POST /mcp` ตอนนี้ได้ `405` + `index.html` ของ SPA — ไม่มี MCP server
- `apps/mcp/src/httpApp.ts` (`createMcpApp`) เป็น Express app ที่ทำงานครบแล้ว (Streamable HTTP,
  `enableJsonResponse: true`, OAuth 2.1 + DCR, API token `nsk_...`) แต่ถูกออกแบบให้รันบน Render เป็น process ยาว
- เป้าหมาย: Claude / ChatGPT เชื่อมต่อด้วย URL `https://nail-studio-sand.vercel.app/mcp`

## สิ่งที่ไม่เข้ากับ Vercel (และทางแก้)

| ส่วน | ปัญหา | ทางแก้ |
|---|---|---|
| `NailStudioOAuth.codes` (Map ในหน่วยความจำ) | `/consent` กับ `/token` อาจวิ่งคนละ instance → แลก code ไม่ได้ | ทำ authorization code เป็นค่า sealed (`this.sealed.seal('code', …)`) แบบเดียวกับ access/refresh token |
| `NailStudioOAuth.usedRefresh` | กันใช้ refresh token ซ้ำได้แค่ภายใน instance | คงไว้ (best-effort) + เขียน comment `shortcut:` ระบุข้อจำกัด |
| `render.ts` อ่าน `../../web/public/models/hand.glb` จาก `import.meta.url` | หลัง bundle path นี้ชี้ออกนอก function | ให้ path override ได้ด้วย `NAIL_STUDIO_HAND_GLB` (อ่านแบบ lazy ตอนเรียก `nailHulls()`), build คัดลอกไฟล์เข้า function |
| `@napi-rs/canvas` (native addon) | bundle ไม่ได้ | `external` + คัดลอก `node_modules/@napi-rs/canvas*` เข้า function แบบเดียวกับ argon2 |
| `trust proxy` เปิดเฉพาะ `RENDER === 'true'` | rate limit บน Vercel เห็น IP เดียวกันหมด | เปิดเมื่อ `VERCEL === '1'` ด้วย |
| Vercel จำกัด body 4.5 MB | `express.json({ limit: '6mb' })` | ไม่แก้ — ระบุใน README ว่าบน Vercel รับได้ ~4.5 MB |

## การออกแบบ

### 1. Entry ของ function — `apps/mcp/src/vercel.ts` (ไฟล์ใหม่)

```ts
import { createMcpApp } from './httpApp.ts'
export default createMcpApp()
```

ไม่มี `listen()` เหมือน `apps/api/src/vercel.ts`

### 2. OAuth แบบ stateless — `apps/mcp/src/oauth.ts`

- ตอน consent สำเร็จ: `code = this.sealed.seal('code', { ...flow, apiToken, expiresAt: now + CODE_SECONDS })`
  - เพิ่ม `CODE_SECONDS = 60` (สั้นกว่า `FLOW_SECONDS`) — code ใช้แค่ redirect กลับทันที
  - ต้องมี zod schema (`codeSchema`) ตรวจค่าที่ `open` ออกมา เหมือน `refreshSchema`
- `codeFor()` เปลี่ยนจากอ่าน Map เป็น `codeSchema.parse(this.sealed.open('code', code))` + เช็ค `expiresAt`, `clientId` เดิม; parse ล้ม → `InvalidGrantError('Invalid or expired code')`
- single-use: เก็บ hash ของ code ที่ใช้แล้วใน Map แบบเดียวกับ `usedRefresh` (best-effort ต่อ instance)
  ความปลอดภัยจริงมาจาก PKCE (SDK บังคับ S256) + `redirect_uri` ต้องตรง + อายุ 60 วินาที
- ลบ field `codes` เดิม

### 3. `apps/mcp/src/httpApp.ts`

- `if (env.RENDER === 'true' || env.VERCEL === '1') app.set('trust proxy', 1)`
- ค่า `publicUrl`: ใช้ `NAIL_STUDIO_MCP_URL ?? RENDER_EXTERNAL_URL` เหมือนเดิม (ไม่เดาจาก `VERCEL_URL` — issuer ต้องคงที่)

### 4. `apps/mcp/src/render.ts`

- `glbPath()` อ่าน `process.env.NAIL_STUDIO_HAND_GLB` ตอนเรียก ถ้าไม่มีใช้ path เดิม

### 5. Build — `tools/vercel-build.mjs`

- bundle `apps/mcp/src/vercel.ts` ไป `.vercel/output/functions/mcp.func/index.mjs` ด้วย option เดียวกับ API
  (`platform: 'node'`, banner `createRequire`), `external: [/^@napi-rs\/canvas/]`
- คัดลอก `node_modules/@napi-rs/canvas*` (ทุกโฟลเดอร์ที่ขึ้นต้น `canvas`) เข้า `mcp.func/node_modules/@napi-rs/` (`dereference: true`)
- คัดลอก `apps/web/public/models/hand.glb` → `mcp.func/hand.glb`
- `.vc-config.json` เหมือน API แต่เพิ่ม `environment: { NAIL_STUDIO_HAND_GLB: 'hand.glb' }`
  (cwd ของ function = root ของ `.func`; ถ้าไม่ใช่ ให้ resolve จาก `import.meta.url` ใน `vercel.ts` แล้ว set env ก่อนใช้)
- ลด code ซ้ำ: แยก helper `bundleFunction({ input, dir, external })` ใช้ร่วมระหว่าง API และ MCP
- routes ใน `config.json` — ต้องอยู่ **ก่อน** rule `securityHeaders` (MCP ใช้ helmet ของตัวเอง ซึ่ง CSP อนุญาต form-action ไป claude.ai/chatgpt.com):

```js
{ src: '^/(mcp|consent|authorize|token|revoke)/?$', dest: '/mcp' },
{ src: '^/register/?$', methods: ['POST'], dest: '/mcp' }, // GET /register = หน้าสมัครของ SPA
{ src: '^/\\.well-known/(oauth-authorization-server|oauth-protected-resource)(/.*)?$', dest: '/mcp' },
```

  - ตรวจว่า SPA (`apps/web/src`) ไม่มีหน้าใช้ path เหล่านี้
  - `dest: '/mcp'` = function `mcp.func`; Express ได้ path เดิม (เหมือน `/api`)

### 6. Smoke — `tools/vercel-smoke.mjs`

เพิ่มส่วน MCP: import `mcp.func/index.mjs` แล้วตรวจ
- `GET /health` → 200
- `POST /mcp` ไม่มี token → 401
- `import('@napi-rs/canvas')` จากใน `mcp.func` โหลดได้ (หรือเรียก `nailHulls()` สำเร็จ) — ยืนยัน native addon + hand.glb

### 7. Env บน Vercel (Production) — ผู้ใช้ตั้งเอง / Claude ตั้งผ่าน Vercel MCP เมื่อได้รับอนุญาต

| ตัวแปร | ค่า |
|---|---|
| `NAIL_STUDIO_API_URL` | `https://nail-studio-sand.vercel.app/api/v1` |
| `NAIL_STUDIO_WEB_URL` | `https://nail-studio-sand.vercel.app` |
| `NAIL_STUDIO_MCP_URL` | `https://nail-studio-sand.vercel.app` |
| `NAIL_STUDIO_OAUTH_SECRET` | ค่าสุ่ม ≥ 32 ตัว (ห้าม commit) |

Preview deployment: ไม่ตั้ง `NAIL_STUDIO_MCP_URL`/`SECRET` → OAuth ปิด ใช้ได้แค่ `nsk_` token

### 8. README — `apps/mcp/README.md`

เพิ่มหัวข้อ "Deploy บน Vercel" (env ข้างบน, URL `/mcp`, ข้อจำกัด body 4.5 MB, refresh-replay best-effort) และระบุว่าส่วน Render เป็นทางเลือกเดิม

## ไฟล์ที่กระทบ

- `apps/mcp/src/vercel.ts` (ใหม่)
- `apps/mcp/src/oauth.ts`
- `apps/mcp/src/httpApp.ts`
- `apps/mcp/src/render.ts`
- `apps/mcp/src/httpApp.test.ts` (หรือ `oauth.test.ts` ใหม่)
- `tools/vercel-build.mjs`
- `tools/vercel-smoke.mjs`
- `apps/mcp/README.md`

ห้ามแตะ `apps/mcp/src/stdio.ts` (ผู้ใช้มีการแก้ค้างอยู่)

## Acceptance criteria

1. `node tools/vercel-build.mjs` สร้าง `.vercel/output/functions/mcp.func/` ที่มี `index.mjs`, `hand.glb`, `node_modules/@napi-rs/canvas*`
2. `node tools/vercel-smoke.mjs` ผ่านทั้งส่วน API และ MCP
3. หลัง deploy: `POST https://nail-studio-sand.vercel.app/mcp` (initialize) ไม่มี token → 401 + `WWW-Authenticate`; มี `nsk_` token → 200 JSON-RPC
4. `GET /.well-known/oauth-authorization-server` → JSON metadata ที่ `issuer` = `https://nail-studio-sand.vercel.app/`
5. OAuth flow: code ที่ออกโดย instance A แลก token ที่ instance B ได้ (secret เดียวกัน)
6. หน้าเว็บ SPA เส้นทางอื่นและ `/api/*` ทำงานเหมือนเดิม
7. lint / typecheck / test ของ workspace ผ่าน

## Edge cases

- code หมดอายุ (> 60 s) → `invalid_grant`
- code ของ client อื่น → `invalid_grant`
- code ถูกแก้ไข/ปลอม (auth tag ไม่ตรง) → `invalid_grant` ไม่ throw 500
- code ใช้ซ้ำใน instance เดิม → `invalid_grant`
- access token ไม่สามารถใช้แทน code ได้ (AAD แยก `kind`) — มีอยู่แล้วใน `SealedValues`
- `NAIL_STUDIO_MCP_URL` ตั้งแต่ไม่ตั้ง secret → throw ตอนโหลด (พฤติกรรมเดิม) — ต้องไม่ตั้งแค่ตัวเดียวบน Vercel
- body > 4.5 MB → Vercel ตอบ 413 เอง

## Complexity

- seal/open code: O(n) ตามขนาด payload (< 1 KB), AES-GCM — ค่าคงที่
- used-code Map: O(1) ต่อ request, ล้างตัวหมดอายุแบบเดียวกับ `consumeRefresh`
- ไม่มี DB call เพิ่ม; cold start เพิ่มจากการโหลด `@napi-rs/canvas` เฉพาะตอนเรียก `render_preview` ถ้า import แบบ lazy ได้ (ไม่บังคับ)

## Tests ที่ต้องมี

- OAuth: สร้าง `NailStudioOAuth` 2 ตัวที่ secret/publicUrl เดียวกัน — consent ที่ตัว A, `exchangeAuthorizationCode` ที่ตัว B สำเร็จ
- code หมดอายุ / ผิด client / ถูกแก้ / ใช้ซ้ำ → `InvalidGrantError`
- `trust proxy` เปิดเมื่อ `VERCEL=1`
- `nailHulls()` ใช้ `NAIL_STUDIO_HAND_GLB` เมื่อตั้งค่า
- test เดิมใน `apps/mcp` ผ่านทั้งหมด

## Known limitations

- refresh-token replay และ code replay ป้องกันได้แค่ภายใน instance เดียว (เดิมก็หายเมื่อรีสตาร์ท) — PKCE + อายุสั้นเป็นแนวป้องกันหลัก
- rate limit (`express-rate-limit` memory store) เป็นต่อ instance
- request body สูงสุด ~4.5 MB
