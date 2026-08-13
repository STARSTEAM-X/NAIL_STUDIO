import type { ErrorCode } from '@nail-studio/contracts'

export interface ErrorDetail {
  path: string
  message: string
}

/**
 * ข้อผิดพลาดที่ "ตั้งใจให้ผู้ใช้เห็น" — ต่างจาก error ที่หลุดมาโดยไม่ได้ตั้งใจ
 *
 * ตัวจัดการ error กลางจะส่งข้อความของ AppError ออกไปตรง ๆ ได้ เพราะเรารู้ว่า
 * มันถูกเขียนขึ้นเพื่อสื่อสารกับผู้ใช้ ส่วน error อื่นจะถูกกลบเป็นข้อความกลาง
 * เพื่อไม่ให้รายละเอียดภายในรั่ว (เกณฑ์ P3)
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: ErrorDetail[] | undefined

  constructor(code: ErrorCode, status: number, message: string, details?: ErrorDetail[]) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }

  static validation(message: string, details?: ErrorDetail[]): AppError {
    return new AppError('VALIDATION_ERROR', 400, message, details)
  }

  static unauthenticated(message = 'กรุณาเข้าสู่ระบบก่อน'): AppError {
    return new AppError('UNAUTHENTICATED', 401, message)
  }

  static forbidden(message = 'ไม่มีสิทธิ์ทำรายการนี้'): AppError {
    return new AppError('FORBIDDEN', 403, message)
  }

  /**
   * ใช้ทั้งกรณี "ไม่มีอยู่จริง" และ "มีอยู่แต่ไม่ใช่ของผู้ใช้คนนี้"
   *
   * จงใจไม่แยกเป็น 403 เพราะการตอบ 403 เท่ากับยืนยันว่า id นั้นมีอยู่จริง
   * ซึ่งเปิดช่องให้ไล่เดา id เพื่อสำรวจว่าใครมีงานอะไรบ้าง
   */
  static notFound(message = 'ไม่พบข้อมูลที่ต้องการ'): AppError {
    return new AppError('NOT_FOUND', 404, message)
  }

  static conflict(message: string): AppError {
    return new AppError('CONFLICT', 409, message)
  }
}
