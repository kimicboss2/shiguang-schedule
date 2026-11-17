import { useMemo } from 'react'
import type { ScheduleEvent } from '@/types'
import { useSchedule } from '@/lib/store'
import {
  CATEGORY_META,
  WEEKDAYS,
  addDays,
  isSameDay,
  parseISODate,
  startOfWeekMonday,
  toISODate,
  todayISO,
} from '@/lib/schedule-utils'
import { cn } from '@/lib/utils'

interface Props {
  /** 当前展示月份中的任意一天 */
  cursor: Date
  onOpenEvent: (id: string) => void
  onCreateAt: (dateISO: string) => void
}

const MAX_CHIPS = 3

export function MonthView({ cursor, onOpenEvent, onCreateAt }: Props) {
  const { visibleEvents } = useSchedule()
  const today = todayISO()

  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = startOfWeekMonday(first)
    const days: Date[] = []
    for (let i = 0; i < 42; i++) days.push(addDays(start, i))
    // 如果第 6 行整行都属于下个月，裁掉
    const trimmed =
      days[35].getMonth() !== cursor.getMonth() && days[28].getMonth() === cursor.getMonth()
        ? days.slice(0, 35)
        : days
    const rows: Date[][] = []
    for (let i = 0; i < trimmed.length; i += 7) rows.push(trimmed.slice(i, i + 7))
    return rows
  }, [cursor])

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>()
    for (const e of visibleEvents) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return (a.start || '') < (b.start || '') ? -1 : 1
      })
    }
    return map
  }, [visibleEvents])

  return (
    <div className="flex h-full flex-col">
      {/* 星期表头 */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              'py-2 text-center text-xs font-medium',
              i >= 5 ? 'text-muted-foreground/70' : 'text-muted-foreground',
            )}
          >
            周{w}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7">
        {weeks.flat().map((day) => {
          const iso = toISODate(day)
          const inMonth = day.getMonth() === cursor.getMonth()
          const isToday = isSameDay(day, parseISODate(today))
          const events = byDate.get(iso) ?? []
          const overflow = events.length - MAX_CHIPS
          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              aria-label={`${day.getMonth() + 1} 月 ${day.getDate()} 日，点击新建日程`}
              onClick={() => onCreateAt(iso)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCreateAt(iso)
                }
              }}
              className={cn(
                'group flex min-h-[92px] cursor-pointer flex-col gap-0.5 border-b border-r p-1.5 transition-colors duration-150 hover:bg-accent/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                '[&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-muted/30',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'tnum grid h-6 w-6 place-items-center rounded-full text-xs',
                    isToday
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : inMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground/60',
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="text-[10px] font-medium text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  + 新建
                </span>
              </div>

              {events.slice(0, MAX_CHIPS).map((e) => {
                const meta = CATEGORY_META[e.category]
                return (
                  <button
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpenEvent(e.id)
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-transform duration-150 hover:scale-[1.02]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      e.done && 'opacity-45 line-through',
                    )}
                    style={{ backgroundColor: meta.soft, color: meta.text }}
                  >
                    {!e.allDay && (
                      <span className="tnum shrink-0 font-medium">{e.start}</span>
                    )}
                    <span className="truncate">{e.title}</span>
                  </button>
                )
              })}
              {overflow > 0 && (
                <span className="px-1.5 text-[10px] text-muted-foreground">
                  还有 {overflow} 条…
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
