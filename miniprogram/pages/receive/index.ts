// pages/receive/index.ts —— 接收 .kbz 题库文件并收藏到我的题库
import { decodeBank } from '../../utils/bank-format'
import { upsertBank, setActiveBank, getBank } from '../../utils/bank-store'

Page({
  data: {
    loading: true,
    bank: null as ReturnType<typeof decodeBank>,
    err: '',
    already: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    // 支持两类入口：?path=（本机文件） / ?data=（分享卡片带进 base64）
    const path = options.path
    const data = options.data
    if (path) {
      const fs = wx.getFileSystemManager()
      try {
        const text = fs.readFileSync(decodeURIComponent(path), 'utf8') as string
        this.handle(text)
      } catch (e) {
        this.setData({ loading: false, err: '文件读取失败' })
      }
      return
    }
    if (data) {
      try {
        const text = decodeURIComponent(data)
        this.handle(text)
      } catch (e) {
        this.setData({ loading: false, err: '参数解析失败' })
      }
      return
    }
    // 从"打开小程序时带的文件"入口（聊天里点 .kbz）
    const info = wx.getEnterOptionsSync?.()
    const filePath = (info as { query?: Record<string, string> } | undefined)?.query?.path
    if (filePath) {
      try {
        const fs = wx.getFileSystemManager()
        const text = fs.readFileSync(filePath, 'utf8') as string
        this.handle(text)
        return
      } catch (e) { /* fallthrough */ }
    }
    this.setData({ loading: false, err: '没有可导入的内容' })
  },

  handle(text: string) {
    const bank = decodeBank(text)
    if (!bank) { this.setData({ loading: false, err: '不是有效的题库文件' }); return }
    const already = !!getBank(bank.id)
    this.setData({ loading: false, bank, already })
  },

  collect() {
    const bank = this.data.bank
    if (!bank) return
    // 若已存在同 id 题库则更新内容；否则视为新题库
    upsertBank(bank)
    setActiveBank(bank.id)
    wx.showToast({ title: '已收藏到我的题库', icon: 'success' })
    setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 600)
  },

  pickFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['kbz', 'json', 'txt'],
      success: res => {
        const path = res.tempFiles[0]?.path
        if (!path) return
        const fs = wx.getFileSystemManager()
        try {
          const text = fs.readFileSync(path, 'utf8') as string
          this.handle(text)
        } catch (e) {
          this.setData({ err: '文件读取失败' })
        }
      },
    })
  },
})

