import { useEffect, useState } from 'react'
import { tooltipPlacement, type TooltipSide } from './tooltipPlacement.ts'

interface Bubble {
  text: string
  side: TooltipSide
  x: number
  y: number
}

/**
 * ชั้นแสดง tooltip ของทั้งแอป
 *
 * เดิม tooltip เป็น ::after ที่ position: absolute อยู่ในตัวปุ่มเอง ซึ่งถูกกล่องที่
 * เลื่อนได้ตัดขอบทิ้ง — `.editor-inspector-scroll` และ `.editor-right-panel-scroll`
 * ตั้ง overflow-y: auto ไว้ และตามสเปก CSS แกน x ที่เป็น visible จะถูกดันเป็น auto
 * ตามไปด้วย ผลคือ tooltip ของ swatch สี ปุ่มในแผงเลเยอร์ และ chip ของตกแต่ง
 * ที่อยู่ใกล้ขอบล่างถูกตัดจนอ่านไม่ได้
 *
 * ตัวนี้เรนเดอร์นอกลำดับชั้นนั้นด้วย position: fixed จึงไม่มีใครตัดได้ และทำงานกับ
 * ทุกปุ่มที่มี data-tooltip โดยไม่ต้องแก้ปุ่มทีละตัว
 */
export function TooltipLayer() {
  const [bubble, setBubble] = useState<Bubble | null>(null)

  useEffect(() => {
    const show = (target: EventTarget | null) => {
      const element = target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null
      const text = element?.dataset.tooltip
      if (!element || !text) return
      const placement = tooltipPlacement(
        element.getBoundingClientRect(),
        (element.dataset.tooltipSide as TooltipSide | undefined) ?? 'bottom',
        { width: window.innerWidth, height: window.innerHeight },
      )
      setBubble({ text, ...placement })
    }

    const hide = () => setBubble(null)
    const onEnter = (event: Event) => show(event.target)

    document.addEventListener('pointerover', onEnter)
    document.addEventListener('pointerout', hide)
    document.addEventListener('focusin', onEnter)
    document.addEventListener('focusout', hide)
    // เลื่อนหรือย่อขยายแล้วพิกัดที่วัดไว้ใช้ไม่ได้อีก ซ่อนทิ้งง่ายกว่าคำนวณใหม่ตลอด
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    document.addEventListener('pointerdown', hide)

    return () => {
      document.removeEventListener('pointerover', onEnter)
      document.removeEventListener('pointerout', hide)
      document.removeEventListener('focusin', onEnter)
      document.removeEventListener('focusout', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('pointerdown', hide)
    }
  }, [])

  if (!bubble) return null

  return (
    <div
      className={`tooltip-bubble tooltip-bubble-${bubble.side}`}
      style={{ left: bubble.x, top: bubble.y }}
      role="presentation"
    >
      {bubble.text}
    </div>
  )
}
