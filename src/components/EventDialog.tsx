import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Sparkles, Swords, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CategoryId, EventDraft, Reminder, ScheduleEvent, Subtask } from '@/types'
import { CATEGORY_META, CATEGORY_ORDER, REMINDER_META } from '@/lib/schedule-utils'
import { useSchedule } from '@/lib/store'
import { chatComplete, extractJson, isAiReady, loadAiConfig } from '@/lib/ai'
import { cn } from '@/lib/utils'

export interface DialogState {
  open: boolean
  /** 编辑已有日程时传入 */
  event?: ScheduleEvent
  /** 新建时的预填值 */
  prefill?: Partial<EventDraft>
}

interface Props {
  state: DialogState
  onClose: () => void
  onSave: (draft: EventDraft) => void
  onDelete: (id: string) => void
  /** 未配置 AI 时打开设置 */
  onNeedAiConfig: () => void
}

function subId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

const emptyDraft = (prefill?: Partial<EventDraft>): EventDraft => ({
  title: '',
  date: prefill?.date ?? new Date().toISOString().slice(0, 10),
  allDay: prefill?.allDay ?? false,
  start: prefill?.start ?? '09:00',
  end: prefill?.end ?? '10:00',
  category: prefill?.category ?? 'work',
  notes: prefill?.notes ?? '',
  reminder: prefill?.reminder ?? 'none',
  goalId: prefill?.goalId ?? null,
  subtasks: prefill?.subtasks ?? [],
})

