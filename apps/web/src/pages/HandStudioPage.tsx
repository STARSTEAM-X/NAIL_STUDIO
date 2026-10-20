import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FINGERS, type Finger, type Hand } from '@nail-studio/contracts'
import { StudioCanvas, type StudioBridge } from '@/features/handStudio/StudioCanvas.tsx'
import { commitScene, redoScene, sceneHistory, undoScene } from '@/features/handStudio/sceneHistory.ts'
import { createPose, createStudioScene, DECORATIONS, FINISHES, LIGHTS, MAX_SCENE_BYTES, nailTextureSchema, parseStudioJson, POSES, SHAPES, updateNails, type HandPose, type NailScope, type StudioHand, type StudioNail, type StudioScene } from '@/features/handStudio/sceneSchema.ts'
import '@/features/handStudio/handStudio.css'

const DRAFT_KEY = 'nail-studio:original-hand-scene:v1'
const FINGER_NAMES: Record<Finger, string> = { thumb: 'โป้ง', index: 'ชี้', middle: 'กลาง', ring: 'นาง', little: 'ก้อย' }
const POSE_NAMES = { open: 'กางมือ', relaxed: 'ผ่อนคลาย', soft_fist: 'กำมือเบา', pinch: 'จีบนิ้ว', v: 'V pose' }
const SHAPE_NAMES = { round: 'Round', oval: 'Oval', almond: 'Almond', square: 'Square', squoval: 'Squoval', coffin: 'Coffin', stiletto: 'Stiletto' }

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Slider({ label, value, min = 0, max = 1, step = .01, onChange, unit = '' }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void; unit?: string
}) {
  return <label className="hs-field"><span>{label}<output>{step >= 1 ? Math.round(value) : value.toFixed(2)}{unit}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
}

