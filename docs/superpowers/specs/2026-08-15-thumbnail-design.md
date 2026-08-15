# สเปก — Thumbnail Capture (Slice 4 ข้อ 6)

## 1 · ทำไมต้องมีรอบนี้

Slice 4 เหลือ 2 ข้อสุดท้าย (Thumbnail, Exporters) หลังจากสัดส่วนมือ+สีผิว (ข้อ 5) เสร็จแล้ว
รอบนี้ทำ **Thumbnail** ก่อน — Exporters เป็นงานคนละสเปก (แยกเพราะสองงานนี้อิสระจากกัน:
Exporters ทำเป็น client-side ล้วนได้ ไม่ต้องมี backend ใหม่)

**ต่างจาก Slice 4 ข้อ 4-5 ตรงที่รอบนี้ไม่มีโค้ดต้นแบบให้ยกมาเลย** — `docs/architecture.md`
(D-09, บรรทัด 393-408) และ `docs/database.md` (§3.5, บรรทัด 356-381) ออกแบบ
`StorageProvider` interface และตาราง `assets` ไว้แล้วในเอกสาร แต่**ไม่มีไฟล์จริงในโค้ด
สักไฟล์เดียว** — ไม่มี `apps/api/src/storage/`, ไม่มี `Asset` model ใน `prisma/schema.prisma`,
ไม่มี multipart/upload middleware ไหนเลย (`grep multer|busboy|formidable` ทั้ง `apps/api`
ไม่เจอ) สเปกนี้จึงต้องออกแบบรายละเอียดระดับ implementation เองทั้งหมด ไม่ใช่แค่อ้างอิงกลับ

## 2 · ขอบเขตที่ตัดออกโดยตั้งใจ (จากบทสนทนาออกแบบ)

### D-35 · StorageProvider ทำแค่ LocalDiskProvider รอบนี้

**อะไร**: implement `StorageProvider` interface + `LocalDiskProvider` เท่านั้น ไม่ทำ
`S3Provider` แม้ D-09 จะออกแบบไว้ว่าต้องมี 2 ตัว

**ทำไม**: เครื่องพัฒนาไม่มี Docker/MinIO ติดตั้งอยู่ (ยืนยันจาก `SETUP.md` และบทเรียน Slice 1
"เครื่องพัฒนาไม่มี Docker ใช้ PostgreSQL ตรง") การเพิ่ม S3 SDK dependency + ตั้งค่า MinIO ตอนนี้
คือการทำโครงสร้างที่วัดผลไม่ได้ในสภาพแวดล้อมจริงที่มี — เป็นงาน hardening ที่เหมาะกับ Slice 8
(Optimize + Security) ตอน deploy จริงมากกว่า `StorageProvider` เป็น interface อยู่แล้ว
สลับ implementation ทีหลังไม่กระทบโค้ดที่เรียกใช้ (`services/` เห็นแค่ interface ตาม D-09 เขียนไว้)

**ทางเลือกที่ปฏิเสธ**: ทำทั้งสอง implementation ตาม D-09 ตรงๆ — ปฏิเสธเพราะ YAGNI และ
ไม่มีทางเทสให้มั่นใจได้จริงว่า S3Provider ทำงานถูกต้องโดยไม่มี MinIO ให้รันจริง

### D-36 · จับภาพตอนกด "บันทึกเป็นเวอร์ชัน" อัตโนมัติ ไม่ใช่ปุ่มแยก

**อะไร**: ทุกครั้งที่กด "บันทึกเป็นเวอร์ชัน" (explicit save, ไม่ใช่ autosave draft) ระบบ capture
ภาพจากกล้องปัจจุบันแล้วอัป thumbnail ให้อัตโนมัติในคำขอเดียวกัน ไม่มีปุ่ม "ถ่ายภาพปก" แยกต่างหาก

**ทำไม**: ผู้ใช้ไม่ต้องจำว่าต้องกดอะไรเพิ่ม — thumbnail อัปเดตสดใหม่เสมอทุกเวอร์ชันที่บันทึกจริง
ตรงกับพฤติกรรมที่คาดหวัง (เห็นงานล่าสุดในหน้ารายการ) ปุ่มแยกเพิ่มขั้นตอนที่ผู้ใช้ส่วนใหญ่ลืมกด

**ทางเลือกที่ปฏิเสธ**: ปุ่ม "ถ่ายภาพปก" แยก — ให้ควบคุมได้มากกว่า แต่เพิ่ม UI ที่ไม่มีในแผนเดิม
(DoD เดิมไม่ได้ขอ) และผู้ใช้ส่วนใหญ่ลืมกด thumbnail จึงค้างเป็นภาพเปล่าตลอด

