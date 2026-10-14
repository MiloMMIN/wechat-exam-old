// utils/quiz.ts
import { Question } from '../data/questions'
import { cullStore } from './store'

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

/** 组卷：从 pool 中抽 count 题；可选乱序选项 */
export function pickExam(pool: Question[], count: number, shuffleOpts = false): Question[] {
  const picked = shuffle(pool).slice(0, Math.min(count, pool.length))
  if (!shuffleOpts) return picked
  // 深拷贝 + 选项乱序（修正 a 下标）
  return picked.map(q => {
    const order = shuffle(q.o.map((_, i) => i))
    return {
      ...q,
      o: order.map(i => q.o[i]),
      a: order.indexOf(q.a),
    }
  })
}

/** 练习池：剔除"斩题" */
export function practicePool(bankId: string, pool: Question[]): Question[] {
  const culled = new Set(cullStore.ids(bankId))
  return pool.filter(q => !culled.has(q.id))
}

export function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m < 10 ? '0' + m : m}:${ss < 10 ? '0' + ss : ss}`
}
