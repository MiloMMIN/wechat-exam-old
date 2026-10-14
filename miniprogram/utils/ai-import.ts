// utils/ai-import.ts —— 把"格式化文本"解析成 Question[]
// AI 接口预留：parseWithAI 现在是占位实现（本地正则），未来可换成后端调用。
import type { Question } from '../data/questions'

export interface ParseResult {
  questions: Question[]
  warnings: string[]
}

const ANS_RE = /【参考答案】\s*([A-F])/                         // docx 原格式
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
  // 1) 全文行归一化：空行过滤 + 把孤立字母行（"A" 后跟内容行）黏回去
  const raw0 = input.split(/\r?\n/).map(l => l.trim())
  const rawLines: string[] = []
  for (let i = 0; i < raw0.length; i++) {
    const l = raw0[i]
    if (!l) continue
    // docx 表格流常见："A、" 或 "A" 单独一行，下一行才是选项内容
    if (/^[A-F][、.．：:]?\s*$/.test(l) && i + 1 < raw0.length && raw0[i + 1]) {
      rawLines.push(`${l}${raw0[++i].trim()}`)
      continue
    }
    rawLines.push(l)
  }
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

  // 逐题处理：把块内字符串拼成一段，然后用全局正则按 "字母+选项" 位置切片
  for (const b of blocks) {
    // 先合成一段：题干行 + 选项/答案行全黏起来，再由正则切
    const seg = [b.first, ...b.rest].join('\n')
    // 统一"答案"分隔：把 【参考答案】X 提到段尾
    const ansMatch = ANS_RE.exec(seg) || /(?:参考答案|答案|答)\s*[:：]?\s*([A-F])\s*$/.exec(seg)
    const answer = ansMatch ? ansMatch[1] : ''

    // 定位第一个选项起始（行首字母+分隔符）
    const firstOptM = /(?:^|\n)\s*([A-F])\s*[、.．：:]\s*/.exec(seg)
    if (!firstOptM) {
      warnings.push(`跳过无效题块：${(seg.slice(0, 30))}（无选项）`)
      continue
    }
    const stemEnd = firstOptM.index + (firstOptM[0].startsWith('\n') ? 1 : 0)
    const stem = cleanStem(seg.slice(0, stemEnd))

    // 选项段：从 firstOptM 到答案正则的起始位置
    const ansStart = ansMatch ? ansMatch.index : seg.length
    const optSeg = seg.slice(stemEnd, ansStart)
    // 按 (字母)(、|.|：|:|空白) 切
    const opts: Record<string, string> = {}
    const optRe = /([A-F])\s*[、.．：:]\s*/g
    const marks: { letter: string; start: number; end: number }[] = []
    let mm: RegExpExecArray | null
    while ((mm = optRe.exec(optSeg)) !== null) {
      marks.push({ letter: mm[1], start: mm.index, end: mm.index + mm[0].length })
    }
    for (let i = 0; i < marks.length; i++) {
      const cur = marks[i]
      const nextStart = i + 1 < marks.length ? marks[i + 1].start : optSeg.length
      opts[cur.letter] = optSeg.slice(cur.end, nextStart).trim().replace(/\s+/g, ' ')
    }

    const optList = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => opts[l] || '')
    while (optList.length && !optList[optList.length - 1]) optList.pop()

    if (!stem || optList.length < 2 || !answer || !opts[answer]) {
      warnings.push(`跳过无效题块：${stem.slice(0, 30) || `(题 ${b.no})`}`)
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
