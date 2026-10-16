// miniprogram/utils/search-engine.ts —— 题库拼音/模糊拼音/跨字/题干选项高精度搜索引擎
import type { Question } from '../data/questions'

export type HighlightType = 'none' | 'normal' | 'pinyin'

export interface MatchSpan {
  start: number
  end: number
  type: 'normal' | 'pinyin'
}

export interface HighlightSegment {
  text: string
  type: HighlightType
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
  /** 是否为连续紧凑匹配 (无论是精确还是模糊音) */
  isContinuous: boolean
  /** 是否包含模糊音转化命中 (同等条件下精确拼音优先) */
  hasFuzzy: boolean
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
  /** 选项高亮区间 */
  optHighlights: MatchSpan[]
  /** 标签：普通命中 / 拼音命中 / 拼音模糊 / 跨字匹配 等 */
  matchTag: string
  /** 题干切片渲染段 */
  stemSegments?: HighlightSegment[]
  /** 选项切片渲染段列表 */
  optSegmentsList?: HighlightSegment[][]
}

interface MatchScore {
  matchedChars: number
  isExact: boolean
  isContinuous: boolean
  hasFuzzy: boolean
  span: number
  highlights: MatchSpan[]
}

// 完整合法拼音音节表
const PINYIN_SYLLABLES: Set<string> = new Set([
  'a','ai','an','ang','ao','ba','bai','ban','bang','bao','bei','ben','beng','bi','bian','biao','bie','bin','bing','bo','bu',
  'ca','cai','can','cang','cao','ce','cen','ceng','cha','chai','chan','chang','chao','che','chen','cheng','chi','chong','chou',
  'chu','chua','chuai','chuan','chuang','chui','chun','chuo','ci','cong','cou','cu','cuan','cui','cun','cuo','da','dai','dan',
  'dang','dao','de','dei','den','deng','di','dia','dian','diao','die','ding','diu','dong','dou','du','duan','dui','dun','duo',
  'e','ei','en','eng','er','fa','fan','fang','fei','fen','feng','fo','fou','fu','ga','gai','gan','gang','gao','ge','gei','gen',
  'geng','gong','gou','gu','gua','guai','guan','guang','gui','gun','guo','ha','hai','han','hang','hao','he','hei','hen','heng',
  'hng','hong','hou','hu','hua','huai','huan','huang','hui','hun','huo','ji','jia','jian','jiang','jiao','jie','jin','jing',
  'jiong','jiu','ju','juan','jue','jun','ka','kai','kan','kang','kao','ke','kei','ken','keng','kong','kou','ku','kua','kuai',
  'kuan','kuang','kui','kun','kuo','la','lai','lan','lang','lao','le','lei','leng','li','lia','lian','liang','liao','lie','lin',
  'ling','liu','lo','long','lou','lu','luan','lue','lun','luo','lv','lve','ma','mai','man','mang','mao','me','mei','men','meng',
  'mi','mian','miao','mie','min','ming','miu','mo','mou','mu','na','nai','nan','nang','nao','ne','nei','nen','neng','ng','ni',
  'nian','niang','niao','nie','nin','ning','niu','nong','nou','nu','nuan','nue','nun','nuo','nv','nve','o','ou','pa','pai',
  'pan','pang','pao','pei','pen','peng','pi','pian','piao','pie','pin','ping','po','pou','pu','qi','qia','qian','qiang','qiao',
  'qie','qin','qing','qiong','qiu','qu','quan','que','qun','ran','rang','rao','re','ren','reng','ri','rong','rou','ru','rua',
  'ruan','rui','run','ruo','sa','sai','san','sang','sao','se','sen','seng','sha','shai','shan','shang','shao','she','shei','shen',
  'sheng','shi','shou','shu','shua','shuai','shuan','shuang','shui','shun','shuo','si','song','sou','su','suan','sui','sun','suo',
  'ta','tai','tan','tang','tao','te','teng','ti','tian','tiao','tie','ting','tong','tou','tu','tuan','tui','tun','tuo','wa',
  'wai','wan','wang','wei','wen','weng','wo','wu','xi','xia','xian','xiang','xiao','xie','xin','xing','xiong','xiu','xu','xuan',
  'xue','xun','ya','yan','yang','yao','ye','yi','yin','ying','yo','yong','you','yu','yuan','yue','yun','za','zai','zan','zang',
  'zao','ze','zei','zen','zeng','zha','zhai','zhan','zhang','zhao','zhe','zhei','zhen','zheng','zhi','zhong','zhou','zhu','zhua',
  'zhuai','zhuan','zhuang','zhui','zhun','zhuo','zi','zong','zou','zu','zuan','zui','zun','zuo'
])

