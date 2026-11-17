export type CategoryId = 'work' | 'life' | 'study' | 'health' | 'other'

export type Reminder = 'none' | 'at' | 'min15' | 'hour1' | 'day1'

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
  createdAt: number
}

export type ViewMode = 'month' | 'week' | 'agenda'

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
}
