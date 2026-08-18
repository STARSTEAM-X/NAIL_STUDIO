import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  CreateShopServiceInput,
  ShopDetail,
  UpdateShopProfileInput,
  UpdateShopServiceInput,
} from '@nail-studio/contracts'
import {
  createMyService,
  deleteMyService,
  fetchShop,
  fetchShops,
  replyToReview,
  updateMyService,
  updateMyShop,
} from './client.ts'

export const shopKeys = {
  all: ['shops'] as const,
  list: (search: string) => [...shopKeys.all, 'list', search] as const,
  detail: (id: string) => [...shopKeys.all, 'detail', id] as const,
}

export function useShopList(search = '') {
  return useQuery({
    queryKey: shopKeys.list(search),
    queryFn: () => fetchShops(search || undefined),
    staleTime: 60_000,
  })
}

export function useShop(id: string | undefined) {
  return useQuery({
    queryKey: shopKeys.detail(id ?? ''),
    queryFn: () => fetchShop(id!),
    enabled: Boolean(id),
  })
}

/**
 * บริการและการตอบรีวิวคืนค่าเป็นชิ้นส่วน ไม่ใช่ร้านทั้งก้อน
 * จึงต้องสั่งดึงร้านใหม่หลังแก้ เพื่อให้หน้าจอตรงกับฐานข้อมูลเสมอ
 */
function invalidateShop(queryClient: QueryClient, shopId: string | undefined) {
  if (shopId) void queryClient.invalidateQueries({ queryKey: shopKeys.detail(shopId) })
  void queryClient.invalidateQueries({ queryKey: shopKeys.all })
}

export function useUpdateMyShop(shopId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateShopProfileInput) => updateMyShop(input),
    onSuccess: (shop: ShopDetail) => {
      queryClient.setQueryData(shopKeys.detail(shop.userId), shop)
      void queryClient.invalidateQueries({ queryKey: shopKeys.all })
      invalidateShop(queryClient, shopId)
    },
  })
}

export function useCreateMyService(shopId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateShopServiceInput) => createMyService(input),
    onSuccess: () => invalidateShop(queryClient, shopId),
  })
}

export function useUpdateMyService(shopId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateShopServiceInput }) => updateMyService(id, input),
    onSuccess: () => invalidateShop(queryClient, shopId),
  })
}

export function useDeleteMyService(shopId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMyService(id),
    onSuccess: () => invalidateShop(queryClient, shopId),
  })
}

export function useReplyToReview(shopId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) => replyToReview(reviewId, reply),
    onSuccess: () => invalidateShop(queryClient, shopId),
  })
}
