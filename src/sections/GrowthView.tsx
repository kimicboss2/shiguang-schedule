import { useMemo, useState } from 'react'
import { CalendarClock, Flame, Plus, Sparkles, Swords, Target, Trash2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Goal } from '@/types'
import { useSchedule } from '@/lib/store'
import { isBoss, levelFromXp, monsterHp, streakFromLog } from '@/lib/game-utils'
import { parseISODate, todayISO } from '@/lib/schedule-utils'
import { cn } from '@/lib/utils'

interface Props {
  onOpenEvent: (id: string) => void
}

export function GrowthView({ onOpenEvent }: Props) {
  const { events, goals, xpLog, totalXp, newGoal, upsertGoal, deleteGoal } = useSchedule()
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [goalError, setGoalError] = useState('')
  const [confirmingGoal, setConfirmingGoal] = useState<string | null>(null)

  const level = levelFromXp(totalXp)
  const streak = streakFromLog(xpLog)
  const today = todayISO()

  const bosses = useMemo(
    () =>
      events
        .filter((e) => isBoss(e) && !e.done)
        .map((e) => ({ event: e, hp: monsterHp(e) }))
        .filter((b) => b.hp.remaining > 0)
        .sort((a, b) => a.event.date.localeCompare(b.event.date))
        .slice(0, 5),
    [events],
  )

  const goalStats = useMemo(() => {
    return goals.map((g) => {
      const linked = events.filter((e) => e.goalId === g.id)
      const done = linked.filter((e) => e.done).length
      return { goal: g, total: linked.length, done, pct: linked.length ? Math.round((done / linked.length) * 100) : 0 }
    })
  }, [goals, events])

  const recentXp = useMemo(() => [...xpLog].sort((a, b) => b.ts - a.ts).slice(0, 8), [xpLog])

  const doneCount = useMemo(() => events.filter((e) => e.done).length, [events])

  const addGoal = () => {
    const title = goalTitle.trim()
    if (!title) {
      setGoalError('请填写目标名称')
      return
    }
    upsertGoal(newGoal(title, goalDeadline))
    setGoalTitle('')
    setGoalDeadline('')
    setGoalError('')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">
        {/* 等级面板 */}
        <section
          aria-label="等级面板"
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="flex items-center gap-4 p-5">
            <div
              aria-hidden
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg,#5541EA 0%,#8B7CFF 100%)' }}
            >
              <Trophy className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight">Lv.{level.level}</span>
                <span className="truncate text-sm font-medium text-primary">{level.title}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.round((level.intoLevel / level.span) * 100)}%` }}
                />
              </div>
              <div className="tnum mt-1 text-xs text-muted-foreground">
                {totalXp} XP · 距 Lv.{level.level + 1} 还需 {level.nextLevelAt - totalXp} XP
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center rounded-lg bg-muted/60 px-3 py-2">
              <Flame className={cn('h-5 w-5', streak > 0 ? 'text-[#FF6B00]' : 'text-muted-foreground')} />
              <span className="tnum text-sm font-bold">{streak}</span>
              <span className="text-[10px] text-muted-foreground">连续天数</span>
            </div>
          </div>
          <div className="tnum flex divide-x border-t text-center text-sm">
            <Stat label="总经验" value={totalXp} />
            <Stat label="已完成任务" value={doneCount} />
            <Stat label="进行中 BOSS" value={bosses.length} />
          </div>
        </section>

        {/* BOSS 挑战 */}
        <section className="mt-6" aria-label="BOSS 挑战">
          <SectionTitle icon={<Swords className="h-4 w-4" />} text="BOSS 挑战" />
          {bosses.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              暂无进行中的 BOSS。给任务拆出 2 个以上子任务，它就会变成 BOSS。
            </p>
          ) : (
            <ul className="space-y-2">
              {bosses.map(({ event, hp }) => {
                const pct = Math.round(((hp.total - hp.remaining) / hp.total) * 100)
                return (
                  <li key={event.id}>
                    <button
                      onClick={() => onOpenEvent(event.id)}
                      className="w-full cursor-pointer rounded-lg border bg-card p-3.5 text-left transition-transform duration-150 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">{event.title}</span>
                        <span className="tnum shrink-0 text-xs text-muted-foreground">
                          {event.date.slice(5)} · HP {hp.remaining}/{hp.total}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-destructive transition-all duration-500"
                          style={{ width: `${100 - pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        每完成一个子任务削减一格血量，清零即击败 BOSS（+额外经验）
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* 长期目标 */}
        <section className="mt-6" aria-label="长期目标">
          <SectionTitle icon={<Target className="h-4 w-4" />} text="长期目标" />
          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="比如：三个月练出稳定晨跑习惯"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGoal()}
              />
              <div className="flex gap-2">
                <Input
                  type="date"
                  aria-label="目标截止日期"
                  className="w-[150px]"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                />
                <Button onClick={addGoal} className="shrink-0">
                  <Plus className="mr-1 h-4 w-4" />
                  立个目标
                </Button>
              </div>
            </div>
            {goalError && (
              <p role="alert" className="mt-1.5 text-xs text-destructive">
                {goalError}
              </p>
            )}
          </div>

          {goalStats.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              还没有长期目标。立一个，然后让每天的日程为它积累进度。
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {goalStats.map(({ goal, total, done, pct }) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  total={total}
                  done={done}
                  pct={pct}
                  today={today}
                  confirming={confirmingGoal === goal.id}
                  onConfirmAsk={() => setConfirmingGoal(goal.id)}
                  onConfirmCancel={() => setConfirmingGoal(null)}
                  onDelete={() => {
                    deleteGoal(goal.id)
                    setConfirmingGoal(null)
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        {/* 经验记录 */}
        <section className="mt-6 mb-10" aria-label="经验记录">
          <SectionTitle icon={<Sparkles className="h-4 w-4" />} text="最近经验记录" />
          {recentXp.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              完成任意任务即可获得第一笔经验。
            </p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {recentXp.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                  <span
                    className={cn(
                      'tnum w-12 shrink-0 font-semibold',
                      e.amount > 0 ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {e.amount > 0 ? `+${e.amount}` : e.amount}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">
                    {new Date(e.ts).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 py-2.5">
      <div className="font-bold">{value}</div>
      <div className="text-[11px] font-normal text-muted-foreground">{label}</div>
    </div>
  )
}

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
      <span className="text-primary">{icon}</span>
      {text}
    </h2>
  )
}

function GoalCard({
  goal,
  total,
  done,
  pct,
  today,
  confirming,
  onConfirmAsk,
  onConfirmCancel,
  onDelete,
}: {
  goal: Goal
  total: number
  done: number
  pct: number
  today: string
  confirming: boolean
  onConfirmAsk: () => void
  onConfirmCancel: () => void
  onDelete: () => void
}) {
  const daysLeft = goal.deadline
    ? Math.round((parseISODate(goal.deadline).getTime() - parseISODate(today).getTime()) / 86400000)
    : null
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{goal.title}</div>
          <div className="tnum mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {goal.deadline
              ? daysLeft !== null && daysLeft >= 0
                ? `${goal.deadline} 截止 · 还剩 ${daysLeft} 天`
                : `${goal.deadline} 截止 · 已超期 ${-daysLeft!} 天`
              : '未设截止日期'}
          </div>
        </div>
        {confirming ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              删除
            </Button>
            <Button variant="ghost" size="sm" onClick={onConfirmCancel}>
              取消
            </Button>
          </div>
        ) : (
          <button
            onClick={onConfirmAsk}
            aria-label={`删除目标「${goal.title}」`}
            className="shrink-0 cursor-pointer p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#5541EA,#8B7CFF)' }}
        />
      </div>
      <div className="tnum mt-1 text-xs text-muted-foreground">
        {total === 0 ? '还没有关联的日程，编辑日程时可关联到此目标' : `${done}/${total} 项关联日程已完成 · ${pct}%`}
      </div>
    </li>
  )
}
