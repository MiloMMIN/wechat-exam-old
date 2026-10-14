// utils/ai-import.ts —— 把"格式化文本"解析成 Question[]
// AI 接口预留：parseWithAI 现在是占位实现（本地正则），未来可换成后端调用。
import type { Question } from '../data/questions'

export interface ParseResult {
  questions: Question[]
  warnings: string[]
}

const OPT_RE = /^([A-F])\s*[、.．：:]\s*(.+)$/
const OPT_BARE_RE = /^([A-F])\s+(.+)$/
const ANS_RE = /【参考答案】\s*([A-F])/                         // docx 原格式
const ANS_RE2 = /^(?:参考答案|答案|答)\s*[:：]?\s*([A-F])\s*$/  // 简写格式
const Q_RE = /^(?:第\s*)?(\d+)\s*[题\.、．]\s*(.+)$/

function cleanStem(s: string): string {
  return s.replace(/[   ​]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * 解析粘贴文本为题目列表。
 * 兼容两种输入：
 *  1) docx 直接复制的连续文本（无空行）：
 *       766.题干...
 *       A、高速
 *       B、低速
 *       【参考答案】A
 *       767.题干...
 *  2) 空行分隔的题块（每块独立题干+选项+答案行）
 *
 * 内部统一成"按题号行切块"，块内逐行分类。
 */
export function parseText(input: string): ParseResult {
  const warnings: string[] = []
  const questions: Question[] = []

  // 1) 全文行归一化
  const rawLines = input
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  // 2) 按"题号行"切块：每块 = 题号行 + 后续直到下一题号行或文件尾
  interface Block { no: number; first: string; rest: string[] }
  const blocks: Block[] = []
  let cur: Block | null = null
  for (const line of rawLines) {
    const m = Q_RE.exec(line)
    if (m) {
      cur = { no: parseInt(m[1]), first: m[2], rest: [] }
      blocks.push(cur)
    } else if (cur) {
      cur.rest.push(line)
    } else {
      // 文件头的标题/前言——丢进警告让用户知道
      if (line.length > 4) warnings.push(`跳过前言：${line.slice(0, 30)}`)
    }
  }

  // 无题号场景：把全文当一个块尝试（兜底，基本走不到）
  if (!blocks.length && rawLines.length) {
    blocks.push({ no: 0, first: '', rest: rawLines })
  }

  for (const b of blocks) {
    const stemLines: string[] = b.first ? [b.first] : []
    const opts: Record<string, string> = {}
    let answer = ''

    for (const line of b.rest) {
      const am = ANS_RE.exec(line) || ANS_RE2.exec(line)
      if (am) { answer = am[1]; continue }

      const om = OPT_RE.exec(line) || OPT_BARE_RE.exec(line)
      if (om) { opts[om[1]] = om[2].trim(); continue }

      // 题干续行（例如"767.淘宝拍摄,一般只要( )盏闪光灯即可完成/拍摄"折行）
      if (!answer) stemLines.push(line)
    }

    const stem = cleanStem(stemLines.join(' '))
    const optList = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => opts[l] || '')
    while (optList.length && !optList[optList.length - 1]) optList.pop()

    if (!stem || optList.length < 2 || !answer || !opts[answer]) {
      warnings.push(`跳过无效题块：${(stem || `题 ${b.no}`).slice(0, 30)}`)
      continue
    }
    questions.push({ id: b.no || questions.length + 1, q: stem, o: optList, a: 'ABCDEF'.indexOf(answer) })
  }

  return { questions, warnings }
}

/** AI 导题占位：现在走本地 parseText；未来替换为调用后端 LLM 解析任意格式文本 */
export async function parseWithAI(input: string): Promise<ParseResult> {
  // TODO(ai): 接入后端模型。保持返回类型不变，上层无感知。
  return parseText(input)
}
