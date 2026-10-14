// pages/import/index.ts —— +号：粘贴文本 / 上传文件 / AI 导题（占位）
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
    fileName: '',
    expandText: false,
  },

  onShow() {
    const tab = this.getTabBar?.()
    tab?.setData({ selected: 2 })
  },

  onName(e: WechatMiniprogram.Input) { this.setData({ name: e.detail.value }) },
  onRaw(e: WechatMiniprogram.Input) { this.setData({ raw: e.detail.value }) },
  toggleExpand() { this.setData({ expandText: !this.data.expandText }) },

  async doParse() {
    const text = this.data.raw.trim()
    if (!text) { wx.showToast({ title: '先粘贴题目或上传文件', icon: 'none' }); return }
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
    const name = this.data.name.trim() || this.data.fileName.replace(/\.[^.]+$/, '') || `自定义题库 ${new Date().toLocaleDateString()}`
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
    wx.getClipboardData({ success: r => this.setData({ raw: r.data }) })
  },

  // 上传文件：.txt/.md 文本 → 填 textarea；.kbz → 直接导入；.doc/.docx → 提示先转文本
  pickFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: res => {
        const file = res.tempFiles[0]
        if (!file) return
        const name = file.name
        // 二进制 Office 直接拦下
        if (/\.(docx?|wps|rtf|pdf|xlsx?|pptx?)$/i.test(name)) {
          wx.showModal({
            title: '暂不支持 Office 文件',
            content: '小程序读不了二进制。请把题目复制为文本粘贴进来，或先用桌面脚本转 .docx 再离线生成题库。',
            showCancel: false,
            confirmText: '知道了',
          })
          return
        }
        const fs = wx.getFileSystemManager()
        try {
          const text = fs.readFileSync(file.path, 'utf8') as string
          if (name.endsWith('.kbz')) {
            const { decodeBank } = require('../../utils/bank-format')
            const bank = decodeBank(text)
            if (bank) {
              upsertBank(bank)
              wx.showToast({ title: `导入 ${bank.questions.length} 题`, icon: 'success' })
              setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 600)
              return
            }
          }
          this.setData({ raw: text, fileName: name })
          wx.showToast({ title: '已读取文件，点解析', icon: 'none' })
        } catch (e) {
          wx.showToast({ title: '文件读取失败', icon: 'none' })
        }
      },
    })
  },
})