/** 模糊拼音归一化：声母(平翘舌/鼻音/唇齿) + 韵母(前后鼻音) */
export function toFuzzyPinyin(s: string): string {
  let r = s.toLowerCase()
  // 声母平翘舌/易混
  if (r.startsWith('zh')) r = 'z' + r.slice(2)
  else if (r.startsWith('ch')) r = 'c' + r.slice(2)
  else if (r.startsWith('sh')) r = 's' + r.slice(2)
  else if (r.startsWith('l')) r = 'n' + r.slice(1)
  else if (r.startsWith('f')) r = 'h' + r.slice(1)

  // 韵母前后鼻音
  if (r.endsWith('iang')) r = r.slice(0, -4) + 'ian'
  else if (r.endsWith('uang')) r = r.slice(0, -4) + 'uan'
  else if (r.endsWith('ang')) r = r.slice(0, -3) + 'an'
  else if (r.endsWith('eng')) r = r.slice(0, -3) + 'en'
  else if (r.endsWith('ing')) r = r.slice(0, -3) + 'in'

  return r
}

/** 智能将用户输入的拼音串切分为音节序列 (支持全拼、前缀拼音、首字母简拼) */
export function segmentPinyin(str: string): string[] {
  const s = str.toLowerCase().replace(/[^a-z]/g, '')
  if (!s) return []

  const memo = new Map<number, string[][]>()

  function dfs(idx: number): string[][] {
    if (idx === s.length) return [[]]
    if (memo.has(idx)) return memo.get(idx)!

    const list: string[][] = []
    const maxLen = Math.min(6, s.length - idx)

    for (let len = maxLen; len >= 1; len--) {
      const piece = s.slice(idx, idx + len)
      if (PINYIN_SYLLABLES.has(piece) || PINYIN_SYLLABLES.has(toFuzzyPinyin(piece))) {
        const subs = dfs(idx + len)
        for (const sub of subs) list.push([piece, ...sub])
      }
    }

    memo.set(idx, list)
    return list
  }

  const all = dfs(0)
  if (all.length > 0) {
    all.sort((a, b) => a.length - b.length)
    return all[0]
  }

  // 若无法整除，尝试截断末尾前缀 (如 'wul' -> ['wu', 'l'])
  for (let prefixLen = s.length - 1; prefixLen >= 1; prefixLen--) {
    const head = s.slice(0, prefixLen)
    const tail = s.slice(prefixLen)
    let tailIsPrefix = false
    for (const p of PINYIN_SYLLABLES) {
      if (p.startsWith(tail)) {
        tailIsPrefix = true
        break
      }
    }
    if (tailIsPrefix) {
      const sub = segmentPinyin(head)
      if (sub && sub.length) {
        return [...sub, tail]
      }
    }
  }

  // 兜底：按单字母序列处理 (首字母简拼模式)
  return s.split('')
}

