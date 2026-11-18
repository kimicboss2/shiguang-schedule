import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ListTodo, Plus, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/sections/Sidebar'
import { MonthView } from '@/sections/MonthView'
import { WeekView } from '@/sections/WeekView'
import { AgendaView } from '@/sections/AgendaView'
import { GrowthView } from '@/sections/GrowthView'
import { EventDialog, type DialogState } from '@/components/EventDialog'
import { ScheduleProvider, useSchedule } from '@/lib/store'
import type { EventDraft, ViewMode } from '@/types'
import {
  REMINDER_META,
  addDays,
  eventStartTimestamp,
  monthLabel,
  pad,
  startOfWeekMonday,
  weekLabel,
} from '@/lib/schedule-utils'
import { cn } from '@/lib/utils'

const MOBILE_NAV: { key: ViewMode; label: string; icon: typeof CalendarDays }[] = [
  { key: 'month', label: '月', icon: CalendarDays },
  { key: 'week', label: '周', icon: CalendarRange },
  { key: 'agenda', label: '待办', icon: ListTodo },
  { key: 'growth', label: '成长', icon: Trophy },
]

function useNotificationPermission() {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  )
  const request = useCallback(async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPerm(result)
    if (result === 'granted') toast.success('到点提醒已开启')
    else if (result === 'denied') toast.error('浏览器拒绝了通知权限，可在地址栏设置中重新开启')
  }, [])
  return { perm, request }
}

/** 提醒引擎：每 30 秒检查一次，到点的日程弹 toast + 系统通知 */
function useReminderEngine() {
  const { events } = useSchedule()
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      for (const e of events) {
        if (e.done || e.reminder === 'none') continue
        const offset = REMINDER_META[e.reminder].offsetMin
        if (offset === null) continue
        const startTs = eventStartTimestamp(e.date, e.allDay, e.start)
        const fireAt = startTs - offset * 60000
        const key = `${e.id}@${fireAt}`
        if (now >= fireAt && now < startTs + 30 * 60000 && !firedRef.current.has(key)) {
          firedRef.current.add(key)
          const timeText = e.allDay ? '全天' : `${e.start} 开始`
          const msg = `${e.title} · ${timeText}`
          toast(msg, { description: e.notes || undefined })
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('拾光日程提醒', { body: msg })
            } catch {
              /* 某些移动端浏览器不允许构造器调用，忽略 */
            }
          }
        }
      }
    }
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [events])
}

function Shell() {
  const { events, upsertEvent, deleteEvent, xpLog } = useSchedule()
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [dialog, setDialog] = useState<DialogState>({ open: false })
  const { perm, request } = useNotificationPermission()
  useReminderEngine()

  // 经验到账提示：只为新增的记录弹 toast，历史记录不弹
  const xpSeenRef = useRef<number | null>(null)
  useEffect(() => {
    if (xpSeenRef.current === null) {
      xpSeenRef.current = xpLog.length
      return
    }
    if (xpLog.length > xpSeenRef.current) {
      const fresh = xpLog.slice(xpSeenRef.current)
      xpSeenRef.current = xpLog.length
      for (const e of fresh) {
        if (e.amount > 0) toast.success(`+${e.amount} XP`, { description: e.label })
        else toast(`${e.amount} XP`, { description: e.label })
      }
    }
  }, [xpLog])

  const openCreate = useCallback((prefill?: Partial<EventDraft>) => {
    setDialog({ open: true, prefill })
  }, [])

  const openEdit = useCallback(
    (id: string) => {
      const ev = events.find((e) => e.id === id)
      if (ev) setDialog({ open: true, event: ev })
    },
    [events],
  )

  const closeDialog = useCallback(() => setDialog({ open: false }), [])

  const handleSave = useCallback(
    (draft: EventDraft) => {
      upsertEvent(draft)
      setDialog({ open: false })
      toast.success(draft.id ? '日程已更新' : '日程已创建', {
        description: `${draft.date}${draft.allDay ? ' · 全天' : ` · ${draft.start}`}`,
      })
    },
    [upsertEvent],
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteEvent(id)
      setDialog({ open: false })
      toast.success('日程已删除')
    },
    [deleteEvent],
  )

  const navigate = useCallback(
    (dir: -1 | 0 | 1) => {
      setCursor((c) => {
        if (dir === 0) return new Date()
        const d = new Date(c)
        if (view === 'month') d.setMonth(d.getMonth() + dir)
        else if (view === 'week') return addDays(d, dir * 7)
        return d
      })
    },
    [view],
  )

  const title = useMemo(() => {
    if (view === 'month') return monthLabel(cursor)
    if (view === 'week') return weekLabel(startOfWeekMonday(cursor))
    if (view === 'growth') return '目标与成长'
    return '待办清单'
  }, [view, cursor])

  const quickAddFromWeek = useCallback(
    (dateISO: string, startHHmm: string) => {
      const [h, m] = startHHmm.split(':').map(Number)
      const endMin = Math.min(h * 60 + m + 60, 23 * 60 + 59)
      openCreate({
        date: dateISO,
        start: startHHmm,
        end: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`,
      })
    },
    [openCreate],
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* 桌面侧边栏 */}
      <div className="hidden md:block">
        <Sidebar
          view={view}
          onViewChange={setView}
          onCreate={() => openCreate()}
          onOpenEvent={openEdit}
          notifyPermission={perm}
          onRequestNotify={request}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 工具栏 */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 md:px-5">
          {/* 移动端品牌 */}
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold text-white md:hidden"
            style={{ background: 'linear-gradient(135deg,#5541EA 0%,#8B7CFF 100%)' }}
          >
            拾
          </span>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight md:text-lg">
            {title}
          </h1>

          {(view === 'month' || view === 'week') && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="上一页" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(0)}>
                今天
              </Button>
              <Button variant="outline" size="icon" aria-label="下一页" onClick={() => navigate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button size="sm" className="hidden md:inline-flex" onClick={() => openCreate()}>
            <Plus className="mr-1 h-4 w-4" />
            新建
          </Button>
        </header>

        {/* 主视图 */}
        <main className="min-h-0 flex-1 pb-16 md:pb-0">
          {view === 'month' && (
            <MonthView cursor={cursor} onOpenEvent={openEdit} onCreateAt={(d) => openCreate({ date: d })} />
          )}
          {view === 'week' && (
            <WeekView cursor={cursor} onOpenEvent={openEdit} onCreateAt={quickAddFromWeek} />
          )}
          {view === 'agenda' && <AgendaView onOpenEvent={openEdit} onCreate={() => openCreate()} />}
          {view === 'growth' && <GrowthView onOpenEvent={openEdit} />}
        </main>
      </div>

      {/* 移动端底部导航 */}
      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {MOBILE_NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-current={view === key ? 'page' : undefined}
            className={cn(
              'flex min-h-[52px] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              view === key ? 'font-medium text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
        <button
          onClick={() => openCreate()}
          aria-label="新建日程"
          className="flex min-h-[52px] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-xs text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" />
          </span>
          新建
        </button>
      </nav>

      <EventDialog state={dialog} onClose={closeDialog} onSave={handleSave} onDelete={handleDelete} />
    </div>
  )
}

export default function Home() {
  return (
    <ScheduleProvider>
      <Shell />
    </ScheduleProvider>
  )
}
