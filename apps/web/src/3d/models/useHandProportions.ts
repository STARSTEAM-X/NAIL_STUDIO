import { useEffect } from 'react'
import { MeshStandardMaterial, type SkinnedMesh } from 'three'
import type { HandSettings } from '@nail-studio/contracts'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import type { HandParts } from './PartsRegistry.ts'
import { applyProportions, refreshSkinnedBounds } from './handProportions.ts'

/** ตัดสินใจล้วน ๆ ว่าต้อง apply สัดส่วน/สีผิวใหม่ไหม — แยกออกมาให้เทสได้โดยไม่ต้อง mount */
export function shouldApplyHand(current: HandSettings, last: HandSettings | undefined): boolean {
  return current !== last
}

/**
 * ผูกสไลเดอร์สัดส่วนมือ/สีผิวเข้ากับบอร์น+วัสดุจริงของโมเดลที่โหลดอยู่
 *
 * ใช้ store.subscribe ตรง ๆ (ไม่ใช่ useDesign selector) แบบเดียวกับ useNailTextures.ts
 * เพราะต้องรันครั้งเดียวต่อการเปลี่ยน document.hand หนึ่งครั้ง ไม่ใช่ทุก re-render
 * ที่ไม่เกี่ยวข้อง — เทียบด้วย reference ผ่าน shouldApplyHand
 */
export function useHandProportions(parts: HandParts | null): void {
  const store = useDesignStoreApi()

  useEffect(() => {
    if (!parts) return undefined

    let last: HandSettings | undefined

    const apply = (hand: HandSettings): void => {
      if (!shouldApplyHand(hand, last)) return
      applyProportions(parts.bones, hand.proportions)
      if (!(parts.skin.material instanceof MeshStandardMaterial)) {
        throw new Error(
          `วัสดุผิวมือไม่ใช่ MeshStandardMaterial (ได้ ${parts.skin.material.constructor.name}) — ตั้งสีผิวไม่ได้`,
        )
      }
      parts.skin.material.color.set(hand.skinTone)
      const skinnedMeshes = [...parts.nails.values(), parts.skin]
        .filter((mesh): mesh is SkinnedMesh => (mesh as SkinnedMesh).isSkinnedMesh === true)
      refreshSkinnedBounds(skinnedMeshes)
      last = hand
    }

    apply(store.getState().document.hand)
    const unsubscribe = store.subscribe((state) => apply(state.document.hand))
    return unsubscribe
  }, [parts, store])
}
