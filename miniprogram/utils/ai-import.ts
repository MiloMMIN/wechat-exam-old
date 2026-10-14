// utils/ai-import.ts —— 把"格式化文本"解析成 Question[]
// AI 接口预留：parseWithAI 现在是占位实现（仅调本地正则），未来可换成后端调用。
import type { Question } from '../data/questions'

export interface ParseResult {
  questions: Question[]
  /** 解析失败的行/段提示 */
  warnings: string[]
}

/**
 * 支持的"格式化文档"纯文本格式（每个题块 4~6 行）：
 *   题干...
 *   A. 选项        （也接受 A、选项 / A 选项 / A：选项）
 *   B. 选项
 *   C. 选项
 *   D. 选项
 *   答案：B         （或 答案:B / 参考答案 B / 答 B）
 *
 * 题块之间用空行分隔；题号可有可无。
 */
export function parseText(input: string): ParseResult {
  const warnings: string[] = []
  const questions: Question[] = []

  // 按空行切块
  const blocks = input.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean)
  let autoId = 1

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue

    const stemLines: string[] = []
    const opts: Record<string, string> = {}
    let answer = ''
    let nextId = 0

    for (const line of lines) {
      const om = line.match(/^([A-F])\s*[、.．：:]\s*(.+)$/) || line.match(/^([A-F])\s+(.+)$/)
      if (om) {
        opts[om[1]] = om[2].trim()
        continue
      }
      const am = line.match(/^(?:参考答案|答案|答)\s*[:：]?\s*([A-F])\s*$/)
      if (am) {
        answer = am[1]
        continue
      }
      const qm = line.match(/^(?:第\s*)?(\d+)\s*[题\.、]\s*(.+)$/)
      if (qm) {
        nextId = parseInt(qm[1])
        stemLines.push(qm[2])
        continue
      }
      stemLines.push(line)
    }

    const stem = stemLines.join(' ').trim()
    const optList = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => opts[l] || '')
    // 截掉尾部空项
    while (optList.length && !optList[optList.length - 1]) optList.pop()

    if (!stem || optList.length < 2 || !answer || !opts[answer]) {
      warnings.push(`跳过无效题块：${stem.slice(0, 30) || '(空题干)'}`)
      continue
    }
    questions.push({
      id: nextId || autoId++,
      q: stem,
      o: optList,
      a: 'ABCDEF'.indexOf(answer),
    })
    if (nextId) autoId = nextId + 1
  }

  return { questions, warnings }
}

/** AI 导题占位：现在走本地 parseText；未来替换为调用后端 LLM 解析任意格式文本 */
export async function parseWithAI(input: string): Promise<ParseResult> {
  // TODO(ai): 接入后端模型。保持返回类型不变，上层无感知。
  return parseText(input)
}
