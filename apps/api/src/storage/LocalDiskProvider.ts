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