/** 单音节匹配评估 */
function matchSingleSyllable(targetPy: string, queryPy: string): { matched: boolean; isFuzzy: boolean } {
  if (!targetPy || !queryPy) return { matched: false, isFuzzy: false }
  const t = targetPy.toLowerCase()
  const q = queryPy.toLowerCase()

  // 1. 完全精确全拼
  if (t === q) return { matched: true, isFuzzy: false }
  // 2. 精确前缀匹配 (打了一半的音节)
  if (t.startsWith(q) && q.length >= 2) return { matched: true, isFuzzy: false }

  // 3. 模糊音归一化
  const ft = toFuzzyPinyin(t)
  const fq = toFuzzyPinyin(q)
  if (ft === fq) return { matched: true, isFuzzy: true }
  if (ft.startsWith(fq) && fq.length >= 2) return { matched: true, isFuzzy: true }

  // 4. 首字母匹配 (单字母 query)
  if (q.length === 1) {
    if (t[0] === q[0]) return { matched: true, isFuzzy: false }
    if (ft[0] === fq[0]) return { matched: true, isFuzzy: true }
  }

  return { matched: false, isFuzzy: false }
}

/** 连续汉字或英文直接子串匹配 (普通命中：红色下划线) */
function matchExact(text: string, q: string): MatchScore | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return null
  return {
    matchedChars: q.length,
    isExact: true,
    isContinuous: true,
    hasFuzzy: false,
    span: q.length,
    highlights: [{ start: idx, end: idx + q.length, type: 'normal' }],
  }
}

/** 跨字汉字直接匹配 (普通命中：红色下划线) */
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
      highlights.push({ start: pos, end: pos + 1, type: 'normal' })
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
      isExact: false, // 跨字
      isContinuous: false,
      hasFuzzy: false,
      span: last - first,
      highlights,
    }
  }
  return null
}

