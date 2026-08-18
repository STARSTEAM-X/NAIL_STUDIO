import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon.tsx'
import { BackLink } from '@/components/ui/BackLink.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { useCreateAppointment } from '@/features/appointments/useAppointments.ts'
import { useShop } from '@/features/shops/useShops.ts'
import { formatBaht, formatDate, formatDuration, localInputToIso } from '@/lib/datetime.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'

/**
 * หน้ารายละเอียดร้าน
 *
 * GET /shops/:id มีมาตั้งแต่ต้นแต่ไม่มีหน้าใดเรียกใช้ ลูกค้าจึงตัดสินใจเลือกร้าน
 * ได้จากชื่อใน dropdown เท่านั้น หน้านี้เปิดข้อมูลที่ backend มีอยู่แล้วทั้งหมด
 * และให้จองบริการที่เลือกได้ในคลิกเดียว
 */
export function ShopDetailPage() {
  const { shopId } = useParams<{ shopId: string }>()
  const shop = useShop(shopId)
  const { data: currentUser } = useCurrentUser()
  const createAppointment = useCreateAppointment()
  const navigate = useNavigate()
  const toast = useToast()

  const [serviceId, setServiceId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [note, setNote] = useState('')

  usePageTitle(shop.data?.shopName)

  const minStartAt = useMemo(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }, [])

  const detail = shop.data
  const activeServices = detail?.services.filter((service) => service.isActive) ?? []
  const selectedService = activeServices.find((service) => service.id === serviceId)
  const isOwnShop = currentUser?.id === detail?.userId

  const book = () => {
    const iso = localInputToIso(startAt)
    if (!shopId || !iso) return
    createAppointment.mutate(
      {
        shopId,
        ...(serviceId ? { serviceId } : {}),
        proposedStartAt: iso,
        durationMinutes: selectedService?.durationMinutes ?? 60,
        ...(note.trim() ? { customerNote: note.trim() } : {}),
      },
      {
        onSuccess: (appointment) => {
          toast.success('ส่งคำขอนัดหมายแล้ว')
          navigate(`/appointments/${appointment.id}`)
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'ส่งคำขอนัดหมายไม่สำเร็จ'),
      },
    )
  }

  return (
    <section className="page shop-detail-page">
      <BackLink to="/shops">กลับไปรายชื่อร้าน</BackLink>

      {shop.isPending && <ListSkeleton count={3} lines={4} />}

      {shop.error && (
        <ErrorState title="โหลดข้อมูลร้านไม่สำเร็จ" error={shop.error} onRetry={() => void shop.refetch()} />
      )}

      {!shop.isPending && !shop.error && !detail && (
        <EmptyState icon="search" title="ไม่พบร้านที่ต้องการ" description="ร้านนี้อาจปิดรับนัดหมายไปแล้ว" />
      )}

      {detail && (
        <>
          <header className="ui-card shop-hero">
            <div className="shop-hero-head">
              <div>
                <p className="eyebrow">NAIL SHOP</p>
                <h1>{detail.shopName}</h1>
                {detail.locationText && (
                  <p className="shop-hero-location"><Icon name="compass" size={15} /> {detail.locationText}</p>
                )}
              </div>
              {detail.isVerified && (
                <span className="ui-status ui-status-ok"><Icon name="check" size={12} /> ร้านยืนยันแล้ว</span>
              )}
            </div>

            <dl className="ap-detail-facts">
              <div>
                <dt>คะแนนเฉลี่ย</dt>
                <dd>{detail.ratingCount > 0 ? `${Number(detail.ratingAvg).toFixed(1)} / 5` : 'ยังไม่มีรีวิว'}</dd>
              </div>
              <div><dt>จำนวนรีวิว</dt><dd>{detail.ratingCount}</dd></div>
              <div><dt>บริการที่เปิดรับ</dt><dd>{activeServices.length}</dd></div>
              {detail.phoneNumbers.length > 0 && (
                <div><dt>ติดต่อ</dt><dd>{detail.phoneNumbers.join(', ')}</dd></div>
              )}
            </dl>

            {detail.description && <p className="shop-hero-description">{detail.description}</p>}
          </header>

          <div className="shop-detail-grid">
            <section className="ui-card ap-panel" aria-labelledby="shop-services-title">
              <h2 id="shop-services-title"><Icon name="layers" size={16} /> บริการของร้าน</h2>
              {activeServices.length === 0 ? (
                <EmptyState icon="layers" title="ร้านยังไม่ได้เพิ่มบริการ" description="ลองติดต่อร้านโดยตรงเพื่อสอบถามรายละเอียด" />
              ) : (
                <ul className="shop-services">
                  {activeServices.map((service) => (
                    <li key={service.id} className={serviceId === service.id ? 'shop-service-on' : ''}>
                      <button type="button" onClick={() => setServiceId(service.id)} aria-pressed={serviceId === service.id}>
                        <div className="shop-service-head">
                          <strong>{service.name}</strong>
                          <span>{formatBaht(service.priceThb)}</span>
                        </div>
                        {service.description && <p>{service.description}</p>}
                        <span className="shop-service-duration">
                          <Icon name="clock" size={13} /> {formatDuration(service.durationMinutes)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="ui-card ap-panel shop-booking" aria-labelledby="shop-book-title">
              <h2 id="shop-book-title"><Icon name="calendar" size={16} /> ขอนัดหมาย</h2>
              {isOwnShop ? (
                <p className="muted">นี่คือร้านของคุณ — จัดการบริการและรีวิวได้ที่หน้าจัดการร้าน</p>
              ) : (
                <>
                  <label className="ap-field">
                    <span>บริการที่ต้องการ</span>
                    <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                      <option value="">ไม่ระบุบริการ</option>
                      {activeServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} · {formatBaht(service.priceThb)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ap-field">
                    <span>วันและเวลาที่ต้องการ</span>
                    <input
                      type="datetime-local"
                      value={startAt}
                      min={minStartAt}
                      onChange={(event) => setStartAt(event.target.value)}
                    />
                  </label>
                  <label className="ap-field">
                    <span>หมายเหตุ (ไม่บังคับ)</span>
                    <textarea
                      value={note}
                      rows={3}
                      maxLength={1000}
                      placeholder="เช่น อยากได้ลายแบบไหน"
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                  <Button
                    variant="primary"
                    block
                    disabled={!startAt}
                    loading={createAppointment.isPending}
                    loadingLabel="กำลังส่งคำขอ…"
                    onClick={book}
                  >
                    ส่งคำขอนัดหมาย
                  </Button>
                  <p className="ap-booking-hint">
                    {selectedService
                      ? `ใช้เวลาประมาณ ${formatDuration(selectedService.durationMinutes)}`
                      : 'ไม่เลือกบริการจะถือว่าใช้เวลา 1 ชม.'}
                  </p>
                </>
              )}
            </aside>
          </div>

          <section className="ui-card ap-panel" aria-labelledby="shop-reviews-title">
            <h2 id="shop-reviews-title"><Icon name="comment" size={16} /> รีวิวจากลูกค้า ({detail.reviews.length})</h2>
            {detail.reviews.length === 0 ? (
              <EmptyState icon="comment" title="ยังไม่มีรีวิว" description="เมื่อมีลูกค้าใช้บริการและให้คะแนน รีวิวจะแสดงที่นี่" />
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
                    {review.shopReply && (
                      <div className="ap-review-reply">
                        <strong>ร้านตอบกลับ</strong>
                        <p>{review.shopReply}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  )
}
