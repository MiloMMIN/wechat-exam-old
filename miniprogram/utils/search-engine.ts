// miniprogram/utils/search-engine.ts —— 题库拼音/跨字/题干选项高精度搜索引擎
import type { Question } from '../data/questions'

export interface MatchSpan {
  start: number
  end: number
}

export interface HighlightSegment {
  text: string
  highlight: boolean
}

export interface SearchResult {
  question: Question
  /** 匹配字数 (降序主要依据) */
  matchedChars: number
  /** 是否题干命中 */
  stemHit: boolean
  /** 是否选项命中 */
  optionHit: boolean
  /** 题干连续完整匹配 */
  stemExact: boolean
  /** 选项连续完整匹配 */
  optionExact: boolean
  /** 是否有任意完整连续匹配 */
  isAnyExact: boolean
  /** 题干命中字数 */
  stemMatchedChars: number
  /** 选项命中字数 */
  optionMatchedChars: number
  /** 最小跨度 */
  minSpan: number
  /** 命中最好的选项下标 (-1 为无) */
  bestOptIdx: number
  /** 题干高亮区间 */
  stemHighlights: MatchSpan[]
  /** 选项高亮 */
  optHighlights: MatchSpan[]
  /** 标签：完整匹配 / 跨字匹配 / 拼音匹配 等 */
  matchTag: string
  /** 切片好的题干渲染段 */
  stemSegments?: HighlightSegment[]
}

interface MatchScore {
  matchedChars: number
  isExact: boolean
  span: number
  highlights: MatchSpan[]
}

/** 连续子串匹配 */
function matchExact(text: string, q: string): MatchScore | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return null
  return {
    matchedChars: q.length,
    isExact: true,
    span: q.length,
    highlights: [{ start: idx, end: idx + q.length }],
  }
}

/** 跨字子序列匹配 (Subsequence)，如 "高冷" 匹配 "高高的很冷" */
function matchSubsequence(text: string, q: string): MatchScore | null {
  if (q.length < 2) return null
  const lower = text.toLowerCase()
  const highlights: MatchSpan[] = []
  let fromIdx = 0
  let matchedCount = 0

  for (let i = 0; i < q.length; i++) {
    const ch = q[i]
    const pos = lower.indexOf(ch, fromIdx)
    if (pos >= 0) {
      highlights.push({ start: pos, end: pos + 1 })
      fromIdx = pos + 1
      matchedCount++
    } else {
      break
    }
  }

  if (matchedCount === q.length && highlights.length === q.length) {
    const first = highlights[0].start
    const last = highlights[highlights.length - 1].end
    return {
      matchedChars: q.length,
      isExact: false, // 跨字，非连续
      span: last - first,
      highlights,
    }
  }
  return null
}

/** 拼音首字母匹配 (连续或跨字) */
function matchPinyinFirst(text: string, pyFirst: string | undefined, q: string): MatchScore | null {
  if (!pyFirst || !q) return null

  // 1. 连续首字母命中
  const cIdx = pyFirst.indexOf(q)
  if (cIdx >= 0) {
    const end = Math.min(text.length, cIdx + q.length)
    return {
      matchedChars: q.length,
      isExact: true,
      span: q.length,
      highlights: [{ start: cIdx, end }],
    }
  }

  // 2. 跨字首字母命中
  if (q.length >= 2) {
    const highlights: MatchSpan[] = []
    let fromIdx = 0
    let count = 0
    for (let i = 0; i < q.length; i++) {
      const pos = pyFirst.indexOf(q[i], fromIdx)
      if (pos >= 0 && pos < text.length) {
        highlights.push({ start: pos, end: pos + 1 })
        fromIdx = pos + 1
        count++
      } else break
    }
    if (count === q.length && highlights.length === q.length) {
      const first = highlights[0].start
      const last = highlights[highlights.length - 1].end
      return {
        matchedChars: q.length,
        isExact: false,
        span: last - first,
        highlights,
      }
    }
  }
  return null
}

/** 拼音全拼连续匹配 */
function matchPinyinFull(pyFull: string | undefined, q: string): MatchScore | null {
  if (!pyFull || !q) return null
  const idx = pyFull.indexOf(q)
  if (idx >= 0) {
    return {
      matchedChars: Math.max(1, Math.round(q.length / 3)),
      isExact: true,
      span: q.length,
      highlights: [],
    }
  }
  return null
}