### D-37 · จัดกล้อง "ดูทั้งมือ" ก่อน capture เสมอ ไม่ใช้มุมกล้องปัจจุบันของผู้ใช้

**อะไร**: ก่อน capture จริง สั่งกล้องไปตำแหน่ง home (`HOME_POSITION`/`HOME_TARGET` จาก
`cameraPresets.ts` — ตำแหน่งเดียวกับปุ่ม "ดูทั้งมือ") รอให้กล้องนิ่งก่อนแล้วค่อยจับภาพ
ไม่ใช้มุมกล้องปัจจุบันที่ผู้ใช้อาจซูมเข้าไปที่เล็บนิ้วเดียวตอนกดบันทึก

**ทำไม**: thumbnail ทุกงานหน้ารายการต้อง framing เหมือนกันเทียบกันง่าย ถ้าใช้มุมกล้องปัจจุบัน
ผู้ใช้ที่กดบันทึกตอนซูมเข้าเล็บนิ้วเดียวจะได้ thumbnail เป็นภาพเล็บนิ้วเดียวแทนที่จะเป็นภาพมือ
ทั้งชิ้นที่สื่อความหมายของงานได้ดีกว่า

**ทางเลือกที่ปฏิเสธ**: ใช้มุมกล้องปัจจุบันตรงๆ — เร็วกว่า (capture ทันทีไม่ต้องรอกล้องเข้าที่)
แต่ผลลัพธ์ไม่สม่ำเสมอ ขึ้นกับว่าผู้ใช้บังเอิญอยู่มุมไหนตอนกดบันทึก

### D-38 · serve รูปผ่าน API endpoint ที่มี auth ไม่ใช่ static path ตรงๆ

**อะไร**: `GET /projects/:id/thumbnail` เป็น route ที่มี `requireUser`+`mustOwn` เหมือน endpoint
อื่นของ `projectsRouter` ทั้งหมด สตรีม buffer จาก `StorageProvider.get()` กลับไปตรงๆ ไม่ทำ
`express.static` ชี้ตรงไปที่โฟลเดอร์เก็บไฟล์

**ทำไม**: โปรเจกต์เป็นของส่วนตัวจนกว่าจะ publish (`status`) การเปิด static path ให้ทายชื่อไฟล์
เดาได้จะเท่ากับข้าม authorization ทั้งชั้น (คนอื่นเปิด thumbnail ของโปรเจกต์ที่ยังไม่ publish ได้
ถ้ารู้/เดา `storage_key`) และ D-09 เขียนไว้แล้วว่า S3 ไม่มี "static path" แบบเดียวกับ local disk
ให้ endpoint คลุมเรื่องนี้ตั้งแต่ต้นทำให้สลับ storage backend ทีหลังไม่กระทบ auth model

**ทางเลือกที่ปฏิเสธ**: static ตรงๆ — เร็วกว่า ไม่มี auth overhead ต่อ request แต่เสีย
ความปลอดภัยและผูกกับ local disk เกินไป (ทางเลือกนี้ยังใช้ cache header ปกติของเบราว์เซอร์ไม่ได้
เต็มที่ด้วยเพราะทุก response ต้องผ่าน auth check ก่อน — ยอมรับ trade-off นี้ในรอบนี้ ไม่ทำ
CDN/pre-signed URL ซึ่งเป็นงานคนละ scope)

## 3 · Backend

### 3.1 `apps/api/src/storage/StorageProvider.ts`

ตรงตาม D-09 ใน `architecture.md:396-399`:

```ts
export interface ObjectMeta {
  contentType: string
}

export interface StoredObject {
  key: string
  sizeBytes: number
}

export interface StorageProvider {
  put(key: string, data: Buffer, meta: ObjectMeta): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}
```

**ต่างจาก D-09 เล็กน้อย**: `get()` คืน `Promise<Buffer>` ไม่ใช่ `Promise<Readable>` ตามที่
architecture.md เขียนไว้เดิม — เหตุผล: thumbnail มีขนาดเล็กมาก (จำกัด 2MB ที่ต้นทาง §3.4) การ
buffer ทั้งก้อนในหน่วยความจำก่อนส่งออก ง่ายกว่าการจัดการ stream สำหรับเคสนี้ และ Express
`response.send(buffer)` ตรงไปตรงมากว่า `stream.pipe(response)` (ที่ต้องจัดการ error event
เพิ่มเอง) ถ้าอนาคตมีไฟล์ใหญ่ (เช่น export GLB) ค่อยทำ `getStream()` เป็นเมธอดเพิ่มตอนนั้น

### 3.2 `apps/api/src/storage/LocalDiskProvider.ts`

