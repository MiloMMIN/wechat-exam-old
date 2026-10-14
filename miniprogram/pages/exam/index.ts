// pages/exam/index.ts —— 模拟考试：抽题组卷、倒计时、交卷判分
import { Question } from '../../data/questions'
import { pickExam, LETTERS, fmtSeconds } from '../../utils/quiz'
import { mistakeStore, recordAnswer, addExamRecord } from '../../utils/store'

interface SheetItem {
  q: Question
  chosen: number // -1 未答
}
interface OptView {
  letter: string
  text: string
  state: '' | 'chosen'
}

const DRAFT_KEY = 'exam_draft'

Page({
  data: {
    sheet: [] as SheetItem[],
    cursor: 0,
    q: null as Question | null,
    opts: [] as OptView[],
    answeredCount: 0,
    minutes: 45,
    secondsLeft: 0,
    timeText: '00:00',
    submitted: false,
    showSheet: false,
    cardScale: 'normal', // normal | mistake（错题重考无草稿恢复）
  },

  _timer: 0 as number, // 0 = 未启动；miniprogram lib 中 clearInterval 接 number

  onLoad(options: Record<string, string | undefined>) {
    const count = Math.max(5, parseInt(options.count || '50') || 50)
    const minutes = Math.max(1, parseInt(options.minutes || '45') || 45)
    const fromMistake = options.from === 'mistake'

    // 错题重考 or 恢复草稿 or 新组卷
    let sheet: SheetItem[] = []
    let cursor = 0
    let secondsLeft = minutes * 60

    if (fromMistake) {
      const ids = mistakeStore.ids()
      sheet = pickExam(ids.length, ids).map(q => ({ q, chosen: -1 }))
      this.setData({ cardScale: 'mistake' })
    } else {
      const draft = wx.getStorageSync(DRAFT_KEY)
      if (draft && draft.sheet && draft.sheet.length) {
        sheet = draft.sheet
        cursor = draft.cursor || 0
        secondsLeft = Math.max(0, draft.secondsLeft ?? secondsLeft)
      }
    }
    if (sheet.length === 0) {
      sheet = pickExam(count).map(q => ({ q, chosen: -1 }))
    }

    this.setData({ sheet, cursor, minutes, secondsLeft })
    this.showQuestion()
    this.updateAnswered()
    this.tick()
    this._timer = setInterval(() => this.tick(), 1000)
  },

  onUnload() {
    clearInterval(this._timer)
  },
  onHide() {
    this.saveDraft()
  },

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
    const { sheet, cursor } = this.data
    const item = sheet[cursor]
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
    this.setData({ [key]: idx }, () => {
      this.updateAnswered()
      this.showQuestion()
    })
  },

  prev() {
    if (this.data.cursor <= 0) return
    this.setData({ cursor: this.data.cursor - 1 }, () => this.showQuestion())
  },
  next() {
    if (this.data.cursor >= this.data.sheet.length - 1) return
    this.setData({ cursor: this.data.cursor + 1 }, () => this.showQuestion())
  },
  jumpTo(e: WechatMiniprogram.TouchEvent) {
    const n = Number(e.currentTarget.dataset.n)
    this.setData({ cursor: n, showSheet: false }, () => this.showQuestion())
  },
  toggleSheet() {
    this.setData({ showSheet: !this.data.showSheet })
  },
  onSheetPanelTap() {
    // 仅用于 catchtap 阻止冒泡到遮罩层关闭
  },

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
      else if (s.chosen >= 0) mistakeStore.add(s.q.id)
      if (s.chosen >= 0) recordAnswer(s.q.id, ok)
    }
    const total = this.data.sheet.length
    const score = right * 2.5 // 每题 2.5 分
    const seconds = this.data.minutes * 60 - this.data.secondsLeft
    addExamRecord({ score, total, right, seconds, at: Date.now() })
    wx.removeStorageSync(DRAFT_KEY)
    this.setData({ submitted: true })
    wx.redirectTo({
      url: `../result/index?score=${score}&right=${right}&total=${total}&seconds=${seconds}`,
      fail: () => wx.showToast({ title: `得分 ${score}`, icon: 'none' }),
    })
  },
})
