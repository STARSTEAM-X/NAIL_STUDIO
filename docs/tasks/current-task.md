# Task: ให้ Vite อ่านไฟล์ .env จาก root ของ monorepo

## ปัญหา

`apps/web/vite.config.ts` ไม่ได้ตั้ง `envDir` — Vite จึงมองหาไฟล์ env ใน `apps/web/`
ซึ่งไม่มีไฟล์ env อยู่เลย ผลคือ **ตัวแปร `VITE_*` ทั้งหมดใน `.env` ที่ root ไม่เคยถูกโหลด**

`apps/web/src/api/client.ts:3`

```ts
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
```

`VITE_API_URL` เป็น `undefined` เสมอ จึงตกไปใช้ค่า fallback `http://localhost:4000` ตลอด

### อาการที่เกิดจริง (ยืนยันแล้ว)

ตอนเปิดเว็บให้เครื่องอื่นใน LAN เข้าถึง (host = IP ไม่ใช่ localhost):

1. หน้าเว็บที่ `http://192.168.0.200:5173` ยิง API ไป `http://localhost:4000`
2. API ตอบ `Set-Cookie: nscsrf=...` แต่เบราว์เซอร์เก็บ cookie ไว้ใต้โดเมน `localhost`
3. หน้าเว็บอยู่โดเมน `192.168.0.200` จึงอ่าน cookie ไม่ได้ — `document.cookie` ว่างเปล่า
4. `csrfHeaders()` ใน `apps/web/src/api/client.ts:41` แนบ header `x-csrf-token` ไม่ได้
5. `csrfProtection` ใน `apps/api/src/middleware/csrf.ts` ตอบ 403
   *"คำขอนี้ขาดโทเคนความปลอดภัย (CSRF) กรุณารีเฟรชหน้าแล้วลองใหม่"*

ล็อกอิน/สมัครสมาชิกจากเครื่องอื่นใน LAN ไม่ได้เลย

**หลักฐาน:** รันในเบราว์เซอร์ที่ `http://192.168.0.44:5173` → `document.cookie` คืนค่าว่าง
และ network log แสดง `GET http://localhost:4000/api/v1/auth/me` ทั้งที่หน้าเว็บอยู่ที่ IP

---

## ไฟล์ที่แก้

`apps/web/vite.config.ts` — ไฟล์เดียว

## การเปลี่ยนแปลง

เพิ่ม `envDir` ชี้ไป root ของ monorepo (ขึ้นสองระดับจาก `apps/web`)

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(import.meta.dirname, '../..'),
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { port: 5173 },
})
```

`path` กับ `import.meta.dirname` ถูก import และใช้อยู่แล้วในไฟล์ (บรรทัด 4 และ 9)
ไม่ต้องเพิ่ม import ใหม่

## ขอบเขต — ห้ามแตะ

- **ห้ามแก้** `apps/web/src/api/client.ts` — ค่า fallback `?? 'http://localhost:4000'`
  ต้องคงไว้ เป็น default ที่ถูกต้องสำหรับ dev บนเครื่องตัวเอง
- **ห้ามแก้** `server.host` ใน vite config — การเปิด LAN ควรเป็นการตัดสินใจตอนรัน
  (`--host`) ไม่ใช่ค่า default ที่ commit ลง repo เพราะจะเปิดพอร์ตให้ทุกคนใน
  เน็ตเวิร์กโดยที่ผู้ใช้ไม่ได้ตั้งใจ
- **ห้ามสร้าง** `apps/web/.env` หรือ `.env.local` — เจตนาของโปรเจกต์คือใช้ `.env`
  ไฟล์เดียวที่ root (ดู `prisma.config.ts` และ `--env-file=../../.env` ใน
  `apps/api/package.json` ที่ชี้ไป root เหมือนกัน)
- ไม่ต้องแตะ `spikes/*/vite.config.ts` — เป็นโปรเจกต์ทดลองแยก ไม่ได้ใช้ `.env` ที่ root

---

## Acceptance criteria

1. `apps/web/vite.config.ts` มี `envDir` ชี้ไป root ของ monorepo
2. ตั้ง `VITE_API_URL=http://<ip>:4000` ใน `.env` ที่ root แล้วรัน `npm run dev:web`
   → ค่าที่ Vite ฝังให้ client ต้องเป็นค่านั้น ไม่ใช่ `http://localhost:4000`
3. ถ้า `.env` ไม่มี `VITE_API_URL` → ยังตกไปใช้ fallback `http://localhost:4000` ได้ตามเดิม
4. `npm run build --workspace apps/web` ผ่าน
5. `npm run typecheck` ผ่าน

### วิธีตรวจข้อ 2 (ไม่ต้องเปิดเบราว์เซอร์)

Vite ฝังค่า env ลงในโมดูลที่ serve ออกมา ตรวจได้ตรง ๆ:

```bash
curl -s http://localhost:5173/src/api/client.ts | grep -o 'VITE_API_URL[^,}]*'
```

ต้องเห็นค่าจาก `.env` ไม่ใช่ค่า fallback

---

## Edge cases

- **`import.meta.dirname`** ใช้ได้เพราะ vite config โหลดเป็น ESM บน Node 24
  (ไฟล์นี้ใช้อยู่แล้วที่บรรทัด 9 จึงไม่ใช่ของใหม่)
- **path บน Windows** — `path.resolve` คืน backslash ซึ่ง Vite รับได้ ไม่ต้อง normalize
- **`envDir` ไม่กระทบ `envPrefix`** — ยังโหลดเฉพาะตัวแปรขึ้นต้น `VITE_` เท่านั้น
  ค่าลับใน `.env` เช่น `DATABASE_URL`, `SESSION_SECRET`, `AI_INTERNAL_TOKEN`
  **จะไม่ถูกฝังลง bundle** เพราะไม่มี prefix `VITE_`
  → ข้อนี้สำคัญมาก ห้ามตั้ง `envPrefix` เป็นค่าอื่นหรือ `''` เด็ดขาด

---

## Tests

ไม่ต้องเขียน test ใหม่ — เป็น build config ไม่ใช่ logic ที่ unit test จับได้
ตรวจด้วย acceptance criteria ข้อ 2–5 แทน

## Complexity

O(1) — config บรรทัดเดียว ไม่กระทบ runtime