export function HandStudioPage() {
  const [initial] = useState(() => {
    try { const saved = localStorage.getItem(DRAFT_KEY); return { scene: saved ? parseStudioJson(saved) : createStudioScene(), notice: '' } }
    catch { return { scene: createStudioScene(), notice: 'อ่านฉากที่บันทึกในเครื่องไม่ได้ เปิดฉากใหม่ให้แล้ว' } }
  })
  const [history, setHistory] = useState(() => sceneHistory(initial.scene))
  const value = history.present
  const [selected, setSelected] = useState<{ hand: Hand; finger: Finger }>({ hand: 'right', finger: 'index' })
  const [scope, setScope] = useState<NailScope>('nail')
  const [panel, setPanel] = useState<'nail' | 'pose' | 'skin' | 'photo'>('nail')
  const [notice, setNotice] = useState(initial.notice)
  const [presetName, setPresetName] = useState('')
  const [decorationId, setDecorationId] = useState<string | null>(null)
  const photoShape = value.scene.photoAspect
  const [exporting, setExporting] = useState(false)
  const [warnings, setWarnings] = useState<Record<Hand, string[]>>({ left: [], right: [] })
  const bridge = useRef<StudioBridge | null>(null), input = useRef<HTMLInputElement>(null), gesture = useRef(0)
  const hand = value.hands[selected.hand], nail = hand.nails[selected.finger]
  const edit = useCallback((change: (scene: StudioScene) => StudioScene, mergeKey?: string) => {
    setHistory((state) => commitScene(state, change(state.present), mergeKey))
  }, [])
  const key = (field: string) => `${gesture.current}:${selected.hand}:${selected.finger}:${field}`
  const editHand = (change: (hand: StudioHand) => StudioHand, mergeKey?: string) => edit((scene) => ({
    ...scene, hands: { ...scene.hands, [selected.hand]: change(scene.hands[selected.hand]) },
  }), mergeKey)
  const editNail = (patch: Partial<StudioNail>, field?: string) => edit((scene) => updateNails(scene, selected.hand, selected.finger, scope, patch), field ? key(field) : undefined)
  const editPose = (change: (pose: HandPose) => HandPose, field?: string) => editHand((current) => ({ ...current, pose: change(current.pose) }), field ? key(field) : undefined)
  const editScene = (patch: Partial<StudioScene['scene']>, field?: string) => edit((scene) => ({ ...scene, scene: { ...scene.scene, ...patch } }), field ? key(field) : undefined)
  const onBridge = useCallback((next: StudioBridge | null) => { bridge.current = next }, [])
  const onSelect = useCallback((side: Hand, finger: Finger) => { setSelected({ hand: side, finger }); setDecorationId(null) }, [])
  const onCamera = useCallback((camera: StudioScene['scene']['camera']) => {
    edit((scene) => {
      const before = scene.scene.camera
      const difference = [...camera.position, ...camera.target].some((number, index) => Math.abs(number - [...before.position, ...before.target][index]!) > .00001)
      return difference ? { ...scene, scene: { ...scene.scene, camera } } : scene
    }, 'camera')
  }, [edit])
  const onWarnings = useCallback((side: Hand, issues: string[]) => setWarnings((previous) => previous[side].join('|') === issues.join('|') ? previous : { ...previous, [side]: issues }), [])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)) }
      catch { setNotice('พื้นที่บันทึกในเครื่องไม่พอ กรุณาบันทึกไฟล์ฉากไว้') }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [value])

  const saveScene = () => {
    const scene = { ...value, scene: { ...value.scene, camera: bridge.current?.cameraState() ?? value.scene.camera } }
    download(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }), 'nail-studio-scene.json')
    setNotice('บันทึกไฟล์ฉากแล้ว รวมท่า สี เล็บ ของตกแต่ง แสง และกล้อง')
  }
  const loadScene = async (file: File) => {
    try {
      if (file.size > MAX_SCENE_BYTES) throw new Error('ไฟล์ฉากต้องมีขนาดไม่เกิน 2 MB')
      const next = parseStudioJson(await file.text())
      edit(() => next)
      setSelected({ hand: next.hands.right.enabled ? 'right' : 'left', finger: 'index' })
      setDecorationId(null); setNotice('เปิดฉากแล้ว สามารถย้อนกลับไปฉากก่อนหน้าได้')
    } catch { setNotice('เปิดไฟล์ไม่ได้: ต้องเป็นไฟล์ฉาก Hand Studio v1.0 ที่ถูกต้องและไม่เกิน 2 MB') }
  }
  const photo = async () => {
    if (!bridge.current) { setNotice('กำลังโหลดโมเดล กรุณารอสักครู่'); return }
    setExporting(true)
    try {
      const size = photoShape === 'portrait' ? [2048, 2732] : photoShape === 'landscape' ? [2732, 2048] : [2048, 2048]
      const blob = await bridge.current.capture(size[0]!, size[1]!, value.scene.transparent)
      download(blob, `nail-studio-${size[0]}x${size[1]}.png`)
      setNotice(`ส่งออกภาพ ${size[0]} × ${size[1]} แล้ว`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'ส่งออกภาพไม่สำเร็จ') }
    finally { setExporting(false) }
  }
  const savePreset = (kind: 'poses' | 'nails') => {
    const name = presetName.trim().slice(0, 40)
    if (!name) { setNotice('ตั้งชื่อพรีเซ็ตก่อนบันทึก'); return }
    if (value.presets[kind].length >= 12) { setNotice('บันทึกพรีเซ็ตได้ประเภทละ 12 แบบ'); return }
    edit((scene) => ({ ...scene, presets: { ...scene.presets, [kind]: [...scene.presets[kind], { name, value: structuredClone(kind === 'poses' ? hand.pose : nail) }] } }))
    setPresetName(''); setNotice('บันทึกพรีเซ็ตไว้ในฉากแล้ว')
  }
  const selectedDecoration = nail.decorations.find((item) => item.id === decorationId)
  const editDecoration = (patch: Partial<NonNullable<typeof selectedDecoration>>, field: string) => {
    edit((scene) => updateNails(scene, selected.hand, selected.finger, 'nail', {
      decorations: scene.hands[selected.hand].nails[selected.finger].decorations.map((item) => item.id === decorationId ? { ...item, ...patch } : item),
    }), key(field))
  }
  const resetCamera = () => editScene({ camera: { position: [0, .032, value.hands.left.enabled && value.hands.right.enabled ? .70 : .57], target: [0, .032, 0] } })

  return <div className="hs-app">
    <header className="hs-header">
      <div><Link to="/projects" className="hs-back" aria-label="กลับไปงานของฉัน">← Nail Studio</Link><h1>Hand <em>Atelier</em><span>3D</span></h1></div>
      <div className="hs-actions">
        <button type="button" disabled={!history.past.length} onClick={() => setHistory(undoScene)}>↶ ย้อนกลับ</button>
        <button type="button" disabled={!history.future.length} onClick={() => setHistory(redoScene)}>↷ ทำซ้ำ</button>
        <button type="button" onClick={() => input.current?.click()}>เปิดฉาก</button>
        <button type="button" className="hs-primary" onClick={saveScene}>บันทึกฉาก ↗</button>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => {
          const file = event.target.files?.[0]; if (file) void loadScene(file); event.target.value = ''
        }} />
      </div>
    </header>
    <div className="hs-layout">
      <aside className="hs-sidebar" onPointerDownCapture={() => { gesture.current += 1 }} onFocusCapture={() => { gesture.current += 1 }}>
        <div className="hs-section hs-hand-picker"><span className="hs-eyebrow">YOUR CANVAS</span><h2>สร้างสรรค์บนมือคุณ</h2>
          <div className="hs-segment">{(['left', 'right'] as const).map((side) => <button type="button" key={side} aria-pressed={selected.hand === side} onClick={() => onSelect(side, selected.finger)}>มือ{side === 'left' ? 'ซ้าย' : 'ขวา'}</button>)}</div>
          <div className="hs-visibility">{(['left', 'right'] as const).map((side) => <label key={side}><input type="checkbox" checked={value.hands[side].enabled} onChange={(event) => {
            const enabled = event.target.checked
            edit((scene) => ({ ...scene, hands: { ...scene.hands, [side]: { ...scene.hands[side], enabled } }, scene: { ...scene.scene, camera: { position: [0, .032, enabled && scene.hands[side === 'left' ? 'right' : 'left'].enabled ? .70 : .57], target: [0, .032, 0] } } }))
          }} />แสดงมือ{side === 'left' ? 'ซ้าย' : 'ขวา'}</label>)}</div>
        </div>
        <nav className="hs-tabs" aria-label="ส่วนปรับแต่ง">{([['nail', 'เล็บ'], ['pose', 'ท่ามือ'], ['skin', 'ผิวมือ'], ['photo', 'สตูดิโอ']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={panel === id} onClick={() => setPanel(id)}>{label}</button>)}</nav>
        <div className="hs-scroll">
          {(panel === 'nail' || panel === 'pose') && <div className="hs-section"><span className="hs-eyebrow">เลือกนิ้ว</span><div className="hs-fingers">{FINGERS.map((finger) => <button type="button" key={finger} aria-pressed={selected.finger === finger} onClick={() => onSelect(selected.hand, finger)}>{FINGER_NAMES[finger]}</button>)}</div></div>}
          {panel === 'nail' && <>
            <section className="hs-section"><h3>ดีไซน์เล็บ <span>{selected.hand === 'left' ? 'ซ้าย' : 'ขวา'} · นิ้ว{FINGER_NAMES[selected.finger]}</span></h3>
              <label className="hs-field"><span>ใช้การเปลี่ยนแปลงกับ</span><select value={scope} onChange={(event) => { setScope(event.target.value as NailScope); setDecorationId(null) }}><option value="nail">เล็บนี้</option><option value="hand">มือที่เลือก · 5 เล็บ</option><option value="both">ทั้งสองมือ · 10 เล็บ</option></select></label>
              <div className="hs-shapes">{SHAPES.map((shape) => <button type="button" key={shape} aria-pressed={nail.shape === shape} onClick={() => editNail({ shape })}><span className={`hs-nail-icon hs-shape-${shape}`} />{SHAPE_NAMES[shape]}</button>)}</div>
              <Slider label="ความยาว" value={nail.length} onChange={(length) => editNail({ length }, 'length')} />
              <div className="hs-mini-buttons">{['XS', 'S', 'M', 'L', 'XL'].map((label, index) => <button type="button" key={label} aria-pressed={nail.length === index / 4} onClick={() => editNail({ length: index / 4 })}>{label}</button>)}</div>
              <details><summary>รูปทรงเพิ่มเติม</summary>
                <Slider label="ความกว้าง" value={nail.width} min={.8} max={1.15} onChange={(width) => editNail({ width }, 'width')} />
                <Slider label="C-Curve" value={nail.curvature} min={.65} max={1.4} onChange={(curvature) => editNail({ curvature }, 'curvature')} />
                <Slider label="ความเรียว" value={nail.taper} onChange={(taper) => editNail({ taper }, 'taper')} />
                <Slider label="ความกว้างปลาย Coffin" value={nail.tipWidth} min={.1} max={1} onChange={(tipWidth) => editNail({ tipWidth }, 'tipWidth')} />
              </details>
            </section>
            <section className="hs-section"><h3>สีและผิวสัมผัส</h3>
              <div className="hs-color-row"><label>สีพื้น<input aria-label="สีพื้นเล็บ" type="color" value={nail.baseColor} onChange={(event) => editNail({ baseColor: event.target.value }, 'baseColor')} /></label><label>สีปลาย<input aria-label="สีปลายเล็บ" type="color" value={nail.tipColor} onChange={(event) => editNail({ tipColor: event.target.value }, 'tipColor')} /></label></div>
              <div className="hs-segment">{(['solid', 'french', 'ombre'] as const).map((type) => <button type="button" key={type} aria-pressed={nail.pattern.type === type} onClick={() => editNail({ pattern: { ...nail.pattern, type } })}>{type === 'solid' ? 'สีเดียว' : type === 'french' ? 'French' : 'Ombré'}</button>)}</div>
              {nail.pattern.type !== 'solid' && <><Slider label="สัดส่วนสีปลาย" value={nail.pattern.amount} min={.08} max={.7} onChange={(amount) => editNail({ pattern: { ...nail.pattern, amount } }, 'amount')} /><Slider label="องศาลาย" value={nail.pattern.angle} min={-180} max={180} step={1} unit="°" onChange={(angle) => editNail({ pattern: { ...nail.pattern, angle } }, 'angle')} /></>}
              {nail.pattern.type === 'ombre' && <Slider label="ความนุ่มไล่สี" value={nail.pattern.softness} min={.01} max={.8} onChange={(softness) => editNail({ pattern: { ...nail.pattern, softness } }, 'softness')} />}
              <label className="hs-field"><span>วัสดุ</span><select value={nail.finish} onChange={(event) => editNail({ finish: event.target.value as StudioNail['finish'] })}>{FINISHES.map((finish) => <option key={finish}>{finish}</option>)}</select></label>
              {nail.finish === 'jelly' && <Slider label="ความทึบ Jelly" value={nail.opacity} min={.15} max={1} onChange={(opacity) => editNail({ opacity }, 'opacity')} />}
              <label className="hs-field"><span>ลาย PNG บนหน้าเล็บ</span><input type="file" accept="image/png" onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                if (file.size > 65536) { setNotice('ลาย PNG ต้องไม่เกิน 64 KB และ 2048 × 2048 px'); return }
                const reader = new FileReader()
                reader.onerror = () => setNotice('อ่านลาย PNG ไม่สำเร็จ')
                reader.onload = () => {
                  const result = nailTextureSchema.safeParse(reader.result)
                  if (!result.success) { setNotice('ลายต้องเป็น PNG ที่ถูกต้อง ไม่เกิน 2048 × 2048 px'); return }
                  editNail({ texture: result.data })
                }
                reader.readAsDataURL(file)
              }} /></label>
              {nail.texture && <button type="button" className="hs-full" onClick={() => editNail({ texture: null })}>ลบลาย PNG</button>}
            </section>
            <section className="hs-section"><h3>ของตกแต่ง</h3><p className="hs-help">วางบนเล็บที่เลือก · สูงสุด 12 ชิ้น</p>
              <div className="hs-decoration-grid">{DECORATIONS.map((type) => <button type="button" key={type} disabled={nail.decorations.length >= 12} onClick={() => {
                const id = crypto.randomUUID()
                // Decoration placement is explicitly per nail, independent of color scope.
                edit((scene) => updateNails(scene, selected.hand, selected.finger, 'nail', { decorations: [...scene.hands[selected.hand].nails[selected.finger].decorations, { id, type, u: .5, v: .45, rotation: 0, scale: 1, color: type === 'pearl' ? '#fff4df' : '#e8c580' }] }))
                setDecorationId(id)
              }}>{type}</button>)}</div>
              {nail.decorations.map((item, index) => <div className="hs-decoration-row" key={item.id}><button type="button" aria-pressed={decorationId === item.id} onClick={() => setDecorationId(item.id)}>{index + 1}. {item.type}</button><button type="button" aria-label={`ลบ ${item.type} ชิ้นที่ ${index + 1}`} onClick={() => edit((scene) => updateNails(scene, selected.hand, selected.finger, 'nail', { decorations: nail.decorations.filter((other) => other.id !== item.id) }))}>×</button></div>)}
              {selectedDecoration && <>
                <Slider label="ซ้าย–ขวา" value={selectedDecoration.u} min={.12} max={.88} onChange={(u) => editDecoration({ u }, 'decoration-u')} />
                <Slider label="โคน–ปลาย" value={selectedDecoration.v} min={.12} max={.88} onChange={(v) => editDecoration({ v }, 'decoration-v')} />
                <Slider label="ขนาดของตกแต่ง" value={selectedDecoration.scale} min={.4} max={1.6} onChange={(scale) => editDecoration({ scale }, 'decoration-scale')} />
                <Slider label="หมุนของตกแต่ง" value={selectedDecoration.rotation} min={-180} max={180} step={1} unit="°" onChange={(rotation) => editDecoration({ rotation }, 'decoration-rotation')} />
                <label className="hs-color-row">สีของตกแต่ง<input type="color" value={selectedDecoration.color} onChange={(event) => editDecoration({ color: event.target.value }, 'decoration-color')} /></label>
              </>}
            </section>
          </>}
          {panel === 'pose' && <>
            <section className="hs-section"><h3>ท่ามือ</h3><div className="hs-pose-grid">{POSES.map((preset) => <button type="button" key={preset} aria-pressed={hand.pose.preset === preset} onClick={() => editPose((current) => ({ ...createPose(preset), wrist: current.wrist }))}>{POSE_NAMES[preset]}</button>)}</div>
              <h3>นิ้ว{FINGER_NAMES[selected.finger]}</h3>
              {(['mcp', 'pip', 'dip', 'spread'] as const).map((joint, index) => <Slider key={joint} label={joint === 'spread' ? 'กาง–หุบนิ้ว' : `${selected.finger === 'thumb' ? ['CMC', 'MCP', 'IP'][index] : joint.toUpperCase()} · งอข้อ ${index + 1}`} value={hand.pose.joints[selected.finger][joint]} min={joint === 'mcp' ? -10 : joint === 'spread' ? -18 : 0} max={joint === 'mcp' ? selected.finger === 'thumb' ? 50 : 85 : joint === 'pip' ? selected.finger === 'thumb' ? 65 : 100 : joint === 'dip' ? 75 : 18} step={1} unit="°" onChange={(angle) => editPose((pose) => ({ ...pose, preset: 'custom', joints: { ...pose.joints, [selected.finger]: { ...pose.joints[selected.finger], [joint]: angle } } }), joint)} />)}
              <Slider label="ประกบนิ้วหัวแม่มือ" value={hand.pose.opposition} max={65} step={1} unit="°" onChange={(opposition) => editPose((pose) => ({ ...pose, preset: 'custom', opposition }), 'opposition')} />
            </section>
            <section className="hs-section"><h3>ข้อมือ</h3><p className="hs-help">ข้อมือและกล้องควบคุมแยกจากท่านิ้ว</p>{(['x', 'y', 'z'] as const).map((axis) => <Slider key={axis} label={{ x: 'ก้ม–เงย', y: 'พลิกมือ', z: 'เอียงมือ' }[axis]} value={hand.pose.wrist[axis]} min={axis === 'y' ? -90 : -60} max={axis === 'y' ? 90 : 60} step={1} unit="°" onChange={(angle) => editPose((pose) => ({ ...pose, wrist: { ...pose.wrist, [axis]: angle } }), `wrist-${axis}`)} />)}</section>
          </>}
          {panel === 'skin' && <>
            <section className="hs-section"><h3>สีผิวและรายละเอียด</h3><div className="hs-swatches">{['#f4d4bd', '#e8bfa0', '#c88e72', '#a96f50', '#78503b', '#4d3025'].map((tone) => <button type="button" key={tone} style={{ background: tone }} aria-label={`สีผิว ${tone}`} aria-pressed={hand.skin.tone === tone} onClick={() => editHand((current) => ({ ...current, skin: { ...current.skin, tone } }))} />)}</div>
              <label className="hs-color-row">สีผิวที่ต้องการ<input type="color" value={hand.skin.tone} onChange={(event) => editHand((current) => ({ ...current, skin: { ...current.skin, tone: event.target.value } }), key('skin-tone'))} /></label>
              <Slider label="ความหยาบผิว" value={hand.skin.roughness} min={.25} max={.95} onChange={(roughness) => editHand((current) => ({ ...current, skin: { ...current.skin, roughness } }), key('roughness'))} />
              <Slider label="รายละเอียดผิว" value={hand.skin.detail} max={2} onChange={(detail) => editHand((current) => ({ ...current, skin: { ...current.skin, detail } }), key('skin-detail'))} />
            </section>
            <section className="hs-section"><h3>สัดส่วนมือ</h3>
              <Slider label="ความกว้างฝ่ามือ" value={hand.proportions.palmWidth} min={.85} max={1.15} onChange={(palmWidth) => editHand((current) => ({ ...current, proportions: { ...current.proportions, palmWidth } }), key('palmWidth'))} />
              <Slider label="ความหนานิ้ว" value={hand.proportions.fingerWidth} min={.85} max={1.15} onChange={(fingerWidth) => editHand((current) => ({ ...current, proportions: { ...current.proportions, fingerWidth } }), key('fingerWidth'))} />
              {FINGERS.map((finger) => <Slider key={finger} label={`ความยาวนิ้ว${FINGER_NAMES[finger]}`} value={hand.proportions.fingerLengths[finger]} min={.85} max={1.15} onChange={(length) => editHand((current) => ({ ...current, proportions: { ...current.proportions, fingerLengths: { ...current.proportions.fingerLengths, [finger]: length } } }), key(`length-${finger}`))} />)}
            </section>
          </>}
          {panel === 'photo' && <>
            <section className="hs-section"><h3>แสงและบรรยากาศ</h3><div className="hs-pose-grid">{LIGHTS.map((lighting) => <button type="button" key={lighting} aria-pressed={value.scene.lighting === lighting} onClick={() => editScene({ lighting })}>{lighting}</button>)}</div><p className="hs-help">Studio ใช้แสงขาวกลางสำหรับเทียบสี</p>
              <Slider label="ความแรงแสง" value={value.scene.intensity} min={.3} max={2} onChange={(intensity) => editScene({ intensity }, 'intensity')} />
              <label className="hs-check"><input type="checkbox" checked={value.scene.highlights} onChange={(event) => editScene({ highlights: event.target.checked })} />แสงสะท้อน Softbox</label>
              <label className="hs-color-row">สีฉากหลัง<input type="color" value={value.scene.background} onChange={(event) => editScene({ background: event.target.value }, 'background')} /></label>
              <label className="hs-field"><span>คุณภาพการแสดงผล</span><select value={value.scene.quality} onChange={(event) => editScene({ quality: event.target.value as 'low' | 'high' })}><option value="high">ละเอียด</option><option value="low">ประหยัดพลังงาน</option></select></label>
            </section>
            <section className="hs-section"><h3>Studio Photo</h3><label className="hs-field"><span>สัดส่วนภาพ</span><select value={photoShape} onChange={(event) => editScene({ photoAspect: event.target.value as typeof photoShape })}><option value="square">จัตุรัส · 2048 × 2048</option><option value="portrait">แนวตั้ง · 2048 × 2732</option><option value="landscape">แนวนอน · 2732 × 2048</option></select></label>
              <label className="hs-check"><input type="checkbox" checked={value.scene.transparent} onChange={(event) => editScene({ transparent: event.target.checked })} />พื้นหลังโปร่งใสใน PNG</label>
              <button type="button" className="hs-primary hs-full" disabled={exporting} onClick={() => void photo()}>{exporting ? 'กำลังสร้างภาพ…' : 'ส่งออกภาพ PNG ↗'}</button>
              <button type="button" className="hs-full" onClick={resetCamera}>ดูทั้งมือ</button>
            </section>
            <section className="hs-section"><h3>เปรียบเทียบดีไซน์</h3><p className="hs-help">เปิดสองมือ เลือกข้าง แล้วแต่งแต่ละข้างภายใต้แสงและกล้องเดียวกัน</p><button type="button" className="hs-full" onClick={() => edit((scene) => ({ ...scene, hands: { left: { ...scene.hands.left, enabled: true }, right: { ...scene.hands.right, enabled: true } }, scene: { ...scene.scene, camera: { position: [0, .032, .70], target: [0, .032, 0] } } }))}>เปิดสองมือเพื่อเทียบ</button><button type="button" className="hs-full" onClick={() => edit((scene) => ({ ...scene, hands: { ...scene.hands, [selected.hand === 'left' ? 'right' : 'left']: structuredClone({ ...scene.hands[selected.hand], enabled: true }) } }))}>คัดลอกข้างนี้ไปอีกข้าง</button></section>
          </>}
          {(panel === 'pose' || panel === 'nail') && <section className="hs-section"><h3>พรีเซ็ตของฉัน</h3><label className="hs-field"><span>ชื่อพรีเซ็ต</span><input type="text" value={presetName} maxLength={40} onChange={(event) => setPresetName(event.target.value)} placeholder={panel === 'pose' ? 'ท่ามือโปรด' : 'ดีไซน์โปรด'} /></label><button type="button" className="hs-full" onClick={() => savePreset(panel === 'pose' ? 'poses' : 'nails')}>บันทึก{panel === 'pose' ? 'ท่ามือ' : 'ดีไซน์เล็บ'}</button>
            {panel === 'pose' ? value.presets.poses.map((preset, index) => <div className="hs-decoration-row" key={index}><button type="button" onClick={() => editPose(() => structuredClone(preset.value))}>{preset.name}</button><button type="button" aria-label={`ลบพรีเซ็ต ${preset.name}`} onClick={() => edit((scene) => ({ ...scene, presets: { ...scene.presets, poses: scene.presets.poses.filter((_, at) => at !== index) } }))}>×</button></div>) : value.presets.nails.map((preset, index) => <div className="hs-decoration-row" key={index}><button type="button" onClick={() => editNail(structuredClone(preset.value))}>{preset.name}</button><button type="button" aria-label={`ลบพรีเซ็ต ${preset.name}`} onClick={() => edit((scene) => ({ ...scene, presets: { ...scene.presets, nails: scene.presets.nails.filter((_, at) => at !== index) } }))}>×</button></div>)}
          </section>}
        </div>
      </aside>
      <main className="hs-stage" aria-label="โมเดลมือ 3 มิติ">
        <div className="hs-stage-caption"><span className="hs-eyebrow">THE NAIL PORTRAIT</span><h2>ทุกดีเทล ในมุมของคุณ</h2><p>{value.hands.left.enabled && value.hands.right.enabled ? 'Two hands · One light' : 'Your personal nail canvas'}</p></div>
        <StudioCanvas value={value} selected={selected} onSelect={onSelect} onBridge={onBridge} onCamera={onCamera} onWarnings={onWarnings} />
        {warnings[selected.hand].length > 0 && <div className="hs-attachment-warnings" role="status">{warnings[selected.hand].map((warning) => <p key={warning}>{warning}</p>)}</div>}
        {!value.hands.left.enabled && !value.hands.right.enabled && <div className="hs-empty">เปิดแสดงมือซ้ายหรือมือขวาเพื่อเริ่มออกแบบ</div>}
        {!hand.enabled && <div className="hs-hidden-warning">มือที่เลือกยังซ่อนอยู่ · เปิดแสดงมือ{selected.hand === 'left' ? 'ซ้าย' : 'ขวา'}เพื่อดูผล</div>}
        <div className="hs-view-actions"><button type="button" onClick={resetCamera}>↺ ดูทั้งมือ</button><button type="button" disabled={!hand.enabled} onClick={() => bridge.current?.focus(selected.hand, selected.finger)}>⊕ จ่อเล็บที่เลือก</button><button type="button" onClick={() => { setPanel('photo'); void photo() }} disabled={exporting}>↗ ถ่ายภาพ</button></div>
        <div className="hs-stage-footer"><span>ลากเพื่อหมุน 360° · เลื่อนเพื่อซูม · คลิกขวาลากเพื่อเลื่อนภาพ</span></div>
      </main>
    </div>
    {notice && <div className="hs-notice" role="status"><span>{notice}</span><button type="button" aria-label="ปิดข้อความ" onClick={() => setNotice('')}>×</button></div>}
  </div>
}

