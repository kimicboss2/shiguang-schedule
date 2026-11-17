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
import { Trash2 } from 'lucide-react'
import type { CategoryId, EventDraft, Reminder, ScheduleEvent } from '@/types'
import { CATEGORY_META, CATEGORY_ORDER, REMINDER_META } from '@/lib/schedule-utils'
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
})

export function EventDialog({ state, onClose, onSave, onDelete }: Props) {
  const editing = state.event
  const [draft, setDraft] = useState<EventDraft>(emptyDraft())
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (!state.open) return
    setConfirmingDelete(false)
    setError('')
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
      })
    } else {
      setDraft(emptyDraft(state.prefill))
    }
  }, [state.open, state.event, state.prefill])

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

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
      <DialogContent className="anim-pop sm:max-w-[460px]">
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
