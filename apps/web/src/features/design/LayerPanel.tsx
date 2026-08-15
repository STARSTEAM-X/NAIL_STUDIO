import { useState } from 'react'
import { BLEND_MODES, MAX_LAYERS_PER_NAIL, type Layer } from '@nail-studio/contracts'
import { useDesign } from './DesignStoreProvider.tsx'
import { primaryOf } from './designStore.ts'

const BLEND_LABELS: Record<Layer['blend'], string> = {
  normal: 'ปกติ',
  multiply: 'ทวีคูณ',
  screen: 'สกรีน',
}

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
          <p className="hint">คลิกชื่อเพื่อเปลี่ยนชื่อแบบ inline</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={layers.length >= MAX_LAYERS_PER_NAIL}
          onClick={add}
        >
          เพิ่ม
        </button>
      </div>

      <div className="layer-list">
        {layers.map((layer, index) => {
          const active = layer.id === activeLayerId
          const editing = layer.id === editingLayerId
          return (
            <article key={layer.id} className={`layer-card ${active ? 'layer-card-active' : ''}`}>
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
                  title="คลิกเพื่อเปลี่ยนชื่อเลเยอร์"
                  onClick={() => beginRename(layer)}
                >
                  {layer.name || `เลเยอร์ ${index + 1}`}
                </button>
              )}
              <div className="layer-row">
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={(event) => setLayerVisibility(nailKey, layer.id, event.target.checked)}
                  />
                  แสดง
                </label>
                <label className="field layer-blend">
                  ผสม
                  <select
                    value={layer.blend}
                    onChange={(event) => setLayerBlend(nailKey, layer.id, event.target.value as Layer['blend'])}
                  >
                    {BLEND_MODES.map((blend) => <option key={blend} value={blend}>{BLEND_LABELS[blend]}</option>)}
                  </select>
                </label>
              </div>
              <label className="field">
                ความทึบ <output>{Math.round(layer.opacity * 100)}%</output>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(event) => setLayerOpacity(
                    nailKey,
                    layer.id,
                    Number(event.target.value) / 100,
                    `layer-opacity:${nailKey}:${layer.id}`,
                  )}
                />
              </label>
              <div className="layer-actions">
                <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => moveLayer(nailKey, layer.id, index - 1)}>ขึ้น</button>
                <button type="button" className="btn btn-ghost" disabled={index === layers.length - 1} onClick={() => moveLayer(nailKey, layer.id, index + 1)}>ลง</button>
                <button type="button" className="btn btn-ghost btn-danger" disabled={layers.length <= 1} onClick={() => removeLayer(nailKey, layer.id)}>ลบ</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
