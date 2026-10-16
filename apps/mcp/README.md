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

## Deploy บน Render และเชื่อมกับ ChatGPT

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

OAuth ใช้ authorization code + PKCE S256, callback อนุญาตเฉพาะ `chatgpt.com`,
scope `nails:design`, และตรวจ API token กับ backend ทั้งก่อนอนุญาตและทุกคำขอ MCP
access token มีอายุ 1 ชั่วโมง; confidential clients ได้ refresh token อายุ 30 วัน
public clients ต้องเชื่อมบัญชีใหม่เมื่อ access token หมดอายุ
ยกเลิกสิทธิ์ทันทีได้โดยยกเลิก API token จากหน้าโปรไฟล์

client registrations และ OAuth tokens เข้ารหัสด้วย AES-256-GCM และใช้งานต่อได้หลัง restart
เมื่อเก็บ secret เดิมไว้; การเปลี่ยน secret จะยกเลิกการเชื่อมต่อเดิมทั้งหมด
authorization codes อายุ 5 นาที ใช้ได้ครั้งเดียวและเก็บในหน่วยความจำ จึงใช้ **หนึ่ง instance**
(หาก restart ระหว่างอนุญาต ผู้ใช้เริ่มเชื่อมต่อใหม่ได้)
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
| | `get_design` | สรุปต่อนิ้ว (`format: "full"` = JSON เต็ม) |
| | `list_patterns` / `list_decorations` / `list_palettes` / `list_presets` | สิ่งที่ใช้ได้ |
| ตรวจ/ดู | `preview_recipe` | **ภาพตัวอย่างจาก recipe โดยไม่บันทึก** — ใช้วนปรับก่อนบันทึก |
| | `render_preview` | ภาพ PNG ของงานเวอร์ชันล่าสุด |
| | `validate_document` | ตรวจเอกสาร JSON กับ schema จริง |
| สร้าง/แก้ | `create_project` | สร้างงาน (+ preset/recipe ได้ทันที) |
| | `apply_recipe` | ลง recipe (นิ้วที่ระบุถูกแทนทั้งนิ้ว นิ้วอื่นคงเดิม) |
| | `apply_preset` | ลงดีไซน์สำเร็จรูป |
| | `set_nail` | แก้บางนิ้ว |
| | `copy_nail` / `mirror_hand` | คัดลอก/สมมาตร |
| | `add_strokes` / `add_decoration` / `clear_nail` | ระดับต่ำ (ขั้นสูง) |

Resources: `nailstudio://guide` (กฎและตัวอย่าง), `nailstudio://schema/recipe` (JSON Schema)
Prompt: `design_from_description`

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
