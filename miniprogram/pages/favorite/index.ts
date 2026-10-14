// pages/favorite/index.ts —— 收藏夹练习（简化版，复用 learn 视图）
import { Question } from '../../data/questions'
import { getActiveBank } from '../../utils/bank-store'
import { LETTERS } from '../../utils/quiz'
import { favoriteStore, mistakeStore, recordAnswer } from '../../utils/store'

interface OptView { letter: string; text: string; state: '' | 'correct' | 'wrong' | 'disabled' }

Page({
  data: {
    pool: [] as Question[],
    cursor: 0,
    q: null as Question | null,
    opts: [] as OptView[],
    answered: false,
    bankId: '',
    emptyText: '',
    poolSize: 0,
  },

  onLoad() {
    const bank = getActiveBank()
    const ids = new Set(favoriteStore.ids(bank.id))
    const pool = bank.questions.filter(q => ids.has(q.id))
    this.setData({ bankId: bank.id, pool, poolSize: pool.length })
    if (!pool.length) { this.setData({ emptyText: '还没有收藏题目' }); return }
    this.showQuestion()
  },

  showQuestion() {
    const q = this.data.pool[this.data.cursor]
    if (!q) return
    this.setData({
      q,
      answered: false,
      opts: q.o.map((text, i) => ({ letter: LETTERS[i], text, state: '' })),
    })
  },

  choose(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered || !this.data.q) return
    const idx = Number(e.currentTarget.dataset.idx)
    const q = this.data.q
    const correct = idx === q.a
    recordAnswer(this.data.bankId, q.id, correct)
    if (!correct) mistakeStore.add(this.data.bankId, q.id)
    this.setData({
      answered: true,
      opts: this.data.opts.map((o, i): OptView => ({
        ...o,
        state: i === q.a ? 'correct' : (i === idx ? 'wrong' : 'disabled'),
      })),
    })
  },

  unfav() {
    const q = this.data.q
    if (!q) return
    favoriteStore.remove(this.data.bankId, q.id)
    const pool = this.data.pool.filter(p => p.id !== q.id)
    if (!pool.length) {
      this.setData({ pool, poolSize: 0, q: null, emptyText: '收藏夹已空' })
      return
    }
    const cursor = Math.min(this.data.cursor, pool.length - 1)
    this.setData({ pool, poolSize: pool.length, cursor }, () => this.showQuestion())
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  },

  prev() {
    if (this.data.cursor > 0) this.setData({ cursor: this.data.cursor - 1 }, () => this.showQuestion())
  },
  next() {
    if (this.data.cursor < this.data.pool.length - 1) {
      this.setData({ cursor: this.data.cursor + 1 }, () => this.showQuestion())
    } else {
      wx.showToast({ title: '已是最后一题', icon: 'none' })
    }
  },
})
