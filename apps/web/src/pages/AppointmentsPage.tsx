import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { APPOINTMENT_STATUSES } from '@nail-studio/contracts'
import type { Appointment } from '@nail-studio/contracts'
import { usePageTitle } from '@/lib/usePageTitle.ts'
import { Icon } from '@/components/Icon.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import { AppointmentCard } from '@/features/appointments/components/AppointmentCard.tsx'
import { APPOINTMENT_STATUS_LABELS } from '@/features/appointments/labels.ts'
import { useAppointments, useCreateAppointment, useShops } from '@/features/appointments/useAppointments.ts'
import { formatBaht, formatDuration, localInputToIso } from '@/lib/datetime.ts'

type StatusFilter = Appointment['status'] | 'all'

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180]

export function AppointmentsPage() {
  usePageTitle('การนัดหมาย')
  const appointments = useAppointments()
  const shops = useShops()
  const createAppointment = useCreateAppointment()
  const toast = useToast()

  const [shopId, setShopId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [duration, setDuration] = useState(60)
  const [note, setNote] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const shopList = shops.data ?? []
  const selectedShop = shopList.find((shop) => shop.userId === shopId)
  const selectedService = selectedShop?.services.find((service) => service.id === serviceId)

  const items = useMemo(() => {
    const all = appointments.data ?? []
    return statusFilter === 'all' ? all : all.filter((item) => item.status === statusFilter)
  }, [appointments.data, statusFilter])

  /** นับจำนวนต่อสถานะจากข้อมูลจริง เพื่อไม่แสดงตัวกรองที่กดแล้วว่างเปล่า */
  const statusCounts = useMemo(() => {
    const counts = new Map<Appointment['status'], number>()
    for (const item of appointments.data ?? []) {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1)
    }
    return counts
  }, [appointments.data])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const iso = localInputToIso(startAt)
    if (!shopId || !iso) return

    createAppointment.mutate(
      {
        shopId,
        ...(serviceId ? { serviceId } : {}),
        proposedStartAt: iso,
        durationMinutes: duration,
        ...(note.trim() ? { customerNote: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success('ส่งคำขอนัดหมายแล้ว ร้านจะตอบรับหรือเสนอเวลาใหม่')
          setNote('')
          setStartAt('')
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'ส่งคำขอนัดหมายไม่สำเร็จ')
        },
      },
    )
  }

  // เวลาที่เลือกได้ต้องไม่อยู่ในอดีต
  const minStartAt = useMemo(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }, [])

  return (
    <section className="page ap-page">
      <header className="ap-header">
        <div>
          <p className="eyebrow">APPOINTMENTS</p>
          <h1>การนัดหมาย</h1>
          <p className="muted">ขอนัดกับร้าน ต่อรองเวลา และพูดคุยได้ในที่เดียว</p>
        </div>
        <Link to="/shops" className="ui-btn ui-btn-ghost ui-btn-md">
          <Icon name="compass" size={16} /> ดูร้านทั้งหมด
        </Link>
      </header>

      <div className="ap-layout">
        <form className="ui-card ap-booking" onSubmit={submit}>
          <h2><Icon name="plus" size={16} /> ขอนัดหมายใหม่</h2>

          <label className="ap-field">
            <span>ร้าน</span>
            <select
              value={shopId}
              required
              onChange={(event) => { setShopId(event.target.value); setServiceId('') }}
            >
              <option value="">เลือกร้าน</option>
              {shopList.map((shop) => (
                <option key={shop.userId} value={shop.userId}>{shop.shopName}</option>
              ))}
            </select>
            {shops.isPending && <small>กำลังโหลดรายชื่อร้าน…</small>}
            {shops.error && <small className="error">โหลดรายชื่อร้านไม่สำเร็จ</small>}
            {!shops.isPending && !shops.error && shopList.length === 0 && (
              <small>ยังไม่มีร้านที่เปิดรับนัดหมายในระบบ</small>
            )}
          </label>

          {selectedShop && (
            <label className="ap-field">
              <span>บริการ</span>
              <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                <option value="">ไม่ระบุบริการ</option>
                {selectedShop.services.filter((service) => service.isActive).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {formatBaht(service.priceThb)} · {formatDuration(service.durationMinutes)}
                  </option>
                ))}
              </select>
              {selectedService?.description && <small>{selectedService.description}</small>}
            </label>
          )}

          <label className="ap-field">
            <span>เวลาที่ต้องการ</span>
            <input
              type="datetime-local"
              value={startAt}
              min={minStartAt}
              required
              onChange={(event) => setStartAt(event.target.value)}
            />
          </label>

          <label className="ap-field">
            <span>ระยะเวลาที่คาดว่าจะใช้</span>
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>{formatDuration(minutes)}</option>
              ))}
            </select>
          </label>

          <label className="ap-field">
            <span>หมายเหตุถึงร้าน (ไม่บังคับ)</span>
            <textarea
              value={note}
              maxLength={1000}
              rows={3}
              placeholder="เช่น อยากได้ลายแบบไหน หรือมีข้อจำกัดเรื่องเวลา"
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          <Button
            type="submit"
            variant="primary"
            block
            disabled={!shopId || !startAt}
            loading={createAppointment.isPending}
            loadingLabel="กำลังส่งคำขอ…"
          >
            ส่งคำขอนัดหมาย
          </Button>
          <p className="ap-booking-hint">ร้านจะตอบรับหรือเสนอเวลาใหม่ คุณตกลงได้ในหน้ารายละเอียด</p>
        </form>

        <section className="ap-list-section" aria-labelledby="ap-list-title">
          <header className="ap-list-head">
            <h2 id="ap-list-title">รายการของฉัน</h2>
            {(appointments.data?.length ?? 0) > 0 && (
              <span className="ap-list-count">{items.length} จาก {appointments.data?.length} รายการ</span>
            )}
          </header>

          {(appointments.data?.length ?? 0) > 0 && (
            <div className="ap-filters" role="group" aria-label="กรองตามสถานะ">
              <button
                type="button"
                className={`nc-chip ${statusFilter === 'all' ? 'nc-chip-on' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                ทั้งหมด
              </button>
              {APPOINTMENT_STATUSES.filter((status) => statusCounts.has(status)).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`nc-chip ${statusFilter === status ? 'nc-chip-on' : ''}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {APPOINTMENT_STATUS_LABELS[status]} ({statusCounts.get(status)})
                </button>
              ))}
            </div>
          )}

          {appointments.isPending && <ListSkeleton count={3} lines={3} />}

          {appointments.error && (
            <ErrorState
              title="โหลดรายการนัดหมายไม่สำเร็จ"
              error={appointments.error}
              onRetry={() => void appointments.refetch()}
            />
          )}

          {!appointments.isPending && !appointments.error && items.length === 0 && (
            statusFilter === 'all' ? (
              <EmptyState
                icon="calendar"
                title="ยังไม่มีการนัดหมาย"
                description="เลือกร้านและเวลาที่ต้องการทางซ้าย เพื่อส่งคำขอนัดครั้งแรกของคุณ"
              />
            ) : (
              <EmptyState
                icon="search"
                title="ไม่มีนัดในสถานะนี้"
                description="ลองเลือกสถานะอื่นหรือดูทั้งหมด"
              >
                <Button variant="ghost" onClick={() => setStatusFilter('all')}>ดูทั้งหมด</Button>
              </EmptyState>
            )
          )}

          {items.length > 0 && (
            <ul className="ap-list">
              {items.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
