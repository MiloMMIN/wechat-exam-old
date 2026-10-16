// pages/search/index.ts —— 智能搜题
import { Question } from '../../data/questions'
import { getActiveBank, listBanks, setActiveBank } from '../../utils/bank-store'
import { searchQuestions, SearchResult, HighlightSegment } from '../../utils/search-engine'
import { favoriteStore, mistakeStore } from '../../utils/store'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const KEY_HISTORY = 'quiz_search_history'

interface OptViewItem {
  letter: string
  text: string
  isCorrect: boolean
  segments?: HighlightSegment[]
}

interface ViewItem {
  id: number
  qSegments: HighlightSegment[]
  rawStem: string
  opts: OptViewItem[]
  answerLetter: string
  answerText: string
  matchTag: string
  matchedChars: number
  isFav: boolean
  isMistake: boolean
  showAnswer: boolean
  optHitIdx: number
}

Page({
  data: {
    query: '',
    bankName: '',
    bankId: '',
    bankList: [] as { id: string; name: string }[],
    bankIdx: 0,
    totalBankQuestions: 0,
    results: [] as ViewItem[],
    searched: false,
    historyList: [] as string[],
    showAllAnswers: true,
  },

  _timer: null as number | null,
  _pool: [] as Question[],

  onLoad() {
    this.initBank()
    this.loadHistory()
  },

  onShow() {
    this.initBank()
  },

  initBank() {
    const active = getActiveBank()
    const banks = listBanks()
    this._pool = active.questions
    const idx = Math.max(0, banks.findIndex(b => b.id === active.id))
    this.setData({
      bankId: active.id,
      bankName: active.name,
      bankList: banks.map(b => ({ id: b.id, name: b.name })),
      bankIdx: idx,
      totalBankQuestions: active.questions.length,
    })
    // 如果已经有搜索词，重新搜一次
    if (this.data.query.trim()) {
      this.doSearch(this.data.query.trim())
    }
  },

  loadHistory() {
    const list: string[] = wx.getStorageSync(KEY_HISTORY) || []
    this.setData({ historyList: list.slice(0, 10) })
  },

  saveHistory(query: string) {
    const q = query.trim()
    if (!q) return
    let list: string[] = wx.getStorageSync(KEY_HISTORY) || []
    list = [q, ...list.filter(item => item !== q)].slice(0, 10)
    wx.setStorageSync(KEY_HISTORY, list)
    this.setData({ historyList: list })
  },

  clearHistory() {
    wx.removeStorageSync(KEY_HISTORY)
    this.setData({ historyList: [] })
  },

  onBankChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    const bank = this.data.bankList[idx]
    if (!bank) return
    setActiveBank(bank.id)
    this.initBank()
  },

  onInput(e: WechatMiniprogram.Input) {
    const val = e.detail.value
    this.setData({ query: val })
    if (this._timer) clearTimeout(this._timer)
    if (!val.trim()) {
      this.setData({ results: [], searched: false })
      return
    }
    this._timer = setTimeout(() => {
      this.doSearch(val.trim())
    }, 150) as unknown as number
  },

  onConfirm() {
    const q = this.data.query.trim()
    if (q) {
      this.saveHistory(q)
      this.doSearch(q)
    }
  },

  onClear() {
    this.setData({ query: '', results: [], searched: false })
  },

  onTapHistory(e: WechatMiniprogram.TouchEvent) {
    const word = e.currentTarget.dataset.word as string
    if (!word) return
    this.setData({ query: word })
    this.saveHistory(word)
    this.doSearch(word)
  },

  doSearch(keyword: string) {
    const raw = keyword.trim()
    if (!raw) {
      this.setData({ results: [], searched: false })
      return
    }

    const matches: SearchResult[] = searchQuestions(this._pool, raw, 100)
    const bankId = this.data.bankId
    const favIds = new Set(favoriteStore.ids(bankId))
    const mistakeIds = new Set(mistakeStore.ids(bankId))

    const views: ViewItem[] = matches.map(m => {
      const q = m.question
      const answerLetter = LETTERS[q.a] || 'A'
      const answerText = q.o[q.a] || ''

      const optSegsList = m.optSegmentsList
      const opts: OptViewItem[] = q.o.map((text, idx) => ({
        letter: LETTERS[idx],
        text,
        isCorrect: idx === q.a,
        segments: optSegsList ? optSegsList[idx] : [{ text, type: 'none' }],
      }))

      return {
        id: q.id,
        qSegments: m.stemSegments || [{ text: q.q, type: 'none' }],
        rawStem: q.q,
        opts,
        answerLetter,
        answerText,
        matchTag: m.matchTag,
        matchedChars: m.matchedChars,
        isFav: favIds.has(q.id),
        isMistake: mistakeIds.has(q.id),
        showAnswer: this.data.showAllAnswers,
        optHitIdx: m.bestOptIdx,
      }
    })

    this.setData({
      results: views,
      searched: true,
    })
  },

  toggleShowAll() {
    const next = !this.data.showAllAnswers
    const nextResults = this.data.results.map(r => ({ ...r, showAnswer: next }))
    this.setData({ showAllAnswers: next, results: nextResults })
  },

  toggleItemAnswer(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx)
    const item = this.data.results[idx]
    if (!item) return
    const key = `results[${idx}].showAnswer`
    this.setData({ [key]: !item.showAnswer })
  },

  toggleFav(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx)
    const item = this.data.results[idx]
    if (!item) return
    const bankId = this.data.bankId
    const isNowFav = favoriteStore.toggle(bankId, item.id)
    const key = `results[${idx}].isFav`
    this.setData({ [key]: isNowFav })
    wx.showToast({
      title: isNowFav ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1000,
    })
  },

  copyQuestion(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx)
    const item = this.data.results[idx]
    if (!item) return
    const optLines = item.opts.map(o => `${o.letter}. ${o.text}`).join('\n')
    const fullText = `题目：${item.rawStem}\n${optLines}\n【参考答案】${item.answerLetter}（${item.answerText}）`
    wx.setClipboardData({
      data: fullText,
      success() {
        wx.showToast({ title: '题目已复制', icon: 'success', duration: 1000 })
      },
    })
  },
})
