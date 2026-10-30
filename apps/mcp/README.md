# NailStudio MCP server

ให้ AI (Claude Desktop, Claude Code หรือ client MCP ใดก็ได้) ออกแบบลายเล็บในงานของผู้ใช้
ผ่าน **ข้อมูล schema เท่านั้น** — AI ส่ง "recipe" (ชนิดลาย + พารามิเตอร์) แล้วเซิร์ฟเวอร์แปลงเป็น
stroke ตรวจกับ `designDocumentSchema` และบันทึกเป็น **เวอร์ชันใหม่** (ผู้ใช้ย้อนกลับได้เสมอ)

```
AI client ──MCP──▶ apps/mcp ──HTTP──▶ apps/api ──▶ PostgreSQL
                    │                     └─ SSE ──▶ editor ที่เปิดงานอยู่อัปเดตเอง
                    └─ @nail-studio/patterns (ลาย/recipe) + ตัววาดของเว็บ (ภาพตัวอย่าง)
```

## ติดตั้ง

ต้องใช้ Node 24 ขึ้นไป (รันไฟล์ `.ts` ตรง ๆ) และติดตั้ง dependency ที่ root ของ repo ครั้งเดียว:

```bash
npm install
```

## ยืนยันตัวตน

| วิธี | ใช้เมื่อ | ตั้งค่า |
|---|---|---|
| **API token** (แนะนำ) | ใช้งานจริง | หน้าโปรไฟล์ → แก้ไขโปรไฟล์ → **เชื่อมต่อ AI (API token)** → สร้าง token แล้วคัดลอก (`nsk_...`) |
| email / รหัสผ่าน | dev บนเครื่องเท่านั้น | `NAIL_STUDIO_EMAIL`, `NAIL_STUDIO_PASSWORD` |

สิทธิ์ของ token:
- ใช้ได้เฉพาะ API งานออกแบบ (`/api/v1/projects/**`) — แตะบัญชี การนัดหมาย การแจ้งเตือน ไม่ได้
- สร้าง/ยกเลิก token ด้วย token ไม่ได้ (ต้องทำจากหน้าเว็บ)
- หมดอายุ 90 วัน, มีได้สูงสุด 10 อัน, ยกเลิกแล้วใช้ไม่ได้ทันที
- เซิร์ฟเวอร์เก็บแค่ SHA-256 ของ token — token ดิบแสดงครั้งเดียวตอนสร้าง

## ตัวแปร environment

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `NAIL_STUDIO_API_URL` | `http://localhost:4000/api/v1` | API ของ NailStudio |
| `NAIL_STUDIO_WEB_URL` | `http://localhost:5173` | ใช้สร้างลิงก์ editor ในคำตอบ |
| `NAIL_STUDIO_TOKEN` | – | API token (โหมด stdio) |
| `NAIL_STUDIO_TOKEN_FILE` | – | ไฟล์ที่เก็บ API token — อ่านใหม่ทุกครั้ง (ไม่ต้องใส่ secret ใน config ของ AI client, เปลี่ยน token ได้โดยไม่ต้องรีสตาร์ท) |
| `NAIL_STUDIO_EMAIL` / `NAIL_STUDIO_PASSWORD` | – | ล็อกอินแบบเว็บ (dev) |
| `PORT` | `4200` | พอร์ตของโหมด HTTP |
| `NAIL_STUDIO_MCP_URL` | `RENDER_EXTERNAL_URL` บน Render | HTTPS origin ของบริการ MCP สำหรับ OAuth discovery |
| `NAIL_STUDIO_OAUTH_SECRET` | – | secret สุ่มอย่างน้อย 32 ตัวอักษรสำหรับเข้ารหัส OAuth credentials; ต้องคงเดิมข้าม deploy |

## Deploy บน Vercel (ค่าเริ่มต้น)

`node tools/vercel-build.mjs` สร้าง function `mcp.func` ใน deployment เดียวกับเว็บและ API
(`/mcp`, `/authorize`, `/token`, `POST /register`, `/revoke`, `/consent`, `/.well-known/oauth-*` วิ่งไปที่ function นี้)
URL สำหรับ AI client คือ `https://nail-studio-sand.vercel.app/mcp`

ตั้ง env ใน Vercel (Production):

- `NAIL_STUDIO_API_URL=https://nail-studio-sand.vercel.app/api/v1`
- `NAIL_STUDIO_WEB_URL=https://nail-studio-sand.vercel.app`
- `NAIL_STUDIO_MCP_URL=https://nail-studio-sand.vercel.app`
- `NAIL_STUDIO_OAUTH_SECRET`: ค่าสุ่มอย่างน้อย 32 ตัวอักษร (ห้าม commit)

