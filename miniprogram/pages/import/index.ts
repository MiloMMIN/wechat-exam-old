// pages/import/index.ts —— +号：粘贴文本 / 上传文件（含 .doc/.docx 直接解析） / AI 导题
import { parseWithAI } from '../../utils/ai-import'
import { extractOfficeText } from '../../utils/doc-extract'
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

  // 上传文件：.txt/.md 文本 → textarea；.kbz → 直导题库；.doc/.docx → 二进制解包抽文本
  pickFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: res => {
        const file = res.tempFiles[0]
        if (!file) return
        const name = file.name

        // .kbz 直接导入
        if (name.endsWith('.kbz')) {
          const fs = wx.getFileSystemManager()
          try {
            const text = fs.readFileSync(file.path, 'utf8') as string
            const { decodeBank } = require('../../utils/bank-format')
            const bank = decodeBank(text)
            if (bank) {
              upsertBank(bank)
              wx.showToast({ title: `导入 ${bank.questions.length} 题`, icon: 'success' })
              setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 600)
            } else {
              wx.showToast({ title: '不是有效题库文件', icon: 'none' })
            }
          } catch (e) {
            wx.showToast({ title: '文件读取失败', icon: 'none' })
          }
          return
        }

        // 其余走 extractOfficeText：自动分流 docx/doc/txt
        const { text, err } = extractOfficeText(file.path, name)
        if (err) { wx.showToast({ title: err, icon: 'none' }); return }
        if (!text.trim()) { wx.showToast({ title: '未抽到文本', icon: 'none' }); return }
        this.setData({ raw: text, fileName: name })
        wx.showToast({ title: '已读取，点解析', icon: 'none' })
      },
    })
  },
})
