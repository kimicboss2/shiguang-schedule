import { useMemo, useState } from 'react'
import { Bot, CalendarClock, Flame, Loader2, Plus, Sparkles, Swords, Target, Trash2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Goal } from '@/types'
import { useSchedule } from '@/lib/store'
import { isBoss, levelFromXp, monsterHp, streakFromLog } from '@/lib/game-utils'
import { addDays, parseISODate, toISODate, todayISO } from '@/lib/schedule-utils'
import { chatComplete, extractJson, isAiReady, loadAiConfig } from '@/lib/ai'
import { cn } from '@/lib/utils'

interface Props {
  onOpenEvent: (id: string) => void
  onOpenAiSettings: () => void
}

interface PlanStep {
  title: string
  date: string
  note: string
  checked: boolean
}

export function GrowthView({ onOpenEvent, onOpenAiSettings }: Props) {
  const { events, goals, xpLog, totalXp, newGoal, upsertGoal, deleteGoal, upsertEvent } = useSchedule()
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [goalError, setGoalError] = useState('')
  const [confirmingGoal, setConfirmingGoal] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState<string | null>(null)
  const [planFor, setPlanFor] = useState<Goal | null>(null)
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])

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

  /** AI 规划：为目标生成循序渐进的行动步骤 */
  const planGoal = async (goal: Goal) => {
    const cfg = loadAiConfig()
    if (!isAiReady(cfg)) {
      toast.error('请先配置 AI 助手')
      onOpenAiSettings()
      return
    }
    setPlanLoading(goal.id)
    try {
      const raw = await chatComplete(
        cfg,
        '你是行动计划助手。为用户的一个长期目标生成 3 到 5 个循序渐进的行动步骤，每步是可以直接放进日程的具体行动。只输出 JSON：{"steps":[{"title":"步骤标题，15 字以内","offset":7,"note":"一句话说明"}]}。offset 是建议距今天数（整数，递增，考虑截止期限）。不要输出其他内容。',
        `目标：${goal.title}\n今天：${today}\n截止：${goal.deadline || '未设截止'}`,
      )
      const parsed = extractJson<{ steps?: unknown }>(raw)
      const list = Array.isArray(parsed.steps) ? parsed.steps : []
      const steps: PlanStep[] = []
      for (const item of list.slice(0, 6)) {
        if (typeof item !== 'object' || item === null) continue
        const it = item as { title?: unknown; offset?: unknown; note?: unknown }
        if (typeof it.title !== 'string' || !it.title.trim()) continue
        const offset =
          typeof it.offset === 'number' && Number.isFinite(it.offset)
            ? Math.max(0, Math.min(365, Math.round(it.offset)))
            : 7
        steps.push({
          title: it.title.trim(),
          date: toISODate(addDays(new Date(), offset)),
          note: typeof it.note === 'string' ? it.note.trim() : '',
          checked: true,
        })
      }
      if (steps.length === 0) throw new Error('AI 没有给出可用步骤，请重试')
      setPlanFor(goal)
      setPlanSteps(steps)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI 规划失败，请重试')
    } finally {
      setPlanLoading(null)
    }
  }

  const applyPlan = () => {
    if (!planFor) return
    const chosen = planSteps.filter((s) => s.checked)
    for (const s of chosen) {
      upsertEvent({
        title: s.title,
        date: s.date,
        allDay: true,
        start: '',
        end: '',
        category: 'other',
        notes: s.note,
        reminder: 'none',
        goalId: planFor.id,
        subtasks: [],
      })
    }
    toast.success(`已把 ${chosen.length} 个步骤加入日程`, { description: `关联目标「${planFor.title}」` })
    setPlanFor(null)
    setPlanSteps([])
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">
        {/* 等级面板 */}
        <section aria-label="等级面板" className="overflow-hidden rounded-xl border bg-card">
          <div className="relative">
            <img
              src="./img/banner-cosmos.svg"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-card/25" />
            <div className="relative flex items-center gap-4 p-5">
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
              <div className="flex shrink-0 flex-col items-center rounded-lg bg-background/70 px-3 py-2 backdrop-blur-sm">
                <Flame className={cn('h-5 w-5', streak > 0 ? 'text-[#FF6B00]' : 'text-muted-foreground')} />
                <span className="tnum text-sm font-bold">{streak}</span>
                <span className="text-[10px] text-muted-foreground">连续天数</span>
              </div>
            </div>
          </div>
          <div className="tnum relative flex divide-x border-t bg-card text-center text-sm">
            <Stat label="总经验" value={totalXp} />
            <Stat label="已完成任务" value={doneCount} />
            <Stat label="进行中 BOSS" value={bosses.length} />
          </div>
        </section>

        {/* BOSS 挑战 */}
        <section className="mt-6" aria-label="BOSS 挑战">
          <SectionTitle icon={<Swords className="h-4 w-4" />} text="BOSS 挑战" />
          {bosses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center">
              <img src="./img/boss-beast.svg" alt="" aria-hidden className="h-20 w-20 rounded-2xl object-cover opacity-90" />
              <p className="text-sm text-muted-foreground">
                暂无进行中的 BOSS。给任务拆出 2 个以上子任务，它就会变成 BOSS。
              </p>
            </div>
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
                      <div className="flex items-center gap-3">
                        <img
                          src="./img/boss-beast.svg"
                          alt=""
                          aria-hidden
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
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
                        </div>
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
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle icon={<Target className="h-4 w-4" />} text="长期目标" />
            <button
              onClick={onOpenAiSettings}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bot className="h-3.5 w-3.5" />
              AI 助手设置
            </button>
          </div>
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
            <div className="mt-2 flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center">
              <img src="./img/empty-station.svg" alt="" aria-hidden className="h-24 w-auto rounded-lg object-cover opacity-90" />
              <p className="text-sm text-muted-foreground">
                还没有长期目标。立一个，然后让每天的日程为它积累进度。
              </p>
            </div>
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
                  planning={planLoading === goal.id}
                  onConfirmAsk={() => setConfirmingGoal(goal.id)}
                  onConfirmCancel={() => setConfirmingGoal(null)}
                  onDelete={() => {
                    deleteGoal(goal.id)
                    setConfirmingGoal(null)
                  }}
                  onPlan={() => planGoal(goal)}
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

      {/* AI 行动计划预览 */}
      <Dialog open={planFor !== null} onOpenChange={(o) => !o && setPlanFor(null)}>
        <DialogContent className="anim-pop sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 行动计划
            </DialogTitle>
            <DialogDescription>
              为目标「{planFor?.title}」生成的步骤，勾选后加入日程并自动关联该目标。
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50dvh] space-y-1.5 overflow-y-auto py-1">
            {planSteps.map((s, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50">
                  <Checkbox
                    checked={s.checked}
                    onCheckedChange={() =>
                      setPlanSteps((list) => list.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))
                    }
                    aria-label={`选择步骤「${s.title}」`}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.title}</span>
                    {s.note && <span className="mt-0.5 block text-xs text-muted-foreground">{s.note}</span>}
                  </span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">{s.date.slice(5)}</span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanFor(null)}>
              取消
            </Button>
            <Button onClick={applyPlan} disabled={planSteps.every((s) => !s.checked)}>
              加入日程（{planSteps.filter((s) => s.checked).length}）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  planning,
  onConfirmAsk,
  onConfirmCancel,
  onDelete,
  onPlan,
}: {
  goal: Goal
  total: number
  done: number
  pct: number
  today: string
  confirming: boolean
  planning: boolean
  onConfirmAsk: () => void
  onConfirmCancel: () => void
  onDelete: () => void
  onPlan: () => void
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
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onPlan}
            disabled={planning}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {planning ? '规划中…' : 'AI 规划'}
          </button>
          {confirming ? (
            <>
              <Button variant="destructive" size="sm" onClick={onDelete}>
                删除
              </Button>
              <Button variant="ghost" size="sm" onClick={onConfirmCancel}>
                取消
              </Button>
            </>
          ) : (
            <button
              onClick={onConfirmAsk}
              aria-label={`删除目标「${goal.title}」`}
              className="cursor-pointer p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#5541EA,#8B7CFF)' }}
        />
      </div>
      <div className="tnum mt-1 text-xs text-muted-foreground">
        {total === 0 ? '还没有关联的日程，可点「AI 规划」生成，或编辑日程手动关联' : `${done}/${total} 项关联日程已完成 · ${pct}%`}
      </div>
    </li>
  )
}
