import { Bell, BellRing, CalendarDays, CalendarRange, ListTodo, Plus, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { CategoryId, ViewMode } from '@/types'
import { useSchedule } from '@/lib/store'
import { levelFromXp } from '@/lib/game-utils'
import { CATEGORY_META, CATEGORY_ORDER, todayISO, weekdayOf } from '@/lib/schedule-utils'
import { cn } from '@/lib/utils'

const NAV: { key: ViewMode; label: string; icon: typeof CalendarDays }[] = [
  { key: 'month', label: '月视图', icon: CalendarDays },
  { key: 'week', label: '周视图', icon: CalendarRange },
  { key: 'agenda', label: '待办清单', icon: ListTodo },
  { key: 'growth', label: '目标与成长', icon: Trophy },
]

interface Props {
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  onCreate: () => void
  onOpenEvent: (id: string) => void
  notifyPermission: NotificationPermission | 'unsupported'
  onRequestNotify: () => void
}

export function Sidebar({
  view,
  onViewChange,
  onCreate,
  onOpenEvent,
  notifyPermission,
  onRequestNotify,
}: Props) {
  const { visibleEvents, filters, toggleCategory, totalXp } = useSchedule()
  const level = levelFromXp(totalXp)
  const today = todayISO()
  const todayEvents = visibleEvents
    .filter((e) => e.date === today && !e.done)
    .sort((a, b) => (a.start || '99') < (b.start || '99') ? -1 : 1)

  return (
    <aside className="flex h-full w-[270px] shrink-0 flex-col border-r bg-sidebar">
      {/* 品牌 */}
      <div className="flex items-center gap-2.5 px-5 pb-2 pt-6">
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-lg text-[15px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#5541EA 0%,#8B7CFF 100%)' }}
        >
          拾
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">拾光日程</div>
          <div className="text-xs text-muted-foreground">把时间收进口袋</div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <Button className="w-full justify-start gap-2 shadow-sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          新建日程
        </Button>
      </div>

      {/* 视图导航 */}
      <nav className="px-3 pt-5" aria-label="视图切换">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            aria-current={view === key ? 'page' : undefined}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              view === key
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-muted',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* 等级速览 */}
      <button
        onClick={() => onViewChange('growth')}
        aria-label={`当前等级 Lv.${level.level} ${level.title}，查看目标与成长`}
        className={cn(
          'mx-4 mt-3 cursor-pointer rounded-lg border bg-card px-3 py-2.5 text-left transition-transform duration-150 hover:scale-[1.01]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <div className="flex items-baseline justify-between">
          <span className="tnum text-sm font-bold">Lv.{level.level}</span>
          <span className="text-xs font-medium text-primary">{level.title}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.round((level.intoLevel / level.span) * 100)}%` }}
          />
        </div>
        <div className="tnum mt-1 text-[10px] text-muted-foreground">
          {totalXp} XP · 距下一级 {level.nextLevelAt - totalXp} XP
        </div>
      </button>

      <Separator className="mx-5 my-4 w-auto" />

      {/* 分类筛选 */}
      <div className="px-5">
        <div className="pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          分类筛选
        </div>
        <div className="space-y-0.5">
          {CATEGORY_ORDER.map((c: CategoryId) => {
            const meta = CATEGORY_META[c]
            const on = filters[c]
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                aria-pressed={on}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-opacity duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'opacity-100 hover:bg-muted' : 'opacity-40 hover:opacity-70',
                )}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
                <span className="ml-auto text-xs text-muted-foreground">
                  {on ? '显示' : '隐藏'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <Separator className="mx-5 my-4 w-auto" />

      {/* 今日概览 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 scrollbar-none">
        <div className="pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          今天 · 周{weekdayOf(today)}
        </div>
        {todayEvents.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-3 text-xs leading-relaxed text-muted-foreground">
            今天没有待办的日程，好好休息，或点上方「新建日程」安排点什么。
          </p>
        ) : (
          <ul className="space-y-1 pb-2">
            {todayEvents.map((e) => {
              const meta = CATEGORY_META[e.category]
              return (
                <li key={e.id}>
                  <button
                    onClick={() => onOpenEvent(e.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-muted',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <span
                      aria-hidden
                      className="mt-1 h-2 w-2 shrink-0 self-center rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="tnum shrink-0 text-xs text-muted-foreground">
                      {e.allDay ? '全天' : e.start}
                    </span>
                    <span className="truncate">{e.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 通知提醒 */}
      <div className="border-t px-4 py-3">
        {notifyPermission === 'granted' ? (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <BellRing className="h-3.5 w-3.5 text-primary" />
            到点提醒已开启
          </div>
        ) : notifyPermission === 'unsupported' ? null : (
          <button
            onClick={onRequestNotify}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Bell className="h-3.5 w-3.5" />
            {notifyPermission === 'denied' ? '通知已被浏览器拦截' : '开启到点提醒'}
          </button>
        )}
      </div>
    </aside>
  )
}
