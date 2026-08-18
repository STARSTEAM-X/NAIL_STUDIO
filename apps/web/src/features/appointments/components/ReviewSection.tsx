import { useState } from 'react'
import type { ShopReview } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx'
import { formatDate } from '@/lib/datetime.ts'

const RATINGS = [1, 2, 3, 4, 5] as const
const REVIEW_LIMIT = 2000

/** ดาวให้คะแนน — เป็นปุ่มจริงเพื่อให้ใช้ด้วยคีย์บอร์ดได้ */
function RatingPicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="ap-rating" role="radiogroup" aria-label="ให้คะแนนร้าน">
      {RATINGS.map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} ดาว`}
          className={`ap-rating-star ${rating <= value ? 'ap-rating-on' : ''}`}
          onClick={() => onChange(rating)}
        >
          <Icon name="sparkle" size={20} />
        </button>
      ))}
      <span className="ap-rating-value">{value}/5</span>
    </div>
  )
}

interface ReviewSectionProps {
  review: ShopReview | null
  canWrite: boolean
  canDelete: boolean
  submitting: boolean
  deleting: boolean
  onSubmit: (input: { rating: number; comment?: string }) => void
  onDelete: () => void
}

export function ReviewSection({
  review, canWrite, canDelete, submitting, deleting, onSubmit, onDelete,
}: ReviewSectionProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (review) {
    return (
      <section className="ui-card ap-review" aria-labelledby="ap-review-title">
        <h2 id="ap-review-title"><Icon name="sparkle" size={16} /> รีวิวร้าน</h2>
        <p className="ap-review-score">{'★'.repeat(review.rating)}<span>{review.rating}/5</span></p>
        {review.comment && <p className="ap-review-comment">{review.comment}</p>}
        <p className="ap-review-date">เขียนเมื่อ {formatDate(review.createdAt)}</p>
        {review.shopReply && (
          <div className="ap-review-reply">
            <strong>ร้านตอบกลับ</strong>
            <p>{review.shopReply}</p>
          </div>
        )}
        {canDelete && (
          <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirmOpen(true)}>ลบรีวิว</Button>
        )}
        {confirmOpen && (
          <ConfirmDialog
            title="ลบรีวิวนี้?"
            message="รีวิวจะถูกลบถาวรและคะแนนเฉลี่ยของร้านจะถูกคำนวณใหม่ การกระทำนี้ย้อนกลับไม่ได้"
            confirmLabel="ลบรีวิว"
            destructive
            pending={deleting}
            onConfirm={() => { onDelete(); setConfirmOpen(false) }}
            onCancel={() => setConfirmOpen(false)}
          />
        )}
      </section>
    )
  }

  if (!canWrite) return null

  return (
    <section className="ui-card ap-review" aria-labelledby="ap-review-title">
      <h2 id="ap-review-title"><Icon name="sparkle" size={16} /> ให้คะแนนร้านนี้</h2>
      <p className="muted">รีวิวของคุณช่วยให้คนอื่นเลือกร้านได้ง่ายขึ้น</p>
      <RatingPicker value={rating} onChange={setRating} />
      <label className="ap-field">
        <span>ความคิดเห็น (ไม่บังคับ)</span>
        <textarea
          value={comment}
          maxLength={REVIEW_LIMIT}
          rows={3}
          placeholder="เล่าประสบการณ์ที่ได้รับ…"
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        loading={submitting}
        loadingLabel="กำลังส่ง…"
        onClick={() => onSubmit({ rating, ...(comment.trim() ? { comment: comment.trim() } : {}) })}
      >
        ส่งรีวิว
      </Button>
    </section>
  )
}