/** 单题匹配评估 */
function evaluateQuestion(question: Question, rawQuery: string): SearchResult | null {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return null

  const isAlpha = /^[a-z0-9]+$/i.test(q)
  const stem = question.q || ''
  const opts = question.o || []

  // 1. 匹配题干
  let stemScore: MatchScore | null = null
  let stemMode: 'exact' | 'subseq' | 'py-first' | 'py-full' | '' = ''

  if (!isAlpha) {
    stemScore = matchExact(stem, q)
    if (stemScore) stemMode = 'exact'
    else {
      stemScore = matchSubsequence(stem, q)
      if (stemScore) stemMode = 'subseq'
    }
  } else {
    // 先试英文原词连续命中
    stemScore = matchExact(stem, q)
    if (stemScore) {
      stemMode = 'exact'
    } else {
      // 拼音首字母连续/跨字
      stemScore = matchPinyinFirst(stem, question.pyq, q)
      if (stemScore) {
        stemMode = stemScore.isExact ? 'py-first' : 'subseq'
      } else {
        // 拼音全拼
        stemScore = matchPinyinFull(question.pyqFull, q)
        if (stemScore) stemMode = 'py-full'
      }
    }
  }

  // 2. 匹配选项
  let bestOptScore: MatchScore | null = null
  let bestOptIdx = -1

  for (let i = 0; i < opts.length; i++) {
    const optText = opts[i]
    let s: MatchScore | null = null

    if (!isAlpha) {
      s = matchExact(optText, q) || matchSubsequence(optText, q)
    } else {
      s = matchExact(optText, q) ||
        matchPinyinFirst(optText, question.pyo?.[i], q) ||
        matchPinyinFull(question.pyoFull?.[i], q)
    }

    if (s) {
      if (
        !bestOptScore ||
        s.matchedChars > bestOptScore.matchedChars ||
        (s.matchedChars === bestOptScore.matchedChars && s.isExact && !bestOptScore.isExact)
      ) {
        bestOptScore = s
        bestOptIdx = i
      }
    }
  }
  if (!stemScore && !bestOptScore) return null

  const stemChars = stemScore ? stemScore.matchedChars : 0
  const optChars = bestOptScore ? bestOptScore.matchedChars : 0
  const totalMatchedChars = Math.max(stemChars, optChars)

  const isStemExact = !!stemScore?.isExact
  const isOptExact = !!bestOptScore?.isExact
  const isAnyExact = isStemExact || isOptExact

  const minSpan = Math.min(
    stemScore ? stemScore.span : 9999,
    bestOptScore ? bestOptScore.span : 9999
  )

  let matchTag = '模糊匹配'
  if (isStemExact) matchTag = isAlpha && stemMode === 'py-first' ? '拼音命中' : '题干命中'
  else if (isOptExact) matchTag = '选项命中'
  else if (stemScore && !stemScore.isExact) matchTag = '题干跨字'
  else if (bestOptScore && !bestOptScore.isExact) matchTag = '选项跨字'

  return {
    question,
    matchedChars: totalMatchedChars,
    stemHit: !!stemScore,
    optionHit: !!bestOptScore,
    stemExact: isStemExact,
    optionExact: isOptExact,
    isAnyExact,
    stemMatchedChars: stemChars,
    optionMatchedChars: optChars,
    minSpan,
    bestOptIdx,
    stemHighlights: stemScore?.highlights || [],
    optHighlights: bestOptScore?.highlights || [],
    matchTag,
  }
}

/** 排序比较器（严格遵循用户需求 3 与 4） */
export function compareSearchResults(a: SearchResult, b: SearchResult): number {
  // 1. 按照字数匹配数降序
  if (b.matchedChars !== a.matchedChars) {
    return b.matchedChars - a.matchedChars
  }
  // 2. 完整连续匹配优先于跨字匹配 (需求 4)
  if (b.isAnyExact !== a.isAnyExact) {
    return (b.isAnyExact ? 1 : 0) - (a.isAnyExact ? 1 : 0)
  }
  // 3. 同字数匹配度则优先展示题干匹配度高的 (需求 3)
  if (b.stemMatchedChars !== a.stemMatchedChars) {
    return b.stemMatchedChars - a.stemMatchedChars
  }
  if (b.stemHit !== a.stemHit) {
    return (b.stemHit ? 1 : 0) - (a.stemHit ? 1 : 0)
  }
  // 4. 跨度更紧凑优先
  if (a.minSpan !== b.minSpan) {
    return a.minSpan - b.minSpan
  }
  // 5. 题号升序兜底
  return a.question.id - b.question.id
}

