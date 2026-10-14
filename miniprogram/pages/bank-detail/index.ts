// pages/bank-detail/index.ts —— 题库详情 + 微信分享（onShareAppMessage 携带题库 ID 进 path）
import { getBank, removeBank, BUILTIN_ID } from '../../utils/bank-store'
import { encodeBank, Bank } from '../../utils/bank-format'

Page({
  data: {
    bank: null as Bank | null,
    isBuiltin: true,
    preview: [] as { q: string; opts: string }[],
    examSummary: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const id = options.id || BUILTIN_ID
    const bank = getBank(id)
    if (!bank) { wx.showToast({ title: '题库不存在', icon: 'none' }); return }
    this.setData({
      bank,
      isBuiltin: id === BUILTIN_ID,
      preview: bank.questions.slice(0, 5).map(q => ({
        q: q.q.slice(0, 60),
        opts: q.o.map((o, i) => `${'ABCDEF'[i]}.${o}`).join('  '),
      })),
      examSummary: `${bank.exam.count} 题 × ${bank.exam.scorePerQuestion} 分 · ${bank.exam.minutes} 分钟 · 及格 ${bank.exam.passScore} 分`,
    })
    // 开启右上角分享菜单
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] })
  },

  // 微信原生分享：朋友点开卡片 → onLoad 拿到 bankId → 展示该题库 → 一键收藏
  onShareAppMessage() {
    const bank = this.data.bank
    if (!bank) return {}
    return {
      title: `推荐你一个题库「${bank.name}」—— ${bank.questions.length} 题，点击查看`,
      path: `/pages/receive/index?bankId=${bank.id}`,
      // imageUrl 可自定义分享卡片封面，暂用默认截图
    }
  },

  // 备用：导出 .kbz 文件（通过"发送给朋友"→文件 走文件传输链路）
  exportFile() {
    const bank = this.data.bank
    if (!bank) return
    const fs = wx.getFileSystemManager()
    const path = `${wx.env.USER_DATA_PATH}/${bank.name.replace(/[\\/:*?"<>|]/g, '_')}.kbz`
    try {
      fs.writeFileSync(path, encodeBank(bank), 'utf8')
      wx.openDocument({
        filePath: path,
        showMenu: true,
        fail: () => wx.showModal({ title: '已生成', content: path, showCancel: false }),
      })
    } catch (e) {
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  copyShareText() {
    const bank = this.data.bank
    if (!bank) return
    // 分享内容存 storage，朋友打开小程序时若路径带 bankId 会落 receive 页
    wx.setClipboardData({ data: `分享题库「${bank.name}」：${bank.id}` })
    wx.showToast({ title: '已复制', icon: 'none' })
  },

  deleteBank() {
    const bank = this.data.bank
    if (!bank || bank.id === BUILTIN_ID) return
    wx.showModal({
      title: '删除题库',
      content: `删除「${bank.name}」？`,
      success: r => { if (r.confirm) { removeBank(bank.id); wx.navigateBack() } },
    })
  },
})
