// pages/bank-detail/index.ts —— 题库详情：预览题目 + 导出 .kbz + 分享
import { getBank, removeBank, BUILTIN_ID } from '../../utils/bank-store'
import { encodeBank, Bank } from '../../utils/bank-format'

Page({
  data: {
    bank: null as Bank | null,
    isBuiltin: true,
    preview: [] as { q: string; opts: string }[],
    examSummary: '',
    filePath: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const id = options.id || BUILTIN_ID
    const bank = getBank(id)
    if (!bank) { wx.showToast({ title: '题库不存在', icon: 'none' }); return }
    const preview = bank.questions.slice(0, 5).map(q => ({
      q: q.q.slice(0, 60),
      opts: q.o.map((o, i) => `${'ABCDEF'[i]}.${o}`).join('  '),
    }))
    const s = bank.exam
    this.setData({
      bank,
      isBuiltin: id === BUILTIN_ID,
      preview,
      examSummary: `${s.count} 题 × ${s.scorePerQuestion} 分 · ${s.minutes} 分钟 · 及格 ${s.passScore} 分`,
    })
  },

  exportFile() {
    const bank = this.data.bank
    if (!bank) return
    const fs = wx.getFileSystemManager()
    const path = `${wx.env.USER_DATA_PATH}/${bank.name.replace(/[\\/:*?"<>|]/g, '_')}.kbz`
    try {
      fs.writeFileSync(path, encodeBank(bank), 'utf8')
      this.setData({ filePath: path })
      wx.openDocument({
        filePath: path,
        showMenu: true, // 右上角菜单可"发送给朋友"
        fail: () => {
          wx.showModal({ title: '已生成文件', content: path, showCancel: false })
        },
      })
    } catch (e) {
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  deleteBank() {
    const bank = this.data.bank
    if (!bank || bank.id === BUILTIN_ID) return
    wx.showModal({
      title: '删除题库',
      content: `删除「${bank.name}」？该题库的错题/收藏/笔记会保留但无法使用。`,
      success: r => {
        if (!r.confirm) return
        removeBank(bank.id)
        wx.navigateBack()
      },
    })
  },
})
