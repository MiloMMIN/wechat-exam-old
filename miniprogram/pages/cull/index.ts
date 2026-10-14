// pages/cull/index.ts —— 斩题管理：查看/恢复已斩题
import { Question } from '../../data/questions'
import { getActiveBank } from '../../utils/bank-store'
import { cullStore } from '../../utils/store'

Page({
  data: {
    culled: [] as Question[],
    bankId: '',
    emptyText: '',
  },
  onShow() {
    const bank = getActiveBank()
    const ids = new Set(cullStore.ids(bank.id))
    const culled = bank.questions.filter(q => ids.has(q.id))
    this.setData({ bankId: bank.id, culled, emptyText: culled.length ? '' : '暂无斩题' })
  },
  restore(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id)
    cullStore.remove(this.data.bankId, id)
    this.setData({ culled: this.data.culled.filter(q => q.id !== id) })
    wx.showToast({ title: '已恢复', icon: 'none' })
  },
  clearAll() {
    wx.showModal({
      title: '清空斩题',
      content: `将恢复全部 ${this.data.culled.length} 题，确定？`,
      success: r => {
        if (!r.confirm) return
        cullStore.clear(this.data.bankId)
        this.setData({ culled: [], emptyText: '暂无斩题' })
      },
    })
  },
})
