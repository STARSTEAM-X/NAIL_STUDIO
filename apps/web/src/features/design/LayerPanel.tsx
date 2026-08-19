import { useState } from 'react'
import { BLEND_MODES, MAX_LAYERS_PER_NAIL, type Layer } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { useDesign } from './DesignStoreProvider.tsx'
import { primaryOf } from './designStore.ts'
import { SliderField } from './SliderField.tsx'

const BLEND_LABELS: Record<Layer['blend'], string> = {
  normal: 'ปกติ',
  multiply: 'ทวีคูณ',
  screen: 'สกรีน',
}

/**
 * แผงเลเยอร์ของเล็บที่เลือกอยู่
 *
 * คลิก = เลือกเลเยอร์ ดับเบิลคลิก (หรือปุ่มดินสอ) = เปลี่ยนชื่อ
 * เดิมคลิกครั้งเดียวเข้าโหมดเปลี่ยนชื่อทันที ซึ่งขัดกับทุกเครื่องมือที่มีเลเยอร์ —
 * ผู้ใช้ที่แค่อยากสลับเลเยอร์จะเผลอแก้ชื่อทุกครั้งที่กด
 */
export function LayerPanel() {
  const selection = useDesign((state) => state.selection)
  const nailKey = primaryOf(selection)
  const layers = useDesign((state) => state.document.nails[nailKey].layers)
  const activeLayerId = useDesign((state) => state.activeLayerId(nailKey))
  const selectLayer = useDesign((state) => state.selectLayer)
  const addLayer = useDesign((state) => state.addLayer)
  const removeLayer = useDesign((state) => state.removeLayer)
  const renameLayer = useDesign((state) => state.renameLayer)
  const setLayerVisibility = useDesign((state) => state.setLayerVisibility)
  const setLayerOpacity = useDesign((state) => state.setLayerOpacity)
  const setLayerBlend = useDesign((state) => state.setLayerBlend)
  const moveLayer = useDesign((state) => state.moveLayer)
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const beginRename = (layer: Layer) => {
    selectLayer(nailKey, layer.id)
    setEditingLayerId(layer.id)
    setDraftName(layer.name)
  }

  const cancelRename = () => {
    setEditingLayerId(null)
    setDraftName('')
  }

  const commitRename = (layer: Layer) => {
    const value = draftName.trim()
    if (value !== layer.name) {
      renameLayer(nailKey, layer.id, value, `layer-name:${nailKey}:${layer.id}`)
    }
    cancelRename()
  }

  const add = () => {
    addLayer(nailKey, {
      id: `layer-${crypto.randomUUID()}`,
      name: `เลเยอร์ ${layers.length + 1}`,
      visible: true,
      opacity: 1,
      blend: 'normal',
      strokes: [],
    })
  }

  return (
    <section className="layer-panel" aria-label="เลเยอร์ของเล็บที่เลือก">
      <div className="layer-panel-head">
        <div>
          <h2>เลเยอร์</h2>
          <p className="hint">ดับเบิลคลิกที่ชื่อเพื่อเปลี่ยนชื่อ</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={layers.length >= MAX_LAYERS_PER_NAIL}
          onClick={add}
        >
          <Icon name="plus" size={15} /> เพิ่ม
        </button>
      </div>

      <div className="layer-list">
        {layers.map((layer, index) => {
          const active = layer.id === activeLayerId
          const editing = layer.id === editingLayerId
          const name = layer.name || `เลเยอร์ ${index + 1}`
          return (
            <article key={layer.id} className={`layer-card ${active ? 'layer-card-active' : ''}`}>
              <div className="layer-card-head">
                <button
                  type="button"
                  className="layer-visibility"
                  aria-label={layer.visible ? `ซ่อน${name}` : `แสดง${name}`}
                  aria-pressed={layer.visible}
                  data-tooltip={layer.visible ? 'ซ่อนเลเยอร์' : 'แสดงเลเยอร์'}
                  onClick={() => setLayerVisibility(nailKey, layer.id, !layer.visible)}
                >
                  <Icon name={layer.visible ? 'eye' : 'eye-off'} size={14} />
                </button>

                {editing ? (
                  <input
                    className="layer-name-input"
                    autoFocus
                    value={draftName}
                    maxLength={60}
                    aria-label={`ชื่อเลเยอร์ ${index + 1}`}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => commitRename(layer)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        event.currentTarget.blur()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelRename()
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="layer-select"
                    aria-pressed={active}
                    aria-expanded={active}
                    onClick={() => selectLayer(nailKey, layer.id)}
                    onDoubleClick={() => beginRename(layer)}
                  >
                    <span className="layer-select-name">{name}</span>
                    {layer.opacity < 1 && (
                      <span className="layer-select-meta">{Math.round(layer.opacity * 100)}%</span>
                    )}
                  </button>
                )}

                {/*
                  ดับเบิลคลิกเป็นทางเดียวไม่พอ — คนที่ใช้คีย์บอร์ดล้วนหรือจอสัมผัส
                  จะเปลี่ยนชื่อเลเยอร์ไม่ได้เลย ปุ่มนี้จึงเป็นทางเข้าที่โฟกัสถึงได้
                */}
                <button
                  type="button"
                  className="layer-icon-button"
                  aria-label={`เปลี่ยนชื่อ${name}`}
                  data-tooltip="เปลี่ยนชื่อ"
                  onClick={() => beginRename(layer)}
                >
                  <Icon name="pencil" size={14} />
                </button>
                <button
                  type="button"
                  className="layer-icon-button"
                  disabled={index === 0}
                  aria-label={`เลื่อน${name}ขึ้น`}
                  data-tooltip="เลื่อนขึ้น"
                  onClick={() => moveLayer(nailKey, layer.id, index - 1)}
                >
                  <Icon name="arrow-up" size={14} />
                </button>
                <button
                  type="button"
                  className="layer-icon-button"
                  disabled={index === layers.length - 1}
                  aria-label={`เลื่อน${name}ลง`}
                  data-tooltip="เลื่อนลง"
                  onClick={() => moveLayer(nailKey, layer.id, index + 1)}
                >
                  <Icon name="arrow-down" size={14} />
                </button>
                <button
                  type="button"
                  className="layer-icon-button layer-icon-button-danger"
                  disabled={layers.length <= 1}
                  aria-label={`ลบ${name}`}
                  data-tooltip="ลบเลเยอร์"
                  data-tooltip-side="left"
                  onClick={() => removeLayer(nailKey, layer.id)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>

              {/*
                ความทึบกับโหมดผสมกางเฉพาะเลเยอร์ที่กำลังทำงานอยู่

                เล็บหนึ่งมีได้ถึง MAX_LAYERS_PER_NAIL ใบ ถ้ากางทุกใบตลอดเวลา การ์ดละ
                4 แถวจะดันรายชื่อเลเยอร์ยาวเกินจอ — ทั้งที่ผู้ใช้ปรับได้ทีละใบอยู่แล้ว
              */}
              {active && (
                <div className="layer-card-body">
                  <label className="field layer-blend">
                    ผสม
                    <select
                      value={layer.blend}
                      onChange={(event) => setLayerBlend(nailKey, layer.id, event.target.value as Layer['blend'])}
                    >
                      {BLEND_MODES.map((blend) => <option key={blend} value={blend}>{BLEND_LABELS[blend]}</option>)}
                    </select>
                  </label>

                  <SliderField
                    label="ความทึบ"
                    suffix="%"
                    min={0}
                    max={100}
                    value={Math.round(layer.opacity * 100)}
                    onChange={(percent) => setLayerOpacity(
                      nailKey,
                      layer.id,
                      percent / 100,
                      `layer-opacity:${nailKey}:${layer.id}`,
                    )}
                  />
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
