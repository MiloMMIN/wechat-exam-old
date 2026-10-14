// pages/docs/index.ts —— 文档：题库源文件/导入文件列表
import { listBanks } from '../../utils/bank-store'
import { encodeBank } from '../../utils/bank-format'

interface DocItem {
  id: string
  name: string
  meta: string
  origin: string
  size: number // bytes of serialized bank
}

Page({
  data: {
    docs: [] as DocItem[],
    searchKey: '',
    filtered: [] as DocItem[],
  },

  onShow() {
    const tab = this.getTabBar?.()
    tab?.setData({ selected: 1 })
    const banks = listBanks()
    const docs = banks.map(b => ({
      id: b.id,
      name: b.name,
      meta: `${b.questions.length} 题 · ${b.origin === 'builtin' ? '内置' : b.origin === 'imported' ? '导入' : '分享'}`,
      origin: b.origin,
      size: encodeBank(b).length,
    }))
    this.setData({ docs, filtered: docs })
  },

  onSearch(e: WechatMiniprogram.Input) {
    const k = e.detail.value.trim()
    this.setData({
      searchKey: k,
      filtered: k ? this.data.docs.filter(d => d.name.includes(k)) : this.data.docs,
    })
  },

  fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    return `${(bytes / 1024).toFixed(1)}KB`
  },

  openDoc(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    wx.navigateTo({ url: `../bank-detail/index?id=${id}` })
  },
})
