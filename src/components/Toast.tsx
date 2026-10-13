import { useEffect } from 'react'
import { useUI } from '../store/ui'

export function Toast() {
  const toast = useUI((s) => s.toast)
  const dismiss = useUI((s) => s.dismissToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(dismiss, 3200)
    return () => clearTimeout(t)
  }, [toast, dismiss])
  if (!toast) return null
  return (
    <div className={`toast ${toast.tone}`} role="status" onClick={dismiss}>
      {toast.message}
    </div>
  )
}
