import type { PublicUser } from '@nail-studio/contracts'

declare global {
  namespace Express {
    interface Request {
      /** ถูกเติมโดย requireUser เท่านั้น — handler ที่อยู่หลัง middleware นั้นใช้ได้เลย */
      user?: PublicUser
      sessionId?: string
    }
    interface Locals {
      requestId: string
    }
  }
}

export {}
