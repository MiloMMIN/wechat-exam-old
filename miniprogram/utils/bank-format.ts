// utils/bank-format.ts —— 题库数据模型 + .kbz 分享格式
import type { Question } from '../data/questions'

export interface ExamSettings {
  /** 单选题数量 */
  count: number
  /** 每题分值（允许 .5） */
  scorePerQuestion: number
  /** 考试时长（分钟） */
  minutes: number
  /** 及格分 */
  passScore: number
  /** 交卷后立即显示答案 */
  showAnswerAfterSubmit: boolean
  /** 选项乱序 */
  shuffleOptions: boolean
}

export const DEFAULT_EXAM_SETTINGS: ExamSettings = {
  count: 40,
  scorePerQuestion: 2.5,
  minutes: 60,
  passScore: 60,
  showAnswerAfterSubmit: true,
  shuffleOptions: false,
}

export interface Bank {
  /** 唯一 id：'builtin' 或时间戳串 */
  id: string
  /** 题库名 */
  name: string
  /** 创建时间戳 */
  createdAt: number
  /** 题目 */
  questions: Question[]
  /** 默认考试设置（分享时随题库携带） */
  exam: ExamSettings
  /** 来源描述：'builtin' | 'imported' | 'shared' */
  origin: 'builtin' | 'imported' | 'shared'
}

/** .kbz 文件载荷（JSON 序列化后写入文件） */
export interface BankFile {
  /** 格式标识 */
  kind: 'wechat-exam-bank'
  /** 格式版本 */
  v: 1
  bank: Bank
}

export function encodeBank(bank: Bank): string {
  const payload: BankFile = { kind: 'wechat-exam-bank', v: 1, bank }
  return JSON.stringify(payload)
}

export function decodeBank(text: string): Bank | null {
  try {
    const obj = JSON.parse(text) as BankFile
    if (obj && obj.kind === 'wechat-exam-bank' && obj.bank && Array.isArray(obj.bank.questions)) {
      return obj.bank
    }
  } catch (e) {
    return null
  }
  return null
}
