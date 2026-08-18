import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { AppointmentDetail } from '@nail-studio/contracts'
import { LoadingScreen } from '@/components/Loading.tsx'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import {
  appointmentAction,
  deleteAppointmentReview,
  fetchAppointment,
  fetchSameDayConfirmed,
  markAppointmentMessagesRead,
  proposeAppointment,
  reviewAppointment,
  sendAppointmentMessage,
  type SameDayAppointment,
} from '@/features/appointments/client.ts'

export function AppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const [detail, setDetail] = useState<AppointmentDetail | null>(null)
  const [message, setMessage] = useState('')
  const [proposalTime, setProposalTime] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [sameDayAppointments, setSameDayAppointments] = useState<SameDayAppointment[]>([])
  const [error, setError] = useState<string | null>(null)
  const { data: currentUser } = useCurrentUser()

  const reload = () => {
    if (!appointmentId) return
    void fetchAppointment(appointmentId).then(setDetail).catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดนัดหมายไม่สำเร็จ'))
  }
  useEffect(reload, [appointmentId])
  useEffect(() => {
    if (!appointmentId) return
    void markAppointmentMessagesRead(appointmentId)
    const timer = window.setInterval(reload, 10_000)
    return () => window.clearInterval(timer)
  }, [appointmentId])

  const pending = detail?.proposals.find((item) => item.status === 'pending')
  const isShopSide = currentUser?.id === detail?.shopId
  useEffect(() => {
    if (!appointmentId || !pending || !isShopSide) {
      setSameDayAppointments([])
      return
    }
    let active = true
    void fetchSameDayConfirmed(appointmentId)
      .then((items) => { if (active) setSameDayAppointments(items) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'โหลดนัดหมายวันเดียวกันไม่สำเร็จ') })
    return () => { active = false }
  }, [appointmentId, isShopSide, pending?.id, pending?.proposedStartAt])

  if (!appointmentId) return <p className="error center">ไม่พบรหัสการนัดหมาย</p>
  if (!detail) return <LoadingScreen label="กำลังโหลดนัดหมาย…" />

  const action = async (name: 'accept' | 'decline' | 'cancel' | 'complete') => {
    try { setDetail(await appointmentAction(appointmentId, name)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'ทำรายการไม่สำเร็จ') }
  }
  const submitProposal = async () => {
    if (!proposalTime) return
    try { setDetail(await proposeAppointment(appointmentId, { proposedStartAt: new Date(proposalTime).toISOString(), durationMinutes: detail.durationMinutes })) } catch (cause) { setError(cause instanceof Error ? cause.message : 'เสนอเวลาไม่สำเร็จ') }
  }
  const submitMessage = async () => {
    if (!message.trim()) return
    try { await sendAppointmentMessage(appointmentId, message.trim()); setMessage(''); reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'ส่งข้อความไม่สำเร็จ') }
  }
  const submitReview = async () => {
    try { setDetail(await reviewAppointment(appointmentId, { rating: reviewRating, comment: reviewComment || undefined })) } catch (cause) { setError(cause instanceof Error ? cause.message : 'ส่งรีวิวไม่สำเร็จ') }
  }
  const deleteReview = async () => {
    if (!window.confirm('ต้องการลบรีวิวนี้หรือไม่')) return
    try { await deleteAppointmentReview(appointmentId); reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'ลบรีวิวไม่สำเร็จ') }
  }

  return (
    <section className="page appointment-detail-page">
      <Link to="/appointments" className="back-link">← กลับรายการนัดหมาย</Link>
      <header className="page-head"><div><h1>{detail.shopName}</h1><p className="muted">{detail.serviceName ?? 'นัดหมาย'} · {detail.status}</p></div></header>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="appointment-detail-grid">
        <div className="card">
          <h2>ไทม์ไลน์การต่อรอง</h2>
          {detail.proposals.map((item) => <div className="proposal-row" key={item.id}><strong>{item.proposedBy}</strong><span>{new Date(item.proposedStartAt).toLocaleString()} · {item.durationMinutes} นาที</span><span>{item.status}</span>{item.message && <small>{item.message}</small>}</div>)}
          {pending && isShopSide && sameDayAppointments.length > 0 && <div className="editor-notice" role="status">ร้านมีนัดที่ยืนยันแล้ววันเดียวกันอีก {sameDayAppointments.length} รายการ: {sameDayAppointments.map((item) => `${new Date(item.agreedStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${item.customerName})`).join(', ')}</div>}
          {pending && <button type="button" className="btn btn-primary" onClick={() => { void action('accept') }}>ยอมรับข้อเสนอปัจจุบัน</button>}
          <div className="proposal-form"><input type="datetime-local" value={proposalTime} onChange={(event) => setProposalTime(event.target.value)} /><button type="button" className="btn btn-ghost" disabled={!proposalTime} onClick={() => { void submitProposal() }}>เสนอเวลาใหม่</button></div>
          <div className="appointment-actions"><button type="button" className="btn btn-ghost" onClick={() => { void action('cancel') }}>ยกเลิก</button>{detail.status === 'confirmed' && <button type="button" className="btn btn-primary" onClick={() => { void action('complete') }}>ทำเสร็จแล้ว</button>}{detail.status === 'pending' && <button type="button" className="btn btn-ghost" onClick={() => { void action('decline') }}>ปฏิเสธ</button>}</div>
        </div>
        <div className="card appointment-chat">
          <h2>ข้อความกับร้าน</h2>
          <div className="appointment-messages">{detail.messages.map((item) => <p key={item.id} className={item.senderId ? 'message' : 'message system'}>{item.content}</p>)}</div>
          <div className="proposal-form"><input value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder="พิมพ์ข้อความ…" /><button type="button" className="btn btn-primary" onClick={() => { void submitMessage() }}>ส่ง</button></div>
        </div>
      </div>
      {detail.status === 'completed' && !detail.review && <div className="card review-form"><h2>รีวิวร้าน</h2><label>คะแนน<select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><textarea value={reviewComment} maxLength={2000} onChange={(event) => setReviewComment(event.target.value)} /><button type="button" className="btn btn-primary" onClick={() => { void submitReview() }}>ส่งรีวิว</button></div>}
      {detail.review && currentUser?.id === detail.review.authorId && <div className="card review-form"><h2>รีวิวของคุณ</h2><p>{detail.review.rating}/5{detail.review.comment ? ` · ${detail.review.comment}` : ''}</p><button type="button" className="btn btn-ghost btn-danger" onClick={() => { void deleteReview() }}>ลบรีวิว</button></div>}
    </section>
  )
}
