import type { ScheduleEvent, XpEntry } from '@/types'
import { toISODate } from '@/lib/schedule-utils'

/** XP 规则 */
export const XP = {
  /** 完成普通任务 */
  TASK: 10,
  /** 完成一个子任务（攻击 BOSS 一次） */
  SUBTASK: 5,
  /** 击败 BOSS（含 ≥2 子任务的任务全部完成）额外奖励 */
  BOSS_BONUS: 20,
  /** 当天首次完成的连续打卡加成 */
  STREAK_FIRST: 5,
} as const

const LEVEL_TITLES = [
  '见习行者',
  '自律新手',
  '时间猎手',
  '规划达人',
  '日程大师',
  '拾光贤者',
  '拾光传说',
]

/** 升到第 L 级所需累计 XP：50·(L-1)·L，即 0/100/300/600/1000… */
export function totalXpForLevel(level: number): number {
  return 50 * (level - 1) * level
}

export interface LevelInfo {
  level: number
  title: string
  /** 当前等级内已获得 XP */
  intoLevel: number
  /** 当前等级升下一级所需 XP */
  span: number
  nextLevelAt: number
}

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1
  while (totalXpForLevel(level + 1) <= totalXp) level++
  const floor = totalXpForLevel(level)
  const next = totalXpForLevel(level + 1)
  return {
    level,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
    intoLevel: totalXp - floor,
    span: next - floor,
    nextLevelAt: next,
  }
}

/** 连续打卡天数：XP 账本中正向记录所在的日期，从今天或昨天向前连续计数 */
export function streakFromLog(xpLog: XpEntry[], now = new Date()): number {
  const days = new Set(
    xpLog.filter((e) => e.amount > 0).map((e) => toISODate(new Date(e.ts))),
  )
  if (days.size === 0) return 0
  const cursor = new Date(now)
  // 今天还没有记录时，从昨天开始往回数也算保持中
  if (!days.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(toISODate(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** BOSS（含子任务的任务）血量 */
export function monsterHp(event: ScheduleEvent): { total: number; remaining: number } {
  const total = event.subtasks.length
  const remaining = event.subtasks.filter((s) => !s.done).length
  return { total, remaining }
}

export function isBoss(event: ScheduleEvent): boolean {
  return event.subtasks.length >= 2
}

export function subtaskProgress(event: ScheduleEvent): string {
  const done = event.subtasks.filter((s) => s.done).length
  return `${done}/${event.subtasks.length}`
}
