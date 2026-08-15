# Thumbnail Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every time a user explicitly saves a version, capture a WebP screenshot of the whole hand and show it as the project's thumbnail on the projects list page.

**Architecture:** New `StorageProvider` abstraction (LocalDisk only) + `assets` Prisma table + two new endpoints on the existing `projectsRouter` (`POST`/`GET /projects/:id/thumbnail`), following the exact route→service→repository pattern already used for every other project endpoint. On the frontend, a small React-three-fiber component reads the WebGL canvas via `canvas.toBlob()` and uploads it after `saveVersion` succeeds, without blocking the save.

**Tech Stack:** Express 5, Prisma 7 (driver adapter, no engine), Zod 4, Vitest, React 19, react-three-fiber 9, TanStack Query 5.

**Spec:** `docs/superpowers/specs/2026-08-15-thumbnail-design.md`

## Global Constraints

- Max thumbnail upload size: 2MB (`MAX_THUMBNAIL_BYTES` — spec §3.4).
- Only `image/webp` accepted, verified by magic-byte sniffing (`file-type` package), never trusted from the client-supplied `Content-Type` header (spec §3.4, `database.md:364`).
- `StorageProvider` implements only `LocalDiskProvider` this round — no S3 (spec D-35).
- `GET /projects/:id/thumbnail` requires `requireUser` + ownership check returning 404 (not 403) for someone else's project — same as every other route in `projectsRouter` (spec D-38).
- Thumbnail capture always frames the whole hand ("ดูทั้งมือ" / `HOME_POSITION`/`HOME_TARGET`), never the user's current camera angle (spec D-37).
- Thumbnail capture fires automatically after "บันทึกเป็นเวอร์ชัน" succeeds — no separate capture button (spec D-36).
- A failed capture or upload must never make the version-save action appear to have failed (spec §4.4).
- Every task ends with `npm run typecheck` and `npm run test` passing in the affected workspace(s).

---

## Task 1: `StorageProvider` interface + `LocalDiskProvider`

**Files:**
- Create: `apps/api/src/storage/StorageProvider.ts`
- Create: `apps/api/src/storage/LocalDiskProvider.ts`
- Create: `apps/api/src/storage/LocalDiskProvider.test.ts`
- Modify: `apps/api/src/config/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `export interface ObjectMeta { contentType: string }`, `export interface StoredObject { key: string; sizeBytes: number }`, `export interface StorageProvider { put(key, data, meta): Promise<StoredObject>; get(key): Promise<Buffer>; delete(key): Promise<void> }`, `export class LocalDiskProvider implements StorageProvider`. Consumed by Task 4's `storage/index.ts` factory.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/storage/LocalDiskProvider.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalDiskProvider } from './LocalDiskProvider.ts'

let root: string
let provider: LocalDiskProvider

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'nail-studio-storage-'))
  provider = new LocalDiskProvider(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('LocalDiskProvider', () => {
  it('put/get round-trip returns the exact bytes written', async () => {
    const data = Buffer.from('hello world')
    const stored = await provider.put('thumbnails/2026/a.webp', data, { contentType: 'image/webp' })
    expect(stored).toEqual({ key: 'thumbnails/2026/a.webp', sizeBytes: data.byteLength })

    const read = await provider.get('thumbnails/2026/a.webp')
    expect(read).toEqual(data)
  })

  it('creates nested directories automatically', async () => {
    await provider.put('a/b/c/d.webp', Buffer.from('x'), { contentType: 'image/webp' })
    const read = await provider.get('a/b/c/d.webp')
    expect(read.toString()).toBe('x')
  })

  it('delete removes the file; a second delete does not throw', async () => {
    await provider.put('gone.webp', Buffer.from('x'), { contentType: 'image/webp' })
    await provider.delete('gone.webp')
    await expect(provider.delete('gone.webp')).resolves.toBeUndefined()
    await expect(provider.get('gone.webp')).rejects.toThrow()
  })

  it('rejects a key that tries to escape the storage root', async () => {
    await expect(
      provider.put('../../etc/passwd', Buffer.from('x'), { contentType: 'image/webp' }),
    ).rejects.toThrow(/ออกนอกขอบเขต/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@nail-studio/api -- LocalDiskProvider.test.ts`
Expected: FAIL — `LocalDiskProvider.ts` does not exist.

- [ ] **Step 3: Write `StorageProvider.ts`**

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

- [ ] **Step 4: Write `LocalDiskProvider.ts`**

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

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace=@nail-studio/api -- LocalDiskProvider.test.ts`
Expected: PASS

- [ ] **Step 6: Add `STORAGE_DRIVER`/`STORAGE_ROOT` to env config**

In `apps/api/src/config/env.ts`, add to `envSchema` (after `SESSION_TTL_DAYS`):

```ts
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_ROOT: z.string().min(1).default('./storage'),
```

In `.env.example`, add after the `# ---------- API ----------` block (before `# ---------- Web ----------`):

```
# ---------- Storage ----------
# ที่เก็บไฟล์ (thumbnail ฯลฯ) — รองรับแค่ local รอบนี้
STORAGE_DRIVER=local
STORAGE_ROOT=./storage
```

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/api`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/storage/StorageProvider.ts apps/api/src/storage/LocalDiskProvider.ts apps/api/src/storage/LocalDiskProvider.test.ts apps/api/src/config/env.ts .env.example
git commit -m "feat: add StorageProvider interface and LocalDiskProvider"
```

---

## Task 2: MIME magic-byte sniffing

**Files:**
- Create: `apps/api/src/storage/mimeSniff.ts`
- Create: `apps/api/src/storage/mimeSniff.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export const MAX_THUMBNAIL_BYTES: number`, `export function sniffThumbnailMime(data: Buffer): Promise<string>` (throws if not a genuine `image/webp`). Consumed by Task 6's `saveThumbnail`.

- [ ] **Step 1: Add the `file-type` dependency**

In `apps/api/package.json`, add to `dependencies` (alphabetical order, matching existing style):

