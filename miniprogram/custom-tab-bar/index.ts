// custom-tab-bar/index.ts
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '题库', icon: '📚' },
      { pagePath: '/pages/docs/index', text: '文档', icon: '📄' },
      { pagePath: '/pages/import/index', text: '', icon: '＋', center: true },
      { pagePath: '/pages/mine/index', text: '我的', icon: '👤' },
    ],
  },
  methods: {
    switchTab(e: WechatMiniprogram.TouchEvent) {
      const path = e.currentTarget.dataset.path as string
      const idx = Number(e.currentTarget.dataset.idx)
      this.setData({ selected: idx })
      wx.switchTab({ url: path })
    },
  },
})
