import { env } from '../config/env.ts'

export class AiServiceError extends Error {
  readonly status: number

  constructor(message: string, status = 503) {
    super(message)
    this.name = 'AiServiceError'
    this.status = status
  }
}

function headers(): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-AI-Internal-Token': env.AI_INTERNAL_TOKEN,
  }
}

export async function postAiJson<T>(path: string, payload: unknown): Promise<T> {
  if (!env.AI_INTERNAL_TOKEN) throw new AiServiceError('AI service is not configured')
  let response: Response
  try {
    response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(65_000),
    })
  } catch (error) {
    throw new AiServiceError(error instanceof Error ? error.message : 'AI service unavailable')
  }
  if (!response.ok) {
    throw new AiServiceError(`AI service returned ${response.status}`, response.status >= 500 ? 503 : response.status)
  }
  return (await response.json()) as T
}

export async function postAiStream(path: string, payload: unknown): Promise<Response> {
  if (!env.AI_INTERNAL_TOKEN) throw new AiServiceError('AI service is not configured')
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { ...headers(), Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(65_000),
    })
    if (!response.ok || !response.body) {
      throw new AiServiceError(`AI service returned ${response.status}`, response.status >= 500 ? 503 : response.status)
    }
    return response
  } catch (error) {
    if (error instanceof AiServiceError) throw error
    throw new AiServiceError(error instanceof Error ? error.message : 'AI service unavailable')
  }
}
