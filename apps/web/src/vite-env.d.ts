/// <reference types="vite/client" />

// TypeScript 7 เข้มกว่า 5.x เรื่อง side-effect import ของไฟล์ที่ไม่ใช่โค้ด
// (`import './index.css'`) ถ้าไม่มีบรรทัดอ้างอิงนี้จะได้ error TS2882
// พบครั้งแรกใน Spike S1b

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
