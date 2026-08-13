import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginInput, PublicUser, RegisterInput } from '@nail-studio/contracts'
import { ApiRequestError, apiFetch } from '@/api/client.ts'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

/**
 * สถานะการล็อกอินเป็น server state ไม่ใช่ client state
 *
 * จึงอยู่ใน TanStack Query ไม่ใช่ Zustand — เพราะแหล่งความจริงคือ cookie
 * ที่เซิร์ฟเวอร์ออกให้ ไม่ใช่ตัวแปรในเบราว์เซอร์ (architecture.md §3.1)
 * ซอร์สเดิมของ CEPP เก็บ user ใน localStorage ซึ่งทำให้สถานะสองฝั่งไม่ตรงกันได้
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async (): Promise<PublicUser | null> => {
      try {
        return await apiFetch<PublicUser>('/auth/me')
      } catch (error) {
        // 401 ไม่ใช่ข้อผิดพลาด แต่คือคำตอบว่า "ยังไม่ได้ล็อกอิน"
        if (error instanceof ApiRequestError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

/** ID ที่ใช้แบ่งข้อมูลเฉพาะเครื่องตามบัญชี โดยยังให้ server session เป็นแหล่งความจริง */
export function useCurrentUserId(): string | null {
  return useCurrentUser().data?.id ?? null
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<PublicUser>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch<PublicUser>('/auth/register', { method: 'POST', body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // ล้างแคชทั้งหมด ไม่ใช่แค่ auth — ข้อมูลงานของผู้ใช้คนก่อนต้องไม่ค้างให้คนถัดไปเห็น
      queryClient.clear()
      queryClient.setQueryData(authKeys.me, null)
    },
  })
}
