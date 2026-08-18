import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppointmentDetail, CreateAppointmentInput, ProposeAppointmentInput, ReviewAppointmentInput } from '@nail-studio/contracts'
import {
  appointmentAction,
  createAppointment,
  deleteAppointmentReview,
  fetchAppointment,
  fetchAppointments,
  fetchSameDayConfirmed,
  fetchShops,
  markAppointmentMessagesRead,
  proposeAppointment,
  reviewAppointment,
  sendAppointmentMessage,
} from './client.ts'

export const appointmentKeys = {
  all: ['appointments'] as const,
  list: () => [...appointmentKeys.all, 'list'] as const,
  detail: (id: string) => [...appointmentKeys.all, 'detail', id] as const,
  sameDay: (id: string) => [...appointmentKeys.all, 'same-day', id] as const,
}

export const shopKeys = {
  all: ['shops'] as const,
  list: (search?: string) => [...shopKeys.all, 'list', search ?? ''] as const,
  detail: (id: string) => [...shopKeys.all, 'detail', id] as const,
}

/**
 * รายการนัดหมายของผู้ใช้ปัจจุบัน
 *
 * เดิมสองหน้านี้เป็นที่เดียวในแอปที่ดึงข้อมูลด้วย useState + useEffect เอง
 * จึงไม่มีแคช ไม่มีสถานะกำลังโหลด และต้องยิงใหม่ทั้งชุดหลังทุกการกระทำ
 */
export function useAppointments() {
  return useQuery({
    queryKey: appointmentKeys.list(),
    queryFn: fetchAppointments,
  })
}

export function useShops(search?: string) {
  return useQuery({
    queryKey: shopKeys.list(search),
    queryFn: () => fetchShops(search),
    staleTime: 5 * 60_000,
  })
}

/**
 * รายละเอียดนัดหมายหนึ่งรายการ
 *
 * ข้อความในนัดหมายเป็นบทสนทนาสองฝ่าย จึงต้องดึงซ้ำเป็นระยะ
 * แต่หยุดเมื่อผู้ใช้ไม่ได้ดูแท็บอยู่ — ของเดิมใช้ setInterval ที่ยิงตลอดเวลาแม้สลับแท็บไปแล้ว
 */
export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: appointmentKeys.detail(id ?? ''),
    queryFn: () => fetchAppointment(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.error ? false : 15_000),
    refetchIntervalInBackground: false,
  })
}

/** นัดที่ยืนยันแล้วในวันเดียวกัน — ฝั่งร้านใช้ตรวจว่าเวลาที่เสนอชนกับคิวอื่นไหม */
export function useSameDayAppointments(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: appointmentKeys.sameDay(id ?? ''),
    queryFn: () => fetchSameDayConfirmed(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => createAppointment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.list() })
    },
  })
}

/** ผลลัพธ์ของทุกการกระทำคือ AppointmentDetail ชุดใหม่ จึงเขียนทับแคชได้เลยไม่ต้องดึงซ้ำ */
function writeDetail(queryClient: ReturnType<typeof useQueryClient>, detail: AppointmentDetail) {
  queryClient.setQueryData(appointmentKeys.detail(detail.id), detail)
  void queryClient.invalidateQueries({ queryKey: appointmentKeys.list() })
}

export type AppointmentActionName = 'accept' | 'decline' | 'cancel' | 'complete'

export function useAppointmentAction(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: AppointmentActionName) => appointmentAction(id!, action),
    onSuccess: (detail) => writeDetail(queryClient, detail),
  })
}

export function useProposeAppointment(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProposeAppointmentInput) => proposeAppointment(id!, input),
    onSuccess: (detail) => {
      writeDetail(queryClient, detail)
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.sameDay(id ?? '') })
    },
  })
}

export function useSendAppointmentMessage(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => sendAppointmentMessage(id!, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(id ?? '') })
    },
  })
}

export function useReviewAppointment(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReviewAppointmentInput) => reviewAppointment(id!, input),
    onSuccess: (detail) => writeDetail(queryClient, detail),
  })
}

export function useDeleteAppointmentReview(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteAppointmentReview(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(id ?? '') })
    },
  })
}

export function useMarkMessagesRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markAppointmentMessagesRead(id),
    onSuccess: () => {
      // จำนวนที่ยังไม่อ่านโชว์อยู่บนกระดิ่ง จึงต้องรีเฟรชด้วย
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