```json
    "file-type": "^19.6.0",
```

Run: `npm install --workspace=@nail-studio/api`

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/storage/mimeSniff.test.ts`. A minimal valid WebP file is a RIFF container — build one with a real WebP header (the smallest valid lossless WebP magic bytes) rather than a fake string, so the test proves real magic-byte detection, not just "starts with some prefix":

```ts
import { describe, expect, it } from 'vitest'
import { MAX_THUMBNAIL_BYTES, sniffThumbnailMime } from './mimeSniff.ts'

// RIFF....WEBPVP8L... — the minimal byte sequence file-type needs to recognize
// a lossless WebP container. Body bytes after the header are irrelevant to detection.
const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x1a, 0x00, 0x00, 0x00, // chunk size (arbitrary, not validated by file-type)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
  0x56, 0x50, 0x38, 0x4c, // "VP8L"
  0x0d, 0x00, 0x00, 0x00, // VP8L chunk size
  0x2f, 0x00, 0x00, 0x00, 0x10, 0x88, 0x88, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
])

describe('sniffThumbnailMime', () => {
  it('accepts a genuine WebP buffer and returns image/webp', async () => {
    await expect(sniffThumbnailMime(VALID_WEBP)).resolves.toBe('image/webp')
  })

  it('rejects a PNG file even if the caller claims it is WebP', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await expect(sniffThumbnailMime(png)).rejects.toThrow(/ไม่ใช่ WebP/)
  })

  it('rejects an empty buffer', async () => {
    await expect(sniffThumbnailMime(Buffer.alloc(0))).rejects.toThrow(/ไม่ใช่ WebP/)
  })

  it('MAX_THUMBNAIL_BYTES is 2MB', () => {
    expect(MAX_THUMBNAIL_BYTES).toBe(2 * 1024 * 1024)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test --workspace=@nail-studio/api -- mimeSniff.test.ts`
Expected: FAIL — `mimeSniff.ts` does not exist.

- [ ] **Step 4: Write `mimeSniff.ts`**

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

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace=@nail-studio/api -- mimeSniff.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/storage/mimeSniff.ts apps/api/src/storage/mimeSniff.test.ts
git commit -m "feat: add magic-byte MIME sniffing for thumbnail uploads"
```

---

## Task 3: `storage/index.ts` factory

**Files:**
- Create: `apps/api/src/storage/index.ts`

**Interfaces:**
- Consumes: `StorageProvider` (Task 1's `StorageProvider.ts`), `LocalDiskProvider` (Task 1), `env` from `../config/env.ts` (Task 1 added `STORAGE_DRIVER`/`STORAGE_ROOT`).
- Produces: `export const storage: StorageProvider` — the singleton instance consumed by Task 6's `service.ts`.

No test file — this is a thin factory with a single branch (only `'local'` exists in the `STORAGE_DRIVER` enum, so there is nothing to branch-test beyond what Task 1's `LocalDiskProvider.test.ts` already covers). Verified by typecheck plus Task 6's integration test exercising it end-to-end.

- [ ] **Step 1: Write `storage/index.ts`**

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

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/api`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/storage/index.ts
git commit -m "feat: add StorageProvider factory selected by STORAGE_DRIVER"
```

---

## Task 4: Prisma migration — `assets` table + `projects.thumbnail_asset_id`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_assets_and_thumbnail/migration.sql`
- Modify: `tools/verify-migration.mjs`

**Interfaces:**
- Produces: Prisma model `Asset` (TS type `Asset` generated into `apps/api/src/generated/prisma`), `Project.thumbnailAssetId: string | null`, `Project.thumbnailAsset: Asset | null` relation. Consumed by Task 5's repository functions.

- [ ] **Step 1: Add the `Asset` model and `Project.thumbnailAssetId` to `schema.prisma`**

In `prisma/schema.prisma`, add after the `Project` model's closing `}` (before `model DesignVersion`):

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
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  owner    User?     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  projects Project[] @relation("ProjectThumbnail")

  @@index([ownerId, kind, createdAt(sort: Desc)])
  @@index([checksumSha256])
  @@map("assets")
}
```

In the `Project` model, add two fields right after `deletedAt` and before the `draftDocument` comment block:

```prisma
  thumbnailAssetId String?   @map("thumbnail_asset_id") @db.Uuid
```

and add the relation field next to the existing `user`/`versions` relations:

```prisma
  thumbnailAsset Asset? @relation("ProjectThumbnail", fields: [thumbnailAssetId], references: [id], onDelete: SetNull)
```

In the `User` model, add `assets Asset[]` next to the existing `sessions`/`projects` relation fields.

- [ ] **Step 2: Generate the migration SQL**

Run: `npm run db:migrate -- --name add_assets_and_thumbnail --create-only`

This creates `prisma/migrations/<timestamp>_add_assets_and_thumbnail/migration.sql` without applying it. Open the generated file and verify it matches this shape (Prisma may order statements slightly differently — what matters is the resulting schema, not exact statement order):

```sql
-- AlterTable
ALTER TABLE "projects" ADD COLUMN "thumbnail_asset_id" UUID;

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "kind" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" BYTEA NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_storage_key_key" ON "assets"("storage_key");

-- CreateIndex
CREATE INDEX "assets_owner_id_kind_created_at_idx" ON "assets"("owner_id", "kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "assets_checksum_sha256_idx" ON "assets"("checksum_sha256");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_thumbnail_asset_id_fkey" FOREIGN KEY ("thumbnail_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Then append the CHECK constraint manually to the same generated `migration.sql` file (Prisma's `kind String` doesn't know about this business rule — add it by hand, following the spec's D-35/§3.5 reasoning for why `kind` is `text` + CHECK instead of a Postgres enum):

```sql
-- CheckConstraint (manually added — see spec §3.5: text+CHECK instead of enum so
-- future asset kinds don't require ALTER TYPE ... ADD VALUE outside a transaction)
ALTER TABLE "assets" ADD CONSTRAINT "assets_kind_check" CHECK (kind IN ('thumbnail'));
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run: `npm run db:migrate`
Expected: applies cleanly against your local dev database, prints "Your database is now in sync with your schema."

Run: `npm run db:generate`
Expected: regenerates `apps/api/src/generated/prisma` with the new `Asset` model and `Project.thumbnailAssetId` field.

- [ ] **Step 4: Update `tools/verify-migration.mjs`'s expected schema**

In `tools/verify-migration.mjs`, update the `EXPECTED` object's `projects` entry to include the new column, and add an `assets` entry:

```js
  projects: [
    'id', 'user_id', 'name', 'status', 'version_count',
    'created_at', 'updated_at', 'deleted_at',
    'draft_document', 'draft_updated_at', 'draft_base_version',
    'thumbnail_asset_id',
  ],
  design_versions: ['id', 'project_id', 'version_number', 'schema_version', 'document', 'label', 'created_at'],
  assets: [
    'id', 'owner_id', 'kind', 'storage_key', 'mime_type',
    'size_bytes', 'checksum_sha256', 'metadata', 'created_at',
  ],
```

Add to `EXPECTED_UNIQUE`:

```js
  { table: 'assets', columns: ['storage_key'] },
```

- [ ] **Step 5: Run the migration verifier**

Run: `npm run db:verify`
Expected: PASS — reports the `assets` table and all expected columns/unique constraints present, using a scratch database that gets dropped afterward.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tools/verify-migration.mjs
git commit -m "feat: add assets table and projects.thumbnail_asset_id migration"
```

---

## Task 5: `hasThumbnail` on `ProjectSummary` contract

**Files:**
- Modify: `packages/contracts/src/project.ts`
- Modify: `packages/contracts/src/project.test.ts` (create if it doesn't exist — check with Glob first)

**Interfaces:**
- Produces: `projectSummarySchema` now includes `hasThumbnail: z.boolean()`; `ProjectSummary` type gains `hasThumbnail: boolean`. Consumed by Task 6 (`toSummary` in `service.ts`) and Task 12 (`ProjectsPage.tsx`).

- [ ] **Step 1: Write the failing test**

Check whether `packages/contracts/src/project.test.ts` exists. If not, create it:

```ts
import { describe, expect, it } from 'vitest'
import { projectSummarySchema } from './project.ts'

describe('projectSummarySchema', () => {
  it('requires hasThumbnail as a boolean', () => {
    const valid = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Test',
      status: 'draft',
      versionCount: 1,
      hasThumbnail: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect(projectSummarySchema.safeParse(valid).success).toBe(true)
    expect(projectSummarySchema.safeParse({ ...valid, hasThumbnail: undefined }).success).toBe(false)
  })
})
```

If the file already exists, append this `describe` block instead, reusing its existing imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@nail-studio/contracts -- project.test.ts`
Expected: FAIL — `hasThumbnail` not in schema, so the "requires" case doesn't distinguish yet (the valid-object assertion still passes; the `undefined` rejection assertion fails because the field isn't required yet).

- [ ] **Step 3: Add `hasThumbnail` to the schema**

In `packages/contracts/src/project.ts`, modify `projectSummarySchema`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@nail-studio/contracts -- project.test.ts`
Expected: PASS

- [ ] **Step 5: Run full contracts test suite (this type is used widely)**

Run: `npm run typecheck --workspace=@nail-studio/contracts && npm run test --workspace=@nail-studio/contracts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/project.ts packages/contracts/src/project.test.ts
git commit -m "feat(contracts): add hasThumbnail to ProjectSummary"
```

---

## Task 6: Repository — `replaceThumbnail` + `findAsset`

**Files:**
- Modify: `apps/api/src/projects/repository.ts`

**Interfaces:**
- Consumes: `prisma` from `../db.ts`, the generated `Asset`/`Project` types (Task 4).
- Produces: `export interface NewAsset { ownerId: string; kind: string; storageKey: string; mimeType: string; sizeBytes: bigint; checksumSha256: Buffer }`, `export function replaceThumbnail(userId: string, projectId: string, input: NewAsset): Promise<{ storageKey: string } | null>`, `export function findAsset(id: string)`. Consumed by Task 7's `service.ts`.

No standalone test file — `repository.ts` functions are exercised indirectly through `service.test.ts` (Task 7, mocked) and the integration test (Task 8, real DB), matching how the rest of `repository.ts` is already tested in this codebase (no `repository.test.ts` file exists for the other functions either).

- [ ] **Step 1: Add `NewAsset`, `replaceThumbnail`, `findAsset` to `repository.ts`**

At the end of `apps/api/src/projects/repository.ts`, add:

```ts
export interface NewAsset {
  ownerId: string
  kind: string
  storageKey: string
  mimeType: string
  sizeBytes: bigint
  checksumSha256: Buffer
}

/**
 * สร้าง asset ใหม่ + ผูกเข้า project ในทรานแซกชันเดียว คืน asset เก่า (ถ้ามี) ให้ service
 * ไปลบไฟล์ต่อ — ลบแถว asset เก่าออกจาก DB ในทรานแซกชันเดียวกันนี้เลย ไม่งั้นตาราง assets
 * โตไม่จำกัดจากแค่ thumbnail ที่ถูกเขียนทับซ้ำๆ ทุกครั้งที่บันทึกเวอร์ชัน
 */
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

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/api`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/projects/repository.ts
git commit -m "feat: add replaceThumbnail and findAsset repository functions"
```

---

## Task 7: Service — `saveThumbnail` + `loadThumbnail` + `hasThumbnail` in `toSummary`

**Files:**
- Modify: `apps/api/src/projects/service.ts`
- Create: `apps/api/src/projects/thumbnail.test.ts`

**Interfaces:**
- Consumes: `sniffThumbnailMime`, `MAX_THUMBNAIL_BYTES` (Task 2), `storage` (Task 3), `replaceThumbnail`, `findAsset` (Task 6), `mustOwn` (existing, this file).
- Produces: `export async function saveThumbnail(userId: string, projectId: string, data: Buffer): Promise<void>`, `export async function loadThumbnail(userId: string, projectId: string): Promise<{ data: Buffer; mimeType: string } | null>`. `toSummary` now reads `hasThumbnail` from `row.thumbnailAssetId !== null`. Consumed by Task 9's `routes.ts`.

This task mocks `storage`/`repository` rather than hitting a real database or filesystem — the real end-to-end path (real Postgres, real disk) is covered by Task 8's integration test. Vitest's `vi.mock` is the tool; check `apps/api/src/projects/repositoryErrors.test.ts` for the existing mocking style used in this codebase before writing this file, and follow the same pattern.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/projects/thumbnail.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AppError } from '../errors/AppError.ts'

const mustOwnMock = vi.hoisted(() => vi.fn())
const findProjectMock = vi.hoisted(() => vi.fn())
const replaceThumbnailMock = vi.hoisted(() => vi.fn())
const findAssetMock = vi.hoisted(() => vi.fn())
const storagePutMock = vi.hoisted(() => vi.fn())
const storageGetMock = vi.hoisted(() => vi.fn())
const storageDeleteMock = vi.hoisted(() => vi.fn())

vi.mock('./repository.ts', () => ({
  findProject: findProjectMock,
  replaceThumbnail: replaceThumbnailMock,
  findAsset: findAssetMock,
}))
vi.mock('../storage/index.ts', () => ({
  storage: { put: storagePutMock, get: storageGetMock, delete: storageDeleteMock },
}))

// ไฟล์ WebP ปลอมที่พอผ่าน magic-byte sniff จริง (เหมือน fixture ใน mimeSniff.test.ts)
const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00, 0x00,
  0x2f, 0x00, 0x00, 0x00, 0x10, 0x88, 0x88, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
])

const { saveThumbnail, loadThumbnail } = await import('./service.ts')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saveThumbnail', () => {
  it('rejects a project that does not belong to the user (404)', async () => {
    findProjectMock.mockResolvedValue(null)
    await expect(saveThumbnail('user-1', 'project-1', VALID_WEBP)).rejects.toThrow(AppError)
    await expect(saveThumbnail('user-1', 'project-1', VALID_WEBP)).rejects.toMatchObject({ status: 404 })
    expect(storagePutMock).not.toHaveBeenCalled()
  })

  it('rejects a buffer over MAX_THUMBNAIL_BYTES before touching storage', async () => {
    findProjectMock.mockResolvedValue({ id: 'project-1', thumbnailAssetId: null })
    const tooLarge = Buffer.alloc(2 * 1024 * 1024 + 1)
    await expect(saveThumbnail('user-1', 'project-1', tooLarge)).rejects.toMatchObject({ status: 400 })
    expect(storagePutMock).not.toHaveBeenCalled()
  })

  it('rejects a buffer that is not a genuine WebP', async () => {
    findProjectMock.mockResolvedValue({ id: 'project-1', thumbnailAssetId: null })
    const notWebp = Buffer.from([0x00, 0x01, 0x02, 0x03])
    await expect(saveThumbnail('user-1', 'project-1', notWebp)).rejects.toThrow()
    expect(storagePutMock).not.toHaveBeenCalled()
  })

  it('stores the asset and deletes the previous file when one existed', async () => {
    findProjectMock.mockResolvedValue({ id: 'project-1', thumbnailAssetId: null })
    replaceThumbnailMock.mockResolvedValue({ storageKey: 'thumbnails/2026/old.webp' })
    storagePutMock.mockResolvedValue({ key: 'thumbnails/2026/new.webp', sizeBytes: VALID_WEBP.byteLength })
    storageDeleteMock.mockResolvedValue(undefined)

    await saveThumbnail('user-1', 'project-1', VALID_WEBP)

    expect(storagePutMock).toHaveBeenCalledWith(
      expect.stringMatching(/^thumbnails\/\d{4}\/.+\.webp$/),
      VALID_WEBP,
      { contentType: 'image/webp' },
    )
    expect(replaceThumbnailMock).toHaveBeenCalled()
    expect(storageDeleteMock).toHaveBeenCalledWith('thumbnails/2026/old.webp')
  })

  it('does not throw when deleting the previous file fails', async () => {
    findProjectMock.mockResolvedValue({ id: 'project-1', thumbnailAssetId: null })
    replaceThumbnailMock.mockResolvedValue({ storageKey: 'thumbnails/2026/old.webp' })
    storagePutMock.mockResolvedValue({ key: 'thumbnails/2026/new.webp', sizeBytes: VALID_WEBP.byteLength })
    storageDeleteMock.mockRejectedValue(new Error('disk error'))

    await expect(saveThumbnail('user-1', 'project-1', VALID_WEBP)).resolves.toBeUndefined()
  })
})

describe('loadThumbnail', () => {
  it('returns null when the project has no thumbnail', async () => {
    findProjectMock.mockResolvedValue({ id: 'project-1', thumbnailAssetId: null })
    await expect(loadThumbnail('user-1', 'project-1')).resolves.toBeNull()
    expect(storageGetMock).not.toHaveBeenCalled()
  })

  it('returns the stored bytes and mime type', async () => {
    findProjectMock.mockResolvedValue({ id: 'project-1', thumbnailAssetId: 'asset-1' })
    findAssetMock.mockResolvedValue({ storageKey: 'thumbnails/2026/x.webp', mimeType: 'image/webp' })
    storageGetMock.mockResolvedValue(Buffer.from('bytes'))

    const result = await loadThumbnail('user-1', 'project-1')
    expect(result).toEqual({ data: Buffer.from('bytes'), mimeType: 'image/webp' })
  })

  it('rejects a project that does not belong to the user (404)', async () => {
    findProjectMock.mockResolvedValue(null)
    await expect(loadThumbnail('user-1', 'project-1')).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@nail-studio/api -- thumbnail.test.ts`
Expected: FAIL — `saveThumbnail`/`loadThumbnail` not exported from `service.ts`.

- [ ] **Step 3: Add `saveThumbnail`/`loadThumbnail` to `service.ts`, and `hasThumbnail` to `toSummary`**

In `apps/api/src/projects/service.ts`:

1. Add imports at the top:

```ts
import { randomUUID, createHash } from 'node:crypto'
import { sniffThumbnailMime, MAX_THUMBNAIL_BYTES } from '../storage/mimeSniff.ts'
import { storage } from '../storage/index.ts'
```

2. Add `thumbnailAssetId: string | null` to the `ProjectRow` interface (after `draftBaseVersion?: number | null`):

```ts
  thumbnailAssetId?: string | null
```

3. Update `toSummary` to include `hasThumbnail`:

```ts
function toSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    versionCount: row.versionCount,
    hasThumbnail: (row.thumbnailAssetId ?? null) !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
```

4. Add at the end of the file:

```ts
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
    sizeBytes: BigInt(data.byteLength),
    checksumSha256: checksum,
  })
  // ลบไฟล์เก่าออกจาก storage หลังอัปเดต DB สำเร็จเท่านั้น — ถ้าลบก่อนแล้ว DB update
  // ล้มเหลว จะเหลือ thumbnail_asset_id ชี้ไปยัง asset ที่ไฟล์หายไปแล้ว
  if (previous) {
    await storage.delete(previous.storageKey).catch(() => {
      // ไฟล์เก่าลบไม่สำเร็จไม่ใช่ความล้มเหลวที่ผู้ใช้ต้องรู้ — asset ใหม่ใช้งานได้ปกติแล้ว
    })
  }
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@nail-studio/api -- thumbnail.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full API test suite and typecheck (this touches shared `ProjectRow`/`toSummary`)**

Run: `npm run typecheck --workspace=@nail-studio/api && npm run test --workspace=@nail-studio/api`
Expected: PASS — confirms no other test that snapshots `ProjectSummary` broke from the new `hasThumbnail` field.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/projects/service.ts apps/api/src/projects/thumbnail.test.ts
git commit -m "feat: add saveThumbnail and loadThumbnail services"
```

---

## Task 8: Routes — `POST`/`GET /projects/:id/thumbnail`

**Files:**
- Modify: `apps/api/src/projects/routes.ts`

**Interfaces:**
- Consumes: `service.saveThumbnail`, `service.loadThumbnail` (Task 7).
- Produces: `POST /api/v1/projects/:id/thumbnail` (raw `image/webp` body, 204 on success), `GET /api/v1/projects/:id/thumbnail` (binary response, 404 if none). Consumed by Task 9's integration test and the frontend (Tasks 11-12).

- [ ] **Step 1: Add the routes**

In `apps/api/src/projects/routes.ts`:

1. Change the `express` import at the top from nothing (currently only `Router` type is imported implicitly via `express`) — check the current import line; it's `import { Router } from 'express'`. Change it to also import the `express` default so `express.raw(...)` is available:

```ts
import express, { Router } from 'express'
```

2. Add, right before the `projectsRouter.get('/:id', ...)` route (so it's declared before the catch-all `/:id` GET but the exact position relative to other named sub-routes doesn't matter since Express matches by full path):

```ts
// จำกัดขนาด raw body เฉพาะ content-type นี้ — express.json({limit:'4mb'}) ใน app.ts
// ไม่ครอบคลุม content-type อื่น
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

3. `AppError` is not currently imported in `routes.ts` — add the import:

```ts
import { AppError } from '../errors/AppError.ts'
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/api`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/projects/routes.ts
git commit -m "feat: add POST/GET /projects/:id/thumbnail routes"
```

---

## Task 9: Integration test — full upload/download/ownership flow

**Files:**
- Modify: `apps/api/src/__tests__/httpClient.ts`
- Create: `apps/api/src/__tests__/thumbnail.integration.test.ts`

**Interfaces:**
- Consumes: `Client` (existing, this file gets one new method), `createApp` from `../app.ts`, `prisma`/`disconnectDb` from `../db.ts` — same pattern as `slice3.versions.integration.test.ts`.
- Produces: `Client.sendRaw(method, path, buffer, contentType): Promise<HttpResponse>` — a binary-body variant of the existing JSON-only `send`.

- [ ] **Step 1: Add `sendRaw` to `Client`**

In `apps/api/src/__tests__/httpClient.ts`, add a new method to the `Client` class, next to the existing `sendWithoutCsrf`:

```ts
  /** ส่ง body เป็นไบต์ดิบ (ไม่ JSON-encode) — สำหรับ endpoint ที่รับไฟล์ตรงๆ เช่น thumbnail */
  async sendRaw(
    method: HttpMethod,
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<HttpResponse> {
    let call = request(this.getApp())[method](`/api/v1${path}`).set('Content-Type', contentType)
    const cookieHeader = this.header()
    if (cookieHeader) call = call.set('Cookie', cookieHeader)
    if (method !== 'get') call = call.set('x-csrf-token', this.csrf())
    const response = await call.send(body)
    this.absorb(response.headers['set-cookie'] as string[] | undefined)
    return { status: response.status, body: response.body }
  }
```

- [ ] **Step 2: Write the failing integration test**

Create `apps/api/src/__tests__/thumbnail.integration.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const PASSWORD = 'integration-test-password'
const stamp = Date.now()
const ownerEmail = `thumbnail.owner.${stamp}@example.test`
const otherEmail = `thumbnail.other.${stamp}@example.test`

// RIFF....WEBPVP8L... — the minimal byte sequence file-type needs to recognize
// a lossless WebP container (same fixture as mimeSniff.test.ts).
const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00, 0x00,
  0x2f, 0x00, 0x00, 0x00, 0x10, 0x88, 0x88, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
])

let app: Express

beforeAll(() => {
  app = createApp()
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  await disconnectDb()
})

describe('Thumbnail upload/download API', () => {
  const owner = new Client(() => app)
  const other = new Client(() => app)
  let projectId = ''

  it('sets up two users and a project', async () => {
    await owner.send('get', '/auth/me')
    await other.send('get', '/auth/me')
    const registeredOwner = await owner.send('post', '/auth/register', {
      email: ownerEmail, password: PASSWORD, displayName: 'Thumbnail owner',
    })
    const registeredOther = await other.send('post', '/auth/register', {
      email: otherEmail, password: PASSWORD, displayName: 'Other user',
    })
    expect(registeredOwner.status).toBe(201)
    expect(registeredOther.status).toBe(201)

    const created = await owner.send('post', '/projects', { name: 'Thumbnail source' })
    expect(created.status).toBe(201)
    projectId = created.body.data.id
  })

  it('project list initially reports hasThumbnail: false', async () => {
    const list = await owner.send('get', '/projects')
    const project = list.body.data.find((item: { id: string }) => item.id === projectId)
    expect(project.hasThumbnail).toBe(false)
  })

  it('GET thumbnail before upload returns 404', async () => {
    const result = await owner.send('get', `/projects/${projectId}/thumbnail`)
    expect(result.status).toBe(404)
  })

  it('uploads a valid WebP and the project list reflects it', async () => {
    const uploaded = await owner.sendRaw('post', `/projects/${projectId}/thumbnail`, VALID_WEBP, 'image/webp')
    expect(uploaded.status).toBe(204)

    const list = await owner.send('get', '/projects')
    const project = list.body.data.find((item: { id: string }) => item.id === projectId)
    expect(project.hasThumbnail).toBe(true)
  })

  it('downloads the thumbnail with a 200 status', async () => {
    const downloaded = await owner.send('get', `/projects/${projectId}/thumbnail`)
    expect(downloaded.status).toBe(200)
  })

  it('rejects a non-WebP upload (fake header, real PNG bytes)', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const result = await owner.sendRaw('post', `/projects/${projectId}/thumbnail`, png, 'image/webp')
    expect(result.status).toBe(400)
  })

  it('another user cannot upload to or read this project\'s thumbnail (404, not 403)', async () => {
    const uploadResult = await other.sendRaw('post', `/projects/${projectId}/thumbnail`, VALID_WEBP, 'image/webp')
    expect(uploadResult.status).toBe(404)

    const readResult = await other.send('get', `/projects/${projectId}/thumbnail`)
    expect(readResult.status).toBe(404)
  })

  it('re-uploading replaces the old asset (old asset row is gone)', async () => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const firstAssetId = before.thumbnailAssetId
    expect(firstAssetId).not.toBeNull()

    const second = await owner.sendRaw('post', `/projects/${projectId}/thumbnail`, VALID_WEBP, 'image/webp')
    expect(second.status).toBe(204)

    const after = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(after.thumbnailAssetId).not.toBe(firstAssetId)

    const orphan = await prisma.asset.findUnique({ where: { id: firstAssetId! } })
    expect(orphan).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails first, if you haven't run Task 8 yet**

Run: `npm run test --workspace=@nail-studio/api -- thumbnail.integration.test.ts`
Expected: If Tasks 1-8 are already done, this should mostly PASS already since it's testing the finished route — this integration test's job is to catch wiring mistakes across the whole stack, not to drive new implementation. If any step fails, read the failure and fix the specific layer it points to (route/service/repository) before proceeding — do not weaken the assertions.

- [ ] **Step 4: Run the full test to verify it passes**

Run: `npm run test --workspace=@nail-studio/api -- thumbnail.integration.test.ts`
Expected: PASS, all `it` blocks green.

- [ ] **Step 5: Run the entire API suite**

Run: `npm run typecheck --workspace=@nail-studio/api && npm run test --workspace=@nail-studio/api`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/__tests__/httpClient.ts apps/api/src/__tests__/thumbnail.integration.test.ts
git commit -m "test: add end-to-end integration coverage for thumbnail upload/download"
```

---

## Task 10: Frontend — raw binary upload helper in `api/client.ts`

**Files:**
- Modify: `apps/web/src/api/client.ts`

**Interfaces:**
- Consumes: nothing new — refactors existing `apiFetch` internals.
- Produces: `export async function apiUploadBinary(path: string, blob: Blob, contentType: string): Promise<void>`. Consumed by Task 13's `useProjects.ts`.

No new test file — this repo has no test infra that mocks `fetch`/network calls (confirmed: no existing `client.ts` test file, and the project's own architecture notes state DOM/network mocking isn't set up). Verified by typecheck plus manual browser verification in Task 14.

- [ ] **Step 1: Extract the CSRF-header logic into a shared helper**

In `apps/web/src/api/client.ts`, replace the inline CSRF logic inside `apiFetch` with a call to a new helper function. Change:

```ts
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}

  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  if (method !== 'GET') {
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) headers[CSRF_HEADER] = csrf
  }
```

to:

```ts
/** แนบโทเคน CSRF ให้ request ที่เปลี่ยนแปลงข้อมูล — ใช้ร่วมกันระหว่าง apiFetch และ apiUploadBinary */
function csrfHeaders(method: string): Record<string, string> {
  if (method === 'GET') return {}
  const csrf = readCookie(CSRF_COOKIE)
  return csrf ? { [CSRF_HEADER]: csrf } : {}
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...csrfHeaders(method),
  }
```

(Remove the now-redundant `if (method !== 'GET') { ... }` block that followed — its logic moved into `csrfHeaders`.)

- [ ] **Step 2: Add `apiUploadBinary`**

At the end of `apps/web/src/api/client.ts`, add:

```ts
/** อัปโหลดไฟล์ไบนารีตรงๆ (ไม่ JSON-encode) — ปลายทางเดียวที่ใช้ตอนนี้คือ thumbnail */
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
        error: {
          code: 'INTERNAL_ERROR',
          message: 'อัปโหลดภาพตัวอย่างไม่สำเร็จ',
          requestId: response.headers.get('x-request-id') ?? 'unknown',
        },
      },
    )
  }
}
```

`ApiError` is already imported at the top of the file (`import type { ApiError, ApiResponse } from '@nail-studio/contracts'`) — no new import needed.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/client.ts
git commit -m "feat: add apiUploadBinary for binary file uploads"
```

---

## Task 11: Frontend — `ThumbnailCapture` component

**Files:**
- Create: `apps/web/src/3d/scene/ThumbnailCapture.tsx`

**Interfaces:**
- Consumes: `useThree` from `@react-three/fiber`, `useDesign` from `@/features/design/DesignStoreProvider.tsx` (existing `focusHome` action), `HOME_POSITION`/`HOME_TARGET` are not directly needed here (camera settling is time-based, not position-polled — see the code below).
- Produces: `export interface ThumbnailCaptureHandle { capture: () => Promise<Blob> }`, `export const ThumbnailCapture` — a `forwardRef` component rendering `null`. Consumed by Task 13's `NailEditor.tsx`.

No test file — this is a thin wrapper around browser Canvas/WebGL APIs with no jsdom/WebGL test environment in this repo (same limitation noted in the hand-proportions and nail-decoration specs for anything touching `<Canvas>` internals). Verified manually in Task 14.

- [ ] **Step 1: Write `ThumbnailCapture.tsx`**

```tsx
import { forwardRef, useImperativeHandle } from 'react'
import { useThree } from '@react-three/fiber'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'

export interface ThumbnailCaptureHandle {
  capture: () => Promise<Blob>
}

// > 500ms ที่ NailFocus.tsx ใช้ถึง ~99.75% ของระยะทางกล้อง (exponential damping,
// k=12: 1 - exp(-12 × 0.5) ≈ 0.9975) ไม่ขึ้นกับระยะเริ่มต้นของกล้อง — ดู
// docs/superpowers/specs/2026-08-15-thumbnail-design.md §4.1
const SETTLE_TIMEOUT_MS = 800

function waitForCameraSettled(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, SETTLE_TIMEOUT_MS))
  })
}

/**
 * Component ลูกใน <NailScene> — ไม่ render อะไรเอง แค่ expose ฟังก์ชัน capture ผ่าน ref
 * ให้ component นอก R3F tree (เช่น NailEditor.tsx) เรียกได้ (แพทเทิร์นเดียวกับที่
 * NailFocus.tsx ใช้ useThree เพื่อเข้าถึง canvas/renderer จากใน scene tree)
 */
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
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/scene/ThumbnailCapture.tsx
git commit -m "feat: add ThumbnailCapture component for canvas screenshot capture"
```

---

## Task 12: Frontend — wire capture into save-version flow

**Files:**
- Modify: `apps/web/src/features/projects/useProjects.ts`
- Modify: `apps/web/src/features/design/NailEditor.tsx`

**Interfaces:**
- Consumes: `apiUploadBinary` (Task 10), `ThumbnailCaptureHandle` (Task 11), `projectKeys` (existing, this file).
- Produces: `export async function captureAndUploadThumbnail(projectId: string, ref: RefObject<ThumbnailCaptureHandle | null>, queryClient: QueryClient): Promise<void>` in `useProjects.ts`. `NailEditor.tsx` renders `<ThumbnailCapture ref={thumbnailRef} />` inside `<NailScene>` and calls `captureAndUploadThumbnail` after a successful version save.

- [ ] **Step 1: Add `captureAndUploadThumbnail` to `useProjects.ts`**

In `apps/web/src/features/projects/useProjects.ts`:

1. Add imports at the top:

```ts
import type { QueryClient } from '@tanstack/react-query'
import { apiFetch, apiUploadBinary } from '@/api/client.ts'
import type { ThumbnailCaptureHandle } from '@/3d/scene/ThumbnailCapture.tsx'
```

(the existing `import { apiFetch } from '@/api/client.ts'` line should be replaced by the combined import above, not duplicated)

2. Add at the end of the file:

```ts
/**
 * Capture + อัปโหลด thumbnail หลังบันทึกเวอร์ชันสำเร็จ — เรียกแบบไม่บล็อก UI การบันทึก
 *
 * จงใจไม่ catch เองในนี้ — ผู้เรียก (NailEditor.tsx) ต้องเป็นคนตัดสินใจว่าจะทำอะไร
 * กับความล้มเหลว (ตอนนี้คือ log อย่างเดียว) เพื่อไม่ให้ error หายไปเงียบๆ จนเทสไม่เห็น
 */
export async function captureAndUploadThumbnail(
  projectId: string,
  ref: RefObject<ThumbnailCaptureHandle | null>,
  queryClient: QueryClient,
): Promise<void> {
  if (!ref.current) return // canvas ยังไม่พร้อม (WebGL ล้ม/ยังโหลดไม่เสร็จ) — ข้ามเงียบๆ
  const blob = await ref.current.capture()
  await apiUploadBinary(`/projects/${projectId}/thumbnail`, blob, 'image/webp')
  void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
}
```

Add `import type { RefObject } from 'react'` to the top imports of `useProjects.ts` (matching how other files in this codebase import React types, e.g. `NailEditor.tsx`'s existing `import { useCallback, useEffect, useRef } from 'react'` style — use a named type import, not a `React.` namespace prefix).

- [ ] **Step 2: Wire into `NailEditor.tsx`**

In `apps/web/src/features/design/NailEditor.tsx`:

1. Add imports:

```ts
import { ThumbnailCapture, type ThumbnailCaptureHandle } from '@/3d/scene/ThumbnailCapture.tsx'
import { captureAndUploadThumbnail } from '@/features/projects/useProjects.ts'
```

(the existing `useProjects.ts` import block already imports several named exports — add `captureAndUploadThumbnail` to that same `import { ... } from '@/features/projects/useProjects.ts'` line rather than a second import statement)

2. Add a ref near the other refs in the component body (near `const [parts, setParts] = useState<HandParts | null>(null)`):

```ts
const thumbnailRef = useRef<ThumbnailCaptureHandle>(null)
```

3. In the save-version button's `onClick` handler, find the line `if (lifecycle.isActive()) explicitSaveUi.current.success(result.versionNumber)` (inside `void autosave.runVersionSave(async ({ document }, lifecycle) => { ... })`) and add immediately after it:

```ts
                if (lifecycle.isActive()) explicitSaveUi.current.success(result.versionNumber)
                void captureAndUploadThumbnail(projectId, thumbnailRef, queryClient).catch((error) => {
                  console.warn('[thumbnail] อัปโหลดภาพตัวอย่างไม่สำเร็จ ไม่กระทบการบันทึกเวอร์ชัน', error)
                })
```

4. Render `<ThumbnailCapture>` inside `<NailScene>`, as a sibling of `<DesignScene>`:

```tsx
            <NailScene fallback={null}>
              <DesignScene
                scale={handScale}
                parts={parts}
                textures={textures}
                onReady={handleReady}
              />
              <ThumbnailCapture ref={thumbnailRef} />
            </NailScene>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/web`
Expected: PASS

- [ ] **Step 4: Run the full web test suite (confirms nothing else broke from the `client.ts`/`useProjects.ts` changes)**

Run: `npm run test --workspace=@nail-studio/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/projects/useProjects.ts apps/web/src/features/design/NailEditor.tsx
git commit -m "feat: capture and upload thumbnail after saving a version"
```

---

## Task 13: Frontend — display thumbnail on the projects list page

**Files:**
- Modify: `apps/web/src/pages/ProjectsPage.tsx`

**Interfaces:**
- Consumes: `project.hasThumbnail` (Task 5's contract change, already flows through `useProjects()`).
- Produces: visual change only — no new exports.

No test file — `ProjectsPage.tsx` has no existing test file either (confirmed: no RTL/jsdom setup in this repo, same limitation noted throughout prior specs). Verified manually in Task 14.

- [ ] **Step 1: Add the thumbnail image/placeholder to the project card**

In `apps/web/src/pages/ProjectsPage.tsx`, add a constant near the top of the file (after imports):

```ts
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
```

Inside the `<li key={project.id} className="card project-card">` block, add the thumbnail markup as the first child of the `<Link>` (before the existing `<span className="project-name">`):

```tsx
            <Link to={`/editor/${project.id}`} className="project-link">
              {project.hasThumbnail ? (
                <img
                  src={`${API_BASE}/api/v1/projects/${project.id}/thumbnail`}
                  crossOrigin="use-credentials"
                  alt={`ภาพตัวอย่างของ ${project.name}`}
                  loading="lazy"
                  className="project-thumbnail"
                />
              ) : (
                <div className="project-thumbnail-placeholder" aria-hidden="true" />
              )}
              <span className="project-name">{project.name}</span>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=@nail-studio/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/ProjectsPage.tsx
git commit -m "feat: show thumbnail image on the projects list page"
```

---

## Task 14: Manual browser verification + close out Slice 4 item 6

**Files:**
- Modify: `docs/implementation-plan.md`

**Interfaces:** None — verification and documentation only.

- [ ] **Step 1: Start the full stack**

Run: `npm run dev:api` (in one terminal) and `npm run dev:web` (in another). Confirm both start without errors and `STORAGE_ROOT` (default `./storage`) is writable — if `./storage` doesn't exist, `LocalDiskProvider.put()` creates it automatically on first write via `mkdir(..., { recursive: true })`, so no manual setup is needed.

- [ ] **Step 2: Manual browser checks**

1. Open the app, log in (or register), open the projects list — every existing project shows the placeholder (no thumbnail yet).
2. Create a new project, open the editor, paint a stroke on a nail, click "บันทึกเป็นเวอร์ชัน".
3. Go back to the projects list — the new project now shows a real rendered image of the hand (not the placeholder), framed as "ดูทั้งมือ" regardless of what camera angle you were at when you clicked save.
4. Open browser devtools → Network tab, reload the projects list — confirm the thumbnail `<img>` request returns `200` with `Content-Type: image/webp`.
5. In the address bar, manually navigate to `http://localhost:4000/api/v1/projects/<some-other-project-id-you-don't-own>/thumbnail` (use an id from a different account, or an id that doesn't exist) — confirm you get a 404 JSON error, not an image and not a 403.
6. Save a second version on the same project after changing the design — confirm the thumbnail updates to reflect the new state (not stuck on the first version's image) within a few seconds (allow for the `Cache-Control: max-age=60` — a hard refresh should show it immediately).

If any check fails, fix the underlying code before proceeding — do not mark this task done on faith.

- [ ] **Step 3: Update `docs/implementation-plan.md`**

Find the Slice 4 §6 line (currently `6. Thumbnail: capture จาก canvas → WebP → `StorageProvider``). Mark it done in the same style as item 5's close-out note:

```markdown
6. [x] Thumbnail: capture จาก canvas → WebP → `StorageProvider`
   - เพิ่ม `StorageProvider`/`LocalDiskProvider`, ตาราง `assets` + `projects.thumbnail_asset_id`,
     `POST`/`GET /projects/:id/thumbnail`, และฝั่ง frontend capture+upload อัตโนมัติหลังบันทึก
     เวอร์ชัน ตาม `docs/superpowers/plans/2026-08-15-thumbnail.md` และ
     `docs/superpowers/specs/2026-08-15-thumbnail-design.md` — ยืนยันบนเบราว์เซอร์จริงแล้ว
     (7 ข้อตรวจใน Step 2 ของแผน implementation ผ่านครบ) `S3Provider` ยังไม่ทำ (D-35, รอ Slice 8)
```

- [ ] **Step 4: Run the full monorepo test suite one last time**

Run: `npm run typecheck && npm run test`
Expected: PASS across `apps/api`, `apps/web`, and `@nail-studio/contracts`

- [ ] **Step 5: Commit**

```bash
git add docs/implementation-plan.md
git commit -m "docs: close out thumbnail capture (Slice 4 item 6)"
```
