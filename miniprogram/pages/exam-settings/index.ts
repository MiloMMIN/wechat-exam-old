// pages/exam-settings/index.ts —— 考试设置（参考图6）
import { getActiveBank, upsertBank } from '../../utils/bank-store'
import { ExamSettings } from '../../utils/bank-format'
import { getExamHistory } from '../../utils/store'

Page({
  data: {
    bankName: '',
    total: 0,
    count: 40,
    scorePer: 2.5,
    minutes: 60,
    passScore: 60,
    showAnswerAfterSubmit: true,
    shuffleOptions: false,
    totalScore: 100,
    lastExam: null as null | { score: number; total: number; at: number },
    touched: false,
  },

  onLoad() {
    const bank = getActiveBank()
    const s = bank.exam
    const history = getExamHistory().filter(r => r.bankId === bank.id)
    this.setData({
      bankName: bank.name,
      total: bank.questions.length,
      count: s.count,
      scorePer: s.scorePerQuestion,
      minutes: s.minutes,
      passScore: s.passScore,
      showAnswerAfterSubmit: s.showAnswerAfterSubmit,
      shuffleOptions: s.shuffleOptions,
      totalScore: s.count * s.scorePerQuestion,
      lastExam: history[0] || null,
    })
  },

  recalc(patch: Partial<ExamSettings>) {
    const next = { ...this.data, ...patch }
    const totalScore = next.count * next.scorePer
    this.setData({ ...patch, totalScore, touched: true })
  },

  onCount(e: WechatMiniprogram.Input) {
    const v = Math.max(1, Math.min(this.data.total, parseInt(e.detail.value) || 1))
    this.recalc({ count: v })
  },
  onScorePer(e: WechatMiniprogram.Input) {
    const v = Math.max(0.5, parseFloat(e.detail.value) || 0.5)
    this.recalc({ scorePerQuestion: v })
  },
  onMinutes(e: WechatMiniprogram.Input) {
    const v = Math.max(5, Math.min(300, parseInt(e.detail.value) || 60))
    this.recalc({ minutes: v })
  },
  onPassScore(e: WechatMiniprogram.Input) {
    const v = Math.max(0, parseFloat(e.detail.value) || 60)
    this.recalc({ passScore: v })
  },
  onShowAnswer(e: WechatMiniprogram.SwitchChange) {
    this.recalc({ showAnswerAfterSubmit: e.detail.value })
  },
  onShuffleOpts(e: WechatMiniprogram.SwitchChange) {
    this.recalc({ shuffleOptions: e.detail.value })
  },

  resetDefault() {
    const bank = getActiveBank()
    const d = bank.exam
    this.setData({
      count: d.count, scorePer: d.scorePerQuestion, minutes: d.minutes,
      passScore: d.passScore, showAnswerAfterSubmit: d.showAnswerAfterSubmit,
      shuffleOptions: d.shuffleOptions, totalScore: d.count * d.scorePerQuestion,
      touched: false,
    })
  },

  saveSettings(): ExamSettings {
    const s: ExamSettings = {
      count: this.data.count,
      scorePerQuestion: this.data.scorePer,
      minutes: this.data.minutes,
      passScore: this.data.passScore,
      showAnswerAfterSubmit: this.data.showAnswerAfterSubmit,
      shuffleOptions: this.data.shuffleOptions,
    }
    // 持久化到当前题库（分享题库时随其携带）
    const bank = getActiveBank()
    upsertBank({ ...bank, exam: s })
    return s
  },

  startExam() {
    const s = this.saveSettings()
    wx.navigateTo({
      url: `../exam/index?count=${s.count}&minutes=${s.minutes}&spq=${s.scorePerQuestion}&pass=${s.passScore}&shuffleOpts=${s.shuffleOptions ? 1 : 0}&showAns=${s.showAnswerAfterSubmit ? 1 : 0}`,
    })
  },
})
