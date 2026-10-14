// pages/result/index.ts —— 交卷成绩
import { fmtSeconds } from '../../utils/quiz'

Page({
  data: {
    score: 0,
    right: 0,
    total: 0,
    wrong: 0,
    secondsText: '00:00',
    pass: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    const score = parseFloat(options.score || '0') || 0
    const right = parseInt(options.right || '0') || 0
    const total = parseInt(options.total || '0') || 0
    const seconds = parseInt(options.seconds || '0') || 0
    const passScore = parseFloat(options.pass || '60') || 60
    this.setData({
      score, right, total,
      wrong: total - right,
      secondsText: fmtSeconds(seconds),
      pass: score >= passScore,
    })
  },

  review() {
    wx.navigateBack({ delta: 1 })
  },
  again() {
    wx.redirectTo({ url: '../exam/index' })
  },
  goHome() {
    wx.reLaunch({ url: '../index/index' })
  },
})
