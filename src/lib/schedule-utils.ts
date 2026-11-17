import type { CategoryId, Reminder } from '@/types'

export const CATEGORY_META: Record<
  CategoryId,
  { label: string; color: string; soft: string; text: string }
> = {
  work: { label: '工作', color: '#5541EA', soft: 'rgba(85,65,234,0.10)', text: '#3D2FB8' },
  life: { label: '生活', color: '#FCCF00', soft: 'rgba(252,207,0,0.16)', text: '#8A6D00' },
  study: { label: '学习', color: '#5551FF', soft: 'rgba(85,81,255,0.10)', text: '#3733C9' },
  health: { label: '健康', color: '#33C95B', soft: 'rgba(51,201,91,0.12)', text: '#177A38' },
  other: { label: '其他', color: '#FF8577', soft: 'rgba(255,133,119,0.14)', text: '#B23A2D' },
}

export const CATEGORY_ORDER: CategoryId[] = ['work', 'life', 'study', 'health', 'other']

export const REMINDER_META: Record<Reminder, { label: string; offsetMin: number | null }> = {
  none: { label: '不提醒', offsetMin: null },
  at: { label: '准时', offsetMin: 0 },
  min15: { label: '提前 15 分钟', offsetMin: 15 },
  hour1: { label: '提前 1 小时', offsetMin: 60 },
  day1: { label: '提前 1 天', offsetMin: 1440 },
}

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Date -> yyyy-MM-dd（本地时区） */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** 周一为一周起点 */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getDay() === 0 ? 7 : d.getDay()
  const r = new Date(d)
  r.setDate(d.getDate() - (day - 1))
  r.setHours(0, 0, 0, 0)
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function monthLabel(d: Date): string {
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

/** "3 月 9 日 – 3 月 15 日" */
export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const s = `${weekStart.getMonth() + 1} 月 ${weekStart.getDate()} 日`
  const e =
    weekStart.getMonth() === end.getMonth()
      ? `${end.getDate()} 日`
      : `${end.getMonth() + 1} 月 ${end.getDate()} 日`
  return `${s} – ${e}`
}

/** HH:mm -> 当天分钟数 */
export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fmtTime(t: string): string {
  return t
}

export function weekdayOf(iso: string): string {
  const d = parseISODate(iso)
  return WEEKDAYS[(d.getDay() + 6) % 7]
}

/** 日程的开始时间（分钟时间戳），全天事件按当天 8:00 算 */
export function eventStartTimestamp(date: string, allDay: boolean, start: string): number {
  const base = parseISODate(date).getTime()
  return base + (allDay ? 8 * 60 : timeToMin(start || '08:00')) * 60000
}
