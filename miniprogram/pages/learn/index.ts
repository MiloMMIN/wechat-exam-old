// pages/learn/index.ts —— 学习模式：顺序/随机/收藏
import { questions, Question } from '../../data/questions'
import { shuffle, LETTERS } from '../../utils/quiz'
import { mistakeStore, favoriteStore, learnProgress, recordAnswer } from '../../utils/store'

type Mode = 'seq' | 'random' | 'fav'

interface OptView {
  letter: string
  text: string
  state: '' | 'correct' | 'wrong' | 'disabled'
}

Page({
  data: {
    mode: 'seq' as Mode,
    title: '顺序学习',
    pool: [] as Question[],
    cursor: 0,
    q: null as Question | null,
    opts: [] as OptView[],
    answered: false,
    isFav: false,
    isMistake: false,
    rightCount: 0,
    doneInSession: 0,
    poolSize: 0,
    emptyText: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const mode = (options.mode as Mode) || 'seq'
    let pool: Question[] = []
    let cursor = 0
    let title = '顺序学习'

    if (mode === 'random') {
      pool = shuffle(questions)
      title = '随机练习'
    } else if (mode === 'fav') {
      const ids = new Set(favoriteStore.ids())
      pool = questions.filter(q => ids.has(q.id))
      title = '收藏夹'
    } else {
      pool = questions
      cursor = Math.min(Math.max(learnProgress.cursor, 0), questions.length - 1)
    }

    this.setData({ mode, title, pool, cursor, poolSize: pool.length })
    if (pool.length === 0) {
      this.setData({ emptyText: mode === 'fav' ? '还没有收藏题目' : '暂无题目' })
      return
    }
    this.showQuestion()
  },

  showQuestion() {
    const { pool, cursor } = this.data
    const q = pool[cursor]
    if (!q) return
    this.setData({
      q,
      answered: false,
      isFav: favoriteStore.has(q.id),
      isMistake: mistakeStore.has(q.id),
      opts: q.o.map((text, i) => ({ letter: LETTERS[i], text, state: '' })),
    })
    if (this.data.mode === 'seq') learnProgress.cursor = cursor
  },

  choose(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered || !this.data.q) return
    const idx = Number(e.currentTarget.dataset.idx)
    const q = this.data.q
    const correct = idx === q.a
    const opts = this.data.opts.map((o, i): OptView => ({
      ...o,
      state: i === q.a ? 'correct' : (i === idx ? 'wrong' : 'disabled'),
    }))
    recordAnswer(q.id, correct)
    if (!correct) mistakeStore.add(q.id)
    this.setData({
      answered: true,
      opts,
      isMistake: !correct ? true : this.data.isMistake,
      rightCount: this.data.rightCount + (correct ? 1 : 0),
      doneInSession: this.data.doneInSession + 1,
    })
    wx.vibrateShort({ type: correct ? 'light' : 'medium' })
  },

  prev() {
    if (this.data.cursor <= 0) return
    this.setData({ cursor: this.data.cursor - 1 }, () => this.showQuestion())
  },
  next() {
    const { cursor, pool } = this.data
    if (cursor >= pool.length - 1) {
      wx.showToast({ title: '已是最后一题', icon: 'none' })
      return
    }
    this.setData({ cursor: cursor + 1 }, () => this.showQuestion())
  },

  toggleFav() {
    if (!this.data.q) return
    const fav = favoriteStore.toggle(this.data.q.id)
    this.setData({ isFav: fav })
    wx.showToast({ title: fav ? '已收藏' : '已取消', icon: 'none' })
  },

  toggleMistake() {
    const q = this.data.q
    if (!q) return
    if (this.data.isMistake) {
      mistakeStore.remove(q.id)
      this.setData({ isMistake: false })
      wx.showToast({ title: '已移出错题本', icon: 'none' })
    } else {
      mistakeStore.add(q.id)
      this.setData({ isMistake: true })
      wx.showToast({ title: '已加入错题本', icon: 'none' })
    }
  },

  jumpTo(e: WechatMiniprogram.Input) {
    const n = parseInt(e.detail.value)
    if (!n || n < 1 || n > this.data.poolSize) return
    this.setData({ cursor: n - 1 }, () => this.showQuestion())
  },
})
