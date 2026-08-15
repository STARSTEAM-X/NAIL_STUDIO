import { Router } from 'express'
import { listTemplatesQuerySchema } from '@nail-studio/contracts'
import * as service from './service.ts'

export const templatesRouter: Router = Router()

// Public read-only feed. Mutating template actions are added in the next community slice.
templatesRouter.get('/', async (request, response) => {
  const query = listTemplatesQuerySchema.parse(request.query)
  const result = await service.list(query)
  response.json({ success: true, data: result.items, meta: { nextCursor: result.nextCursor } })
})
