// pages/receive/index.ts —— 点开朋友分享卡片 → 显示题库 → 一键收藏
import { getBank, upsertBank, setActiveBank } from '../../utils/bank-store'
import { decodeBank, Bank } from '../../utils/bank-format'

Page({
  data: {
    loading: true,
    bank: null as Bank | null,
    err: '',
    already: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    // 入口：朋友点卡片 → ?bankId=xxx；或手动导入 .kbz → ?path=xxx
    const bankId = options.bankId
    const path = options.path

    if (bankId) {
      const bank = getBank(bankId)
      if (bank) {
        this.setData({ loading: false, bank, already: true })
        return
      }
      // 对方题库不在本地：正常情况是分享方把题库已经发出来，
      // 这里给个提示引导对方选文件；同时支持 ?path= 兜底
      this.setData({ loading: false, err: '本机没这个题库，请让分享方发 .kbz 文件给你' })
      return
    }

    if (path) {
      const fs = wx.getFileSystemManager()
      try {
        const text = fs.readFileSync(decodeURIComponent(path), 'utf8') as string
        const bank = decodeBank(text)
        if (bank) {
          const already = !!getBank(bank.id)
          this.setData({ loading: false, bank, already })
          return
        }
        this.setData({ loading: false, err: '文件不是有效的题库' })
      } catch (e) {
        this.setData({ loading: false, err: '文件读取失败' })
      }
      return
    }

    // 都没带：引导手动选文件
    this.setData({ loading: false, err: '' })
  },

  collect() {
    const bank = this.data.bank
    if (!bank) return
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
          const bank = decodeBank(text)
          if (bank) {
            this.setData({ bank, loading: false, already: !!getBank(bank.id), err: '' })
          } else {
            this.setData({ err: '不是有效的题库文件' })
          }
        } catch (e) {
          this.setData({ err: '文件读取失败' })
        }
      },
    })
  },
})
