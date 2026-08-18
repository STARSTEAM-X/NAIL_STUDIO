import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Icon, type IconName } from '../Icon.tsx'

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface CommonProps {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  /** ไอคอนนำหน้าข้อความ — ใช้ชุดเดียวกับทั้งแอป */
  icon?: IconName | undefined
  /** ยืดเต็มความกว้างของคอนเทนเนอร์ */
  block?: boolean | undefined
  children?: ReactNode | undefined
}

function classNames({ variant = 'ghost', size = 'md', block }: CommonProps, extra?: string) {
  return ['ui-btn', `ui-btn-${variant}`, `ui-btn-${size}`, block ? 'ui-btn-block' : '', extra ?? '']
    .filter(Boolean)
    .join(' ')
}

interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** ขณะทำงานอยู่ ปุ่มจะถูกปิดและแสดงข้อความนี้แทน */
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  className?: string | undefined
}

/**
 * ปุ่มมาตรฐานของแอป
 *
 * ก่อนหน้านี้มีระบบปุ่มเจ็ดชุดที่ไม่แชร์อะไรกัน (.btn, .auth-submit, .editor-topbar-action,
 * .nc-action, .chip, .template-remix และปุ่มเฉพาะกิจอีกหลายตัว) ทำให้ขนาด มุมโค้ง
 * และสถานะ focus ไม่ตรงกันทั้งแอป
 */
export function Button({
  variant, size, icon, block, loading, loadingLabel, className, children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      type={rest.type ?? 'button'}
      className={classNames({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ui-btn-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  )
}

interface ButtonLinkProps extends CommonProps, Omit<LinkProps, 'className' | 'children'> {
  className?: string | undefined
}

/** ลิงก์ที่หน้าตาเหมือนปุ่ม — ใช้เมื่อการกดคือการนำทาง ไม่ใช่การกระทำ */
export function ButtonLink({ variant, size, icon, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classNames({ variant, size, block }, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </Link>
  )
}
