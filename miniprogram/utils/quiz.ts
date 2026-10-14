// utils/quiz.ts
import { questions, Question } from '../data/questions'

export const TOTAL = questions.length
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Fisher–Yates 洗牌（返回新数组） */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

/** 组卷：随机抽 count 题；或按 id 集合抽（错题重考用） */
export function pickExam(count: number, ids?: number[]): Question[] {
  const pool = ids ? questions.filter(q => ids.includes(q.id)) : questions
  return shuffle(pool).slice(0, Math.min(count, pool.length))
}

export function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m < 10 ? '0' + m : m}:${ss < 10 ? '0' + ss : ss}`
}
