import { apiFetch, apiStream } from '@/api/client.ts'

export interface AiChatInput {
  sessionId: string
  message: string
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  editorContext?: {
    selectedNail?: string
    selectedColor?: string
    selectedShape?: string
    selectedFinish?: string
  }
}

export interface AiChatMeta {
  type: 'meta'
  intent: string
  intent_confidence: number
  grounded: boolean
  sources: string[]
  proposed_command: { type: string; nail: string; value: string; confirmation_required: boolean } | null
}

export type AiChatEvent =
  | AiChatMeta
  | { type: 'token'; text: string }
  | { type: 'done'; degraded?: boolean }

export interface AiRecipe {
  archetype: string
  paletteId: string
  baseColor: string
  accentNails: number[]
  finish: string
  shape: string
  length: string
  decorations: Array<{ catalogId: string; zone: string; density: number }>
}

export interface AiRecipeResponse {
  choices: AiRecipe[]
  degraded: boolean
  model: string
}

export interface AiRecommendation {
  template_id: string
  name: string
  caption: string | null
  category: string | null
  primary_color: string | null
  score: number
}

export async function generateAiRecipes(prompt: string, count = 3): Promise<AiRecipeResponse> {
  return apiFetch<AiRecipeResponse>('/ai/design/recipe', { method: 'POST', body: { prompt, count } })
}

export async function recommendAiTemplates(query: string, limit = 10): Promise<{ items: AiRecommendation[]; degraded: boolean }> {
  return apiFetch<{ items: AiRecommendation[]; degraded: boolean }>('/ai/recommend', {
    method: 'POST',
    body: { query, limit },
  })
}

export async function streamAiChat(
  input: AiChatInput,
  onEvent: (event: AiChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const stream = await apiStream('/ai/chat', input, signal)
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      const line = event.split('\n').find((entry) => entry.startsWith('data: '))
      if (!line) continue
      onEvent(JSON.parse(line.slice(6)) as AiChatEvent)
    }
    if (done) break
  }
  if (buffer.trim()) {
    const line = buffer.split('\n').find((entry) => entry.startsWith('data: '))
    if (line) onEvent(JSON.parse(line.slice(6)) as AiChatEvent)
  }
}