ต้องตั้ง `NAIL_STUDIO_MCP_URL` กับ `NAIL_STUDIO_OAUTH_SECRET` คู่กันเสมอ — ถ้าไม่ตั้งทั้งคู่ (เช่น Preview) OAuth ปิด
ใช้ได้แค่ API token `nsk_...` เป็น Bearer

ข้อจำกัดบน Vercel: request body สูงสุดราว 4.5 MB, rate limit นับแยกต่อ instance และการกันใช้ code/refresh token
ซ้ำทำได้แค่ภายใน instance (ดู "รายละเอียด OAuth")

## Deploy บน Render (ทางเลือกเดิม) และเชื่อมกับ ChatGPT

สร้าง Web Service แยกจากเว็บ/API โดยใช้ repo นี้, Node **24**, แผน Free, region Singapore:

- Build: `npm ci --include=dev`
- Start: `node apps/mcp/src/http.ts`
- Health check: `/health`
- `NAIL_STUDIO_API_URL=https://nail-studio-nkmi.onrender.com/api/v1`
- `NAIL_STUDIO_WEB_URL=https://nail-studio-nkmi.onrender.com`
- `NAIL_STUDIO_OAUTH_SECRET`: ค่าสุ่มที่เก็บเฉพาะใน Render environment (ห้าม commit)

Render กำหนด `RENDER_EXTERNAL_URL` ให้เอง จึงไม่ต้องเดาชื่อโดเมนก่อนสร้าง service
บริการนี้ไม่ต้องใช้ฐานข้อมูลหรือ API token กลางร่วมกันระหว่างผู้ใช้

เมื่อ `/health` พร้อม ให้เพิ่ม custom MCP server ใน ChatGPT โดยใช้ **URL ของบริการ MCP ตามด้วย `/mcp`**,
เลือก **OAuth** และ **Dynamic Client Registration** (ไม่ต้องกรอก client ID/secret เอง)
ตอนเชื่อมบัญชี หน้าอนุญาตของ NailStudio จะให้วาง API token ที่สร้างจากหน้าโปรไฟล์
token ต้องเป็นของบัญชีบนเว็บ/API ที่ตั้งไว้ด้านบน; ไม่ต้องส่ง token ในข้อความแชต

### เชื่อมกับ Claude (custom connector)

claude.ai / Claude Desktop / มือถือ: **Settings → Connectors → Add custom connector** แล้วใส่
**URL ของบริการ MCP ตามด้วย `/mcp`** (เช่น `https://nail-studio-mcp.onrender.com/mcp`) — ไม่ต้องกรอก
client ID/secret ใน Advanced settings เพราะ Claude ลงทะเบียนเองผ่าน DCR จากนั้นกด Connect แล้ววาง API token
ในหน้าอนุญาตของ NailStudio เหมือนฝั่ง ChatGPT

Claude Code ต่อแบบ OAuth ได้เช่นกัน (`claude mcp add --transport http nail-studio <URL>/mcp` แล้ว `/mcp` เพื่อ
authenticate) — redirect กลับมาที่ `http://localhost:<พอร์ต>/callback` บนเครื่องผู้ใช้ หน้าอนุญาตจะแสดงคำเตือนเพิ่ม

### รายละเอียด OAuth

OAuth ใช้ authorization code + PKCE S256, callback อนุญาตเฉพาะ `chatgpt.com`,
`https://claude.ai/api/mcp/auth_callback` (และ `claude.com` สำหรับอนาคต) และ loopback
`http://localhost|127.0.0.1:<พอร์ต>/callback`; หน้าอนุญาตแสดง hostname ปลายทางเสมอ
scope `nails:design` (+ `offline_access` ที่ Claude ขอเพื่อรับ refresh token) และตรวจ API token กับ backend
ทั้งก่อนอนุญาตและทุกคำขอ MCP
access token มีอายุ 1 ชั่วโมง; confidential clients (ChatGPT) ได้ refresh token อายุ 30 วันที่ใช้ซ้ำได้
public clients (Claude ผ่าน DCR) ได้ refresh token แบบ **หมุน** อายุ 14 วัน — ใช้ได้ครั้งเดียว ใช้ซ้ำจะได้
`invalid_grant`; รายการ token ที่ใช้แล้วเก็บในหน่วยความจำ (หลัง restart token เก่าที่ยังไม่หมดอายุจะใช้ได้อีกครั้ง)
ยกเลิกสิทธิ์ทันทีได้โดยยกเลิก API token จากหน้าโปรไฟล์

