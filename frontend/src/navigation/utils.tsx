import { type ServiceRole } from '../types'

export const ROLE_COLORS: Record<ServiceRole, string> = {
  none: '#94a3b8',
  consumer: '#8b5cf6',
  provider: '#0d9488',
  both: '#f59e0b',
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) + '…' : id
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const day = Math.floor(h / 24)
  return `${day}d ago`
}

export function AnimatedNumber({ value }: { value: number }) {
  return <>{value}</>
}
