// utils/store.ts —— 错题本 / 收藏 / 学习进度 / 作答统计 / 考试记录
// 全部走 wx.Storage 同步读写；id 用原题号(number)，存储时转 string 数组。

const KEY_MISTAKES = 'mistake_ids'
const KEY_FAVS = 'favorite_ids'
const KEY_LEARN_CURSOR = 'learn_cursor'
const KEY_DONE = 'done_map'
const KEY_EXAM_HISTORY = 'exam_history'

function readIds(key: string): number[] {
  return wx.getStorageSync(key) || []
}

// ---------- 错题本 / 收藏（同一套增删查） ----------
export const mistakeStore = {
  ids: () => readIds(KEY_MISTAKES),
  has: (id: number) => readIds(KEY_MISTAKES).includes(id),
  add(id: number) {
    const ids = readIds(KEY_MISTAKES)
    if (!ids.includes(id)) wx.setStorageSync(KEY_MISTAKES, [...ids, id])
  },
  remove(id: number) {
    wx.setStorageSync(KEY_MISTAKES, readIds(KEY_MISTAKES).filter(i => i !== id))
  },
  clear() { wx.removeStorageSync(KEY_MISTAKES) },
}

export const favoriteStore = {
  ids: () => readIds(KEY_FAVS),
  has: (id: number) => readIds(KEY_FAVS).includes(id),
  toggle(id: number): boolean {
    const ids = readIds(KEY_FAVS)
    const idx = ids.indexOf(id)
    if (idx >= 0) ids.splice(idx, 1)
    else ids.push(id)
    wx.setStorageSync(KEY_FAVS, ids)
    return idx < 0 // true = 本次变为已收藏
  },
}

// ---------- 学习进度 ----------
export const learnProgress = {
  get cursor(): number { return wx.getStorageSync(KEY_LEARN_CURSOR) || 0 },
  set cursor(i: number) { wx.setStorageSync(KEY_LEARN_CURSOR, i) },
}

// ---------- 作答统计 { [questionId]: { tries, right } } ----------
export interface DoneStat { tries: number; right: number }

export function recordAnswer(qid: number, correct: boolean): void {
  const map: Record<string, DoneStat> = wx.getStorageSync(KEY_DONE) || {}
  const s = map[qid] || { tries: 0, right: 0 }
  s.tries += 1
  if (correct) s.right += 1
  map[qid] = s
  wx.setStorageSync(KEY_DONE, map)
}
export function getDoneMap(): Record<string, DoneStat> {
  return wx.getStorageSync(KEY_DONE) || {}
}

// ---------- 考试记录 ----------
export interface ExamRecord {
  score: number
  total: number
  right: number
  seconds: number
  at: number
}
export function getExamHistory(): ExamRecord[] {
  return wx.getStorageSync(KEY_EXAM_HISTORY) || []
}
export function addExamRecord(r: ExamRecord): void {
  wx.setStorageSync(KEY_EXAM_HISTORY, [r, ...getExamHistory()].slice(0, 50))
}
