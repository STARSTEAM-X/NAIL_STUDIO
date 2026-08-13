import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('ไม่พบ #root')

// StrictMode เปิดไว้โดยตั้งใจ — เป็นส่วนหนึ่งของสิ่งที่ spike นี้ต้องพิสูจน์
// (React 19 StrictMode mount/unmount สองรอบ ซึ่งเป็นจุดที่ WebGL context และ
//  การ dispose ทรัพยากรของ Three.js มักพัง)
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
