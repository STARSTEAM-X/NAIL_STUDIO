import { useEffect, useState, type FormEvent } from 'react'
import type { ShopDetail } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import {
  useCreateMyService,
  useDeleteMyService,
  useReplyToReview,
  useShop,
  useUpdateMyService,
  useUpdateMyShop,
} from '@/features/shops/useShops.ts'
import { formatBaht, formatDate, formatDuration } from '@/lib/datetime.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'

type ShopService = ShopDetail['services'][number]

/**
 * หน้าจัดการร้านสำหรับบัญชี role 'shop'
 *
 * backend รองรับครบมาตั้งแต่ต้น (PUT /shops/me, CRUD บริการ, ตอบรีวิว)
 * แต่ไม่มี UI เลย ผู้ที่สมัครเป็นร้านจึงเห็นแอปเหมือนลูกค้าทุกประการ
 */
export function ShopManagePage() {
  usePageTitle('จัดการร้าน')
  const { data: user } = useCurrentUser()
  const shop = useShop(user?.id)
  const toast = useToast()

  const updateShop = useUpdateMyShop(user?.id)
  const createService = useCreateMyService(user?.id)
  const updateService = useUpdateMyService(user?.id)
  const deleteService = useDeleteMyService(user?.id)
  const replyReview = useReplyToReview(user?.id)

  const [shopName, setShopName] = useState('')
  const [description, setDescription] = useState('')
  const [locationText, setLocationText] = useState('')
  const [phones, setPhones] = useState('')
  const [editingService, setEditingService] = useState<ShopService | null>(null)
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', priceThb: '', durationMinutes: '60' })
  const [pendingDelete, setPendingDelete] = useState<ShopService | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  const detail = shop.data

  // เติมฟอร์มจากข้อมูลจริงครั้งแรกที่โหลดเสร็จ
  useEffect(() => {
    if (!detail) return
    setShopName(detail.shopName)
    setDescription(detail.description ?? '')
    setLocationText(detail.locationText ?? '')
    setPhones(detail.phoneNumbers.join(', '))
  }, [detail])

  const resetServiceForm = () => {
    setEditingService(null)
    setServiceForm({ name: '', description: '', priceThb: '', durationMinutes: '60' })
  }

  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    const phoneNumbers = phones.split(',').map((value) => value.trim()).filter(Boolean)
    updateShop.mutate(
      {
        shopName: shopName.trim(),
        description: description.trim() || null,
        locationText: locationText.trim() || null,
        phoneNumbers,
      },
      {
        onSuccess: () => toast.success('บันทึกข้อมูลร้านแล้ว'),
        onError: (error) => toast.error(error instanceof Error ? error.message : 'บันทึกข้อมูลร้านไม่สำเร็จ'),
      },
    )
  }

  const saveService = (event: FormEvent) => {
    event.preventDefault()
    const price = Number(serviceForm.priceThb)
    const duration = Number(serviceForm.durationMinutes)
    if (!serviceForm.name.trim() || Number.isNaN(price) || Number.isNaN(duration)) return

    const payload = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      priceThb: price,
      durationMinutes: duration,
    }

    if (editingService) {
      updateService.mutate(
        { id: editingService.id, input: payload },
        {
          onSuccess: () => { toast.success('แก้ไขบริการแล้ว'); resetServiceForm() },
          onError: (error) => toast.error(error instanceof Error ? error.message : 'แก้ไขบริการไม่สำเร็จ'),
        },
      )
      return
    }

    createService.mutate(payload, {
      onSuccess: () => { toast.success('เพิ่มบริการแล้ว'); resetServiceForm() },
      onError: (error) => toast.error(error instanceof Error ? error.message : 'เพิ่มบริการไม่สำเร็จ'),
    })
  }

  const startEdit = (service: ShopService) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      description: service.description ?? '',
      priceThb: String(Number(service.priceThb)),
      durationMinutes: String(service.durationMinutes),
    })
  }

  return (
    <section className="page shop-manage-page">
      <header className="ap-header">
        <div>
          <p className="eyebrow">SHOP DASHBOARD</p>
          <h1>จัดการร้าน</h1>
          <p className="muted">ตั้งค่าข้อมูลร้าน จัดการบริการ และตอบกลับรีวิวของลูกค้า</p>
        </div>
      </header>

      {shop.isPending && <ListSkeleton count={3} lines={4} />}

      {shop.error && (
        <ErrorState
          title="โหลดข้อมูลร้านไม่สำเร็จ"
          error={shop.error}
          onRetry={() => void shop.refetch()}
        />
      )}

      {detail && (
        <div className="shop-manage-grid">
          <form className="ui-card ap-panel" onSubmit={saveProfile}>
            <h2><Icon name="palette" size={16} /> ข้อมูลร้าน</h2>
            <label className="ap-field">
              <span>ชื่อร้าน</span>
              <input value={shopName} maxLength={160} required onChange={(event) => setShopName(event.target.value)} />
            </label>
            <label className="ap-field">
              <span>คำอธิบายร้าน</span>
              <textarea
                value={description}
                rows={4}
                maxLength={4000}
                placeholder="เล่าจุดเด่นของร้าน สไตล์ที่ถนัด หรือโปรโมชัน"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="ap-field">
              <span>ที่ตั้ง / พื้นที่ให้บริการ</span>
              <input
                value={locationText}
                maxLength={500}
                placeholder="เช่น ลาดกระบัง กรุงเทพฯ"
                onChange={(event) => setLocationText(event.target.value)}
              />
            </label>
            <label className="ap-field">
              <span>เบอร์ติดต่อ</span>
              <input
                value={phones}
                placeholder="คั่นด้วยจุลภาค เช่น 0812345678, 021234567"
                onChange={(event) => setPhones(event.target.value)}
              />
              <small>ใส่ได้สูงสุด 5 เบอร์</small>
            </label>
            <Button type="submit" variant="primary" loading={updateShop.isPending} loadingLabel="กำลังบันทึก…">
              บันทึกข้อมูลร้าน
            </Button>
          </form>

          <div className="shop-manage-column">
            <section className="ui-card ap-panel" aria-labelledby="manage-services-title">
              <h2 id="manage-services-title"><Icon name="layers" size={16} /> บริการของร้าน</h2>

              <form className="shop-service-form" onSubmit={saveService}>
                <h3>{editingService ? `แก้ไข: ${editingService.name}` : 'เพิ่มบริการใหม่'}</h3>
                <label className="ap-field">
                  <span>ชื่อบริการ</span>
                  <input
                    value={serviceForm.name}
                    maxLength={160}
                    required
                    placeholder="เช่น ต่อเล็บ PVC + เพ้นท์ลาย"
                    onChange={(event) => setServiceForm((form) => ({ ...form, name: event.target.value }))}
                  />
                </label>
                <label className="ap-field">
                  <span>คำอธิบาย (ไม่บังคับ)</span>
                  <textarea
                    value={serviceForm.description}
                    rows={2}
                    maxLength={4000}
                    onChange={(event) => setServiceForm((form) => ({ ...form, description: event.target.value }))}
                  />
                </label>
                <div className="shop-service-form-row">
                  <label className="ap-field">
                    <span>ราคา (บาท)</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      required
                      value={serviceForm.priceThb}
                      onChange={(event) => setServiceForm((form) => ({ ...form, priceThb: event.target.value }))}
                    />
                  </label>
                  <label className="ap-field">
                    <span>ใช้เวลา (นาที)</span>
                    <input
                      type="number"
                      min={15}
                      max={480}
                      step={15}
                      required
                      value={serviceForm.durationMinutes}
                      onChange={(event) => setServiceForm((form) => ({ ...form, durationMinutes: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="shop-service-form-actions">
                  {editingService && (
                    <Button variant="ghost" onClick={resetServiceForm}>ยกเลิกการแก้ไข</Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    icon={editingService ? 'check' : 'plus'}
                    loading={createService.isPending || updateService.isPending}
                    loadingLabel="กำลังบันทึก…"
                  >
                    {editingService ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ'}
                  </Button>
                </div>
              </form>

              {detail.services.length === 0 ? (
                <EmptyState
                  icon="layers"
                  title="ยังไม่มีบริการ"
                  description="เพิ่มบริการอย่างน้อยหนึ่งรายการ เพื่อให้ลูกค้าเลือกได้ตอนขอนัดหมาย"
                />
              ) : (
                <ul className="shop-manage-services">
                  {detail.services.map((service) => (
                    <li key={service.id}>
                      <div className="shop-manage-service-info">
                        <strong>{service.name}</strong>
                        <span>{formatBaht(service.priceThb)} · {formatDuration(service.durationMinutes)}</span>
                        {service.description && <p>{service.description}</p>}
                      </div>
                      <div className="shop-manage-service-actions">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(service)}>แก้ไข</Button>
                        <Button size="sm" variant="danger" icon="trash" onClick={() => setPendingDelete(service)}>
                          ลบ
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ui-card ap-panel" aria-labelledby="manage-reviews-title">
              <h2 id="manage-reviews-title"><Icon name="comment" size={16} /> รีวิวจากลูกค้า ({detail.reviews.length})</h2>
              {detail.reviews.length === 0 ? (
                <EmptyState icon="comment" title="ยังไม่มีรีวิว" description="รีวิวจะปรากฏหลังลูกค้าใช้บริการเสร็จสิ้น" />
              ) : (
                <ul className="shop-reviews">
                  {detail.reviews.map((review) => (
                    <li key={review.id}>
                      <div className="shop-review-head">
                        <span className="shop-review-stars" aria-label={`${review.rating} จาก 5 ดาว`}>
                          {'★'.repeat(review.rating)}<span className="shop-review-dim">{'★'.repeat(5 - review.rating)}</span>
                        </span>
                        <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                      </div>
                      {review.comment && <p>{review.comment}</p>}

                      {review.shopReply ? (
                        <div className="ap-review-reply">
                          <strong>คุณตอบกลับแล้ว</strong>
                          <p>{review.shopReply}</p>
                        </div>
                      ) : (
                        <form
                          className="shop-reply-form"
                          onSubmit={(event) => {
                            event.preventDefault()
                            const reply = (replyDrafts[review.id] ?? '').trim()
                            if (!reply) return
                            replyReview.mutate(
                              { reviewId: review.id, reply },
                              {
                                onSuccess: () => {
                                  toast.success('ตอบกลับรีวิวแล้ว')
                                  setReplyDrafts((drafts) => ({ ...drafts, [review.id]: '' }))
                                },
                                onError: (error) => toast.error(error instanceof Error ? error.message : 'ตอบกลับไม่สำเร็จ'),
                              },
                            )
                          }}
                        >
                          <label className="ap-field">
                            <span className="nc-visually-hidden">ตอบกลับรีวิว</span>
                            <textarea
                              value={replyDrafts[review.id] ?? ''}
                              rows={2}
                              maxLength={2000}
                              placeholder="ตอบกลับลูกค้าอย่างสุภาพ…"
                              onChange={(event) =>
                                setReplyDrafts((drafts) => ({ ...drafts, [review.id]: event.target.value }))
                              }
                            />
                          </label>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            disabled={!(replyDrafts[review.id] ?? '').trim()}
                            loading={replyReview.isPending && replyReview.variables?.reviewId === review.id}
                          >
                            ส่งคำตอบ
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`ลบบริการ "${pendingDelete.name}"?`}
          message="ลูกค้าจะเลือกบริการนี้ไม่ได้อีก นัดหมายที่อ้างถึงบริการนี้อยู่แล้วจะยังคงอยู่ การกระทำนี้ย้อนกลับไม่ได้"
          confirmLabel="ลบบริการ"
          destructive
          pending={deleteService.isPending}
          onConfirm={() =>
            deleteService.mutate(pendingDelete.id, {
              onSuccess: () => { toast.success('ลบบริการแล้ว'); setPendingDelete(null) },
              onError: (error) => toast.error(error instanceof Error ? error.message : 'ลบบริการไม่สำเร็จ'),
            })
          }
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  )
}
