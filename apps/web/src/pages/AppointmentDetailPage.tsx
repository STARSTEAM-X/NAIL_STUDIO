import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon.tsx'
import { BackLink } from '@/components/ui/BackLink.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { AppointmentChat } from '@/features/appointments/components/AppointmentChat.tsx'
import { AppointmentStatusBadge } from '@/features/appointments/components/AppointmentStatusBadge.tsx'
import { ProposalTimeline } from '@/features/appointments/components/ProposalTimeline.tsx'
import { ReviewSection } from '@/features/appointments/components/ReviewSection.tsx'
import { isOpenStatus } from '@/features/appointments/labels.ts'
import {
  useAppointment,
  useAppointmentAction,
  useDeleteAppointmentReview,
  useMarkMessagesRead,
  useProposeAppointment,
  useReviewAppointment,
  useSameDayAppointments,
  useSendAppointmentMessage,
  type AppointmentActionName,
} from '@/features/appointments/useAppointments.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'
import { formatAppointmentTime, formatBaht, formatDuration, formatTime, localInputToIso } from '@/lib/datetime.ts'

export function AppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const { data: currentUser } = useCurrentUser()
  const toast = useToast()

  const appointment = useAppointment(appointmentId)
  const action = useAppointmentAction(appointmentId)
  const propose = useProposeAppointment(appointmentId)
  const sendMessage = useSendAppointmentMessage(appointmentId)
  const submitReview = useReviewAppointment(appointmentId)
  const removeReview = useDeleteAppointmentReview(appointmentId)
  const markRead = useMarkMessagesRead()

  const [proposalTime, setProposalTime] = useState('')
  const [proposalNote, setProposalNote] = useState('')

  const detail = appointment.data
  usePageTitle(detail ? `นัดกับ ${detail.shopName}` : 'การนัดหมาย')
  const pendingProposal = detail?.proposals.find((item) => item.status === 'pending')
  const isShopSide = Boolean(detail && currentUser?.id === detail.shopId)
  const sameDay = useSameDayAppointments(appointmentId, Boolean(pendingProposal) && isShopSide)

  // ทำเครื่องหมายว่าอ่านแล้วครั้งเดียวต่อการเปิดหน้า ไม่ใช่ทุกครั้งที่ refetch
  const markReadMutate = markRead.mutate
  useEffect(() => {
    if (appointmentId) markReadMutate(appointmentId)
  }, [appointmentId, markReadMutate])

  if (!appointmentId) {
    return (
      <section className="page ap-page">
        <ErrorState title="ไม่พบรหัสการนัดหมาย" error={new Error('ลิงก์ที่เปิดไม่มีรหัสของนัดหมาย')} />
      </section>
    )
  }

  const runAction = (name: AppointmentActionName, successMessage: string) => {
    action.mutate(name, {
      onSuccess: () => toast.success(successMessage),
      onError: (error) => toast.error(error instanceof Error ? error.message : 'ทำรายการไม่สำเร็จ'),
    })
  }

  return (
    <section className="page ap-page ap-detail">
      <BackLink to="/appointments">กลับไปรายการนัดหมาย</BackLink>

      {appointment.isPending && <ListSkeleton count={2} lines={4} />}

      {appointment.error && (
        <ErrorState
          title="โหลดนัดหมายไม่สำเร็จ"
          error={appointment.error}
          onRetry={() => void appointment.refetch()}
        />
      )}

      {!appointment.isPending && !appointment.error && !detail && (
        <EmptyState icon="search" title="ไม่พบนัดหมายที่ต้องการ" description="นัดหมายนี้อาจถูกลบไปแล้ว" />
      )}

      {detail && (
        <>
          <header className="ap-detail-head ui-card">
            <div className="ap-detail-title">
              <h1>{detail.shopName}</h1>
              <AppointmentStatusBadge status={detail.status} />
            </div>
            <dl className="ap-detail-facts">
              <div>
                <dt>บริการ</dt>
                <dd>{detail.serviceName ?? 'บริการที่กำหนดเอง'}</dd>
              </div>
              <div>
                <dt>เวลาที่ตกลง</dt>
                <dd>{detail.agreedStartAt ? formatAppointmentTime(detail.agreedStartAt) : 'ยังไม่ได้ตกลง'}</dd>
              </div>
              <div>
                <dt>ระยะเวลา</dt>
                <dd>{formatDuration(detail.durationMinutes)}</dd>
              </div>
              {detail.priceQuotedThb && (
                <div>
                  <dt>ราคาที่เสนอ</dt>
                  <dd>{formatBaht(detail.priceQuotedThb)}</dd>
                </div>
              )}
            </dl>
            {detail.customerNote && (
              <p className="ap-detail-note"><strong>หมายเหตุจากลูกค้า:</strong> {detail.customerNote}</p>
            )}
            {detail.shopNote && (
              <p className="ap-detail-note"><strong>หมายเหตุจากร้าน:</strong> {detail.shopNote}</p>
            )}
          </header>

          <div className="ap-detail-grid">
            <section className="ui-card ap-panel" aria-labelledby="ap-timeline-title">
              <h2 id="ap-timeline-title"><Icon name="clock" size={16} /> การต่อรองเวลา</h2>

              {pendingProposal && isShopSide && (sameDay.data?.length ?? 0) > 0 && (
                <p className="ap-warning" role="status">
                  <Icon name="alert" size={15} />
                  วันเดียวกันนี้ร้านมีนัดที่ยืนยันแล้วอีก {sameDay.data?.length} รายการ:{' '}
                  {sameDay.data?.map((item) => `${formatTime(item.agreedStartAt)} (${item.customerName})`).join(', ')}
                </p>
              )}

              <ProposalTimeline proposals={detail.proposals} />

              {pendingProposal && (
                <Button
                  variant="primary"
                  icon="check"
                  loading={action.isPending && action.variables === 'accept'}
                  onClick={() => runAction('accept', 'ยืนยันเวลานัดแล้ว')}
                >
                  ยอมรับข้อเสนอล่าสุด
                </Button>
              )}

              {isOpenStatus(detail.status) && (
                <form
                  className="ap-propose"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const iso = localInputToIso(proposalTime)
                    if (!iso) return
                    propose.mutate(
                      {
                        proposedStartAt: iso,
                        durationMinutes: detail.durationMinutes,
                        ...(proposalNote.trim() ? { message: proposalNote.trim() } : {}),
                      },
                      {
                        onSuccess: () => {
                          toast.success('เสนอเวลาใหม่แล้ว')
                          setProposalTime('')
                          setProposalNote('')
                        },
                        onError: (error) => toast.error(error instanceof Error ? error.message : 'เสนอเวลาไม่สำเร็จ'),
                      },
                    )
                  }}
                >
                  <h3>เสนอเวลาใหม่</h3>
                  <label className="ap-field">
                    <span>วันและเวลา</span>
                    <input
                      type="datetime-local"
                      value={proposalTime}
                      required
                      onChange={(event) => setProposalTime(event.target.value)}
                    />
                  </label>
                  <label className="ap-field">
                    <span>ข้อความประกอบ (ไม่บังคับ)</span>
                    <input
                      value={proposalNote}
                      maxLength={500}
                      placeholder="เช่น ช่วงนี้ร้านว่างพอดี"
                      onChange={(event) => setProposalNote(event.target.value)}
                    />
                  </label>
                  <Button type="submit" variant="ghost" disabled={!proposalTime} loading={propose.isPending}>
                    ส่งข้อเสนอ
                  </Button>
                </form>
              )}

              {isOpenStatus(detail.status) && (
                <div className="ap-actions">
                  {detail.status === 'confirmed' && (
                    <Button
                      variant="primary"
                      icon="check"
                      loading={action.isPending && action.variables === 'complete'}
                      onClick={() => runAction('complete', 'ทำเครื่องหมายว่าเสร็จสิ้นแล้ว')}
                    >
                      ทำเสร็จแล้ว
                    </Button>
                  )}
                  {detail.status !== 'confirmed' && isShopSide && (
                    <Button
                      variant="ghost"
                      loading={action.isPending && action.variables === 'decline'}
                      onClick={() => runAction('decline', 'ปฏิเสธคำขอแล้ว')}
                    >
                      ปฏิเสธคำขอ
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    loading={action.isPending && action.variables === 'cancel'}
                    onClick={() => runAction('cancel', 'ยกเลิกนัดหมายแล้ว')}
                  >
                    ยกเลิกนัดหมาย
                  </Button>
                </div>
              )}
            </section>

            <section className="ui-card ap-panel" aria-labelledby="ap-chat-title">
              <h2 id="ap-chat-title"><Icon name="comment" size={16} /> ข้อความกับร้าน</h2>
              <AppointmentChat
                messages={detail.messages}
                currentUserId={currentUser?.id}
                pending={sendMessage.isPending}
                onSend={(content) =>
                  sendMessage.mutate(content, {
                    onError: (error) => toast.error(error instanceof Error ? error.message : 'ส่งข้อความไม่สำเร็จ'),
                  })
                }
              />
            </section>
          </div>

          <ReviewSection
            review={detail.review}
            canWrite={detail.status === 'completed' && !isShopSide}
            canDelete={Boolean(detail.review && currentUser?.id === detail.review.authorId)}
            submitting={submitReview.isPending}
            deleting={removeReview.isPending}
            onSubmit={(input) =>
              submitReview.mutate(input, {
                onSuccess: () => toast.success('ขอบคุณสำหรับรีวิว'),
                onError: (error) => toast.error(error instanceof Error ? error.message : 'ส่งรีวิวไม่สำเร็จ'),
              })
            }
            onDelete={() =>
              removeReview.mutate(undefined, {
                onSuccess: () => toast.success('ลบรีวิวแล้ว'),
                onError: (error) => toast.error(error instanceof Error ? error.message : 'ลบรีวิวไม่สำเร็จ'),
              })
            }
          />
        </>
      )}
    </section>
  )
}
