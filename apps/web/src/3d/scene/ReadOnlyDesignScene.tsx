import { useCallback, useState } from 'react'
import { DecorationInstances } from '@/3d/decorations/DecorationInstances.tsx'
import { HandModel, type HandParts } from '@/3d/models/HandModel.tsx'
import { useHandProportions } from '@/3d/models/useHandProportions.ts'
import { useNailTextures } from '@/3d/painting/useNailTextures.ts'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'

/** ฉาก template แบบดูอย่างเดียว — ไม่มี toolbar, history, painting หรือ transform controller */
export function ReadOnlyDesignScene() {
  const [parts, setParts] = useState<HandParts | null>(null)
  const handScale = useDesign((state) => state.document.hand.proportions.handScale)
  const textures = useNailTextures(parts)
  useHandProportions(parts)
  const handleReady = useCallback((next: HandParts) => setParts(next), [])

  return (
    <>
      <HandModel scale={handScale} onReady={handleReady} />
      {parts && textures && <DecorationInstances parts={parts} />}
    </>
  )
}
