import fs from 'fs'
import { pinyin } from 'pinyin'

const DOC_PATH = '电子商务师三级理论试题-all).doc'
const OUT_PATH = 'miniprogram/data/questions.ts'

const buf = fs.readFileSync(DOC_PATH)
const b = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const all = []
for (let i = 0; i < b.length - 1; i += 2) all.push(b[i] | (b[i + 1] << 8))

const hits = []
for (let i = 0; i < all.length - 3; i++) {
  if (all[i] === 0x53c2 && all[i + 1] === 0x8003 && all[i + 2] === 0x7b54 && all[i + 3] === 0x6848) hits.push(i)
}

let start = 0
for (let i = 0; i < hits[0]; i++) {
  if (all[i] === 0x31 && all[i + 1] === 0x2e) {
    let nextChar = all[i + 2]
    if (nextChar === 0x20 || nextChar === 0x3000) nextChar = all[i + 3]
    if (nextChar >= 0x4e00 && nextChar <= 0x9fff) {
      start = i
      break
    }
  }
}
const end = Math.min(all.length, hits[hits.length - 1] + 60)

const parts = []
for (let i = start; i < end; i++) {
  const c = all[i]
  if (c === 0x0d || c === 0x0a) parts.push('\n')
  else if (c >= 0x20) parts.push(String.fromCharCode(c))
}
const text = parts.join('')
const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

const Q_RE = /^(\d+)\s*[\.、．]\s*(.+)$/
const ANS_RE = /【参考答案】\s*([^\s]+)/

const blocks = []
let cur = null
for (const line of lines) {
  const m = Q_RE.exec(line)
  if (m) {
    if (cur) blocks.push(cur)
    cur = { no: parseInt(m[1], 10), first: m[2], rest: [] }
  } else if (cur) {
    cur.rest.push(line)
  }
}
if (cur) blocks.push(cur)

console.log('Total extracted blocks:', blocks.length)

function cleanText(str) {
  return str.replace(/[   ​ 　]/g, '').replace(/\s+/g, ' ').replace(/（）/g, '（ ）').trim()
}

// 提取与字符串逐字一一对应的拼音音节空格分隔字符串
function extractSyllablesString(text) {
  const res = []
  for (const ch of text) {
    if (/[\u4e00-\u9fa5]/.test(ch)) {
      try {
        const py = pinyin(ch, { style: 'normal' })[0][0].toLowerCase()
        res.push(py)
      } catch (e) {
        res.push(ch.toLowerCase())
      }
    } else {
      res.push(ch === ' ' ? '_' : ch.toLowerCase())
    }
  }
  return res.join(' ')
}

function getFirstLetter(str) {
  try {
    return pinyin(str, { style: 'first_letter' }).flat().join('').toLowerCase().replace(/[^a-z0-9]/g, '')
  } catch (e) {
    return ''
  }
}

const questions = []

for (const block of blocks) {
  const full = [block.first, ...block.rest].join('\n')
  const ansMatch = ANS_RE.exec(full)
  if (!ansMatch) continue

  const rawAns = ansMatch[1].trim()
  const ansIndex = ansMatch.index
  const optMatch = /(?:^|\n)\s*([A-F])\s*[、\.．：:]\s*/.exec(full)

  if (!optMatch || rawAns === '√' || rawAns === '×') {
    // 判断题
    const stem = cleanText(full.slice(0, ansIndex))
    let a = -1
    if (rawAns === '√' || rawAns === 'A' || rawAns === '正确' || rawAns === 'T') a = 0
    else if (rawAns === '×' || rawAns === 'B' || rawAns === '错误' || rawAns === 'F') a = 1
    if (a < 0) continue

    const opts = ['正确', '错误']
    questions.push({
      id: block.no,
      q: stem,
      o: opts,
      a,
      pyq: getFirstLetter(stem),
      pys: extractSyllablesString(stem),
      pyos: opts.map(extractSyllablesString),
    })
  } else {
    // 单选题
    const firstOptM = optMatch
    const stemEnd = firstOptM.index + (firstOptM[0].startsWith('\n') ? 1 : 0)
    const stem = cleanText(full.slice(0, stemEnd))
    const optSeg = full.slice(stemEnd, ansIndex)

    const optRe = /([A-F])\s*[、\.．：:]\s*/g
    const marks = []
    let mm
    while ((mm = optRe.exec(optSeg)) !== null) {
      marks.push({ letter: mm[1], start: mm.index, end: mm.index + mm[0].length })
    }
    const optsMap = {}
    for (let i = 0; i < marks.length; i++) {
      const c = marks[i]
      const nx = i + 1 < marks.length ? marks[i + 1].start : optSeg.length
      optsMap[c.letter] = cleanText(optSeg.slice(c.end, nx))
    }
    const letters = ['A', 'B', 'C', 'D']
    const o = letters.map(l => optsMap[l] || '')
    while (o.length && !o[o.length - 1]) o.pop()

    const ansLetter = rawAns.toUpperCase()
    const a = letters.indexOf(ansLetter)
    if (a < 0 || a >= o.length || !stem || o.length < 2) continue

    questions.push({
      id: block.no,
      q: stem,
      o,
      a,
      pyq: getFirstLetter(stem),
      pys: extractSyllablesString(stem),
      pyos: o.map(extractSyllablesString),
    })
  }
}

console.log('Final parsed questions count:', questions.length)

// 生成 TypeScript 文件
const tsContent = `// 由 scripts/build-all-questions.mjs 自动生成，请勿手改
export interface Question {
  /** 原题号 */
  id: number
  /** 题干 */
  q: string
  /** 选项 */
  o: string[]
  /** 正确选项下标 */
  a: number
  /** 题干拼音首字母 */
  pyq?: string
  /** 题干逐字音节 (空格分隔，长度与 q 一一对应) */
  pys?: string
  /** 选项逐字音节 (空格分隔，长度与 o 元素一一对应) */
  pyos?: string[]
}

export const questions: Question[] = ${JSON.stringify(questions, null, 0)}
`

fs.writeFileSync(OUT_PATH, tsContent, 'utf-8')
const stats = fs.statSync(OUT_PATH)
console.log(`Generated ${OUT_PATH}: ${(stats.size / 1024).toFixed(1)} KB`)
