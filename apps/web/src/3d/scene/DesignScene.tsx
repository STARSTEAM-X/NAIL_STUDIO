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

export function DesignScene({ scale, parts, textures, onReady }: Props) {
  const mode = useDesign((state) => state.mode)
  useHandProportions(parts)
  return (
    <>
      <HandModel scale={scale} onReady={onReady} />
      {parts && <NailFocus parts={parts} />}
      {parts && textures && mode === 'paint' && <PaintController parts={parts} textures={textures} />}
      {parts && mode === 'decorate' && <TransformController parts={parts} />}
      {parts && <DecorationInstances parts={parts} />}
    </>
  )
}
