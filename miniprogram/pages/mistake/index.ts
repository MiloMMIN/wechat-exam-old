// pages/mistake/index.ts —— 错题本：重做错题，答对可移出
import { questions, Question } from '../../data/questions'
import { LETTERS, shuffle } from '../../utils/quiz'
import { mistakeStore, recordAnswer } from '../../utils/store'

interface OptView {
  letter: string
  text: string
  state: '' | 'correct' | 'wrong' | 'disabled'
}

Page({
  data: {
    pool: [] as Question[],
    cursor: 0,
    q: null as Question | null,
    opts: [] as OptView[],
    answered: false,
    poolSize: 0,
    clearedSession: 0,   // 本次移出数
    emptyText: '',
  },

  onLoad() {
    const ids = new Set(mistakeStore.ids())
    this.setData({
      pool: questions.filter(q => ids.has(q.id)),
      poolSize: ids.size,
    })
    if (this.data.pool.length === 0) {
      this.setData({ emptyText: '错题本已清空' })
      return
    }
    this.showQuestion()
  },

  showQuestion() {
    const item = this.data.pool[this.data.cursor]
    if (!item) return
    this.setData({
      q: item,
      answered: false,
      opts: item.o.map((text, i) => ({ letter: LETTERS[i], text, state: '' })),
    })
  },

  choose(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered || !this.data.q) return
    const idx = Number(e.currentTarget.dataset.idx)
    const q = this.data.q
    const correct = idx === q.a
    this.setData({
      answered: true,
      opts: this.data.opts.map((o, i): OptView => ({
        ...o,
        state: i === q.a ? 'correct' : (i === idx ? 'wrong' : 'disabled'),
      })),
    })
    recordAnswer(q.id, correct)
    wx.vibrateShort({ type: correct ? 'light' : 'medium' })
  },

  removeCurrent() {
    const q = this.data.q
    if (!q) return
    mistakeStore.remove(q.id)
    const pool = this.data.pool.filter(p => p.id !== q.id)
    const clearedSession = this.data.clearedSession + 1
    if (pool.length === 0) {
      this.setData({ pool, poolSize: 0, clearedSession, q: null, emptyText: '错题本已清空' })
      return
    }
    const cursor = Math.min(this.data.cursor, pool.length - 1)
    this.setData({ pool, poolSize: pool.length, clearedSession, cursor }, () => this.showQuestion())
    wx.showToast({ title: '已移出', icon: 'none' })
  },

  shufflePool() {
    const pool = shuffle(this.data.pool)
    this.setData({ pool, cursor: 0 }, () => this.showQuestion())
  },

  clearAll() {
    wx.showModal({
      title: '清空错题本',
      content: `共 ${this.data.poolSize} 题，确定清空？`,
      success: r => {
        if (!r.confirm) return
        mistakeStore.clear()
        this.setData({ pool: [], poolSize: 0, q: null, emptyText: '错题本已清空' })
      },
    })
  },

  prev() {
    if (this.data.cursor <= 0) return
    this.setData({ cursor: this.data.cursor - 1 }, () => this.showQuestion())
  },
  next() {
    if (this.data.cursor >= this.data.pool.length - 1) {
      wx.showToast({ title: '已是最后一题', icon: 'none' })
      return
    }
    this.setData({ cursor: this.data.cursor + 1 }, () => this.showQuestion())
  },

  goExamFromMistake() {
    wx.navigateTo({ url: '../exam/index?from=mistake' })
  },
})
