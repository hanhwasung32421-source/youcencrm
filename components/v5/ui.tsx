'use client'

import Link from 'next/link'
import { V5_SQL_FILE } from '@/lib/v5/tables'
import {
  COMPLIANCE_STATUS_LABEL,
  CONTRACT_STATUS_LABEL,
  DEAL_STAGE_LABEL,
  PARTNER_STATUS_LABEL,
  RISK_SEVERITY_LABEL,
  RISK_STATUS_LABEL,
  type ComplianceStatus,
  type ContractStatus,
  type DealStage,
  type PartnerStatus,
  type RiskSeverity,
  type RiskStatus
} from '@/lib/v5/types'

// 위젯 카드: header(icon+title+kebab) / body / footer(summary+link)
export function WidgetCard({
  icon,
  title,
  subtitle,
  menu,
  footer,
  footerLink,
  className = '',
  children
}: {
  icon: string
  title: string
  subtitle?: string
  menu?: React.ReactNode
  footer?: React.ReactNode
  footerLink?: { href: string; label: string }
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`v5-widget ${className}`}>
      <header className="v5-widget-head">
        <span className="v5-widget-icon" aria-hidden>
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v5-widget-title">{title}</div>
          {subtitle ? <div className="v5-widget-subtitle">{subtitle}</div> : null}
        </div>
        {menu ?? (
          <button type="button" className="v5-widget-kebab" aria-label="위젯 메뉴" title="위젯 메뉴">
            ⋯
          </button>
        )}
      </header>
      <div className="v5-widget-body">{children}</div>
      {footer || footerLink ? (
        <footer className="v5-widget-foot">
          <span>{footer}</span>
          {footerLink ? <Link href={footerLink.href}>{footerLink.label} →</Link> : null}
        </footer>
      ) : null}
    </section>
  )
}

export function SampleBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="v5-banner" role="status">
      <span aria-hidden>◔</span>
      <span>
        샘플 데이터 표시 중 — <code>{V5_SQL_FILE}</code> 실행 후 실데이터로 전환됩니다
      </span>
    </div>
  )
}

type Tone = 'neutral' | 'indigo' | 'green' | 'amber' | 'red'

export function Badge({ tone = 'neutral', children, plain }: { tone?: Tone; children: React.ReactNode; plain?: boolean }) {
  return <span className={`v5-badge ${tone === 'neutral' ? '' : tone} ${plain ? 'plain' : ''}`}>{children}</span>
}

const DEAL_TONE: Record<DealStage, Tone> = {
  lead: 'neutral',
  proposal: 'indigo',
  negotiation: 'indigo',
  contract: 'indigo',
  executing: 'amber',
  won: 'green',
  lost: 'red'
}

export function DealStageBadge({ stage }: { stage: DealStage }) {
  return <Badge tone={DEAL_TONE[stage]}>{DEAL_STAGE_LABEL[stage]}</Badge>
}

const CONTRACT_TONE: Record<ContractStatus, Tone> = { draft: 'neutral', signed: 'indigo', executing: 'green', expired: 'red' }

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={CONTRACT_TONE[status]}>{CONTRACT_STATUS_LABEL[status]}</Badge>
}

const PARTNER_TONE: Record<PartnerStatus, Tone> = { active: 'green', dormant: 'amber', closed: 'neutral' }

export function PartnerStatusBadge({ status }: { status: PartnerStatus }) {
  return <Badge tone={PARTNER_TONE[status]}>{PARTNER_STATUS_LABEL[status]}</Badge>
}

const COMPLIANCE_TONE: Record<ComplianceStatus, Tone> = { unchecked: 'neutral', passed: 'green', needs_fix: 'red' }

export function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  return <Badge tone={COMPLIANCE_TONE[status]}>{COMPLIANCE_STATUS_LABEL[status]}</Badge>
}

const SEVERITY_TONE: Record<RiskSeverity, Tone> = { low: 'neutral', medium: 'amber', high: 'red' }

export function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{RISK_SEVERITY_LABEL[severity]}</Badge>
}

const RISK_TONE: Record<RiskStatus, Tone> = { open: 'red', in_progress: 'amber', resolved: 'green' }

export function RiskStatusBadge({ status }: { status: RiskStatus }) {
  return <Badge tone={RISK_TONE[status]}>{RISK_STATUS_LABEL[status]}</Badge>
}

export function GradeChip({ grade }: { grade: 'A' | 'B' | 'C' }) {
  return <span className={`v5-grade ${grade}`}>{grade}</span>
}

// 우측 슬라이드 인 패널(생성/수정 폼용)
export function Drawer({
  open,
  title,
  onClose,
  footer,
  children
}: {
  open: boolean
  title: string
  onClose: () => void
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <>
      <div className="v5-drawer-backdrop" onClick={onClose} />
      <aside className="v5-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="v5-drawer-head">
          <div className="v5-drawer-title">{title}</div>
          <button type="button" className="v5-widget-kebab" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="v5-drawer-body">{children}</div>
        {footer ? <div className="v5-drawer-foot">{footer}</div> : null}
      </aside>
    </>
  )
}

export function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>
}
