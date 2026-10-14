// pages/mine/index.ts
import { listBanks } from '../../utils/bank-store'
import { getExamHistory } from '../../utils/store'

Page({
  data: {
    bankCount: 0,
    examCount: 0,
    best: null as null | { score: number; bankName: string },
    version: 'kaoshibao',
  },
  onShow() {
    const tab = this.getTabBar?.()
    tab?.setData({ selected: 3 })
    const history = getExamHistory()
    const best = history.length ? history.reduce((a, b) => a.score >= b.score ? a : b) : null
    this.setData({ bankCount: listBanks().length, examCount: history.length, best })
  },
  clearAll() {
    wx.showModal({
      title: '清空全部数据',
      content: '将清空所有题库/错题/收藏/笔记/进度/考试记录，且不可恢复',
      success: r => {
        if (!r.confirm) return
        wx.clearStorageSync()
        this.onShow()
        wx.showToast({ title: '已清空', icon: 'success' })
      },
    })
  },
  copyShareHelp() {
    wx.setClipboardData({
      data: '题库文件后缀 .kbz（JSON）。发送给朋友→对方在"文档"页点"导入 .kbz"即可收藏并刷题，考试设置随文件携带。',
    })
    wx.showToast({ title: '已复制说明', icon: 'none' })
  },
})
