import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AppError } from '../errors/AppError.ts'

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