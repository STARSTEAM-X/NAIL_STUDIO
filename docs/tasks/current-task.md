# Task: ฟิลด์ Date of birth แสดง/กรอกเป็น dd/mm/yyyy

## บริบท / ทำไมต้องทำ

ผู้ใช้ขอให้ฟิลด์ "Date of birth" ทั้งระบบแสดงและกรอกเป็นรูปแบบ **dd/mm/yyyy**

ตรวจโค้ดจริงแล้วพบว่า `dateOfBirth` มีอยู่ที่**เดียว**ในระบบ ณ ตอนนี้ คือฟอร์มสมัครสมาชิก
(`apps/web/src/pages/RegisterPage.tsx:106-119`) — ไม่มีหน้าโปรไฟล์หรือหน้าไหนอื่นที่แสดงหรือแก้
วันเกิดอีก ปัจจุบันใช้ `<input type="date">` ของเบราว์เซอร์ตรงๆ ซึ่ง**รูปแบบที่แสดงบนจอถูกกำหนดโดย
locale ของ browser/OS ผู้ใช้ ไม่ใช่โดยเว็บ** (ทั้งที่ค่า value ภายในเป็น `yyyy-mm-dd` เสมอตามสเปก
HTML) — ถ้าเครื่องผู้ใช้ตั้ง locale เป็นอังกฤษ-สหรัฐ จะเห็นเป็น `mm/dd/yyyy` ซึ่งทำให้กรอกวันเกิดผิดได้
ง่าย (สับสน วัน/เดือน) นี่คือปัญหาจริงที่ทำให้ต้องเปลี่ยนเป็น custom input ที่บังคับรูปแบบเองแทนที่จะ
พึ่ง native picker

**Wire contract ไม่ต้องเปลี่ยน**: `packages/contracts/src/auth.ts:29`
(`dateOfBirth: z.string().date().optional()`) และ DB column
(`prisma/schema.prisma:143`, `DateTime? @db.Date`) ยังคงเป็น ISO `yyyy-mm-dd` ตามมาตรฐานเดิม —
งานนี้เป็นการเปลี่ยน**การแสดงผล/การกรอกที่ชั้น UI เท่านั้น** แปลงเป็น ISO ก่อนส่ง API เหมือนเดิม
ไม่แตะ `apps/api`, `packages/contracts`, หรือ migration ใดๆ

## ขอบเขตงาน

### 1. Helper แปลง/ตรวจสอบวันที่ — `apps/web/src/utils/dateFormat.ts` (ใหม่)

แยกเป็น pure function เพื่อให้ใช้ซ้ำได้ถ้าอนาคตมีหน้าอื่นต้องแสดง/แก้วันเกิด (เช่นหน้าโปรไฟล์)
โดยไม่ต้องเขียน logic ซ้ำ:

```ts
/** แปลง "31/01/2000" → "2000-01-31" คืน null ถ้า parse ไม่ได้หรือไม่ใช่วันที่จริง (เช่น 31/02) */
export function parseDdMmYyyy(input: string): string | null

/** แปลง ISO "2000-01-31" → "31/01/2000" คืน "" ถ้า input ว่างหรือ parse ไม่ได้ */
export function formatDdMmYyyy(isoDate: string): string

/** ใส่ "/" ให้อัตโนมัติระหว่างพิมพ์ + จำกัดตัวเลข ใช้ตอน onChange ของ input แบบ controlled
 *  เช่น "31012000" หรือกำลังพิมพ์ "3101" → "31/01" */
export function maskDdMmYyyyInput(raw: string): string
```

- ตรวจวันที่จริง (ไม่ใช่แค่ regex ตัวเลข) — ต้องปฏิเสธ `31/02/2000`, `00/01/2000`, `32/01/2000`,
  เดือน `13` และรองรับปีอธิกสุรทิน (`29/02/2000` ผ่าน, `29/02/2001` ไม่ผ่าน)
- ปีต้องเป็น 4 หลัก, ห้ามปีในอนาคต (เทียบกับวันนี้) — เพราะเป็นวันเกิด
- unit test (`dateFormat.test.ts`): ครอบคลุมเคสข้างบนทั้งหมด + partial input (`"31/"`,
  `"31/01"`) ต้องคืน `null` จาก `parseDdMmYyyy` ไม่ throw + round-trip
  `formatDdMmYyyy(parseDdMmYyyy(x)!) === x` สำหรับวันที่ที่ valid

### 2. แก้ `RegisterPage.tsx`

แทนที่ `<input type="date">` (บรรทัด 109-114) ด้วย controlled text input แบบ dd/mm/yyyy:

- เก็บ state ใหม่ `dateOfBirthText` (string ที่ผู้ใช้เห็น/พิมพ์ เช่น `"31/01/2000"`) แทน
  `dateOfBirth` เดิมที่เป็น ISO ตรงๆ — คง `dateOfBirth` (ISO) ไว้เป็น derived value ที่คำนวณจาก
  `parseDdMmYyyy(dateOfBirthText)` เวลาจะส่งให้ `register.mutate` (บรรทัด 27 เดิม เก็บ logic
  `...(dateOfBirth ? { dateOfBirth } : {})` ไว้เหมือนเดิม แค่เปลี่ยนที่มาของค่า)
