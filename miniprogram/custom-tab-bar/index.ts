// custom-tab-bar/index.ts
Component({
  data: { selected: 0 },
  methods: {
    switchTab(e: WechatMiniprogram.TouchEvent) {
      const idx = Number(e.currentTarget.dataset.idx)
      const path = e.currentTarget.dataset.path as string
      this.setData({ selected: idx })
      wx.switchTab({ url: path })
    },
  },
})
