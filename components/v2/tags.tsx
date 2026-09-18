'use client'

import { CONTENT_TYPE_LABELS, KEYWORD_STATUS_LABELS, PRIORITY_LABELS, type ContentType, type KeywordStatus, type Priority } from '@/lib/v2/types'

export function ContentTypeTag({ contentType }: { contentType: ContentType }) {
  return <span className={`v2-tag type-${contentType}`}>{CONTENT_TYPE_LABELS[contentType]}</span>
}

export function PriorityTag({ priority }: { priority: Priority }) {
  return <span className={`v2-tag prio-${priority}`}>{PRIORITY_LABELS[priority]}</span>
}

export function KeywordStatusTag({ status }: { status: KeywordStatus }) {
  return <span className={`v2-tag topic-${status === 'in_progress' ? 'assigned' : status === 'done' ? 'produced' : 'waiting'}`}>{KEYWORD_STATUS_LABELS[status]}</span>
}
