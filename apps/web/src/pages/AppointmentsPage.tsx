import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Appointment, ShopDetail } from '@nail-studio/contracts'
import { createAppointment, fetchAppointments, fetchShops } from '@/features/appointments/client.ts'

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [shops, setShops] = useState<ShopDetail[]>([])
  const [selectedShop, setSelectedShop] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [duration, setDuration] = useState(60)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = () => {
    void Promise.all([fetchAppointments(), fetchShops()]).then(([nextAppointments, nextShops]) => {
      setAppointments(nextAppointments)
      setShops(nextShops)
      setSelectedShop((current) => current || nextShops[0]?.userId || '')
    }).catch(() => setMessage('โหลดข้อมูลการนัดหมายไม่สำเร็จ'))
  }

  useEffect(reload, [])

  const shop = shops.find((item) => item.userId === selectedShop)
  const submit = async () => {
    if (!selectedShop || !startAt) return
    setBusy(true)
    setMessage(null)
    try {
      await createAppointment({
        shopId: selectedShop,
        serviceId: serviceId || undefined,
        proposedStartAt: new Date(startAt).toISOString(),
        durationMinutes: duration,
        customerNote: note || undefined,
      })
      setMessage('ส่งคำขอนัดหมายแล้ว ร้านจะตอบรับหรือเสนอเวลาใหม่')
      setNote('')
      reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างการนัดหมายไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page appointments-page">
      <header className="page-head">
        <div><h1>การนัดหมาย</h1><p className="muted">ต่อรองเวลาและคุยกับร้านได้ใน thread ของนัดหมายเท่านั้น</p></div>
      </header>
      {message && <p className="editor-notice" role="status">{message}</p>}
      <div className="appointment-layout">
        <div className="card appointment-booking-card">
          <h2>ขอนัดหมายใหม่</h2>
          <label>ร้าน<select value={selectedShop} onChange={(event) => { setSelectedShop(event.target.value); setServiceId('') }}>
            <option value="">เลือกร้าน</option>
            {shops.map((item) => <option key={item.userId} value={item.userId}>{item.shopName}</option>)}
          </select></label>
          {shop && <label>บริการ<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">ไม่ระบุบริการ</option>
            {shop.services.map((item) => <option key={item.id} value={item.id}>{item.name} · ฿{item.priceThb}</option>)}
          </select></label>}
          <label>เวลาที่ต้องการ<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></label>
          <label>ระยะเวลา (นาที)<input type="number" min={15} max={480} step={15} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
          <label>หมายเหตุ<textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></label>
          <button type="button" className="btn btn-primary" disabled={busy || !selectedShop || !startAt} onClick={() => { void submit() }}>ส่งคำขอ</button>
        </div>
        <div className="appointment-list">
          <h2>รายการของฉัน</h2>
          {appointments.length === 0 && <p className="muted">ยังไม่มีการนัดหมาย</p>}
          {appointments.map((item) => <Link className="card appointment-list-item" to={`/appointments/${item.id}`} key={item.id}>
            <strong>{item.shopName}</strong><span>{item.serviceName ?? 'บริการที่เลือกเอง'}</span><span>{item.status} · {item.agreedStartAt ? new Date(item.agreedStartAt).toLocaleString() : 'รอการยืนยันเวลา'}</span>
          </Link>)}
        </div>
      </div>
    </section>
  )
}
