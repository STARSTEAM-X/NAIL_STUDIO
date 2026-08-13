import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiRequestError } from '@/api/client.ts'

/**
 * สร้าง QueryClient ใน state ไม่ใช่ตัวแปรระดับโมดูล
 *
 * ถ้าเป็นตัวแปรระดับโมดูล แคชจะอยู่ข้ามการ mount ซึ่งทำให้เทสแต่ละตัวเห็นข้อมูล
 * ของเทสก่อนหน้า และใน dev ที่ StrictMode mount สองรอบก็จะแชร์แคชกันโดยไม่ตั้งใจ
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // อย่าลองใหม่กับ error ที่ลองกี่ครั้งก็ได้ผลเดิม (สิทธิ์ไม่พอ / ไม่มีข้อมูล)
            // การลองซ้ำแค่ทำให้ผู้ใช้รอนานขึ้นโดยไม่มีทางสำเร็จ
            retry: (failureCount, error) => {
              if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
                return false
              }
              return failureCount < 2
            },
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
