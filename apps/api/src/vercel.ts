import { createApp } from './app.ts'

/**
 * entry ของ Vercel Function — Express app เป็น (req, res) handler อยู่แล้ว จึง export ตรง ๆ
 * ไม่มี listen() และไม่ส่งหน้าเว็บ (Vercel เสิร์ฟ static เองจาก CDN) ดู tools/vercel-build.mjs
 */
export default createApp({ webDist: undefined })
