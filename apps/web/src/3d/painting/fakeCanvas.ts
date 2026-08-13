import type { Ctx2D } from './rasterizer.ts'

/**
 * แคนวาสปลอมที่บันทึกคำสั่งวาดแทนการวาดจริง — ใช้ในเทสเท่านั้น
 *
 * ทำไมไม่ใช้ jsdom: jsdom ไม่มี Canvas2D จริง ต้องพึ่งแพ็กเกจ native ที่ต้องคอมไพล์
 * บนเครื่อง ซึ่งบน Windows คือความเสี่ยงที่เคยทำให้ติดตั้งพังมาแล้ว (ดู @node-rs/argon2)
 *
 * ที่สำคัญกว่า: สิ่งที่ต้องยืนยันคือ "ตัดสินใจวาดอะไร ด้วยสถานะไหน ตามลำดับใด"
 * ไม่ใช่สีของพิกเซล การเทียบพิกเซลจะทำในการตรวจปลายทางบนเบราว์เซอร์จริงแทน
 */

export interface DrawCall {
  op: string
  args: unknown[]
  /** สถานะที่มีผลต่อการวาด ณ ตอนที่คำสั่งถูกเรียก */
  composite: GlobalCompositeOperation
  alpha: number
  fillStyle: unknown
}

export interface FakeCanvas {
  ctx: Ctx2D
  calls: DrawCall[]
  /** จำนวนครั้งที่มีการสร้าง gradient ใหม่ — ตัวชี้วัดของการแคช gradient */
  gradients: number
}

export function createFakeCanvas(): FakeCanvas {
  const calls: DrawCall[] = []
  const state = {
    composite: 'source-over' as GlobalCompositeOperation,
    alpha: 1,
    fillStyle: '#000000' as unknown,
  }
  const stack: Array<typeof state> = []
  let gradients = 0

  const record = (op: string, ...args: unknown[]): void => {
    calls.push({ op, args, composite: state.composite, alpha: state.alpha, fillStyle: state.fillStyle })
  }

  const ctx = {
    get globalCompositeOperation() {
      return state.composite
    },
    set globalCompositeOperation(value: GlobalCompositeOperation) {
      state.composite = value
    },
    get globalAlpha() {
      return state.alpha
    },
    set globalAlpha(value: number) {
      state.alpha = value
    },
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(value: unknown) {
      state.fillStyle = value
    },
    save: () => {
      stack.push({ ...state })
    },
    restore: () => {
      const previous = stack.pop()
      if (previous) Object.assign(state, previous)
    },
    createRadialGradient: () => {
      gradients += 1
      return { addColorStop: () => undefined, kind: 'gradient' }
    },
    clip: (...args: unknown[]) => record('clip', ...args),
    clearRect: (...args: unknown[]) => record('clearRect', ...args),
    fillRect: (...args: unknown[]) => record('fillRect', ...args),
    drawImage: (...args: unknown[]) => record('drawImage', ...args),
    beginPath: () => undefined,
    arc: (...args: unknown[]) => record('arc', ...args),
    fill: () => record('fill'),
    translate: (...args: unknown[]) => record('translate', ...args),
    scale: (...args: unknown[]) => record('scale', ...args),
  }

  return {
    ctx: ctx as unknown as Ctx2D,
    calls,
    get gradients() {
      return gradients
    },
  }
}