- `onChange`: เรียก `maskDdMmYyyyInput(event.target.value)` ก่อนเก็บ state เพื่อ auto-insert `/`
  และกันตัวอักษรที่ไม่ใช่เลข, จำกัดความยาว 10 ตัวอักษร (`dd/mm/yyyy`)
- `type="text"` + `inputMode="numeric"` + `placeholder="dd/mm/yyyy"` + `maxLength={10}` —
  ไม่ใช้ native date picker แล้ว (ไอคอน SVG ปฏิทินที่มีอยู่แล้วบรรทัด 115-117 คงไว้เป็น decorative
  เดิม ไม่ต้องลบ)
- ถ้า `dateOfBirthText` ไม่ว่างแต่ `parseDdMmYyyy` คืน `null` (พิมพ์ครบ 10 ตัวแล้วแต่ไม่ valid เช่น
  `31/02/2000`) ให้แสดง inline error ใต้ field ทันที (ไม่ต้องรอ submit) เช่น
  "วันที่ไม่ถูกต้อง กรุณากรอกรูปแบบ dd/mm/yyyy" — reuse style class เดียวกับ error message ที่มีอยู่
  แล้วในฟอร์มนี้ (ดูตัวแปร `message`/`detail` บรรทัด 36-44) แยกกันคนละก้อนไม่ปนกับ server error
- ถ้า `dateOfBirthText` ยังพิมพ์ไม่ครบ (สั้นกว่า 10 ตัวอักษร) ไม่แสดง error — เพราะกำลังพิมพ์อยู่
- ปุ่ม submit ต้อง disable ถ้ามี field-level error ค้างอยู่ (`dateOfBirthText` ไม่ว่างและ parse
  ไม่ผ่าน) — ป้องกันการยิง request ด้วยค่าที่ผิดรูปแบบไปให้ server (server เองก็ validate
  `z.string().date()` อยู่แล้วแต่ควรกันที่ client ก่อนเพื่อ UX ที่ดีกว่า ไม่ใช่เพื่อความปลอดภัย)

### 3. ไม่แตะ

- `apps/api`, `packages/contracts`, `prisma/schema.prisma`, migration — wire format คง ISO เดิม
- ไม่เพิ่ม date-picker library ใหม่ (เช่น `react-datepicker`) — ฟิลด์เดียวในระบบ ไม่คุ้มที่จะเพิ่ม
  dependency ใหม่สำหรับ use case เดียว ทำ custom text input ธรรมดาเพียงพอ
- ไม่ทำ "ทั้งระบบ" เกินความจริง — ไม่มีวันที่อื่นในระบบที่เป็น "date of birth" ให้แก้ (วันที่อื่นๆ
  เช่น `createdAt`, `agreedStartAt` เป็นคนละความหมาย ไม่ใช่ scope ของงานนี้)

## Acceptance criteria (DoD)

- [ ] เปิดหน้าสมัครสมาชิก เห็น field "Date of birth" เป็น text input placeholder `dd/mm/yyyy`
      ไม่ใช่ native date picker ของเบราว์เซอร์
- [ ] พิมพ์ตัวเลขต่อกัน (เช่น `31012000`) → auto แปลงเป็น `31/01/2000` ระหว่างพิมพ์
- [ ] พิมพ์วันที่ไม่จริง (เช่น `31/02/2000`, `00/13/2000`) จนครบ 10 ตัวอักษร →
      เห็น error message ทันที และปุ่มสมัครสมาชิก disable
- [ ] พิมพ์วันที่ถูกต้อง (เช่น `29/02/2000`) → ไม่มี error, สมัครสมาชิกสำเร็จ, ตรวจ request body
      จริงที่ยิงไป `POST /auth/register` มี `dateOfBirth: "2000-02-29"` (ISO) ไม่ใช่ dd/mm/yyyy
      (contract/DB ไม่เปลี่ยน)
- [ ] ปล่อย field ว่างไว้ (optional) → สมัครสมาชิกสำเร็จได้เหมือนเดิม ไม่มี error
- [ ] unit test ของ `dateFormat.ts` ผ่านครบตามที่ระบุในข้อ 1
- [ ] typecheck + lint ผ่านทั้ง `apps/web`
- [ ] ยืนยันบนเบราว์เซอร์จริง: เปิด `npm run dev:web`, ตั้ง OS locale เป็นแบบที่ native date input
      จะแสดง `mm/dd/yyyy` (หรือจำลองด้วยการสลับ browser locale) แล้วเทียบว่า custom input ใหม่
      ยังแสดง `dd/mm/yyyy` เสมอไม่ว่า locale เครื่องเป็นอะไร (พิสูจน์ว่าแก้ปัญหาเดิมได้จริง)
