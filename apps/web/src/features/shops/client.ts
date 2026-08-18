import type {
  CreateShopServiceInput,
  ShopDetail,
  UpdateShopProfileInput,
  UpdateShopServiceInput,
} from '@nail-studio/contracts'
import { apiFetch } from '@/api/client.ts'

type ShopService = ShopDetail['services'][number]

export function fetchShops(search?: string): Promise<ShopDetail[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<ShopDetail[]>(`/shops${query}`)
}

export function fetchShop(id: string): Promise<ShopDetail> {
  return apiFetch<ShopDetail>(`/shops/${id}`)
}

export function updateMyShop(input: UpdateShopProfileInput): Promise<ShopDetail> {
  return apiFetch<ShopDetail>('/shops/me', { method: 'PUT', body: input })
}

/** สร้าง/แก้บริการคืนเฉพาะบริการนั้น ไม่ใช่ทั้งร้าน จึงต้องดึงร้านใหม่หลังทำสำเร็จ */
export function createMyService(input: CreateShopServiceInput): Promise<ShopService> {
  return apiFetch<ShopService>('/shops/me/services', { method: 'POST', body: input })
}

export function updateMyService(id: string, input: UpdateShopServiceInput): Promise<ShopService> {
  return apiFetch<ShopService>(`/shops/me/services/${id}`, { method: 'PATCH', body: input })
}

export function deleteMyService(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/shops/me/services/${id}`, { method: 'DELETE' })
}

/** ร้านตอบกลับรีวิวของลูกค้า */
export function replyToReview(reviewId: string, reply: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/shops/reviews/${reviewId}/reply`, { method: 'POST', body: { reply } })
}
