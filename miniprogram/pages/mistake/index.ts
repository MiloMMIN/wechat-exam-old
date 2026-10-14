// pages/mistake/index.ts —— 错题本（按当前题库）
import { Question } from '../../data/questions'
import { getActiveBank } from '../../utils/bank-store'
import { LETTERS, shuffle } from '../../utils/quiz'
import { mistakeStore, recordAnswer } from '../../utils/store'

interface OptView { letter: string; text: string; state: '' | 'correct' | 'wrong' | 'disabled' }

Page({
  data: {
    pool: [] as Question[],
    cursor: 0,
    q: null as Question | null,
    opts: [] as OptView[],
    answered: false,
    poolSize: 0,
    clearedSession: 0,
    emptyText: '',
    bankId: '',
  },

  onLoad() {
    const bank = getActiveBank()
    const ids = new Set(mistakeStore.ids(bank.id))
    const pool = bank.questions.filter(q => ids.has(q.id))
    this.setData({ bankId: bank.id, pool, poolSize: pool.length })
    if (!pool.length) { this.setData({ emptyText: '错题本已清空' }); return }
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
    recordAnswer(this.data.bankId, q.id, correct)
    this.setData({
      answered: true,
      opts: this.data.opts.map((o, i): OptView => ({
        ...o,
        state: i === q.a ? 'correct' : (i === idx ? 'wrong' : 'disabled'),
      })),
    })
    wx.vibrateShort({ type: correct ? 'light' : 'medium' })
  },

  removeCurrent() {
    const q = this.data.q
    if (!q) return
    mistakeStore.remove(this.data.bankId, q.id)
    const pool = this.data.pool.filter(p => p.id !== q.id)
    const clearedSession = this.data.clearedSession + 1
    if (!pool.length) {
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
        mistakeStore.clear(this.data.bankId)
        this.setData({ pool: [], poolSize: 0, q: null, emptyText: '错题本已清空' })
      },
    })
  },

  prev() { if (this.data.cursor > 0) this.setData({ cursor: this.data.cursor - 1 }, () => this.showQuestion()) },
  next() {
    if (this.data.cursor < this.data.pool.length - 1) {
      this.setData({ cursor: this.data.cursor + 1 }, () => this.showQuestion())
    } else {
      wx.showToast({ title: '已是最后一题', icon: 'none' })
    }
  },

  goExamFromMistake() {
    const bank = getActiveBank()
    wx.navigateTo({ url: `../exam/index?from=mistake&count=${bank.exam.count}&minutes=${bank.exam.minutes}&spq=${bank.exam.scorePerQuestion}&pass=${bank.exam.passScore}&shuffleOpts=${bank.exam.shuffleOptions ? 1 : 0}&showAns=${bank.exam.showAnswerAfterSubmit ? 1 : 0}` })
  },
})
