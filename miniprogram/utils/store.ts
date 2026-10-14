// utils/store.ts —— 按题库隔离的错题/收藏/斩题/进度/笔记/考试记录
// key 格式: `${kind}:${bankId}`，本文件统一管理

const KS_MISTAKE = 'mistake_ids'
const KS_FAV = 'favorite_ids'
const KS_CULL = 'culled_ids'
const KS_CURSOR = 'learn_cursor'
const KS_DONE = 'done_map'
const KS_EXAM_HIST = 'exam_history'
const KS_NOTES = 'notes'

function scoped(key: string, bankId: string) {
  return `${key}:${bankId}`
}
function readIds(key: string, bankId: string): number[] {
  return wx.getStorageSync(scoped(key, bankId)) || []
}
function writeIds(key: string, bankId: string, ids: number[]) {
  wx.setStorageSync(scoped(key, bankId), ids)
}

function makeIdSet(key: string) {
  return {
    ids: (bankId: string) => readIds(key, bankId),
    has: (bankId: string, id: number) => readIds(key, bankId).includes(id),
    add(bankId: string, id: number) {
      const ids = readIds(key, bankId)
      if (!ids.includes(id)) writeIds(key, bankId, [...ids, id])
    },
    remove(bankId: string, id: number) {
      writeIds(key, bankId, readIds(key, bankId).filter(i => i !== id))
    },
    toggle(bankId: string, id: number): boolean {
      const ids = readIds(key, bankId)
      const i = ids.indexOf(id)
      if (i >= 0) ids.splice(i, 1); else ids.push(id)
      writeIds(key, bankId, ids)
      return i < 0
    },
    clear(bankId: string) { wx.removeStorageSync(scoped(key, bankId)) },
  }
}

export const mistakeStore = makeIdSet(KS_MISTAKE)
export const favoriteStore = makeIdSet(KS_FAV)
export const cullStore = makeIdSet(KS_CULL) // 斩题：掌握后剔除出练习池

// ---------- 学习进度 ----------
export const learnProgress = {
  cursor(bankId: string): number {
    return wx.getStorageSync(scoped(KS_CURSOR, bankId)) || 0
  },
  setCursor(bankId: string, i: number) {
    wx.setStorageSync(scoped(KS_CURSOR, bankId), i)
  },
}

// ---------- 作答统计 ----------
export interface DoneStat { tries: number; right: number }
export function recordAnswer(bankId: string, qid: number, correct: boolean): void {
  const k = scoped(KS_DONE, bankId)
  const map: Record<string, DoneStat> = wx.getStorageSync(k) || {}
  const s = map[qid] || { tries: 0, right: 0 }
  s.tries += 1
  if (correct) s.right += 1
  map[qid] = s
  wx.setStorageSync(k, map)
}
export function getDoneMap(bankId: string): Record<string, DoneStat> {
  return wx.getStorageSync(scoped(KS_DONE, bankId)) || {}
}

// ---------- 考试记录 ----------
export interface ExamRecord {
  bankId: string
  bankName: string
  score: number
  total: number
  right: number
  seconds: number
  at: number
}
export function getExamHistory(): ExamRecord[] {
  return wx.getStorageSync(KS_EXAM_HIST) || []
}
export function addExamRecord(r: ExamRecord): void {
  wx.setStorageSync(KS_EXAM_HIST, [r, ...getExamHistory()].slice(0, 50))
}

// ---------- 题库笔记 ----------
export interface Note {
  id: string
  bankId: string
  /** 关联题号；0 = 题库级笔记 */
  qid: number
  text: string
  at: number
}
export function getNotes(bankId: string): Note[] {
  return (wx.getStorageSync(KS_NOTES) || []).filter((n: Note) => n.bankId === bankId)
}
export function addNote(bankId: string, qid: number, text: string): Note {
  const all: Note[] = wx.getStorageSync(KS_NOTES) || []
  const n: Note = {
    id: `n${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
    bankId, qid, text, at: Date.now(),
  }
  all.unshift(n)
  wx.setStorageSync(KS_NOTES, all)
  return n
}
export function removeNote(id: string): void {
  const all: Note[] = (wx.getStorageSync(KS_NOTES) || []).filter((n: Note) => n.id !== id)
  wx.setStorageSync(KS_NOTES, all)
}
export function updateNote(id: string, text: string): void {
  const all: Note[] = wx.getStorageSync(KS_NOTES) || []
  const i = all.findIndex(n => n.id === id)
  if (i >= 0) { all[i] = { ...all[i], text }; wx.setStorageSync(KS_NOTES, all) }
}
