// pages/index/index.ts —— 题库主页
import { getActiveBank, setActiveBank, listBanks, BUILTIN_ID } from '../../utils/bank-store'
import { mistakeStore, favoriteStore, cullStore, learnProgress, getDoneMap, getExamHistory, getNotes } from '../../utils/store'
import { practicePool } from '../../utils/quiz'

Page({
  data: {
    bankName: '',
    bankId: BUILTIN_ID,
    bankList: [] as { id: string; name: string }[],
    bankIdx: 0,
    total: 0,
    doneCount: 0,
    mistakeCount: 0,
    favCount: 0,
    cullCount: 0,
    noteCount: 0,
    learnCursor: 0,
    lastExam: null as null | { score: number; total: number; at: number },
  },

  onShow() {
    const tab = this.getTabBar?.()
    tab?.setData({ selected: 0 })

    const bank = getActiveBank()
    const banks = listBanks()
    const cursor = Math.min(learnProgress.cursor(bank.id), Math.max(bank.questions.length - 1, 0))
    const pool = practicePool(bank.id, bank.questions)
    const history = getExamHistory().filter(r => r.bankId === bank.id)
    this.setData({
      bankId: bank.id,
      bankName: bank.name,
      bankList: banks.map(b => ({ id: b.id, name: b.name })),
      bankIdx: Math.max(0, banks.findIndex(b => b.id === bank.id)),
      total: pool.length,
      doneCount: Object.keys(getDoneMap(bank.id)).length,
      mistakeCount: mistakeStore.ids(bank.id).length,
      favCount: favoriteStore.ids(bank.id).length,
      cullCount: cullStore.ids(bank.id).length,
      noteCount: getNotes(bank.id).length,
      learnCursor: cursor,
      lastExam: history[0] || null,
    })
  },

  onBankChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    const bank = this.data.bankList[idx]
    if (!bank) return
    setActiveBank(bank.id)
    this.onShow()
  },

  goLearn() { wx.navigateTo({ url: '../learn/index?mode=seq' }) },
  goRandom() { wx.navigateTo({ url: '../learn/index?mode=random' }) },
  goType() { wx.navigateTo({ url: '../learn/index?mode=type' }) },
  goChapter() { wx.navigateTo({ url: '../learn/index?mode=chapter' }) },
  goExam() { wx.navigateTo({ url: '../exam-settings/index' }) },
  goMistake() { wx.navigateTo({ url: '../mistake/index' }) },
  goSearch() { wx.navigateTo({ url: '../search/index' }) },
  goFavorite() { wx.navigateTo({ url: '../favorite/index' }) },
  goCull() { wx.navigateTo({ url: '../cull/index' }) },
  goNotes() { wx.navigateTo({ url: '../notes/index' }) },
  goBankDetail() { wx.navigateTo({ url: `../bank-detail/index?id=${this.data.bankId}` }) },
  goImport() { wx.navigateTo({ url: '../import/index' }) },
})