client registrations และ OAuth tokens เข้ารหัสด้วย AES-256-GCM และใช้งานต่อได้หลัง restart
เมื่อเก็บ secret เดิมไว้; การเปลี่ยน secret จะยกเลิกการเชื่อมต่อเดิมทั้งหมด
authorization codes เข้ารหัสแบบเดียวกัน (ไม่ต้องเก็บ state จึงรันหลาย instance / serverless ได้) อายุ 60 วินาที
การกันใช้ code ซ้ำทำได้แค่ภายใน instance — PKCE S256 และ redirect_uri ที่ต้องตรงเป็นแนวป้องกันหลัก
แผน Free อาจพัก service เมื่อไม่มีการใช้งาน; เปิด `/health` รอให้พร้อมก่อนเพิ่มใน ChatGPT

## ใช้กับ Claude Code

stdio (AI เปิดโปรเซสเองบนเครื่อง):

```bash
claude mcp add nail-studio --env NAIL_STUDIO_TOKEN=nsk_xxx -- node C:/Users/SSX/Documents/GitHub/NAIL_STUDIO/apps/mcp/src/stdio.ts
```

HTTP (รัน `npm run start:http -w apps/mcp` ไว้ก่อน — token ส่งต่อจาก header ของ client):

```bash
claude mcp add --transport http nail-studio http://localhost:4200/mcp --header "Authorization: Bearer nsk_xxx"
```

## ใช้กับ Claude Desktop