/** 拼音音节匹配引擎 (拼音命中：蓝色下划线) */
function matchPinyinInSyllables(pys: string | undefined, queryPieces: string[]): MatchScore | null {
  if (!pys || !queryPieces || queryPieces.length === 0) return null
  const syllables = pys.split(' ')
  if (syllables.length === 0) return null

  // 1. 尝试连续音节匹配 (优先)
  for (let i = 0; i <= syllables.length - queryPieces.length; i++) {
    let allMatch = true
    let hasFuzzy = false
    const highlights: MatchSpan[] = []

    for (let j = 0; j < queryPieces.length; j++) {
      const res = matchSingleSyllable(syllables[i + j], queryPieces[j])
      if (!res.matched) {
        allMatch = false
        break
      }
      if (res.isFuzzy) hasFuzzy = true
      highlights.push({ start: i + j, end: i + j + 1, type: 'pinyin' })
    }

    if (allMatch && highlights.length === queryPieces.length) {
      return {
        matchedChars: queryPieces.length,
        isExact: !hasFuzzy,
        isContinuous: true,
        hasFuzzy,
        span: queryPieces.length,
        highlights,
      }
    }
  }

  // 2. 连续未命中，尝试跨字音节匹配
  let fromIdx = 0
  let matchedCount = 0
  let hasFuzzy = false
  const highlights: MatchSpan[] = []

  for (let j = 0; j < queryPieces.length; j++) {
    const qPiece = queryPieces[j]
    let foundPos = -1
    let foundFuzzy = false

    for (let k = fromIdx; k < syllables.length; k++) {
      const res = matchSingleSyllable(syllables[k], qPiece)
      if (res.matched) {
        foundPos = k
        foundFuzzy = res.isFuzzy
        break
      }
    }

    if (foundPos >= 0) {
      if (foundFuzzy) hasFuzzy = true
      highlights.push({ start: foundPos, end: foundPos + 1, type: 'pinyin' })
      fromIdx = foundPos + 1
      matchedCount++
    } else {
      break
    }
  }

  if (matchedCount === queryPieces.length && highlights.length === queryPieces.length) {
    const first = highlights[0].start
    const last = highlights[highlights.length - 1].end
    return {
      matchedChars: queryPieces.length,
      isExact: false, // 跨字
      isContinuous: false,
      hasFuzzy,
      span: last - first,
      highlights,
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
  const pys = question.pys || ''
  const pyos = question.pyos || []

  const queryPieces = isAlpha ? segmentPinyin(q) : []

  // 1. 匹配题干
  let stemScore: MatchScore | null = null
  let stemType: 'normal' | 'pinyin' = 'normal'

  if (!isAlpha) {
    // 纯中文或带符号：优先普通连续，再普通跨字
    stemScore = matchExact(stem, q) || matchSubsequence(stem, q)
    stemType = 'normal'
  } else {
    // 英文优先直接字符精确匹配 (如题干原本包含英文词 B2B、CRM)
    stemScore = matchExact(stem, q)
    if (stemScore) {
      stemType = 'normal'
    } else {
      // 拼音音节引擎 (包含连续全拼、模糊拼音、全拼跨字、简拼首字母跨字)
      stemScore = matchPinyinInSyllables(pys, queryPieces)
      stemType = 'pinyin'
    }
  }

  // 2. 匹配选项
  let bestOptScore: MatchScore | null = null
  let bestOptIdx = -1
  let optType: 'normal' | 'pinyin' = 'normal'

  for (let i = 0; i < opts.length; i++) {
    const optText = opts[i]
    let s: MatchScore | null = null
    let t: 'normal' | 'pinyin' = 'normal'

    if (!isAlpha) {
      s = matchExact(optText, q) || matchSubsequence(optText, q)
      t = 'normal'
    } else {
      s = matchExact(optText, q)
      if (s) {
        t = 'normal'
      } else {
        s = matchPinyinInSyllables(pyos[i], queryPieces)
        t = 'pinyin'
      }
    }

    if (s) {
      if (
        !bestOptScore ||
        s.matchedChars > bestOptScore.matchedChars ||
        (s.matchedChars === bestOptScore.matchedChars && s.isExact && !bestOptScore.isExact) ||
        (s.matchedChars === bestOptScore.matchedChars && !s.hasFuzzy && bestOptScore.hasFuzzy)
      ) {
        bestOptScore = s
        bestOptIdx = i
        optType = t
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
  const hasFuzzy = (stemScore ? stemScore.hasFuzzy : false) || (bestOptScore ? bestOptScore.hasFuzzy : false)

  const minSpan = Math.min(
    stemScore ? stemScore.span : 9999,
    bestOptScore ? bestOptScore.span : 9999
  )

  let matchTag = '模糊匹配'
  if (stemScore) {
    if (stemType === 'pinyin') {
      matchTag = stemScore.isContinuous
        ? (stemScore.hasFuzzy ? '拼音模糊' : '拼音命中')
        : '拼音跨字'
    } else {
      matchTag = stemScore.isContinuous ? '题干命中' : '题干跨字'
    }
  } else if (bestOptScore) {
    if (optType === 'pinyin') {
      matchTag = bestOptScore.isContinuous
        ? (bestOptScore.hasFuzzy ? '选项拼音模糊' : '选项拼音')
        : '选项拼音跨字'
    } else {
      matchTag = bestOptScore.isContinuous ? '选项命中' : '选项跨字'
    }
  }

  return {
    question,
    matchedChars: totalMatchedChars,
    stemHit: !!stemScore,
    optionHit: !!bestOptScore,
    stemExact: isStemExact,
    optionExact: isOptExact,
    isAnyExact,
    isContinuous: (stemScore?.isContinuous || bestOptScore?.isContinuous) || false,
    hasFuzzy,
    stemMatchedChars: stemChars,
    optionMatchedChars: optChars,
    minSpan,
    bestOptIdx,
    stemHighlights: stemScore?.highlights || [],
    optHighlights: bestOptScore?.highlights || [],
    matchTag,
  }
}

/** 排序比较器（严格遵循需求 3、4 以及模糊拼音降权） */
export function compareSearchResults(a: SearchResult, b: SearchResult): number {
  // 1. 按照字数匹配数降序
  if (b.matchedChars !== a.matchedChars) {
    return b.matchedChars - a.matchedChars
  }
  // 2. 连续紧凑匹配优先于跨字匹配 (需求 4)
  if (b.isContinuous !== a.isContinuous) {
    return (b.isContinuous ? 1 : 0) - (a.isContinuous ? 1 : 0)
  }
  // 3. 同为连续时，精确无模糊匹配优先于模糊音转换
  if (a.hasFuzzy !== b.hasFuzzy) {
    return (a.hasFuzzy ? 1 : 0) - (b.hasFuzzy ? 1 : 0)
  }
  if (b.stemMatchedChars !== a.stemMatchedChars) {
    return b.stemMatchedChars - a.stemMatchedChars
  }
  if (b.stemHit !== a.stemHit) {
    return (b.stemHit ? 1 : 0) - (a.stemHit ? 1 : 0)
  }
  // 5. 跨度更紧凑优先
  if (a.minSpan !== b.minSpan) {
    return a.minSpan - b.minSpan
  }
  // 6. 题号升序兜底
  return a.question.id - b.question.id
}

/** 将文本切片为普通文字与高亮段 (支持普通红下划线与拼音蓝下划线) */
export function buildTextSegments(text: string, spans: MatchSpan[]): HighlightSegment[] {
  if (!spans || spans.length === 0) return [{ text, type: 'none' }]

  // 按 start 升序排序并合并重叠
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const merged: MatchSpan[] = []
  for (const s of sorted) {
    if (!merged.length) {
      merged.push({ ...s })
    } else {
      const prev = merged[merged.length - 1]
      if (s.start <= prev.end) {
        prev.end = Math.max(prev.end, s.end)
        // 优先 normal 类型
        if (s.type === 'normal') prev.type = 'normal'
      } else {
        merged.push({ ...s })
      }
    }
  }

  const segs: HighlightSegment[] = []
  let cursor = 0
  for (const m of merged) {
    const s = Math.max(0, Math.min(m.start, text.length))
    const e = Math.max(0, Math.min(m.end, text.length))
    if (s > cursor) {
      segs.push({ text: text.slice(cursor, s), type: 'none' })
    }
    if (e > s) {
      segs.push({ text: text.slice(s, e), type: m.type })
    }
    cursor = e
  }
  if (cursor < text.length) {
    segs.push({ text: text.slice(cursor), type: 'none' })
  }
  return segs
}

/** 主搜索入口：支持拼音模糊音、多词、涵盖题干与选项、双色高亮 */
export function searchQuestions(
  pool: Question[],
  query: string,
  limit: number = 80
): SearchResult[] {
  const raw = query.trim()
  if (!raw) return []

  const words = raw.split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  for (let i = 0; i < pool.length; i++) {
    const q = pool[i]
    if (words.length <= 1) {
      const res = evaluateQuestion(q, raw)
      if (res) results.push(res)
    } else {
      // 多词空格搜索
      let totalMatchedChars = 0
      let anyExact = false
      let hasFuzzy = false
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
        if (subRes.hasFuzzy) hasFuzzy = true
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
          isContinuous: anyExact,
          hasFuzzy,
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

  // 切割高亮分段
  const finalResults = results.slice(0, limit)
  for (const item of finalResults) {
    item.stemSegments = buildTextSegments(item.question.q, item.stemHighlights)
    if (item.bestOptIdx >= 0 && item.question.o[item.bestOptIdx]) {
      item.optSegmentsList = item.question.o.map((optText, idx) => {
        if (idx === item.bestOptIdx) {
          return buildTextSegments(optText, item.optHighlights)
        }
        return [{ text: optText, type: 'none' }]
      })
    }
  }

  return finalResults
}
