import { useMemo, useState } from 'react'
import { FINISHES, NAIL_LENGTHS, NAIL_SHAPES, type NailKey } from '@nail-studio/contracts'
import { generateAiRecipes, streamAiChat, type AiChatMeta, type AiRecipe, type AiRecipeResponse } from './aiClient.ts'
import { useDesign, useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import { primaryOf } from '@/features/design/designStore.ts'

function validOption<T extends readonly string[]>(value: string, options: T): value is T[number] {
  return (options as readonly string[]).includes(value)
}

export function AiAssistantPanel() {
  const store = useDesignStoreApi()
  const selection = useDesign((state) => state.selection)
  const document = useDesign((state) => state.document)
  const selectedNail = primaryOf(selection)
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [meta, setMeta] = useState<AiChatMeta | null>(null)
  const [pendingCommand, setPendingCommand] = useState<AiChatMeta['proposed_command']>(null)
  const [recipes, setRecipes] = useState<AiRecipeResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())

  const editorContext = useMemo(() => ({
    selectedNail,
    selectedColor: document.nails[selectedNail].baseColor,
    selectedShape: document.nails[selectedNail].shape,
    selectedFinish: document.nails[selectedNail].finish,
  }), [document.nails, selectedNail])

  const ask = async () => {
    const message = prompt.trim()
    if (!message || busy) return
    setBusy(true)
    setError(null)
    setAnswer('')
    setMeta(null)
    setPendingCommand(null)
    try {
      await streamAiChat({ sessionId, message, editorContext }, (event) => {
        if (event.type === 'token') setAnswer((current) => current + event.text)
        if (event.type === 'meta') {
          setMeta(event)
          setPendingCommand(event.proposed_command)
        }
      })
      setPrompt('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI ไม่พร้อมใช้งานชั่วคราว')
    } finally {
      setBusy(false)
    }
  }

  const confirmCommand = () => {
    if (!pendingCommand || pendingCommand.type !== 'SetNailColor') return
    if (!/^#[0-9a-f]{6}$/i.test(pendingCommand.value)) {
      setError('คำสั่งสีจาก AI ไม่ผ่านการตรวจสอบ')
      return
    }
    if (pendingCommand.nail && pendingCommand.nail !== selectedNail) {
      store.getState().selectNail(pendingCommand.nail as NailKey)
    }
    // All editor mutations go through the existing HistoryStack-backed actions.
    store.getState().setBaseColor(pendingCommand.value)
    setPendingCommand(null)
  }

  const generateRecipes = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      setRecipes(await generateAiRecipes(prompt.trim(), 3))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถสร้างตัวเลือกดีไซน์ได้')
    } finally {
      setBusy(false)
    }
  }

  const applyRecipe = (recipe: AiRecipe) => {
    const actions = store.getState()
    if (/^#[0-9a-f]{6}$/i.test(recipe.baseColor)) actions.setBaseColor(recipe.baseColor)
    if (validOption(recipe.finish, FINISHES)) actions.setFinish(recipe.finish)
    if (validOption(recipe.shape, NAIL_SHAPES)) actions.setShape(recipe.shape)
    if (validOption(recipe.length, NAIL_LENGTHS)) actions.setLength(recipe.length)
  }

  return (
    <aside className="ai-assistant-panel" aria-label="ผู้ช่วยออกแบบ AI">
      <div className="ai-assistant-head">
        <h2>AI Design Assistant</h2>
        <span className="muted">แก้ไขต้องกดยืนยัน</span>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="เช่น เปลี่ยนเล็บที่เลือกเป็นสีชมพูโครม"
        maxLength={2000}
        rows={3}
      />
      <div className="ai-assistant-actions">
        <button type="button" className="btn btn-primary" disabled={busy || !prompt.trim()} onClick={() => { void ask() }}>
          {busy ? 'กำลังคิด…' : 'ถาม AI'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy || !prompt.trim()} onClick={() => { void generateRecipes() }}>
          สร้าง 3 แบบ
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {answer && <p className="ai-answer">{answer}</p>}
      {meta && <p className="muted">intent: {meta.intent} · ความมั่นใจ {(meta.intent_confidence * 100).toFixed(0)}%</p>}
      {pendingCommand && (
        <div className="ai-command-card">
          <strong>AI เสนอการแก้ไข</strong>
          <span>{pendingCommand.type}: {pendingCommand.value}</span>
          <div>
            <button type="button" className="btn btn-primary" onClick={confirmCommand}>ยืนยัน</button>
            <button type="button" className="btn btn-ghost" onClick={() => setPendingCommand(null)}>ยกเลิก</button>
          </div>
        </div>
      )}
      {recipes && (
        <div className="ai-recipe-list">
          <strong>ตัวเลือกจาก Recipe</strong>
          {recipes.choices.map((recipe, index) => (
            <button type="button" className="ai-recipe-card" key={`${recipe.archetype}-${index}`} onClick={() => applyRecipe(recipe)}>
              <span>{recipe.archetype} · {recipe.paletteId}</span>
              <span>{recipe.baseColor} · {recipe.finish} · {recipe.shape} · {recipe.length}</span>
              <small>กดเพื่อใช้กับเล็บที่เลือก (ย้อนกลับได้ด้วย Ctrl+Z)</small>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
