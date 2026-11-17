import { useMemo, useState } from 'react'
import { CalendarPlus, CheckCircle2, ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { ScheduleEvent } from '@/types'
import { useSchedule } from '@/lib/store'
import {
  CATEGORY_META,
  eventStartTimestamp,
  parseISODate,
  todayISO,
  weekdayOf,
} from '@/lib/schedule-utils'
import { cn } from '@/lib/utils'

interface Props {
  onOpenEvent: (id: string) => void
  onCreate: () => void
}

interface Group {
  key: string
  label: string
  overdue: boolean
  events: ScheduleEvent[]
}

export function AgendaView({ onOpenEvent, onCreate }: Props) {
  const { visibleEvents, toggleDone } = useSchedule()
  const [showDone, setShowDone] = useState(false)
  const today = todayISO()
  const tomorrow = (() => {
    const d = parseISODate(today)
    d.setDate(d.getDate() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const { groups, doneList } = useMemo(() => {
    const pending = visibleEvents
      .filter((e) => !e.done)
      .sort((a, b) => eventStartTimestamp(a.date, a.allDay, a.start) - eventStartTimestamp(b.date, b.allDay, b.start))
    const done = visibleEvents
      .filter((e) => e.done)
      .sort((a, b) => eventStartTimestamp(b.date, b.allDay, b.start) - eventStartTimestamp(a.date, a.allDay, a.start))

    const map = new Map<string, ScheduleEvent[]>()
    for (const e of pending) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    const groups: Group[] = [...map.entries()].map(([date, events]) => ({
      key: date,
      label:
        date === today
          ? `今天 · ${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日 周${weekdayOf(date)}`
          : date === tomorrow
            ? `明天 · ${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日 周${weekdayOf(date)}`
            : `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日 周${weekdayOf(date)}`,
      overdue: date < today,
      events,
    }))
    return { groups, doneList: done }
  }, [visibleEvents, today, tomorrow])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary/60" />
            <div>
              <p className="font-medium">没有待办的日程</p>
              <p className="mt-1 text-sm text-muted-foreground">
                全部安排都完成了，或者还没开始规划。
              </p>
            </div>
            <button
              onClick={onCreate}
              className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <CalendarPlus className="h-4 w-4" />
              安排第一件事
            </button>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.key} className="mb-6">
            <h2
              className={cn(
                'sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/95 px-1 py-2 text-sm font-semibold backdrop-blur',
                g.overdue && 'text-destructive',
              )}
            >
              {g.label}
              {g.overdue && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium">
                  已过期
                </span>
              )}
              <span className="text-xs font-normal text-muted-foreground">
                {g.events.length} 项
              </span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {g.events.map((e) => (
                <AgendaRow key={e.id} event={e} onOpen={() => onOpenEvent(e.id)} onToggle={() => toggleDone(e.id)} />
              ))}
            </ul>
          </section>
        ))}

        {doneList.length > 0 && (
          <section className="mb-10">
            <button
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="flex cursor-pointer items-center gap-1.5 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform duration-200', !showDone && '-rotate-90')}
              />
              已完成（{doneList.length}）
            </button>
            {showDone && (
              <ul className="anim-pop divide-y rounded-lg border bg-card opacity-90">
                {doneList.map((e) => (
                  <AgendaRow key={e.id} event={e} onOpen={() => onOpenEvent(e.id)} onToggle={() => toggleDone(e.id)} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function AgendaRow({
  event,
  onOpen,
  onToggle,
}: {
  event: ScheduleEvent
  onOpen: () => void
  onToggle: () => void
}) {
  const meta = CATEGORY_META[event.category]
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Checkbox
        checked={event.done}
        onCheckedChange={onToggle}
        aria-label={`标记「${event.title}」为${event.done ? '未完成' : '已完成'}`}
      />
      <button
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 rounded-md text-left transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <span className="tnum w-[88px] shrink-0 text-xs text-muted-foreground">
          {event.allDay ? '全天' : `${event.start} – ${event.end}`}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm',
            event.done ? 'text-muted-foreground line-through' : '',
          )}
        >
          {event.title}
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: meta.soft, color: meta.text }}
        >
          {meta.label}
        </span>
      </button>
    </li>
  )
}
