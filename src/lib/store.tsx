import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { CategoryId, EventDraft, Goal, ScheduleEvent, XpEntry } from '@/types'
import { addDays, todayISO, toISODate } from '@/lib/schedule-utils'
import { XP, isBoss } from '@/lib/game-utils'

const STORAGE_KEY = 'shiguang.events.v1'
const FILTER_KEY = 'shiguang.filters.v1'
const GOAL_KEY = 'shiguang.goals.v1'
const XP_KEY = 'shiguang.xp.v1'

function uid(): string {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 首次启动时的示例数据，帮助用户理解产品形态，可自由删除 */
function seedEvents(): ScheduleEvent[] {
  const today = new Date()
  const iso = (d: Date) => toISODate(d)
  const now = Date.now()
  const base = { notes: '', reminder: 'none' as const, done: false, goalId: null, createdAt: now }
  return [
    {
      ...base,
      id: uid(),
      title: '欢迎使用拾光日程',
      date: iso(today),
      allDay: true,
      start: '',
      end: '',
      category: 'other',
      notes: '点击任意日期即可新建日程；点击这条日程可以编辑或删除我。',
      subtasks: [],
    },
    {
      ...base,
      id: uid(),
      title: '晨跑 5 公里',
      date: iso(today),
      allDay: false,
      start: '07:00',
      end: '07:45',
      category: 'health',
      reminder: 'min15',
      subtasks: [],
    },
    {
      ...base,
      id: uid(),
      title: '准备季度述职（BOSS）',
      date: iso(addDays(today, 1)),
      allDay: false,
      start: '10:00',
      end: '11:00',
      category: 'work',
      reminder: 'hour1',
      notes: '这是一个拆解示例：子任务可以在待办清单里逐个勾选，击败 BOSS 有额外经验。',
      subtasks: [
        { id: uid(), title: '整理本季度数据', done: false },
        { id: uid(), title: '写完述职 PPT 初稿', done: false },
        { id: uid(), title: '找同事试讲一遍', done: false },
      ],
    },
    {
      ...base,
      id: uid(),
      title: '读完《深度工作》第 4 章',
      date: iso(addDays(today, 2)),
      allDay: false,
      start: '21:00',
      end: '22:00',
      category: 'study',
      subtasks: [],
    },
    {
      ...base,
      id: uid(),
      title: '给妈妈打电话',
      date: iso(addDays(today, 4)),
      allDay: false,
      start: '20:00',
      end: '20:30',
      category: 'life',
      reminder: 'at',
      subtasks: [],
    },
  ]
}

function seedGoals(): Goal[] {
  const d = new Date()
  d.setDate(d.getDate() + 90)
  return [
    {
      id: uid(),
      title: '三个月练出稳定晨跑习惯',
      deadline: toISODate(d),
      createdAt: Date.now(),
    },
  ]
}

/** 旧版本存档迁移：补齐 goalId / subtasks 字段 */
function migrateEvent(e: Partial<ScheduleEvent> & { id: string; title: string }): ScheduleEvent {
  return {
    date: todayISO(),
    allDay: false,
    start: '',
    end: '',
    category: 'other',
    notes: '',
    reminder: 'none',
    done: false,
    createdAt: Date.now(),
    ...e,
    goalId: e.goalId ?? null,
    subtasks: Array.isArray(e.subtasks) ? e.subtasks : [],
  }
}

function loadJson<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      const v = fallback()
      localStorage.setItem(key, JSON.stringify(v))
      return v
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback()
  }
}

function loadEvents(): ScheduleEvent[] {
  const list = loadJson<unknown>(STORAGE_KEY, seedEvents)
  return Array.isArray(list) ? list.map((e) => migrateEvent(e as never)) : []
}

function loadFilters(): Record<CategoryId, boolean> {
  const all: Record<CategoryId, boolean> = {
    work: true,
    life: true,
    study: true,
    health: true,
    other: true,
  }
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      for (const k of Object.keys(all) as CategoryId[]) {
        if (typeof parsed[k] === 'boolean') all[k] = parsed[k]
      }
    }
  } catch {
    /* ignore */
  }
  return all
}

type Action =
  | { type: 'upsert'; draft: EventDraft }
  | { type: 'delete'; id: string }
  | { type: 'toggleDone'; id: string }
  | { type: 'toggleSubtask'; eventId: string; subtaskId: string }
  | { type: 'toggleCategory'; category: CategoryId }
  | { type: 'upsertGoal'; goal: Goal }
  | { type: 'deleteGoal'; id: string }

interface State {
  events: ScheduleEvent[]
  goals: Goal[]
  xpLog: XpEntry[]
  filters: Record<CategoryId, boolean>
}

