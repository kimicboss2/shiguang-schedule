export type CategoryId = 'work' | 'life' | 'study' | 'health' | 'other'

export type Reminder = 'none' | 'at' | 'min15' | 'hour1' | 'day1'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

/** 长期目标 */
export interface Goal {
  id: string
  title: string
  /** yyyy-MM-dd，可为空（不设截止） */
  deadline: string
  createdAt: number
}

export interface ScheduleEvent {
  id: string
  title: string
  /** yyyy-MM-dd */
  date: string
  allDay: boolean
  /** HH:mm，全天事件为空字符串 */
  start: string
  /** HH:mm，全天事件为空字符串 */
  end: string
  category: CategoryId
  notes: string
  reminder: Reminder
  done: boolean
  /** 关联的长期目标 */
  goalId: string | null
  /** 困难任务的子任务拆解 */
  subtasks: Subtask[]
  createdAt: number
}

/** XP 账本条目：完成任务获得，取消完成扣回 */
export interface XpEntry {
  id: string
  ts: number
  amount: number
  label: string
}

export type ViewMode = 'month' | 'week' | 'agenda' | 'growth'

export interface EventDraft {
  id?: string
  title: string
  date: string
  allDay: boolean
  start: string
  end: string
  category: CategoryId
  notes: string
  reminder: Reminder
  goalId: string | null
  subtasks: Subtask[]
}
