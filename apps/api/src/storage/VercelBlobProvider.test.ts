import { describe, expect, it } from 'vitest'
import { VercelBlobProvider, type BlobClient } from './VercelBlobProvider.ts'

/** Blob store ปลอมในหน่วยความจำ — เลียนพฤติกรรม get คืน null เมื่อไม่มีไฟล์ และ del ไม่ error */
function fakeBlob() {
  const files = new Map<string, Buffer>()
  const calls: { put: unknown[]; get: unknown[]; del: unknown[] } = { put: [], get: [], del: [] }
  const client = {
    put: async (pathname: string, body: Buffer, options: unknown) => {
      calls.put.push(options)
      files.set(pathname, Buffer.from(body))
      return { pathname }
    },
    get: async (pathname: string, options: unknown) => {
      calls.get.push(options)
      const data = files.get(pathname)
      if (!data) return null
      return { statusCode: 200, stream: new Blob([new Uint8Array(data)]).stream() }
    },
    del: async (pathname: string, options: unknown) => {
      calls.del.push(options)
      files.delete(pathname)
    },
  } as unknown as BlobClient
  return { client, files, calls }
}

describe('VercelBlobProvider', () => {
  it('put/get round-trip returns the exact bytes written, stored as private', async () => {
    const blob = fakeBlob()
    const provider = new VercelBlobProvider('token-x', blob.client)
    const data = Buffer.from('hello world')

    expect(await provider.put('thumbnails/2026/a.webp', data, { contentType: 'image/webp' }))
      .toEqual({ key: 'thumbnails/2026/a.webp', sizeBytes: data.byteLength })
    expect(await provider.get('thumbnails/2026/a.webp')).toEqual(data)
    expect(blob.calls.put[0]).toMatchObject({ access: 'private', addRandomSuffix: false, contentType: 'image/webp', token: 'token-x' })
    expect(blob.calls.get[0]).toMatchObject({ access: 'private', token: 'token-x' })
  })

  it('omits the token so @vercel/blob falls back to OIDC + BLOB_STORE_ID', async () => {
    const blob = fakeBlob()
    const provider = new VercelBlobProvider(undefined, blob.client)
    await provider.put('a/b.webp', Buffer.from('x'), { contentType: 'image/webp' })
    await provider.get('a/b.webp')
    await provider.delete('a/b.webp')
    for (const options of [blob.calls.put[0], blob.calls.get[0], blob.calls.del[0]]) {
      expect(options).not.toHaveProperty('token')
    }
  })

  it('get of a missing key throws an ENOENT error like the local driver', async () => {
    const provider = new VercelBlobProvider('t', fakeBlob().client)
    await expect(provider.get('thumbnails/missing.webp')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('delete is idempotent', async () => {
    const blob = fakeBlob()
    const provider = new VercelBlobProvider('t', blob.client)
    await provider.put('a/b.webp', Buffer.from('x'), { contentType: 'image/webp' })
    await provider.delete('a/b.webp')
    await expect(provider.delete('a/b.webp')).resolves.toBeUndefined()
    expect(blob.files.size).toBe(0)
  })

  it.each(['../escape.webp', '/abs.webp', 'a//b.webp', 'a/../../b.webp', ''])('rejects unsafe key %j', async (key) => {
    const provider = new VercelBlobProvider('t', fakeBlob().client)
    await expect(provider.put(key, Buffer.from('x'), { contentType: 'image/webp' })).rejects.toThrow()
  })
})
