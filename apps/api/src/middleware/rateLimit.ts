import rateLimit, { type Options } from 'express-rate-limit'
import { env } from '../config/env.ts'

/** A conservative API ceiling; sensitive routers add a tighter limiter of their own. */
export function createRateLimiter(limit: number, options: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...options,
  })
}

export const apiLimiter = createRateLimiter(600, {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'คำขอถี่เกินไป กรุณารอสักครู่', requestId: '' },
  },
})
