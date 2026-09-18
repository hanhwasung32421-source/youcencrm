'use client'

import { V2_SAMPLE_BANNER_TEXT } from '@/lib/v2/tables'

// API가 sample:true를 돌려줄 때(테이블 미생성) 페이지 상단에 보이는 안내 띠
export function SampleBanner({ show }: { show?: boolean }) {
  if (!show) return null
  return (
    <div className="v2-sample-banner" role="status">
      {V2_SAMPLE_BANNER_TEXT}
    </div>
  )
}
