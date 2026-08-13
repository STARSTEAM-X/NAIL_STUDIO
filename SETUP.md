# การติดตั้งครั้งแรก

เอกสารนี้คือขั้นตอนที่ต้องทำ **ครั้งเดียว** ก่อนรันโปรเจกต์ได้

---

## สิ่งที่ต้องมีอยู่แล้ว

| | เวอร์ชันที่ทดสอบแล้ว |
|---|---|
| Node.js | v24.19.0 (ต้อง ≥ 22.12) |
| npm | 11.17.0 |
| PostgreSQL | 18.4 (รันอยู่ที่ port 5432) |

> **ทำไมไม่ใช้ Docker**: เครื่องพัฒนาเครื่องนี้ไม่มี Docker แต่มี PostgreSQL ติดตั้งตรง
> ขั้นตอนด้านล่างจึงใช้ PostgreSQL ในเครื่อง ส่วน `docker-compose.yml` สำหรับ
> production จะเพิ่มใน Slice 10

---

## 1 · สร้างฐานข้อมูลและผู้ใช้

> ⚠️ **ใช้ PowerShell ไม่ใช่ cmd.exe** — ตัวดำเนินการ `&` เป็นไวยากรณ์ของ PowerShell
> ถ้ารันใน cmd จะได้ `& was unexpected at this time.`
> ตรวจได้จาก prompt: PowerShell ขึ้นต้นด้วย `PS C:\...>` ส่วน cmd เป็น `C:\...>`
> (ถ้าอยู่ใน cmd พิมพ์ `powershell` แล้วกด Enter เพื่อสลับ หรือดูคำสั่งสำหรับ cmd ด้านล่าง)

**ก่อนอื่น สร้างรหัสผ่านสุ่มสำหรับผู้ใช้ฐานข้อมูล** อย่าใช้รหัสที่เดาง่าย

```powershell
node -e "console.log(require('node:crypto').randomBytes(18).toString('base64url'))"
```

จากนั้นรันด้วยบัญชี `postgres` (จะถูกถามรหัสผ่านของ `postgres`)

```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
& $psql -U postgres -c "CREATE ROLE nailstudio LOGIN PASSWORD 'รหัสที่สุ่มมา';"
& $psql -U postgres -c "CREATE DATABASE nailstudio OWNER nailstudio;"
```

<details>
<summary>ถ้าต้องใช้ cmd.exe จริง ๆ</summary>

```
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE ROLE nailstudio LOGIN PASSWORD 'รหัสที่สุ่มมา';"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE nailstudio OWNER nailstudio;"
```

</details>

ตรวจว่าใช้ได้:

```powershell
& $psql -U nailstudio -d nailstudio -c "SELECT current_database(), current_user;"
```

> **ถ้าเผลอตั้งรหัสที่เดาง่ายไปแล้ว** เปลี่ยนได้ด้วย
> `& $psql -U postgres -c "ALTER ROLE nailstudio PASSWORD 'รหัสใหม่';"`
> รหัสผ่านที่พิมพ์ในบรรทัดคำสั่งจะค้างอยู่ใน history ของ shell เสมอ

> **หมายเหตุด้านความปลอดภัย**: ผู้ใช้ `nailstudio` เป็นเจ้าของฐานข้อมูลเพื่อให้รัน
> migration ได้ ใน production ควรแยกเป็นสองบัญชี — บัญชีหนึ่งสำหรับ migration
> (มีสิทธิ์ DDL) และอีกบัญชีสำหรับแอป (มีแค่ SELECT/INSERT/UPDATE/DELETE)
> ตาม `docs/database.md §7` — จะทำใน Slice 8

---

## 2 · สร้างไฟล์ `.env`

```powershell
Copy-Item .env.example .env
```

แล้วแก้ 2 ค่าในไฟล์ `.env`:

**`DATABASE_URL`** — ใส่รหัสผ่านที่ตั้งไว้ในขั้นตอนที่ 1

```
DATABASE_URL="postgresql://nailstudio:รหัสผ่านของคุณ@localhost:5432/nailstudio?schema=public"
```

**`SESSION_SECRET`** — สร้างค่าสุ่มใหม่ ห้ามใช้ค่าตัวอย่าง

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

> API จะ **ไม่ยอมบูต** ถ้า `SESSION_SECRET` ยังขึ้นต้นด้วย `CHANGE_ME`
> หรือ `DATABASE_URL` ว่าง — ตั้งใจให้ล้มตั้งแต่ตอนบูต ไม่ใช่ไปพังตอนมีผู้ใช้จริง

---

## 3 · ติดตั้งและเตรียมฐานข้อมูล

```powershell
npm install
npm run db:generate
npm run db:migrate
```

`db:migrate` จะสร้างตาราง 4 ตารางของ Slice 1: `users`, `sessions`, `projects`, `design_versions`

---

## 4 · รัน

เปิดสอง terminal:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

- API: http://localhost:4000/api/v1/health
- Web: http://localhost:5173

---

## ตรวจสอบว่าทุกอย่างเรียบร้อย

```powershell
npm run typecheck
npm run test
```

---

## ปัญหาที่พบบ่อย

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| `ตั้งค่า environment ไม่ครบ` ตอนบูต API | ยังไม่ได้สร้าง `.env` หรือยังไม่ได้เปลี่ยน `SESSION_SECRET` |
| `npm warn allow-scripts` ตอน `npm install` | npm 11 ไม่รัน postinstall script โดยค่าเริ่มต้น — โปรเจกต์นี้ไม่ต้องพึ่ง script เหล่านั้น ข้ามได้ |
| `prisma generate` ฟ้องเรื่อง `url` ใน schema | Prisma 7 ย้าย connection string ไป `prisma.config.ts` แล้ว — ถ้าเจอแปลว่ามีไฟล์ schema เก่าค้างอยู่ |
| เชื่อมต่อฐานข้อมูลไม่ได้ | ตรวจว่า service `postgresql-x64-18` ทำงานอยู่: `Get-Service postgresql*` |
