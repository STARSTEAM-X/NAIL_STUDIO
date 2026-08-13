import { useEffect, useState } from 'react'
import { CanvasTexture, RepeatWrapping, type MeshPhysicalMaterial } from 'three'
import type { NailKey } from '@nail-studio/contracts'
import {
  applyFinish,
  browserCanvasFactory,
  createNailMaterial,
  createSparkleNormalMap,
  type FinishId,
} from '@/3d/materials/finishes.ts'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import { NailTextureSet } from './NailTextureSet.ts'

/**
 * ผูกเท็กซ์เจอร์ที่ผลิตจากเอกสารงานเข้ากับ mesh เล็บที่กำลังแสดงอยู่
 *
 * ทั้งชุดถูกสร้างใหม่เมื่อ parts เปลี่ยน (เปลี่ยนมือ หรือโหลดโมเดลใหม่) เพราะ
 * วัสดุผูกกับ mesh หนึ่งต่อหนึ่ง การพยายามใช้ชุดเดิมข้ามการเปลี่ยนมือจะทำให้
 * วัสดุของนิ้วซ้ายไปแปะบน mesh ที่ตอนนี้แทนนิ้วขวา
 */
export function useNailTextures(parts: HandParts | null): NailTextureSet | null {
  const store = useDesignStoreApi()
  const [textures, setTextures] = useState<NailTextureSet | null>(null)

  useEffect(() => {
    if (!parts) return undefined

    const set = new NailTextureSet({
      factory: browserCanvasFactory,
      read: () => store.getState().document,
    })
    const keys = [...parts.nails.keys()]
    set.setVisibleNails(keys)

    const maps = new Map<NailKey, CanvasTexture>()
    const materials = new Map<NailKey, MeshPhysicalMaterial>()
    for (const [key, mesh] of parts.nails) {
      // composite ทึบมาตั้งแต่ต้นทางแล้ว (ดู NAIL_BASE_COLOR) จึงป้อนเข้า CanvasTexture
      // ได้ตรง ๆ ไม่ต้องมีแคนวาสอีกชุดคอยรองพื้นให้ทุกครั้งที่ลากนิ้ว
      const texture = new CanvasTexture(set.composite(key) as HTMLCanvasElement)
      const material = createNailMaterial(texture)
      maps.set(key, texture)
      materials.set(key, material)
      mesh.material = material
    }

    const sparkle = new CanvasTexture(
      createSparkleNormalMap(browserCanvasFactory) as HTMLCanvasElement,
    )
    sparkle.wrapS = RepeatWrapping
    sparkle.wrapT = RepeatWrapping
    sparkle.repeat.set(3, 3)

    // จำค่าที่ตั้งไปแล้วไว้เทียบ เพราะ subscribe ยิงทุกการเปลี่ยนแปลงของ store
    // ถ้าเรียก applyFinish ทุกครั้ง จะเป็นการสั่งคอมไพล์เชดเดอร์ใหม่ทุกครั้งที่วาดเสร็จ
    const applied = new Map<NailKey, FinishId>()
    const syncFinish = (key: NailKey): void => {
      const material = materials.get(key)
      if (!material) return
      const finish = store.getState().document.nails[key].finish
      if (applied.get(key) === finish) return
      applied.set(key, finish)
      applyFinish(material, finish, sparkle)
    }
    for (const key of keys) syncFinish(key)

    const offTexture = set.onUpdate((key) => {
      const map = maps.get(key)
      if (map) map.needsUpdate = true
    })

    let previous = store.getState().document
    const unsubscribe = store.subscribe((state) => {
      const next = state.document
      if (next === previous) return
      // เทียบ identity ทีละนิ้ว — O(5) ต่อการเปลี่ยนแปลงหนึ่งครั้ง และเป็นไปได้
      // ก็เพราะ store รักษา identity ของเล็บที่ไม่ถูกแก้ไว้ (ค่าคงตัวข้อ 2)
      for (const key of keys) {
        if (next.nails[key] === previous.nails[key]) continue
        set.rebuild(key)
        syncFinish(key)
      }
      previous = next
    })

    for (const map of maps.values()) map.needsUpdate = true
    setTextures(set)

    return () => {
      offTexture()
      unsubscribe()
      set.dispose()
      for (const map of maps.values()) map.dispose()
      for (const material of materials.values()) material.dispose()
      sparkle.dispose()
      setTextures(null)
    }
  }, [parts, store])

  return textures
}