function xpEntry(amount: number, label: string): XpEntry {
  return { id: uid(), ts: Date.now(), amount, label }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'upsert': {
      const { draft } = action
      if (draft.id) {
        return {
          ...state,
          events: state.events.map((e) =>
            e.id === draft.id ? { ...e, ...draft, id: draft.id } : e,
          ),
        }
      }
      const ev: ScheduleEvent = {
        ...draft,
        id: uid(),
        done: false,
        createdAt: Date.now(),
      }
      return { ...state, events: [...state.events, ev] }
    }
    case 'delete':
      return { ...state, events: state.events.filter((e) => e.id !== action.id) }
    case 'toggleDone': {
      const target = state.events.find((e) => e.id === action.id)
      if (!target) return state
      const completing = !target.done
      const entries: XpEntry[] = []
      const sign = completing ? 1 : -1
      entries.push(
        xpEntry(sign * XP.TASK, `${completing ? '完成' : '取消完成'}任务「${target.title}」`),
      )
      if (isBoss(target)) {
        entries.push(
          xpEntry(
            sign * XP.BOSS_BONUS,
            `${completing ? '击败' : '复活'} BOSS「${target.title}」`,
          ),
        )
      }
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.id ? { ...e, done: completing } : e)),
        xpLog: [...state.xpLog, ...entries],
      }
    }
    case 'toggleSubtask': {
      const target = state.events.find((e) => e.id === action.eventId)
      if (!target) return state
      const sub = target.subtasks.find((s) => s.id === action.subtaskId)
      if (!sub) return state
      const completing = !sub.done
      const sign = completing ? 1 : -1
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.eventId
            ? {
                ...e,
                subtasks: e.subtasks.map((s) =>
                  s.id === action.subtaskId ? { ...s, done: completing } : s,
                ),
              }
            : e,
        ),
        xpLog: [
          ...state.xpLog,
          xpEntry(
            sign * XP.SUBTASK,
            `${completing ? '攻击' : '撤回攻击'} BOSS「${target.title}」：${sub.title}`,
          ),
        ],
      }
    }
    case 'toggleCategory':
      return {
        ...state,
        filters: { ...state.filters, [action.category]: !state.filters[action.category] },
      }
    case 'upsertGoal': {
      const exists = state.goals.some((g) => g.id === action.goal.id)
      return {
        ...state,
        goals: exists
          ? state.goals.map((g) => (g.id === action.goal.id ? action.goal : g))
          : [...state.goals, action.goal],
      }
    }
    case 'deleteGoal':
      return {
        ...state,
        goals: state.goals.filter((g) => g.id !== action.id),
        // 解除关联，不删任务
        events: state.events.map((e) => (e.goalId === action.id ? { ...e, goalId: null } : e)),
      }
  }
}

interface ScheduleContextValue {
  events: ScheduleEvent[]
  visibleEvents: ScheduleEvent[]
  goals: Goal[]
  xpLog: XpEntry[]
  totalXp: number
  filters: Record<CategoryId, boolean>
  upsertEvent: (draft: EventDraft) => void
  deleteEvent: (id: string) => void
  toggleDone: (id: string) => void
  toggleSubtask: (eventId: string, subtaskId: string) => void
  toggleCategory: (c: CategoryId) => void
  upsertGoal: (goal: Goal) => void
  deleteGoal: (id: string) => void
  newGoal: (title: string, deadline: string) => Goal
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null)

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    events: loadEvents(),
    goals: loadJson<Goal[]>(GOAL_KEY, seedGoals),
    xpLog: loadJson<XpEntry[]>(XP_KEY, () => []),
    filters: loadFilters(),
  }))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events))
  }, [state.events])
  useEffect(() => {
    localStorage.setItem(GOAL_KEY, JSON.stringify(state.goals))
  }, [state.goals])
  useEffect(() => {
    localStorage.setItem(XP_KEY, JSON.stringify(state.xpLog))
  }, [state.xpLog])
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(state.filters))
  }, [state.filters])

  const upsertEvent = useCallback((draft: EventDraft) => dispatch({ type: 'upsert', draft }), [])
  const deleteEvent = useCallback((id: string) => dispatch({ type: 'delete', id }), [])
  const toggleDone = useCallback((id: string) => dispatch({ type: 'toggleDone', id }), [])
  const toggleSubtask = useCallback(
    (eventId: string, subtaskId: string) => dispatch({ type: 'toggleSubtask', eventId, subtaskId }),
    [],
  )
  const toggleCategory = useCallback(
    (category: CategoryId) => dispatch({ type: 'toggleCategory', category }),
    [],
  )
  const upsertGoal = useCallback((goal: Goal) => dispatch({ type: 'upsertGoal', goal }), [])
  const deleteGoal = useCallback((id: string) => dispatch({ type: 'deleteGoal', id }), [])
  const newGoal = useCallback(
    (title: string, deadline: string): Goal => ({ id: uid(), title, deadline, createdAt: Date.now() }),
    [],
  )

  const totalXp = useMemo(() => state.xpLog.reduce((s, e) => s + e.amount, 0), [state.xpLog])
  const visibleEvents = useMemo(
    () => state.events.filter((e) => state.filters[e.category]),
    [state.events, state.filters],
  )

  const value = useMemo(
    () => ({
      events: state.events,
      visibleEvents,
      goals: state.goals,
      xpLog: state.xpLog,
      totalXp,
      filters: state.filters,
      upsertEvent,
      deleteEvent,
      toggleDone,
      toggleSubtask,
      toggleCategory,
      upsertGoal,
      deleteGoal,
      newGoal,
    }),
    [
      state.events,
      visibleEvents,
      state.goals,
      state.xpLog,
      totalXp,
      state.filters,
      upsertEvent,
      deleteEvent,
      toggleDone,
      toggleSubtask,
      toggleCategory,
      upsertGoal,
      deleteGoal,
      newGoal,
    ],
  )

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>
}

export function useSchedule(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}

export { todayISO }
