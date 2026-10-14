// utils/bank-store.ts —— 多题库管理：内置 + 导入 + 收藏的外来题库
import { questions as builtinQuestions } from '../data/questions'
import { Bank, DEFAULT_EXAM_SETTINGS } from './bank-format'

const KEY_BANKS = 'banks'            // Bank[] 用户题库（导入/收藏来的）
const KEY_ACTIVE = 'active_bank_id'  // 当前使用的题库 id
export const BUILTIN_ID = 'builtin'

export const builtinBank: Bank = {
  id: BUILTIN_ID,
  name: '电子商务师三级理论',
  createdAt: 0,
  questions: builtinQuestions,
  exam: { ...DEFAULT_EXAM_SETTINGS },
  origin: 'builtin',
}

export function listBanks(): Bank[] {
  const custom: Bank[] = wx.getStorageSync(KEY_BANKS) || []
  return [builtinBank, ...custom]
}

export function getBank(id: string): Bank | undefined {
  return listBanks().find(b => b.id === id)
}

export function getActiveBank(): Bank {
  const id = wx.getStorageSync(KEY_ACTIVE) || BUILTIN_ID
  return getBank(id) || builtinBank
}

export function setActiveBank(id: string): void {
  wx.setStorageSync(KEY_ACTIVE, id)
}

/** 新增/更新题库；返回最终 id */
export function upsertBank(bank: Bank): string {
  const list: Bank[] = wx.getStorageSync(KEY_BANKS) || []
  const i = list.findIndex(b => b.id === bank.id)
  if (i >= 0) list[i] = bank
  else list.push(bank)
  wx.setStorageSync(KEY_BANKS, list)
  return bank.id
}

export function removeBank(id: string): void {
  if (id === BUILTIN_ID) return
  const list: Bank[] = (wx.getStorageSync(KEY_BANKS) || []).filter((b: Bank) => b.id !== id)
  wx.setStorageSync(KEY_BANKS, list)
  if (wx.getStorageSync(KEY_ACTIVE) === id) wx.removeStorageSync(KEY_ACTIVE)
}

export function newBankId(): string {
  return `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}
