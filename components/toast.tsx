'use client'

import { useEffect, useState } from 'react'

type ToastState = { text: string; tone: 'success' | 'error' } | null

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showSuccess = (text: string) => setToast({ text, tone: 'success' })
  const showError = (text: string) => setToast({ text, tone: 'error' })

  return { toast, showSuccess, showError }
}

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  const isError = toast.tone === 'error'
  return (
    <div
      className={`app-toast ${toast.tone}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {toast.text}
    </div>
  )
}
