import {
  DECORATION_CATALOG,
  DECORATION_CATEGORY_LABELS,
  type DecorationCategory,
} from '@/3d/decorations/decorationCatalog.ts'
import { useDesign } from './DesignStoreProvider.tsx'
import { primaryOf } from './designStore.ts'

/**
 * แผงของตกแต่ง — เลือกจาก catalog มาวางกลางเล็บที่เลือกอยู่ (D-30) และปรับ
 * หมุน/ย่อขยาย/ลบของตกแต่งที่กำลังเลือกอยู่ผ่านตัวเลข ไม่มี 3D gizmo (D-29)
 *
 * แสดงเฉพาะตอนอยู่โหมด "ของตกแต่ง" — สลับโหมดทำที่ปุ่มใน PaintToolbar
 */
export function DecorationPanel() {
  const mode = useDesign((state) => state.mode)
  const selection = useDesign((state) => state.selection)
  const selectedDecoration = useDesign((state) => state.selectedDecoration)
  const addDecoration = useDesign((state) => state.addDecoration)
  const removeDecoration = useDesign((state) => state.removeDecoration)
  const moveDecoration = useDesign((state) => state.moveDecoration)
  const scaleDecoration = useDesign((state) => state.scaleDecoration)
  const nail = useDesign((state) => state.document.nails[primaryOf(state.selection)])

  if (mode !== 'decorate') return null

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
    <aside className="toolbar" aria-label="ของตกแต่ง">
      <div className="field">
        เพิ่มของตกแต่ง
        <div className="decoration-catalog">
          {categories.map((category) => (
            <div className="decoration-category" key={category}>
              <span className="decoration-category-label">{DECORATION_CATEGORY_LABELS[category]}</span>
              <div className="swatches">
                {DECORATION_CATALOG.filter((entry) => entry.category === category).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="chip"
                    aria-label={entry.label}
                    title={entry.label}
                    onClick={() => handleAdd(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <>
          <label className="field">
            หมุน {Math.round((selected.rotation * 180) / Math.PI)}°
            <input
              type="range" min={0} max={360} step={1}
              value={Math.round((selected.rotation * 180) / Math.PI)}
              onChange={(event) => {
                const degrees = Number(event.target.value)
                moveDecoration(
                  activeKey, selected.id, selected.u, selected.v, (degrees * Math.PI) / 180,
                  `decoration-rotate:${activeKey}:${selected.id}`,
                )
              }}
            />
          </label>

          <label className="field">
            ขนาด {Math.round(selected.scale * 100)}%
            <input
              type="range" min={10} max={100} step={1}
              value={Math.round(selected.scale * 100)}
              onChange={(event) => scaleDecoration(
                activeKey, selected.id, Number(event.target.value) / 100,
                `decoration-scale:${activeKey}:${selected.id}`,
              )}
            />
          </label>

          <button
            type="button"
            className="btn btn-ghost btn-danger"
            onClick={() => removeDecoration(activeKey, selected.id)}
          >
            ลบ
          </button>
        </>
      )}
    </aside>
  )
}
