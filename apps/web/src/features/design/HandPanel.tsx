import type { HandSettings } from '@nail-studio/contracts'
import { useDesign } from './DesignStoreProvider.tsx'
import { SliderField } from './SliderField.tsx'

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
    <aside className="toolbar toolbar-paint" aria-label="สัดส่วนมือและสีผิว">
      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>สีผิว</span>
        </div>
        <label className="field">
          เลือกสีผิว
          <input
            type="color"
            className="swatch-picker swatch-picker-wide"
            value={skinTone}
            onChange={(event) => setSkinTone(event.target.value)}
          />
        </label>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>สัดส่วน</span>
          <span className="toolbar-section-kicker">ทั้งมือ</span>
        </div>
        {PROPORTION_KEYS.map((key) => {
          const range = PROPORTION_RANGES[key]
          return (
            <SliderField
              key={key}
              label={PROPORTION_LABELS[key]}
              suffix="%"
              min={Math.round(range.min * 100)}
              max={Math.round(range.max * 100)}
              value={Math.round(proportions[key] * 100)}
              onChange={(percent) => setProportions(
                { [key]: percent / 100 },
                `hand-proportions:${key}`,
              )}
            />
          )
        })}
      </div>
    </aside>
  )
}
