/// <reference types="vite/client" />

// TypeScript 7 เข้มกว่า 5.x เรื่อง side-effect import ของไฟล์ที่ไม่ใช่โค้ด
// (`import './index.css'`) — ถ้าไม่มีบรรทัดอ้างอิงนี้จะได้ error TS2882
// "Cannot find module or type declarations for side-effect import"
// ส่วน TS 5.9 ปล่อยผ่านเงียบ ๆ
