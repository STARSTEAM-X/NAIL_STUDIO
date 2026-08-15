import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import { AppError } from '../errors/AppError.ts'
import { AiServiceError, postAiJson, postAiStream } from './client.ts'

const chatSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(8_000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string().min(1).max(8_000) })).max(20).optional(),
  editorContext: z.object({
    selectedNail: z.string().max(64).optional(),
    selectedColor: z.string().max(32).optional(),
    selectedShape: z.string().max(32).optional(),
    selectedFinish: z.string().max(32).optional(),
  }).strict().optional(),
}).strict()

const recipeSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  count: z.number().int().min(1).max(3).optional(),
  editorContext: chatSchema.shape.editorContext,
}).strict()

const recommendSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  limit: z.number().int().min(1).max(50).optional(),
}).strict()

export const aiRouter: Router = Router()
aiRouter.use(requireUser)
aiRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}))

function forwardError(error: unknown, next: (error?: unknown) => void): void {
  if (error instanceof AiServiceError) {
    next(new AppError('INTERNAL_ERROR', error.status, 'AI service is temporarily unavailable'))
    return
  }
  next(error)
}

aiRouter.post('/chat', async (request, response, next) => {
  try {
    const input = chatSchema.parse(request.body)
    const upstream = await postAiStream('/chat', {
      user_id: currentUser(request).id,
      session_id: input.sessionId,
      message: input.message,
      history: input.history,
      editor_context: input.editorContext
        ? {
            selected_nail: input.editorContext.selectedNail,
            selected_color: input.editorContext.selectedColor,
            selected_shape: input.editorContext.selectedShape,
            selected_finish: input.editorContext.selectedFinish,
          }
        : undefined,
    })
    response.status(upstream.status)
    response.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('X-Accel-Buffering', 'no')
    const reader = upstream.body?.getReader()
    if (!reader) {
      response.end()
      return
    }
    request.on('close', () => void reader.cancel())
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      response.write(chunk.value)
    }
    response.end()
  } catch (error) {
    forwardError(error, next)
  }
})

aiRouter.post('/design/recipe', async (request, response, next) => {
  try {
    const input = recipeSchema.parse(request.body)
    const result = await postAiJson('/design/recipe', {
      user_id: currentUser(request).id,
      prompt: input.prompt,
      count: input.count,
      editor_context: input.editorContext
        ? {
            selected_nail: input.editorContext.selectedNail,
            selected_color: input.editorContext.selectedColor,
            selected_shape: input.editorContext.selectedShape,
            selected_finish: input.editorContext.selectedFinish,
          }
        : undefined,
    })
    response.json({ success: true, data: result })
  } catch (error) {
    forwardError(error, next)
  }
})

aiRouter.post('/recommend', async (request, response, next) => {
  try {
    const input = recommendSchema.parse(request.body)
    const result = await postAiJson('/recommend', { ...input, user_id: currentUser(request).id })
    response.json({ success: true, data: result })
  } catch (error) {
    forwardError(error, next)
  }
})