/** 将文本切片为高亮与非高亮段 */
export function buildTextSegments(text: string, spans: MatchSpan[]): HighlightSegment[] {
  if (!spans || spans.length === 0) return [{ text, highlight: false }]

  // 合并重叠或相邻的 span
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const merged: MatchSpan[] = []
  for (const s of sorted) {
    if (!merged.length) merged.push({ ...s })
    else {
      const prev = merged[merged.length - 1]
      if (s.start <= prev.end) prev.end = Math.max(prev.end, s.end)
      else merged.push({ ...s })
    }
  }

  const segs: HighlightSegment[] = []
  let cursor = 0
  for (const m of merged) {
    const s = Math.max(0, Math.min(m.start, text.length))
    const e = Math.max(0, Math.min(m.end, text.length))
    if (s > cursor) {
      segs.push({ text: text.slice(cursor, s), highlight: false })
    }
    if (e > s) {
      segs.push({ text: text.slice(s, e), highlight: true })
    }
    cursor = e
  }
  if (cursor < text.length) {
    segs.push({ text: text.slice(cursor), highlight: false })
  }
  return segs
}

/** 主搜索入口：支持拼音、多词、涵盖题干与选项、排序与高亮 */
export function searchQuestions(
  pool: Question[],
  query: string,
  limit: number = 80
): SearchResult[] {
  const raw = query.trim()
  if (!raw) return []

  const words = raw.split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  // 针对每个题目进行评分
  for (let i = 0; i < pool.length; i++) {
    const q = pool[i]
    if (words.length <= 1) {
      const res = evaluateQuestion(q, raw)
      if (res) results.push(res)
    } else {
      // 多词空格搜索：所有词累加匹配
      let totalMatchedChars = 0
      let anyExact = false
      let stemHit = false
      let optionHit = false
      let stemMatchedChars = 0
      let optionMatchedChars = 0
      let minSpan = 9999
      let bestOptIdx = -1
      const allStemHighlights: MatchSpan[] = []
      const allOptHighlights: MatchSpan[] = []

      let allMatched = true
      for (const w of words) {
        const subRes = evaluateQuestion(q, w)
        if (!subRes) {
          allMatched = false
          break
        }
        totalMatchedChars += subRes.matchedChars
        if (subRes.isAnyExact) anyExact = true
        if (subRes.stemHit) {
          stemHit = true
          stemMatchedChars += subRes.stemMatchedChars
          allStemHighlights.push(...subRes.stemHighlights)
        }
        if (subRes.optionHit) {
          optionHit = true
          optionMatchedChars += subRes.optionMatchedChars
          allOptHighlights.push(...subRes.optHighlights)
          if (bestOptIdx < 0) bestOptIdx = subRes.bestOptIdx
        }
        minSpan = Math.min(minSpan, subRes.minSpan)
      }

      if (allMatched && totalMatchedChars > 0) {
        results.push({
          question: q,
          matchedChars: totalMatchedChars,
          stemHit,
          optionHit,
          stemExact: anyExact && stemHit,
          optionExact: anyExact && optionHit,
          isAnyExact: anyExact,
          stemMatchedChars,
          optionMatchedChars,
          minSpan,
          bestOptIdx,
          stemHighlights: allStemHighlights,
          optHighlights: allOptHighlights,
          matchTag: anyExact ? '全部命中' : '组合命中',
        })
      }
    }
  }

  // 排序
  results.sort(compareSearchResults)

  // 限制返回条数并附带高亮分段数据
  const finalResults = results.slice(0, limit)
  for (const item of finalResults) {
    item.stemSegments = buildTextSegments(item.question.q, item.stemHighlights)
  }

  return finalResults
}
