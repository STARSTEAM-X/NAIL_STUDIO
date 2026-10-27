import { del, get, put } from '@vercel/blob'
import type { ObjectMeta, StorageProvider, StoredObject } from './StorageProvider.ts'

/** ส่วนของ @vercel/blob ที่ใช้จริง — แยกออกมาให้เทสส่งตัวปลอมเข้ามาแทนได้ */
export interface BlobClient {
  put: typeof put
  get: typeof get
  del: typeof del
}

/**
 * เก็บไฟล์ใน Vercel Blob แบบ private
 *
 * ไฟล์ของผู้ใช้ต้องผ่านการตรวจสิทธิ์ของ API ทุกครั้ง (ดู loadThumbnail) จึงห้ามใช้ public
 * ซึ่งจะได้ URL ที่ใครถือก็เปิดได้ — ใช้ key ของระบบเป็น pathname ตรง ๆ เพื่อให้ storage_key
 * ใน DB เหมือนกันทุก driver และย้ายไฟล์ข้าม driver ได้โดยไม่ต้องแก้ข้อมูล
 */
export class VercelBlobProvider implements StorageProvider {
  private readonly token: string
  private readonly client: BlobClient

  constructor(token: string, client: BlobClient = { put, get, del }) {
    this.token = token
    this.client = client
  }

  private checkKey(key: string): string {
    // key มาจากระบบเอง (uuid) แต่กันไว้อีกชั้นเหมือน LocalDiskProvider
    if (!key || key.startsWith('/') || key.split('/').some((part) => part === '..' || part === '')) {
      throw new Error(`storage key ไม่ถูกต้อง: ${key}`)
    }
    return key
  }

  async put(key: string, data: Buffer, meta: ObjectMeta): Promise<StoredObject> {
    await this.client.put(this.checkKey(key), data, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: meta.contentType,
      token: this.token,
    })
    return { key, sizeBytes: data.byteLength }
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.get(this.checkKey(key), { access: 'private', useCache: false, token: this.token })
    if (!result || result.statusCode !== 200) {
      // ให้หน้าตาเหมือน readFile ของ LocalDiskProvider เมื่อไม่มีไฟล์
      throw Object.assign(new Error(`ไม่พบไฟล์ใน storage: ${key}`), { code: 'ENOENT' })
    }
    return Buffer.from(await new Response(result.stream).arrayBuffer())
  }

  async delete(key: string): Promise<void> {
    // del ของ Blob ไม่ error เมื่อไม่มีไฟล์อยู่แล้ว — idempotent เหมือน rm({ force: true })
    await this.client.del(this.checkKey(key), { token: this.token })
  }
}