```ts
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import type { ObjectMeta, StorageProvider, StoredObject } from './StorageProvider.ts'

export class LocalDiskProvider implements StorageProvider {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  private resolveKey(key: string): string {
    // key มาจาก storage_key ที่ระบบสร้างเอง (uuid) ไม่ใช่ input ผู้ใช้โดยตรง แต่ยังกัน
    // path traversal ไว้เป็นชั้นที่สอง — ห้าม resolved path หลุดออกนอก root เด็ดขาด
    const target = normalize(join(this.root, key))
    if (!target.startsWith(this.root + sep) && target !== this.root) {
      throw new Error(`storage key พยายามออกนอกขอบเขตที่อนุญาต: ${key}`)
    }
    return target
  }

  async put(key: string, data: Buffer, _meta: ObjectMeta): Promise<StoredObject> {
    const path = this.resolveKey(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data)
    return { key, sizeBytes: data.byteLength }
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key))
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true })
  }
}
```

`_meta` (content type) ไม่ได้ใช้ใน `LocalDiskProvider` เพราะระบบไฟล์ไม่เก็บ MIME type —
`asset.mime_type` ในตาราง `assets` เป็นแหล่งความจริงเดียวสำหรับเรื่องนี้ (S3Provider ในอนาคต
จะใช้ `meta.contentType` ตั้ง `Content-Type` header ของ object ตอน `put`)

### 3.3 `apps/api/src/storage/index.ts` — factory ตาม `STORAGE_DRIVER`

```ts
import { env } from '../config/env.ts'
import { LocalDiskProvider } from './LocalDiskProvider.ts'
import type { StorageProvider } from './StorageProvider.ts'

export function createStorageProvider(): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return new LocalDiskProvider(env.STORAGE_ROOT)
    default: {
      // exhaustiveness check — ถ้าเพิ่มค่าใน STORAGE_DRIVER union แล้วลืมเพิ่มเคสตรงนี้
      // TypeScript จะฟ้องตอน build ไม่ใช่ runtime
      const exhaustive: never = env.STORAGE_DRIVER
      throw new Error(`ไม่รู้จัก STORAGE_DRIVER: ${String(exhaustive)}`)
    }
  }
}

export const storage: StorageProvider = createStorageProvider()
```

`config/env.ts` เพิ่ม:
```ts
STORAGE_DRIVER: z.enum(['local']).default('local'),
STORAGE_ROOT: z.string().min(1).default('./storage'),
```
(union มีค่าเดียวตอนนี้ตาม D-35 — เพิ่ม `'s3'` เข้า enum ได้ทันทีที่ทำ `S3Provider` จริงโดยไม่ต้อง
แก้โครงสร้างอื่น) `.env.example` เพิ่มบรรทัดคู่กันภายใต้หัวข้อ `# ---------- Storage ----------`

### 3.4 `apps/api/src/storage/mimeSniff.ts`

```ts
import { fileTypeFromBuffer } from 'file-type'

const ALLOWED_THUMBNAIL_TYPES = new Set(['image/webp'])
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024 // 2MB

export async function sniffThumbnailMime(data: Buffer): Promise<string> {
  const detected = await fileTypeFromBuffer(data)
  if (!detected || !ALLOWED_THUMBNAIL_TYPES.has(detected.mime)) {
    throw new Error(`ไฟล์ไม่ใช่ WebP ที่ถูกต้อง (ตรวจ magic bytes ได้: ${detected?.mime ?? 'ไม่รู้จัก'})`)
  }
  return detected.mime
}
```

เพิ่ม dependency `file-type` ใน `apps/api/package.json` — เลือกเพราะเป็น pure-JS (ไม่มี native
binding ที่ต้อง compile), ตรวจจาก magic bytes จริงตามที่ `database.md:364` กำหนดไว้ (ไม่เชื่อ
`Content-Type` header ที่ client ส่งมา)

### 3.5 Prisma migration — `assets` table + `projects.thumbnail_asset_id`

`prisma/schema.prisma` เพิ่ม model (ตาม `database.md` §3.5 ตรงตัว ยกเว้นเปลี่ยน enum เป็น
`text` + CHECK ตามเหตุผลด้านล่าง):

```prisma
model Asset {
  id             String   @id @default(uuid()) @db.Uuid
  ownerId        String?  @map("owner_id") @db.Uuid
  kind           String   @db.Text
  storageKey     String   @unique @map("storage_key") @db.Text
  mimeType       String   @map("mime_type") @db.Text
  sizeBytes      BigInt   @map("size_bytes")
  checksumSha256 Bytes    @map("checksum_sha256")
  metadata       Json     @default("{}") @db.JsonB
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  owner User? @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId, kind, createdAt(sort: Desc)])
  @@index([checksumSha256])
  @@map("assets")
}
```

