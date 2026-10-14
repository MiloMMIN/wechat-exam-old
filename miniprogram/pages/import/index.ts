// pages/import/index.ts —— +号 AI 导题
import { parseWithAI } from '../../utils/ai-import'
import { upsertBank, newBankId, setActiveBank } from '../../utils/bank-store'
import { DEFAULT_EXAM_SETTINGS } from '../../utils/bank-format'

Page({
  data: {
    name: '',
    raw: '',
    parsing: false,
    preview: [] as { q: string; opts: string; a: string }[],
    warnings: [] as string[],
    parsedCount: 0,
    aiEnabled: false, // 占位：未来后端就绪后开
  },

  onShow() {
    const tab = this.getTabBar?.()
    tab?.setData({ selected: 2 })
  },

  onName(e: WechatMiniprogram.Input) { this.setData({ name: e.detail.value }) },
  onRaw(e: WechatMiniprogram.Input) { this.setData({ raw: e.detail.value }) },

  async doParse() {
    const text = this.data.raw.trim()
    if (!text) { wx.showToast({ title: '先粘贴题目', icon: 'none' }); return }
    this.setData({ parsing: true })
    try {
      const res = await parseWithAI(text)
      const preview = res.questions.slice(0, 5).map(q => ({
        q: q.q.slice(0, 60),
        opts: q.o.map((o, i) => `${'ABCDEF'[i]}.${o}`).join('  '),
        a: 'ABCDEF'[q.a],
      }))
      this.setData({ preview, warnings: res.warnings, parsedCount: res.questions.length })
      if (!res.questions.length) wx.showToast({ title: '未识别到题目', icon: 'none' })
    } finally {
      this.setData({ parsing: false })
    }
  },

  async doImport() {
    const name = this.data.name.trim() || `自定义题库 ${new Date().toLocaleDateString()}`
    if (!this.data.parsedCount) { wx.showToast({ title: '先解析', icon: 'none' }); return }
    const res = await parseWithAI(this.data.raw)
    const bank = {
      id: newBankId(),
      name,
      createdAt: Date.now(),
      questions: res.questions,
      exam: { ...DEFAULT_EXAM_SETTINGS },
      origin: 'imported' as const,
    }
    upsertBank(bank)
    setActiveBank(bank.id)
    wx.showToast({ title: `已建题库 ${res.questions.length} 题`, icon: 'success' })
    setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 600)
  },

  pasteFromClipboard() {
    wx.getClipboardData({
      success: r => this.setData({ raw: r.data }),
    })
  },
})