export function EventDialog({ state, onClose, onSave, onDelete, onNeedAiConfig }: Props) {
  const { goals } = useSchedule()
  const editing = state.event
  const [draft, setDraft] = useState<EventDraft>(emptyDraft())
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [subtaskInput, setSubtaskInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!state.open) return
    setConfirmingDelete(false)
    setError('')
    setSubtaskInput('')
    setAiLoading(false)
    if (state.event) {
      const e = state.event
      setDraft({
        id: e.id,
        title: e.title,
        date: e.date,
        allDay: e.allDay,
        start: e.start || '09:00',
        end: e.end || '10:00',
        category: e.category,
        notes: e.notes,
        reminder: e.reminder,
        goalId: e.goalId,
        subtasks: e.subtasks,
      })
    } else {
      setDraft(emptyDraft(state.prefill))
    }
  }, [state.open, state.event, state.prefill])

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const addSubtask = () => {
    const title = subtaskInput.trim()
    if (!title) return
    const sub: Subtask = { id: subId(), title, done: false }
    setDraft((d) => ({ ...d, subtasks: [...d.subtasks, sub] }))
    setSubtaskInput('')
  }

  /** AI 拆解：把任务标题交给模型，返回 3–6 个子任务 */
  const aiBreakdown = async () => {
    const cfg = loadAiConfig()
    if (!isAiReady(cfg)) {
      toast.error('请先配置 AI 助手')
      onNeedAiConfig()
      return
    }
    if (!draft.title.trim()) {
      setError('先填写标题，AI 才能帮你拆解')
      return
    }
    setError('')
    setAiLoading(true)
    try {
      const raw = await chatComplete(
        cfg,
        '你是任务拆解助手。把用户给出的待办任务拆解成 3 到 6 个可执行的小步骤，每步一句话、动词开头、15 字以内、循序渐进。只输出 JSON：{"subtasks":["步骤1","步骤2"]}，不要输出其他内容。',
        `任务：${draft.title}${draft.notes.trim() ? `\n备注：${draft.notes.trim()}` : ''}`,
      )
      const parsed = extractJson<{ subtasks?: unknown }>(raw)
      const list = Array.isArray(parsed.subtasks)
        ? parsed.subtasks
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 8)
        : []
      if (list.length === 0) throw new Error('AI 没有给出可用步骤，请重试')
      setDraft((d) => ({
        ...d,
        subtasks: [...d.subtasks, ...list.map((t) => ({ id: subId(), title: t.trim(), done: false }))],
      }))
      toast.success(`AI 拆出了 ${list.length} 个子任务，可继续增删`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI 拆解失败，请重试')
    } finally {
      setAiLoading(false)
    }
  }

  const submit = () => {
    if (!draft.title.trim()) {
      setError('请填写日程标题')
      return
    }
    if (!draft.date) {
      setError('请选择日期')
      return
    }
    if (!draft.allDay && draft.end <= draft.start) {
      setError('结束时间需要晚于开始时间')
      return
    }
    onSave({ ...draft, title: draft.title.trim() })
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="anim-pop max-h-[90dvh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑日程' : '新建日程'}</DialogTitle>
          <DialogDescription>
            {editing ? '修改日程的详细信息。' : '把接下来的安排记录下来。'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="ev-title">标题</Label>
            <Input
              id="ev-title"
              autoFocus
              placeholder="要做什么？"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-date">日期</Label>
              <Input
                id="ev-date"
                type="date"
                value={draft.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>分类</Label>
              <div className="flex h-9 items-center gap-1.5">
                {CATEGORY_ORDER.map((c: CategoryId) => {
                  const meta = CATEGORY_META[c]
                  const active = draft.category === c
                  return (
                    <button
                      key={c}
                      type="button"
                      title={meta.label}
                      aria-label={`分类：${meta.label}`}
                      aria-pressed={active}
                      onClick={() => set('category', c)}
                      className={cn(
                        'h-7 w-7 cursor-pointer rounded-full transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        active
                          ? 'scale-110 ring-2 ring-offset-2'
                          : 'opacity-45 hover:opacity-90 hover:scale-105',
                      )}
                      style={{
                        backgroundColor: meta.color,
                        ['--tw-ring-color' as string]: active ? meta.color : undefined,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="ev-allday" className="cursor-pointer font-normal">
              全天
            </Label>
            <Switch
              id="ev-allday"
              checked={draft.allDay}
              onCheckedChange={(v) => set('allDay', v)}
            />
          </div>

          {!draft.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ev-start">开始时间</Label>
                <Input
                  id="ev-start"
                  type="time"
                  value={draft.start}
                  onChange={(e) => set('start', e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ev-end">结束时间</Label>
                <Input
                  id="ev-end"
                  type="time"
                  value={draft.end}
                  onChange={(e) => set('end', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>关联长期目标</Label>
            <Select
              value={draft.goalId ?? 'none'}
              onValueChange={(v) => set('goalId', v === 'none' ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不关联</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {goals.length === 0 && (
              <p className="text-xs text-muted-foreground">
                还没有长期目标，可在「成长」视图创建。
              </p>
            )}
          </div>

          {/* 困难任务拆解 */}
          <div className="grid gap-1.5 rounded-md border p-3">
            <div className="flex items-center gap-1.5">
              <Swords className="h-4 w-4 text-primary" />
              <Label>任务拆解</Label>
              {draft.subtasks.length >= 2 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  BOSS 战 · {draft.subtasks.filter((s) => s.done).length}/{draft.subtasks.length}
                </span>
              )}
              <button
                type="button"
                onClick={aiBreakdown}
                disabled={aiLoading}
                className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Sparkles className={cn('h-3.5 w-3.5', aiLoading && 'animate-spin')} />
                {aiLoading ? '拆解中…' : 'AI 拆解'}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              困难任务拆成小步骤逐个击破；子任务 ≥2 个时成为 BOSS，全部完成有额外经验。
            </p>
            {draft.subtasks.length > 0 && (
              <ul className="space-y-1">
                {draft.subtasks.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-sm"
                  >
                    <span className={cn('min-w-0 flex-1 truncate', s.done && 'line-through opacity-50')}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      aria-label={`删除子任务「${s.title}」`}
                      onClick={() =>
                        setDraft((d) => ({ ...d, subtasks: d.subtasks.filter((x) => x.id !== s.id) }))
                      }
                      className="cursor-pointer text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="添加一个子步骤，回车确认"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSubtask()
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" aria-label="添加子任务" onClick={addSubtask}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>提醒</Label>
            <Select value={draft.reminder} onValueChange={(v) => set('reminder', v as Reminder)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REMINDER_META) as Reminder[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {REMINDER_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ev-notes">备注</Label>
            <Textarea
              id="ev-notes"
              rows={2}
              placeholder="可选，补充地点、链接、注意事项……"
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <div>
            {editing &&
              (confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">确认删除？</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(editing.id)}
                  >
                    删除
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                    取消
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除
                </Button>
              ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={submit}>{editing ? '保存修改' : '创建日程'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
