// pages/learn/index.ts —— 练习页：seq / random / type / chapter / fav
import { Question } from '../../data/questions'
import { getActiveBank } from '../../utils/bank-store'
import { shuffle, LETTERS, practicePool } from '../../utils/quiz'
import { mistakeStore, favoriteStore, cullStore, learnProgress, recordAnswer, addNote, getNotes } from '../../utils/store'

type Mode = 'seq' | 'random' | 'type' | 'chapter' | 'fav'

interface OptView { letter: string; text: string; state: '' | 'correct' | 'wrong' | 'disabled' }
interface Seg { label: string; start: number; end: number }

// 简单"题型"分段：按选项数；章节：每 50 题一段
function segment(pool: Question[], by: 'type' | 'chapter'): Seg[] {
  if (by === 'chapter') {
    const segs: Seg[] = []
    for (let i = 0; i < pool.length; i += 50) {
      segs.push({ label: `第 ${i + 1}–${Math.min(i + 50, pool.length)} 题`, start: i, end: Math.min(i + 50, pool.length) })
    }
    return segs
  }
  const map = new Map<number, number[]>()
  pool.forEach((q, i) => {
    const k = q.o.length
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(i)
  })
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([k, idxs]) => ({ label: `${k} 选项题`, start: idxs[0], end: idxs[0] + idxs.length - 1 }))
}

Page({
  data: {
    mode: 'seq' as Mode,
    title: '顺序练习',
    pool: [] as Question[],
    segments: [] as Seg[],
    segIdx: -1,
    cursor: 0,
    q: null as Question | null,
    opts: [] as OptView[],
    answered: false,
    isFav: false,
    isMistake: false,
    isCulled: false,
    rightCount: 0,
    doneInSession: 0,
    poolSize: 0,
    emptyText: '',
    noteDraft: '',
    showNoteInput: false,
    bankId: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const bank = getActiveBank()
    const mode = (options.mode as Mode) || 'seq'
    const full = bank.questions
    const pool = practicePool(bank.id, full)
    let title = '顺序练习'
    let cursor = 0

    if (mode === 'random') title = '随机练习'
    else if (mode === 'fav') title = '收藏练习'
    else if (mode === 'type') title = '题型练习'
    else if (mode === 'chapter') title = '章节练习'

    let eff: Question[] = pool
    if (mode === 'fav') {
      const ids = new Set(favoriteStore.ids(bank.id))
      eff = pool.filter(q => ids.has(q.id))
    } else if (mode === 'random') {
      eff = shuffle(pool)
    }
    // seq/type/chapter 用 pool 原序；type/chapter 先展示分段选择
    this.setData({ bankId: bank.id, mode, title, pool: eff, poolSize: eff.length })

    if (eff.length === 0) {
      this.setData({ emptyText: mode === 'fav' ? '还没有收藏题目' : '当前题库为空或已全部斩掉' })
      return
    }
    if (mode === 'type' || mode === 'chapter') {
      this.setData({ segments: segment(eff, mode) })
      return
    }
    if (mode === 'seq') {
      cursor = Math.min(Math.max(learnProgress.cursor(bank.id), 0), eff.length - 1)
      this.setData({ cursor })
    }
    this.showQuestion()
  },

  pickSeg(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.i)
    const seg = this.data.segments[i]
    if (!seg) return
    if (this.data.mode === 'type') {
      const map = new Map<number, Question[]>()
      this.data.pool.forEach(q => {
        const k = q.o.length
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(q)
      })
      const sorted = Array.from(map.entries()).sort((a, b) => a[0] - b[0])
      const pick = sorted[i]?.[1] || []
      this.setData({ pool: pick, poolSize: pick.length, cursor: 0, segIdx: i }, () => this.showQuestion())
    } else {
      // chapter: pool 不变，cursor 跳到 seg.start
      this.setData({ cursor: seg.start, segIdx: i }, () => this.showQuestion())
    }
  },

  backToSegs() {
    this.setData({ segIdx: -1, q: null })
  },

  showQuestion() {
    const { pool, cursor } = this.data
    const q = pool[cursor]
    if (!q) return
    const bankId = this.data.bankId
    this.setData({
      q,
      answered: false,
      isFav: favoriteStore.has(bankId, q.id),
      isMistake: mistakeStore.has(bankId, q.id),
      isCulled: cullStore.has(bankId, q.id),
      opts: q.o.map((text, i) => ({ letter: LETTERS[i], text, state: '' })),
      showNoteInput: false,
      noteDraft: '',
    })
    if (this.data.mode === 'seq') learnProgress.setCursor(bankId, cursor)
  },

  choose(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered || !this.data.q) return
    const idx = Number(e.currentTarget.dataset.idx)
    const q = this.data.q
    const bankId = this.data.bankId
    const correct = idx === q.a
    recordAnswer(bankId, q.id, correct)
    if (!correct) mistakeStore.add(bankId, q.id)
    this.setData({
      answered: true,
      isMistake: !correct ? true : this.data.isMistake,
      rightCount: this.data.rightCount + (correct ? 1 : 0),
      doneInSession: this.data.doneInSession + 1,
      opts: this.data.opts.map((o, i): OptView => ({
        ...o,
        state: i === q.a ? 'correct' : (i === idx ? 'wrong' : 'disabled'),
      })),
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
    const fav = favoriteStore.toggle(this.data.bankId, this.data.q.id)
    this.setData({ isFav: fav })
    wx.showToast({ title: fav ? '已收藏' : '已取消', icon: 'none' })
  },

  toggleMistake() {
    const { q, bankId, isMistake } = this.data
    if (!q) return
    if (isMistake) mistakeStore.remove(bankId, q.id)
    else mistakeStore.add(bankId, q.id)
    this.setData({ isMistake: !isMistake })
  },

  // 斩题：标记掌握并从练习池剔除
  toggleCull() {
    const { q, bankId, isCulled } = this.data
    if (!q) return
    cullStore.toggle(bankId, q.id)
    this.setData({ isCulled: !isCulled })
    if (!isCulled) {
      wx.showToast({ title: '已斩，下次练习跳过', icon: 'none' })
      // 顺序模式：直接从池子删
      if (this.data.mode === 'seq') {
        const pool = this.data.pool.filter(p => p.id !== q.id)
        const cursor = Math.min(this.data.cursor, pool.length - 1)
        this.setData({ pool, poolSize: pool.length, cursor }, () => this.showQuestion())
      }
    }
  },

  showNote() {
    if (!this.data.q) return
    const existing = getNotes(this.data.bankId).find(n => n.qid === this.data.q!.id)
    this.setData({ showNoteInput: true, noteDraft: existing?.text || '' })
  },
  onNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ noteDraft: e.detail.value })
  },
  saveNote() {
    const text = this.data.noteDraft.trim()
    if (!text || !this.data.q) { this.setData({ showNoteInput: false }); return }
    addNote(this.data.bankId, this.data.q.id, text)
    this.setData({ showNoteInput: false, noteDraft: '' })
    wx.showToast({ title: '笔记已存', icon: 'success' })
  },
})
