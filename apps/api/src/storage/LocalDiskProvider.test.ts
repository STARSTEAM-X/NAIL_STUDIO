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
