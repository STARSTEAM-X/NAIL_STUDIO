import {
  DECORATION_CATALOG,
  DECORATION_CATEGORY_LABELS,
  type DecorationCategory,
} from '@/3d/decorations/decorationCatalog.ts'
import { Icon } from '@/components/Icon.tsx'
import { useDesign } from './DesignStoreProvider.tsx'
import { primaryOf } from './designStore.ts'
import { SliderField } from './SliderField.tsx'

/**
 * แผงของตกแต่ง — เลือกจาก catalog มาวางกลางเล็บที่เลือกอยู่ (D-30) และปรับ
 * หมุน/ย่อขยาย/ลบของตกแต่งที่กำลังเลือกอยู่ผ่านตัวเลข ไม่มี 3D gizmo (D-29)
 */
export function DecorationPanel() {
  const mode = useDesign((state) => state.mode)
  const setMode = useDesign((state) => state.setMode)
  const selection = useDesign((state) => state.selection)
  const selectedDecoration = useDesign((state) => state.selectedDecoration)
  const addDecoration = useDesign((state) => state.addDecoration)
  const removeDecoration = useDesign((state) => state.removeDecoration)
  const moveDecoration = useDesign((state) => state.moveDecoration)
  const scaleDecoration = useDesign((state) => state.scaleDecoration)
  const nail = useDesign((state) => state.document.nails[primaryOf(state.selection)])

  // เดิมคืน null ตรงนี้ ผู้ใช้ที่กดแท็บ "ตกแต่ง" มาจึงเห็นแค่หัวข้อกับพื้นว่าง
  // โดยไม่มีอะไรบอกว่าเกิดอะไรขึ้นหรือต้องทำอะไรต่อ
  if (mode !== 'decorate') {
    return (
      <aside className="toolbar toolbar-paint" aria-label="ของตกแต่ง">
        <div className="panel-empty">
          <Icon name="sparkle" size={26} />
          <p>ยังไม่ได้อยู่ในโหมดตกแต่ง</p>
          <p className="hint">
            โหมดตกแต่งจะปิดการวาดชั่วคราว เพื่อให้คลิกบนเล็บเป็นการเลือกของตกแต่งแทน
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setMode('decorate')}>
            เข้าสู่โหมดตกแต่ง
          </button>
        </div>
      </aside>
    )
  }

  const activeKey = primaryOf(selection)
  const selected = selectedDecoration && selectedDecoration.key === activeKey
    ? nail.decorations.find((decoration) => decoration.id === selectedDecoration.decorationId) ?? null
    : null

  const handleAdd = (catalogId: string) => {
    addDecoration(activeKey, {
      id: `deco-${crypto.randomUUID()}`,
      catalogId,
      u: 0.5,
      v: 0.5,
      rotation: 0,
      scale: 0.3,
    })
  }

  const categories = Object.keys(DECORATION_CATEGORY_LABELS) as DecorationCategory[]

  return (
    <aside className="toolbar toolbar-paint" aria-label="ของตกแต่ง">
      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>เพิ่มของตกแต่ง</span>
          <span className="toolbar-section-kicker">วางกลางเล็บที่เลือก</span>
        </div>
        <div className="decoration-catalog">
          {categories.map((category) => (
            <div className="decoration-category" key={category}>
              <span className="decoration-category-label">{DECORATION_CATEGORY_LABELS[category]}</span>
              <div className="swatches">
                {DECORATION_CATALOG.filter((entry) => entry.category === category).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="chip decoration-chip"
                    aria-label={`เพิ่ม${entry.label}`}
                    data-tooltip={entry.label}
                    onClick={() => handleAdd(entry.id)}
                  >
                    <span
                      className="decoration-chip-dot"
                      style={{ background: entry.defaultColor }}
                      aria-hidden="true"
                    />
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="toolbar-section">
          <div className="toolbar-section-title">
            <span>ชิ้นที่เลือก</span>
          </div>
          <SliderField
            label="หมุน"
            suffix="°"
            min={0}
            max={360}
            value={Math.round((selected.rotation * 180) / Math.PI)}
            onChange={(degrees) => moveDecoration(
              activeKey, selected.id, selected.u, selected.v, (degrees * Math.PI) / 180,
              `decoration-rotate:${activeKey}:${selected.id}`,
            )}
          />
          <SliderField
            label="ขนาด"
            suffix="%"
            min={10}
            max={100}
            value={Math.round(selected.scale * 100)}
            onChange={(percent) => scaleDecoration(
              activeKey, selected.id, percent / 100,
              `decoration-scale:${activeKey}:${selected.id}`,
            )}
          />
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            onClick={() => removeDecoration(activeKey, selected.id)}
          >
            <Icon name="trash" size={15} /> ลบชิ้นนี้
          </button>
        </div>
      ) : (
        <p className="hint">คลิกของตกแต่งบนเล็บเพื่อปรับหมุนและขนาด</p>
      )}
    </aside>
  )
}
