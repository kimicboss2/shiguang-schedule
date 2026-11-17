import { useEffect, useMemo, useRef, useState } from 'react'
import type { ScheduleEvent } from '@/types'
import { useSchedule } from '@/lib/store'
import {
  CATEGORY_META,
  WEEKDAYS,
  addDays,
  pad,
  startOfWeekMonday,
  timeToMin,
  toISODate,
  todayISO,
} from '@/lib/schedule-utils'
import { cn } from '@/lib/utils'

const DAY_START = 6 // 6:00
const DAY_END = 24 // 24:00
const HOUR_PX = 48

interface Props {
  /** 所在周中的任意一天 */
  cursor: Date
  onOpenEvent: (id: string) => void
  onCreateAt: (dateISO: string, startHHmm: string) => void
}

export function WeekView({ cursor, onOpenEvent, onCreateAt }: Props) {
  const { visibleEvents } = useSchedule()
  const today = todayISO()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const weekStart = useMemo(() => startOfWeekMonday(cursor), [cursor])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const { timed, allDay } = useMemo(() => {
    const inWeek = visibleEvents.filter((e) => {
      const d = parseISO(e.date)
      return d >= weekStart && d < addDays(weekStart, 7)
    })
    return {
      timed: inWeek.filter((e) => !e.allDay),
      allDay: inWeek.filter((e) => e.allDay),
    }
  }, [visibleEvents, weekStart])

  // 打开时滚到当前时刻附近
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const h = new Date().getHours()
    el.scrollTop = Math.max(0, (Math.min(h, DAY_END) - DAY_START - 1) * HOUR_PX)
  }, [])

  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i)
  const totalH = (DAY_END - DAY_START) * HOUR_PX
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const showNowLine = nowMin >= DAY_START * 60 && nowMin <= DAY_END * 60

  return (
    <div className="flex h-full flex-col">
      {/* 列头 */}
      <div className="grid shrink-0 grid-cols-[56px_repeat(7,1fr)] border-b">
        <div />
        {days.map((d, i) => {
          const isToday = toISODate(d) === today
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 border-l py-2">
              <span className="text-[10px] font-medium uppercase text-muted-foreground">
                周{WEEKDAYS[i]}
              </span>
              <span
                className={cn(
                  'tnum grid h-7 w-7 place-items-center rounded-full text-sm',
                  isToday ? 'bg-primary font-semibold text-primary-foreground' : '',
                )}
              >
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* 全天事件条 */}
      {allDay.length > 0 && (
        <div className="grid shrink-0 grid-cols-[56px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="py-1 text-center text-[10px] leading-6 text-muted-foreground">全天</div>
          {days.map((d, i) => {
            const iso = toISODate(d)
            return (
              <div key={i} className="space-y-0.5 border-l p-1">
                {allDay
                  .filter((e) => e.date === iso)
                  .map((e) => {
                    const meta = CATEGORY_META[e.category]
                    return (
                      <button
                        key={e.id}
                        onClick={() => onOpenEvent(e.id)}
                        className={cn(
                          'block w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-transform duration-150 hover:scale-[1.02]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          e.done && 'opacity-45 line-through',
                        )}
                        style={{ backgroundColor: meta.soft, color: meta.text }}
                      >
                        {e.title}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>
      )}

      {/* 时间网格 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: totalH }}>
          {/* 时间刻度 */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="tnum absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: (h - DAY_START) * HOUR_PX }}
              >
                {pad(h)}:00
              </div>
            ))}
          </div>

          {days.map((d, colIdx) => {
            const iso = toISODate(d)
            const isToday = iso === today
            const dayEvents = timed.filter((e) => e.date === iso)
            return (
              <div
                key={colIdx}
                className={cn('relative border-l', isToday && 'bg-accent/30')}
              >
                {/* 小时线 + 点击新建区域 */}
                {hours.map((h) => (
                  <button
                    key={h}
                    aria-label={`${iso} ${pad(h)}:00 新建日程`}
                    onClick={() => onCreateAt(iso, `${pad(h)}:00`)}
                    className="block w-full cursor-pointer border-b border-border/60 transition-colors duration-100 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    style={{ height: HOUR_PX }}
                  />
                ))}

                {/* 当前时间线 */}
                {isToday && showNowLine && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-0 right-0 z-10"
                    style={{ top: ((nowMin - DAY_START * 60) / 60) * HOUR_PX }}
                  >
                    <div className="relative h-px bg-primary">
                      <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-primary" />
                    </div>
                  </div>
                )}

                {/* 事件块 */}
                {dayEvents.map((e) => (
                  <EventBlock key={e.id} event={e} onOpen={() => onOpenEvent(e.id)} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function parseISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function EventBlock({ event, onOpen }: { event: ScheduleEvent; onOpen: () => void }) {
  const meta = CATEGORY_META[event.category]
  const start = timeToMin(event.start)
  const end = Math.max(timeToMin(event.end), start + 20)
  const top = ((start - DAY_START * 60) / 60) * HOUR_PX
  const height = Math.max(((end - start) / 60) * HOUR_PX, 20)
  return (
    <button
      onClick={onOpen}
      title={`${event.start}–${event.end} ${event.title}`}
      className={cn(
        'absolute left-1 right-1 z-[5] cursor-pointer overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left transition-transform duration-150 hover:z-20 hover:scale-[1.02]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        event.done && 'opacity-45',
      )}
      style={{
        top,
        height,
        backgroundColor: meta.soft,
        borderLeftColor: meta.color,
        color: meta.text,
      }}
    >
      <div className={cn('truncate text-[11px] font-medium leading-tight', event.done && 'line-through')}>
        {event.title}
      </div>
      {height >= 36 && (
        <div className="tnum text-[10px] leading-tight opacity-80">
          {event.start} – {event.end}
        </div>
      )}
    </button>
  )
}
