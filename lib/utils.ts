import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(date instanceof Date ? date : new Date(date))
}

export function formatDateTime(date: Date | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date instanceof Date ? date : new Date(date))
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20'
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20'
  }
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}
