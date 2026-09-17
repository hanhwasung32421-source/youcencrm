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
  return <div className={`app-toast ${toast.tone}`}>{toast.text}</div>
}