`Project` model เพิ่ม `thumbnailAssetId String? @map("thumbnail_asset_id") @db.Uuid` +
`thumbnailAsset Asset? @relation(fields: [thumbnailAssetId], references: [id], onDelete: SetNull)`

**เบี่ยงจาก `database.md` ตรงที่ `kind` เป็น `text` + CHECK แทน Postgres enum จริง**:

```sql
ALTER TABLE "assets" ADD CONSTRAINT "assets_kind_check"
  CHECK (kind IN ('thumbnail'));
```

เหตุผล: Postgres enum เพิ่มค่าใหม่ทีหลังต้อง `ALTER TYPE ... ADD VALUE` ซึ่ง**รันในทรานแซกชัน
เดียวกับการใช้ค่านั้นไม่ได้** (ข้อจำกัดของ Postgres) ทำให้ deploy ยุ่งยากขึ้นทุกครั้งที่เพิ่ม asset
kind ใหม่ (Slice 5 จะมี `decoration_model`, Slice 4A ทำ `hand_model` ไปแล้วในความหมาย แต่ยังไม่
เก็บเป็น asset) CHECK constraint แก้ด้วย `ALTER TABLE ... DROP CONSTRAINT` +
`ADD CONSTRAINT` ในทรานแซกชันเดียวได้ปกติ — รอบนี้อนุญาตแค่ `'thumbnail'` value เดียวเพราะเป็น
เดียวที่มีโค้ดผลิตจริง (กฎเดียวกับที่ Slice 5 §9 วางไว้เรื่อง "ไม่สร้างฟิลด์ล่วงหน้าสำหรับ event
ที่ยังไม่มีโค้ดผลิต")

ไฟล์: `prisma/migrations/<timestamp>_add_assets_and_thumbnail/migration.sql` — สร้างตาม
timestamp จริงตอน implement (รูปแบบเดียวกับ `20260812205910_add_project_draft`)

### 3.6 Route + Service + Repository

**`apps/api/src/projects/routes.ts`** — เพิ่ม 2 routes ใหม่ ก่อน route `GET /:id` (Express
จับ route ตามลำดับที่ประกาศ ต้องอยู่เหนือ `/:id` แต่ต่ำกว่า `/:id/versions` ไม่ได้ชนกันเพราะคนละ
path segment):

```ts
// จำกัดขนาด raw body ที่ระดับ route เฉพาะที่ไม่ใช่ JSON — express.json({limit:'4mb'})
// ใน app.ts ไม่ครอบคลุม content-type อื่น
const rawWebp = express.raw({ type: 'image/webp', limit: '2mb' })

projectsRouter.post('/:id/thumbnail', rawWebp, async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    throw AppError.validation('ต้องแนบไฟล์ภาพ WebP')
  }
  await service.saveThumbnail(currentUser(request).id, id, request.body)
  response.status(204).send()
})

projectsRouter.get('/:id/thumbnail', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const result = await service.loadThumbnail(currentUser(request).id, id)
  if (!result) throw AppError.notFound('งานนี้ยังไม่มีภาพตัวอย่าง')
  response.setHeader('Content-Type', result.mimeType)
  response.setHeader('Cache-Control', 'private, max-age=60')
  response.send(result.data)
})
```

`express.raw({ type: 'image/webp' })` ต้อง import `express` เป็นค่า (ไม่ใช่แค่ `Router` type)
ใน `routes.ts` — เพิ่ม import `express` เข้าไปในไฟล์เดียวกัน `Cache-Control: private, max-age=60`
สั้นเพราะ thumbnail เปลี่ยนได้ทุกครั้งที่บันทึกเวอร์ชัน ไม่อยากให้เบราว์เซอร์แคชนานเกินจนเห็นภาพเก่า
ค้างหลังบันทึกใหม่ (60 วินาทีพอลด request ซ้ำตอนเปิดหน้ารายการซ้ำเร็วๆ โดยไม่เสี่ยงเห็นภาพเก่านาน)

**`apps/api/src/projects/service.ts`** — เพิ่ม:

```ts
import { sniffThumbnailMime, MAX_THUMBNAIL_BYTES } from '../storage/mimeSniff.ts'
import { storage } from '../storage/index.ts'
import { createHash, randomUUID } from 'node:crypto'

export async function saveThumbnail(
  userId: string,
  projectId: string,
  data: Buffer,
): Promise<void> {
  await mustOwn(userId, projectId)
  if (data.byteLength > MAX_THUMBNAIL_BYTES) {
    throw AppError.validation(`ไฟล์ใหญ่เกิน ${MAX_THUMBNAIL_BYTES / 1024 / 1024}MB`)
  }
  const mimeType = await sniffThumbnailMime(data) // throw ถ้าไม่ใช่ webp จริง

  const key = `thumbnails/${new Date().getUTCFullYear()}/${randomUUID()}.webp`
  await storage.put(key, data, { contentType: mimeType })
  const checksum = createHash('sha256').update(data).digest()

  const previous = await repository.replaceThumbnail(userId, projectId, {
    ownerId: userId,
    kind: 'thumbnail',
    storageKey: key,
    mimeType,
    sizeBytes: data.byteLength,
    checksumSha256: checksum,
  })
  // ลบไฟล์เก่าออกจาก storage หลังอัปเดต DB สำเร็จเท่านั้น — ถ้าลบก่อนแล้ว DB update
  // ล้มเหลว จะเหลือ thumbnail_asset_id ชี้ไปยัง asset ที่ไฟล์หายไปแล้ว
  if (previous) await storage.delete(previous.storageKey).catch(() => {
    // ไฟล์เก่าลบไม่สำเร็จไม่ใช่ความล้มเหลวที่ผู้ใช้ต้องรู้ — asset ใหม่ใช้งานได้ปกติแล้ว
    // เหลือแค่ไฟล์กำพร้าใน storage ที่เก็บกวาดทีหลังได้ (ไม่ใช่ scope รอบนี้)
  })
}

export async function loadThumbnail(
  userId: string,
  projectId: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const project = await mustOwn(userId, projectId)
  if (!project.thumbnailAssetId) return null
  const asset = await repository.findAsset(project.thumbnailAssetId)
  if (!asset) return null
  const data = await storage.get(asset.storageKey)
  return { data, mimeType: asset.mimeType }
}
```

**`apps/api/src/projects/repository.ts`** — เพิ่ม:

```ts
export interface NewAsset {
  ownerId: string
  kind: string
  storageKey: string
  mimeType: string
  sizeBytes: number
  checksumSha256: Buffer
}

/** สร้าง asset ใหม่ + ผูกเข้า project ในทรานแซกชันเดียว คืน asset เก่า (ถ้ามี) ให้ service ไปลบไฟล์ */
export async function replaceThumbnail(
  userId: string,
  projectId: string,
  input: NewAsset,
): Promise<{ storageKey: string } | null> {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, userId, deletedAt: null },
      select: { thumbnailAssetId: true },
    })
    const previous = project?.thumbnailAssetId
      ? await tx.asset.findUnique({
          where: { id: project.thumbnailAssetId },
          select: { storageKey: true },
        })
      : null

    const asset = await tx.asset.create({ data: input })
    await tx.project.updateMany({
      where: { id: projectId, userId, deletedAt: null },
      data: { thumbnailAssetId: asset.id },
    })
    // ลบแถว asset เก่าในทรานแซกชันเดียวกัน — ไม่งั้นตาราง assets โตไม่จำกัดจากแค่
    // thumbnail ที่ถูกเขียนทับซ้ำๆ (ทุกครั้งที่บันทึกเวอร์ชันสร้าง asset ใหม่เสมอ)
    if (project?.thumbnailAssetId) {
      await tx.asset.delete({ where: { id: project.thumbnailAssetId } })
    }
    return previous
  })
}

export function findAsset(id: string) {
  return prisma.asset.findUnique({ where: { id } })
}
```

**ทำไม `replaceThumbnail` อยู่ใน transaction เดียว**: สร้าง asset ใหม่ + ผูกเข้า project ต้อง
atomic — ถ้า process ตายกลางทางหลังสร้าง asset แต่ก่อนอัปเดต `thumbnail_asset_id` จะได้ asset
กำพร้า (แก้ทีหลังได้ ไม่ critical) แต่ถ้าอัปเดต `thumbnail_asset_id` สำเร็จโดยที่ยังไม่มี asset
แถวนั้นจริง จะพังตอนอ่าน — ลำดับใน transaction (`create` ก่อน `update`) และ FK constraint
รับประกันว่าไม่มีทางเกิดกรณีหลัง

### 3.7 `projectSummarySchema` เพิ่ม `hasThumbnail`

`packages/contracts/src/project.ts`:

```ts
export const projectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(PROJECT_STATUSES),
  versionCount: z.number().int(),
  hasThumbnail: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
```

`service.ts`'s `toSummary` (และ `ProjectRow` interface) เพิ่ม `thumbnailAssetId: string | null`
→ map เป็น `hasThumbnail: row.thumbnailAssetId !== null` **ไม่ส่ง asset id ตรงๆ** ออกไปที่
client (client ไม่ต้องรู้ id ภายใน แค่ต้องรู้ว่าจะ render `<img>` หรือ placeholder — ยิง
`GET /projects/:id/thumbnail` ตรงด้วย project id ที่มีอยู่แล้วพอ)

## 4 · Frontend

### 4.1 `apps/web/src/3d/scene/ThumbnailCapture.tsx`

Component ลูกใน `<NailScene>` (แพทเทิร์นเดียวกับ `NailFocus.tsx`) ไม่ render อะไรเอง
(`return null`) แต่ expose imperative capture function ผ่าน `forwardRef`:

```tsx
import { forwardRef, useImperativeHandle } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'
import { HOME_POSITION, HOME_TARGET } from './cameraPresets.ts'

export interface ThumbnailCaptureHandle {
  capture: () => Promise<Blob>
}

const SETTLE_TIMEOUT_MS = 800 // > 500ms ที่ NailFocus ใช้ถึง 99.75% ของระยะทาง (DAMPING=12)

export const ThumbnailCapture = forwardRef<ThumbnailCaptureHandle>((_props, ref) => {
  const gl = useThree((state) => state.gl)
  const focusHome = useDesign((state) => state.focusHome)

  useImperativeHandle(ref, () => ({
    capture: async () => {
      focusHome()
      await waitForCameraSettled()
      const canvas = gl.domElement
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.85)
      })
      if (!blob) throw new Error('สร้างภาพตัวอย่างไม่สำเร็จ')
      return blob
    },
  }), [gl, focusHome])

  return null
})
ThumbnailCapture.displayName = 'ThumbnailCapture'

// รอด้วยเวลาคงที่แทนการ poll ระยะทางกล้องทุกเฟรม — เหตุผล: NailFocus คำนวณ "ถึงแล้ว"
// ของตัวเองอยู่แล้วด้วย exponential damping ที่ไม่ขึ้นกับระยะเริ่มต้น
// (1 - exp(-12 × 0.5) ≈ 99.75% เสมอไม่ว่าเริ่มจากมุมไหน) SETTLE_TIMEOUT_MS ที่มากกว่า
// ค่านี้พอสมควรจึงเพียงพอ ไม่ต้องเพิ่มกลไก polling ซ้อนอีกชั้นในคอมโพเนนต์แยก
function waitForCameraSettled(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, SETTLE_TIMEOUT_MS))
  })
}
```

### 4.2 `apps/web/src/3d/scene/NailScene.tsx` — ต่อสาย ref

`NailEditor.tsx` (หรือ component แม่ที่ถือ ref) ต้องส่ง `ref` ทะลุ `<NailScene>` ลงไปถึง
`<ThumbnailCapture>` — วิธีที่ตรงไปตรงมาที่สุดคือให้ `NailEditor.tsx` render
`<ThumbnailCapture ref={thumbnailRef} />` เป็นลูกโดยตรงของ `<NailScene>` ข้าง
`<DesignScene>` (ไม่ต้องซ้อน prop-drilling ผ่าน `DesignScene`) แล้วเก็บ
`thumbnailRef = useRef<ThumbnailCaptureHandle>(null)` ไว้ที่ `NailEditor.tsx` ระดับเดียวกับ
`handleReady`/`parts`

### 4.3 `apps/web/src/api/client.ts` — เพิ่ม raw upload/download helper

`apiFetch` เดิมรองรับแค่ JSON body/response — thumbnail เป็น binary ทั้งขาขึ้นขาลง เพิ่มฟังก์ชัน
คู่ขนานที่ reuse CSRF/cookie logic เดิมแทนการ duplicate:

```ts
// แยก CSRF/cookie helper ออกจาก apiFetch ให้ทั้งสองฟังก์ชันเรียกร่วมกัน
function csrfHeaders(method: string): Record<string, string> {
  if (method === 'GET') return {}
  const csrf = readCookie(CSRF_COOKIE)
  return csrf ? { [CSRF_HEADER]: csrf } : {}
}

export async function apiUploadBinary(path: string, blob: Blob, contentType: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...csrfHeaders('POST') },
    credentials: 'include',
    body: blob,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiError | null
    throw new ApiRequestError(
      response.status,
      payload ?? {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'อัปโหลดภาพตัวอย่างไม่สำเร็จ', requestId: 'unknown' },
      },
    )
  }
}
```

(ปรับ `apiFetch` เดิมให้เรียก `csrfHeaders(method)` แทนโค้ด inline เดิม — ลด duplicate ไม่ใช่
เขียนใหม่คู่ขนานแบบไม่เกี่ยวกัน) ไม่ต้องเพิ่มฟังก์ชันดาวน์โหลดแยก เพราะฝั่งแสดงผลใช้ `<img>` ตรงๆ
(§4.4)

### 4.4 `NailEditor.tsx` — เรียกหลังบันทึกเวอร์ชันสำเร็จ

ในตำแหน่งเดิมที่ `saveVersion.mutateAsync` สำเร็จ (`NailEditor.tsx:175-182` ปัจจุบัน) เพิ่ม
ต่อท้ายแบบไม่บล็อก:

```ts
if (lifecycle.isActive()) explicitSaveUi.current.success(result.versionNumber)
void captureAndUploadThumbnail(projectId, thumbnailRef).catch((error) => {
  console.warn('[thumbnail] อัปโหลดภาพตัวอย่างไม่สำเร็จ ไม่กระทบการบันทึกเวอร์ชัน', error)
})
```

`captureAndUploadThumbnail` เป็นฟังก์ชันเล็กใน `useProjects.ts` (หรือไฟล์ helper ข้างๆ):

```ts
export async function captureAndUploadThumbnail(
  projectId: string,
  ref: React.RefObject<ThumbnailCaptureHandle | null>,
): Promise<void> {
  if (!ref.current) return // canvas ยังไม่พร้อม (WebGL ล้ม/ยังโหลดไม่เสร็จ) — ข้ามเงียบๆ
  const blob = await ref.current.capture()
  await apiUploadBinary(`/projects/${projectId}/thumbnail`, blob, 'image/webp')
  queryClient.invalidateQueries({ queryKey: projectKeys.list() }) // ให้หน้ารายการเห็นรูปใหม่
}
```

**จงใจ catch ที่ผู้เรียก ไม่ใช่ในฟังก์ชันนี้เอง** — ทำตามหลักการเดียวกับ D-36: การอัปโหลด
thumbnail ล้มเหลวต้องไม่ทำให้ผู้ใช้เข้าใจผิดว่าการบันทึกเวอร์ชันล้มเหลว จึงต้องแยก error path
ออกจาก `saveVersion` โดยสิ้นเชิง แต่การ catch เองในฟังก์ชันนี้จะกลืน error จนเทสไม่เห็นว่าเกิด
อะไรขึ้น — ปล่อยให้ throw แล้วให้ผู้เรียก (`NailEditor.tsx`) เป็นคนตัดสินใจว่าจะทำอะไรกับมัน (ตอนนี้
คือ log อย่างเดียว)

### 4.5 หน้ารายการโปรเจกต์ — แสดง thumbnail

ไฟล์ที่ render การ์ดโปรเจกต์ (list page) เปลี่ยนจาก placeholder เดิมเป็น:

```tsx
{project.hasThumbnail ? (
  <img
    src={`${API_BASE}/api/v1/projects/${project.id}/thumbnail`}
    crossOrigin="use-credentials"
    alt={`ภาพตัวอย่างของ ${project.name}`}
    loading="lazy"
  />
) : (
  <div className="project-thumbnail-placeholder" aria-hidden="true" />
)}
```

`crossOrigin="use-credentials"` จำเป็นเพราะ API อยู่คนละ origin (`localhost:4000` vs web
`localhost:5173`) — ถ้าไม่ตั้งค่านี้ browser จะไม่แนบ session cookie ไปกับคำขอโหลดรูป แล้วได้
401 กลับมาแทนรูป (CORS ฝั่งเซิร์ฟเวอร์อนุญาต credentials ไว้แล้วใน `app.ts` แต่ browser ต้องได้
รับอนุญาตจากฝั่ง client เช่นกันถึงจะส่ง cookie ข้าม origin กับ `<img>` tag)

## 5 · การทดสอบ

- `mimeSniff.test.ts` — ไฟล์ webp จริง (fixture เล็กๆ) ผ่าน, ไฟล์ PNG ที่เปลี่ยนนามสกุล/header
  หลอกเป็น webp ถูกปฏิเสธ, buffer ว่างถูกปฏิเสธ
- `LocalDiskProvider.test.ts` — put/get/delete round-trip บน temp dir (`node:os.tmpdir()`),
  `resolveKey` ปฏิเสธ key ที่พยายาม path traversal (`../../etc/passwd`)
- `service.test.ts` (เพิ่มเข้าไฟล์เดิมที่เทส `projects/service.ts` หรือไฟล์ใหม่ถ้าไม่มี) —
  `saveThumbnail`: mustOwn reject โปรเจกต์คนอื่น (404), ไฟล์เกิน `MAX_THUMBNAIL_BYTES` ถูก
  ปฏิเสธก่อนแตะ storage เลย, asset เก่าถูกแทนที่และไฟล์เก่าถูกลบ (mock `StorageProvider`)
- `repository.test.ts` (ถ้ามี integration test แบบเดียวกับ `projects` เดิมที่ต่อ PostgreSQL
  จริง) — `replaceThumbnail` สอง call ติดกัน: แถวที่สองแทนที่แถวแรกใน `thumbnail_asset_id`,
  แถว asset เก่าถูกลบออกจากตาราง `assets` จริงในทรานแซกชันเดียวกัน (ไม่เหลือ orphan row),
  คืนค่า `storageKey` ของ asset เก่ากลับไปให้ service ลบไฟล์ต่อ
- `npm run db:verify` ตรวจ migration ใหม่ — ตาราง `assets`, FK `projects.thumbnail_asset_id`,
  index ครบตามที่ระบุ, CHECK constraint บน `kind`
- **Manual browser verification (จำเป็น)**: เปิด `dev:api`+`dev:web` จริง สร้างโปรเจกต์ → วาด
  อะไรสักอย่าง → กดบันทึกเป็นเวอร์ชัน → กลับหน้ารายการ → เห็น thumbnail จริง (ไม่ใช่ placeholder)
  → เปิดโปรเจกต์อื่นที่ไม่มี thumbnail → เห็น placeholder ไม่ใช่ broken image icon → ลอง fetch
  `GET /projects/:id/thumbnail` ของโปรเจกต์คนอื่น (เปลี่ยน id ใน URL ตรงๆ) → ได้ 404 ไม่ใช่ 403
  หรือรูปจริง

## 6 · ผลกระทบที่ต้องยอมรับ

- Capture framing คงที่ที่ "ดูทั้งมือ" เสมอ (D-37) — ผู้ใช้เลือก framing เองไม่ได้ในรอบนี้
  (ไม่มีปุ่ม "ถ่ายภาพปก" แยกตาม D-36)
- ไฟล์ thumbnail เก่าที่ storage ลบไม่สำเร็จ (เช่น disk error ชั่วคราว) จะกลายเป็นไฟล์กำพร้า —
  ไม่มี cleanup job อัตโนมัติรอบนี้ (`.catch(() => {})` ใน §3.6 จงใจกลืน error นี้)
- `Cache-Control: private, max-age=60` แปลว่า refresh หน้ารายการถี่ๆ ภายใน 1 นาทีหลังบันทึก
  เวอร์ชันใหม่อาจยังเห็นรูปเก่าจากแคชเบราว์เซอร์ — ยอมรับเพราะ trade-off ระหว่างความสดของภาพกับ
  จำนวน request ซ้ำ ไม่ใช่ bug
- ไม่มี S3Provider (D-35) — deploy ขึ้น production จริงต้องทำเพิ่มก่อน ไม่ใช่ใช้ LocalDiskProvider
  ตรงๆ (ผิดกับ D-09 ที่ห้ามเก็บไฟล์ไว้กับ process เดียวตอน scale หลาย instance)

## 7 · สิ่งที่ไม่อยู่ในรอบนี้

- `S3Provider` (D-35 ตัดออก — รอ Slice 8)
- ปุ่ม "ถ่ายภาพปก" แยกจากการบันทึกเวอร์ชัน (D-36 ตัดออก)
- Cleanup job สำหรับไฟล์กำพร้า
- Pre-signed URL / CDN สำหรับรูป thumbnail (D-38 ยอมรับ overhead ของ auth ต่อ request แทน)
- Exporters (`.nail.json`/PNG/GLB) — Slice 4 ข้อ 7 เป็นสเปกแยก

## 8 · เกณฑ์ว่าเสร็จ

- กด "บันทึกเป็นเวอร์ชัน" → thumbnail อัปเดตอัตโนมัติ ไม่ต้องกดอะไรเพิ่ม
- หน้ารายการโปรเจกต์แสดงภาพจริงของงานที่มี thumbnail, placeholder สำหรับงานที่ยังไม่มี
- โปรเจกต์คนอื่นเปิด thumbnail ของเราไม่ได้ (404 ไม่ใช่ 403 ไม่ใช่รูปจริง) — พิสูจน์บน
  เบราว์เซอร์จริงด้วยการแก้ id ใน URL ตรงๆ
- ไฟล์ที่ไม่ใช่ WebP จริง (ต่อให้ปลอม header) ถูกปฏิเสธที่ backend
- ไฟล์เกิน 2MB ถูกปฏิเสธก่อนเขียนลง storage
- `npm run typecheck`, `npm run test` ผ่านสะอาดทั้ง `apps/api`, `apps/web`, `@nail-studio/contracts`
