import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { CategoryId, EventDraft, ScheduleEvent } from '@/types'
import { addDays, todayISO, toISODate } from '@/lib/schedule-utils'

const STORAGE_KEY = 'shiguang.events.v1'
const FILTER_KEY = 'shiguang.filters.v1'

function uid(): string {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 首次启动时的示例数据，帮助用户理解产品形态，可自由删除 */
function seedEvents(): ScheduleEvent[] {
  const today = new Date()
  const iso = (d: Date) => toISODate(d)
  const now = Date.now()
  return [
    {
      id: uid(),
      title: '欢迎使用拾光日程',
      date: iso(today),
      allDay: true,
      start: '',
      end: '',
      category: 'other',
      notes: '点击任意日期即可新建日程；点击这条日程可以编辑或删除我。',
      reminder: 'none',
      done: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: '晨跑 5 公里',
      date: iso(today),
      allDay: false,
      start: '07:00',
      end: '07:45',
      category: 'health',
      notes: '',
      reminder: 'min15',
      done: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: '产品周会',
      date: iso(addDays(today, 1)),
      allDay: false,
      start: '10:00',
      end: '11:00',
      category: 'work',
      notes: '带上 Q3 排期表',
      reminder: 'hour1',
      done: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: '读完《深度工作》第 4 章',
      date: iso(addDays(today, 2)),
      allDay: false,
      start: '21:00',
      end: '22:00',
      category: 'study',
      notes: '',
      reminder: 'none',
      done: false,
      createdAt: now,
    },
    {
      id: uid(),
      title: '给妈妈打电话',
      date: iso(addDays(today, 4)),
      allDay: false,
      start: '20:00',
      end: '20:30',
      category: 'life',
      notes: '',
      reminder: 'at',
      done: false,
      createdAt: now,
    },
  ]
}

function loadEvents(): ScheduleEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      const seeded = seedEvents()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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
  | { type: 'toggleCategory'; category: CategoryId }

interface State {
  events: ScheduleEvent[]
  filters: Record<CategoryId, boolean>
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
    case 'toggleDone':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, done: !e.done } : e,
        ),
      }
    case 'toggleCategory':
      return {
        ...state,
        filters: { ...state.filters, [action.category]: !state.filters[action.category] },
      }
  }
}

interface ScheduleContextValue {
  events: ScheduleEvent[]
  visibleEvents: ScheduleEvent[]
  filters: Record<CategoryId, boolean>
  upsertEvent: (draft: EventDraft) => void
  deleteEvent: (id: string) => void
  toggleDone: (id: string) => void
  toggleCategory: (c: CategoryId) => void
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null)

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    events: loadEvents(),
    filters: loadFilters(),
  }))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events))
  }, [state.events])

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(state.filters))
  }, [state.filters])

  const upsertEvent = useCallback((draft: EventDraft) => dispatch({ type: 'upsert', draft }), [])
  const deleteEvent = useCallback((id: string) => dispatch({ type: 'delete', id }), [])
  const toggleDone = useCallback((id: string) => dispatch({ type: 'toggleDone', id }), [])
  const toggleCategory = useCallback(
    (category: CategoryId) => dispatch({ type: 'toggleCategory', category }),
    [],
  )

  const visibleEvents = useMemo(
    () => state.events.filter((e) => state.filters[e.category]),
    [state.events, state.filters],
  )

  const value = useMemo(
    () => ({
      events: state.events,
      visibleEvents,
      filters: state.filters,
      upsertEvent,
      deleteEvent,
      toggleDone,
      toggleCategory,
    }),
    [state.events, visibleEvents, state.filters, upsertEvent, deleteEvent, toggleDone, toggleCategory],
  )

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>
}

export function useSchedule(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider')
  return ctx
}

export { todayISO }
