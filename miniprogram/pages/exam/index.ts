// pages/exam/index.ts —— 模拟考试
import { Question } from '../../data/questions'
import { getActiveBank } from '../../utils/bank-store'
import { pickExam, LETTERS, fmtSeconds, practicePool } from '../../utils/quiz'
import { mistakeStore, recordAnswer, addExamRecord } from '../../utils/store'

interface SheetItem { q: Question; chosen: number }
interface OptView { letter: string; text: string; state: '' | 'chosen' }

const DRAFT_KEY = 'exam_draft'

Page({
  data: {
    bankId: '',
    sheet: [] as SheetItem[],
    cursor: 0,
    q: null as Question | null,
    opts: [] as OptView[],
    answeredCount: 0,
    minutes: 60,
    spq: 2.5,
    passScore: 60,
    showAns: true,
    secondsLeft: 0,
    timeText: '00:00',
    submitted: false,
    showSheet: false,
    cardScale: 'normal',
  },

  _timer: 0 as number,

  onLoad(options: Record<string, string | undefined>) {
    const bank = getActiveBank()
    const spq = Math.max(0.5, parseFloat(options.spq || '2.5') || 2.5)
    const passScore = Math.max(0, parseFloat(options.pass || '60') || 60)
    const count = Math.max(1, parseInt(options.count || '40') || 40)
    const minutes = Math.max(1, parseInt(options.minutes || '60') || 60)
    const shuffleOpts = options.shuffleOpts === '1'
    const showAns = options.showAns !== '0'
    const fromMistake = options.from === 'mistake'

    let sheet: SheetItem[] = []
    let cursor = 0
    let secondsLeft = minutes * 60

    if (fromMistake) {
      const ids = new Set(mistakeStore.ids(bank.id))
      const pool = bank.questions.filter(q => ids.has(q.id))
      sheet = pickExam(pool, pool.length, shuffleOpts).map(q => ({ q, chosen: -1 }))
      this.setData({ cardScale: 'mistake' })
    } else {
      const draft = wx.getStorageSync(DRAFT_KEY)
      if (draft && draft.bankId === bank.id && Array.isArray(draft.sheet) && draft.sheet.length) {
        sheet = draft.sheet
        cursor = draft.cursor || 0
        secondsLeft = Math.max(0, draft.secondsLeft ?? secondsLeft)
      }
      if (!sheet.length) {
        const pool = practicePool(bank.id, bank.questions)
        sheet = pickExam(pool, count, shuffleOpts).map(q => ({ q, chosen: -1 }))
      }
    }

    this.setData({ bankId: bank.id, sheet, cursor, minutes, spq, passScore, showAns, secondsLeft })
    this.showQuestion()
    this.updateAnswered()
    this.tick()
    this._timer = setInterval(() => this.tick(), 1000)
  },

  onUnload() { clearInterval(this._timer) },
  onHide() { this.saveDraft() },

  tick() {
    const left = this.data.secondsLeft - 1
    if (left <= 0) {
      this.setData({ secondsLeft: 0, timeText: '00:00' })
      if (!this.data.submitted) this.submit()
      return
    }
    this.setData({ secondsLeft: left, timeText: fmtSeconds(left) })
    if (left % 15 === 0) this.saveDraft()
  },

  saveDraft() {
    if (this.data.submitted || this.data.cardScale === 'mistake') return
    wx.setStorageSync(DRAFT_KEY, {
      bankId: this.data.bankId,
      sheet: this.data.sheet,
      cursor: this.data.cursor,
      secondsLeft: this.data.secondsLeft,
      savedAt: Date.now(),
    })
  },

  updateAnswered() {
    this.setData({ answeredCount: this.data.sheet.filter(s => s.chosen >= 0).length })
  },

  showQuestion() {
    const item = this.data.sheet[this.data.cursor]
    if (!item) return
    this.setData({
      q: item.q,
      opts: item.q.o.map((text, i): OptView => ({
        letter: LETTERS[i],
        text,
        state: i === item.chosen ? 'chosen' : '',
      })),
    })
  },

  choose(e: WechatMiniprogram.TouchEvent) {
    if (this.data.submitted) return
    const idx = Number(e.currentTarget.dataset.idx)
    const key = `sheet[${this.data.cursor}].chosen`
    this.setData({ [key]: idx }, () => { this.updateAnswered(); this.showQuestion() })
  },

  prev() { if (this.data.cursor > 0) this.setData({ cursor: this.data.cursor - 1 }, () => this.showQuestion()) },
  next() { if (this.data.cursor < this.data.sheet.length - 1) this.setData({ cursor: this.data.cursor + 1 }, () => this.showQuestion()) },
  jumpTo(e: WechatMiniprogram.TouchEvent) {
    const n = Number(e.currentTarget.dataset.n)
    this.setData({ cursor: n, showSheet: false }, () => this.showQuestion())
  },
  toggleSheet() { this.setData({ showSheet: !this.data.showSheet }) },
  onSheetPanelTap() { /* catchtap 占位 */ },

  confirmSubmit() {
    const un = this.data.sheet.length - this.data.answeredCount
    wx.showModal({
      title: '交卷',
      content: un > 0 ? `还有 ${un} 题未作答，确定交卷？` : '确定交卷？',
      success: r => { if (r.confirm) this.submit() },
    })
  },

  submit() {
    clearInterval(this._timer)
    let right = 0
    for (const s of this.data.sheet) {
      const ok = s.chosen === s.q.a
      if (ok) right += 1
      else if (s.chosen >= 0) mistakeStore.add(this.data.bankId, s.q.id)
      if (s.chosen >= 0) recordAnswer(this.data.bankId, s.q.id, ok)
    }
    const total = this.data.sheet.length
    const score = right * this.data.spq
    const seconds = this.data.minutes * 60 - this.data.secondsLeft
    addExamRecord({ bankId: this.data.bankId, bankName: '', score, total, right, seconds, at: Date.now() })
    wx.removeStorageSync(DRAFT_KEY)
    this.setData({ submitted: true })
    wx.redirectTo({
      url: `../result/index?score=${score}&right=${right}&total=${total}&seconds=${seconds}&pass=${this.data.passScore}`,
      fail: () => wx.showToast({ title: `得分 ${score}`, icon: 'none' }),
    })
  },
})