เพิ่มใน `claude_desktop_config.json` (Windows: `%APPDATA%\Claude\`) แล้ววาง token ลงในไฟล์ที่ระบุ จากนั้นปิด-เปิด Claude Desktop ใหม่:

```json
{
  "mcpServers": {
    "nail-studio": {
      "command": "node",
      "args": ["C:\\Users\\SSX\\Documents\\GitHub\\NAIL_STUDIO\\apps\\mcp\\src\\stdio.ts"],
      "env": { "NAIL_STUDIO_TOKEN_FILE": "C:\\Users\\SSX\\.nail-studio\\token" }
    }
  }
}
```

## Tools

| กลุ่ม | tool | หน้าที่ |
|---|---|---|
| อ่าน | `list_projects` | รายการงาน |
| | `open_page` | คืนลิงก์หน้าที่เกี่ยวข้องให้ client เปิดในเบราว์เซอร์ หรือแสดงให้ผู้ใช้คลิก |
| | `get_design` | สรุปต่อนิ้ว (`format: "full"` = JSON เต็ม) |
| | `list_patterns` / `list_decorations` / `list_palettes` / `list_presets` | สิ่งที่ใช้ได้ |
| ตรวจ/ดู | `preview_recipe` | **ภาพตัวอย่างจาก recipe โดยไม่บันทึก** — ใช้วนปรับก่อนบันทึก |
| | `render_preview` | ภาพ PNG ของงานเวอร์ชันล่าสุด |
| | `validate_document` | ตรวจเอกสาร JSON กับ schema จริง |
| สร้าง/แก้ | `create_project` | สร้างงาน (+ preset/recipe ได้ทันที) |
| | `apply_recipe` | ลง recipe (นิ้วที่ระบุถูกแทนทั้งนิ้ว นิ้วอื่นคงเดิม) |
| | `apply_preset` | ลงดีไซน์สำเร็จรูป |
| | `set_nail` | แก้บางนิ้ว |
| | `set_nail_properties` | ปรับทรง ความยาว ผิว หรือสีพื้นของนิ้วที่ระบุ โดยเก็บลายและของตกแต่งเดิม |
| | `copy_nail` / `mirror_hand` | คัดลอก/สมมาตร |
| | `add_strokes` / `add_decoration` / `clear_nail` | ระดับต่ำ (ขั้นสูง) |

Resources: `nailstudio://guide` (กฎและตัวอย่าง), `nailstudio://schema/recipe` (JSON Schema)
Prompt: `design_from_description`

### เปิดหน้าเว็บและปรับลักษณะเล็บ

`open_page` รับ `page`: `projects`, `editor`, `profile`, `community`, `shops`,
`appointments`, `login` โดยหน้า `editor` ต้องระบุ `projectId` และผ่านการตรวจสิทธิ์งานก่อน
คืนทั้ง `structuredContent.url` และ `resource_link` ที่ชี้ไปยัง `NAIL_STUDIO_WEB_URL` เท่านั้น
เซิร์ฟเวอร์ MCP ไม่สามารถสั่งเปิดเบราว์เซอร์บนเครื่องผู้ใช้โดยตรงได้:
client ใช้ URL นี้กับเครื่องมือเปิดเบราว์เซอร์ หรือแสดงเป็นลิงก์ให้คลิก
OAuth ของ MCP ไม่ใช่ session ล็อกอินของเว็บ ถ้าเว็บแสดงหน้าเข้าสู่ระบบให้ผู้ใช้ล็อกอินเอง
ห้ามแนบ API token หรือ OAuth token ลงใน URL เพื่อข้ามขั้นตอนล็อกอิน

ตัวอย่างปรับลักษณะเล็บโดยไม่ล้างลายเดิม:

```json
{ "projectId": "<uuid>", "nails": ["thumb", "index", "middle", "ring", "little"], "shape": "almond", "length": "long", "finish": "glossy" }
```

`set_nail` และ `apply_recipe` ยังคงแทนลายทั้งนิ้วที่ระบุ ส่วน `set_nail_properties`
แก้เฉพาะค่าที่ส่งมาและต้องส่งอย่างน้อยหนึ่งค่า ทุกการแก้ตรวจ schema และใช้ `expectedVersion`

Schema ของพิกัดเส้นโค้งประกาศเป็น array ที่มีตัวเลขสองค่า เพื่อหลีกเลี่ยง
tuple-style `items: [...]` ที่ไคลเอนต์บางตัวแปลงเป็น tool signature ไม่ได้
พิกัดที่รับและการตรวจค่าไม่เปลี่ยนแปลง หลัง deploy ให้ไคลเอนต์ refresh รายการเครื่องมือ
หรือเชื่อมต่อใหม่หากยังแสดงรายการเก่า

ทุก tool ที่เขียนข้อมูล: อ่านเวอร์ชันล่าสุด → แก้ → ตรวจ schema → บันทึกด้วย `expectedVersion`
ถ้าผู้ใช้บันทึกแทรกเข้ามาระหว่างนั้น AI จะได้ข้อผิดพลาด ไม่ทับงานของผู้ใช้

## Recipe แบบย่อ

```jsonc
{
  "defaults": { "shape": "square", "length": "long", "base": "#dfaaa2" },
  "mirrorLeft": true,                       // คีย์ชื่อนิ้วใช้ทั้งสองมือ มือซ้ายกลับซ้าย-ขวาให้
  "nails": {
    "index": { "patterns": [
      { "type": "french", "color": "#fdfbfa", "depth": 0.28, "soft": true },
      { "type": "butterfly", "wing": "#9070e4", "outline": "#5d3aa8", "u": 0.53, "v": 0.16 }
    ] },
    "right.ring": { "base": "#4a0e1d", "patterns": [{ "type": "dots", "color": "#f4bfd1" }],
                    "decorations": [{ "catalogId": "gem-round", "u": 0.5, "v": 0.7 }] }
  }
}
```

ระบบพิกัด: `u` 0–1 แนวขวาง, `v = 0` ปลายเล็บ → `v = 1` โคนเล็บ (ทุกนิ้ว)
ชนิดลายทั้งหมดและพารามิเตอร์: `list_patterns` และ JSON Schema ใน `nailstudio://schema/recipe`

## editor อัปเดตเอง

เมื่อมีการบันทึกเวอร์ชันใหม่ API ส่ง event ผ่าน `GET /api/v1/projects/:id/events` (SSE)
- ผู้ใช้ยังไม่ได้แก้อะไร → editor โหลดเวอร์ชันใหม่ให้เองพร้อมแจ้ง
- มีงานที่ยังไม่บันทึก → แสดงแถบให้เลือก "โหลดเวอร์ชันใหม่" หรือ "เก็บงานของฉันไว้"

ข้อจำกัด: ตัวกระจาย event อยู่ในโปรเซสเดียว (`apps/api/src/projects/events.ts`) — ถ้า API รันหลาย
instance ต้องเปลี่ยนเป็น pub/sub ข้ามเครื่อง (PostgreSQL LISTEN/NOTIFY หรือ Redis)

## ภาพตัวอย่าง

`render_preview` / `preview_recipe` ใช้ตัววาดตัวเดียวกับ editor (`apps/web/src/3d/painting`)
บน `@napi-rs/canvas` และตัดตามขอบเล็บจริงจาก UV ของ `hand.glb` — เป็นภาพแบน (ปลายเล็บอยู่บน)
ไม่แสดงทรงเล็บ 3 มิติ และวาดของตกแต่งเป็นวงกลม

## เทส

```bash
npm test -w apps/mcp
```
