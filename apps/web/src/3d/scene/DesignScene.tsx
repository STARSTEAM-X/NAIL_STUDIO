import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { HandModel, type HandParts } from '@/3d/models/HandModel.tsx'
import { PaintController } from '@/3d/painting/PaintController.tsx'
import { TransformController } from '@/3d/interactions/TransformController.tsx'
import type { NailTextureSet } from '@/3d/painting/NailTextureSet.ts'
import { DecorationInstances } from '@/3d/decorations/DecorationInstances.tsx'
import { useHandProportions } from '@/3d/models/useHandProportions.ts'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'
import { NailFocus } from './NailFocus.tsx'

interface Props {
  scale: number
  parts: HandParts | null
  textures: NailTextureSet | null
  onReady: (parts: HandParts) => void
}

/**
 * CanvasTexture is mutated outside React. Explicitly invalidate the R3F loop
 * after a live paint update so the new canvas pixels are uploaded immediately,
 * including when the renderer is running in demand mode.
 */
function LiveTextureInvalidator({ textures }: { textures: NailTextureSet }) {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => textures.onUpdate(() => invalidate()), [textures, invalidate])

  return null
}

export function DesignScene({ scale, parts, textures, onReady }: Props) {
  const mode = useDesign((state) => state.mode)
  useHandProportions(parts)
  return (
    <>
      <HandModel scale={scale} onReady={onReady} />
      {parts && <NailFocus parts={parts} />}
      {textures && <LiveTextureInvalidator textures={textures} />}
      {parts && textures && mode === 'paint' && <PaintController parts={parts} textures={textures} />}
      {parts && mode === 'decorate' && <TransformController parts={parts} />}
      {parts && <DecorationInstances parts={parts} />}
    </>
  )
}
