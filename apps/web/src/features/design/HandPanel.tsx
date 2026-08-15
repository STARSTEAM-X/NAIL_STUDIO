import type { HandSettings } from '@nail-studio/contracts'
import { useDesign } from './DesignStoreProvider.tsx'

const PROPORTION_RANGES: Record<keyof HandSettings['proportions'], { min: number; max: number }> = {
  handScale: { min: 0.8, max: 1.2 },
  palmWidth: { min: 0.7, max: 1.3 },
  fingerLength: { min: 0.7, max: 1.3 },
  fingerWidth: { min: 0.7, max: 1.3 },
}

const PROPORTION_LABELS: Record<keyof HandSettings['proportions'], string> = {
  handScale: 'ขนาดมือ',
  palmWidth: 'ความกว้างฝ่ามือ',
  fingerLength: 'ความยาวนิ้ว',
  fingerWidth: 'ความกว้างนิ้ว',
}

const PROPORTION_KEYS = Object.keys(PROPORTION_RANGES) as Array<keyof HandSettings['proportions']>

/** แผงปรับสัดส่วนมือ + สีผิว — แยกจาก PaintToolbar/DecorationPanel เพราะเป็นการตั้งค่า
 * ระดับ "ทั้งมือ" คนละ scope กับเลเยอร์/ของตกแต่งที่เป็นระดับ "ต่อเล็บ" (D-34) */
export function HandPanel() {
  const proportions = useDesign((state) => state.document.hand.proportions)
  const skinTone = useDesign((state) => state.document.hand.skinTone)
  const setProportions = useDesign((state) => state.setProportions)
  const setSkinTone = useDesign((state) => state.setSkinTone)

  return (
    <aside className="toolbar" aria-label="สัดส่วนมือและสีผิว">
      <h2>มือ</h2>

      <label className="field">
        สีผิว
        <input
          type="color"
          value={skinTone}
          onChange={(event) => setSkinTone(event.target.value)}
        />
      </label>

      {PROPORTION_KEYS.map((key) => {
        const range = PROPORTION_RANGES[key]
        return (
          <label className="field" key={key}>
            {PROPORTION_LABELS[key]} {Math.round(proportions[key] * 100)}%
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={0.01}
              value={proportions[key]}
              onChange={(event) => setProportions(
                { [key]: Number(event.target.value) },
                `hand-proportions:${key}`,
              )}
            />
          </label>
        )
      })}
    </aside>
  )
}
