// pages/index/index.ts
import { questions } from '../../data/questions'
import { mistakeStore, favoriteStore, learnProgress, getDoneMap, getExamHistory } from '../../utils/store'

const EXAM_COUNT = 40
const EXAM_MINUTES = 60

Page({
  data: {
    total: questions.length,
    doneCount: 0,
    mistakeCount: 0,
    favCount: 0,
    learnIndex: 0,
    lastExam: null as null | { score: number; total: number; at: number },
    examCount: EXAM_COUNT,
    examMinutes: EXAM_MINUTES,
  },

  onShow() {
    const history = getExamHistory()
    const cur = Math.min(learnProgress.cursor, questions.length - 1)
    this.setData({
      doneCount: Object.keys(getDoneMap()).length,
      mistakeCount: mistakeStore.ids().length,
      favCount: favoriteStore.ids().length,
      learnIndex: cur,
      lastExam: history[0] || null,
    })
  },



  goLearn() {
    wx.navigateTo({ url: '../learn/index' })
  },
  goLearnRandom() {
    wx.navigateTo({ url: '../learn/index?mode=random' })
  },
  goFavorite() {
    wx.navigateTo({ url: '../learn/index?mode=fav' })
  },
  goMistake() {
    if (this.data.mistakeCount === 0) {
      wx.showToast({ title: '暂无错题', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '../mistake/index' })
  },
  goExam() {
    wx.navigateTo({ url: `../exam/index?count=${EXAM_COUNT}&minutes=${EXAM_MINUTES}` })
  },
  resetProgress() {
    wx.showModal({
      title: '清空数据',
      content: '将清空学习进度、作答统计、错题本与收藏，确定？',
      success: (res) => {
        if (!res.confirm) return
        const keys = ['mistake_ids', 'favorite_ids', 'learn_cursor', 'done_map', 'exam_history', 'exam_draft']
        keys.forEach(k => wx.removeStorageSync(k))
        this.onShow()
        wx.showToast({ title: '已清空', icon: 'success' })
      },
    })
  },
})
