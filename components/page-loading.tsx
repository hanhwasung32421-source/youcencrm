'use client'

export function PageLoading({ text = '불러오는 중입니다...' }: { text?: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-modal">
        <div className="loading-spinner" />
        <div className="loading-text">{text}</div>
      </div>
    </div>
  )
}
