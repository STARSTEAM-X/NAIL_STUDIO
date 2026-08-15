import type {
  Appointment,
  AppointmentDetail,
  CreateAppointmentInput,
  ProposeAppointmentInput,
  ReviewAppointmentInput,
  ShopDetail,
} from '@nail-studio/contracts'
import { apiFetch } from '@/api/client.ts'

export function fetchAppointments(): Promise<Appointment[]> {
  return apiFetch<Appointment[]>('/appointments')
}

export function fetchAppointment(id: string): Promise<AppointmentDetail> {
  return apiFetch<AppointmentDetail>(`/appointments/${id}`)
}

export function fetchShops(search?: string): Promise<ShopDetail[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<ShopDetail[]>(`/shops${query}`)
}

export function createAppointment(input: CreateAppointmentInput): Promise<AppointmentDetail> {
  return apiFetch<AppointmentDetail>('/appointments', { method: 'POST', body: input })
}

export function appointmentAction(id: string, action: 'accept' | 'decline' | 'cancel' | 'complete'): Promise<AppointmentDetail> {
  return apiFetch<AppointmentDetail>(`/appointments/${id}/${action}`, { method: 'POST' })
}

export function proposeAppointment(id: string, input: ProposeAppointmentInput): Promise<AppointmentDetail> {
  return apiFetch<AppointmentDetail>(`/appointments/${id}/propose`, { method: 'POST', body: input })
}

export function reviewAppointment(id: string, input: ReviewAppointmentInput): Promise<AppointmentDetail> {
  return apiFetch<AppointmentDetail>(`/appointments/${id}/review`, { method: 'POST', body: input })
}

export function sendAppointmentMessage(id: string, content: string) {
  return apiFetch<AppointmentDetail['messages'][number]>(`/appointments/${id}/messages`, { method: 'POST', body: { content } })
}

export function markAppointmentMessagesRead(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/appointments/${id}/messages/read`, { method: 'POST' })
}
