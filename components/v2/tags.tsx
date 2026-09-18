'use client'

import {
  CONTENT_TYPE_LABELS,
  PRIORITY_LABELS,
  STAGE_LABELS,
  TOPIC_STATUS_LABELS,
  type ContentType,
  type Priority,
  type Stage,
  type TopicStatus
} from '@/lib/v2/types'

export function StageTag({ stage }: { stage: Stage }) {
  return <span className={`v2-tag stage-${stage}`}>{STAGE_LABELS[stage]}</span>
}

export function PriorityTag({ priority }: { priority: Priority }) {
  return <span className={`v2-tag prio-${priority}`}>{PRIORITY_LABELS[priority]}</span>
}

export function ContentTypeTag({ contentType }: { contentType: ContentType }) {
  return <span className={`v2-tag type-${contentType}`}>{CONTENT_TYPE_LABELS[contentType]}</span>
}

export function TopicStatusTag({ status }: { status: TopicStatus }) {
  return <span className={`v2-tag topic-${status}`}>{TOPIC_STATUS_LABELS[status]}</span>
}

export function LateTag() {
  return <span className="v2-tag late">지연</span>
}
