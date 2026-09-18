'use client'

import { useEffect, useState } from 'react'
import { getDisplayVersion } from '@/lib/version/format'

// 상단(top-version)과 하단 푸터가 같은 표시 규칙(자정이 지나면 날짜, 오전 7시가
// 지나면 빌드 없이도 "-1"로 자동 전환)을 공유하도록 한 곳에 모았다.
export function VersionBadge({ version, className }: { version: string; className?: string }) {
  const [displayVersion, setDisplayVersion] = useState(() => getDisplayVersion(version))

  useEffect(() => {
    setDisplayVersion(getDisplayVersion(version))
    const timer = window.setInterval(() => {
      setDisplayVersion(getDisplayVersion(version))
    }, 60000)
    return () => window.clearInterval(timer)
  }, [version])

  return <div className={className}>버전 {displayVersion}</div>
}
