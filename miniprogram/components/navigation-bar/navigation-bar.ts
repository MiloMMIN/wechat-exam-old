Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  /**
   * 组件的属性列表
   */
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    background: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: ''
    },
    back: {
      type: Boolean,
      value: true
    },
    loading: {
      type: Boolean,
      value: false
    },
    homeButton: {
      type: Boolean,
      value: false,
    },
    animated: {
      // 显示隐藏的时候opacity动画效果
      type: Boolean,
      value: true
    },
    show: {
      // 显示隐藏导航，隐藏的时候navigation-bar的高度占位还在
      type: Boolean,
      value: true,
      observer: '_showChange'
    },
    // back为true的时候，返回的页面深度
    delta: {
      type: Number,
      value: 1
    },
  },
  /**
   * 组件的初始数据
   */
  data: {
    displayStyle: ''
  },
  lifetimes: {
    attached() {
      const rect = wx.getMenuButtonBoundingClientRect()
      let windowWidth = 0
      let safeTop = 0
      let platform = ''

      try {
        const fn = (wx as any).getWindowInfo
        if (typeof fn === 'function') {
          const info = fn()
          windowWidth = info?.windowWidth || info?.screenWidth || 0
          safeTop = (info?.safeArea && typeof info.safeArea.top === 'number') ? info.safeArea.top : 0
        }
      } catch (e) {}

      try {
        const fn = (wx as any).getDeviceInfo
        if (typeof fn === 'function') {
          const info = fn()
          platform = info?.platform || ''
        }
      } catch (e) {}

      if (!windowWidth) {
        try {
          const res = wx.getSystemInfoSync()
          windowWidth = res.windowWidth || 0
          safeTop = (res.safeArea && typeof res.safeArea.top === 'number') ? res.safeArea.top : 0
          platform = res.platform || platform
        } catch (e) {}
      }

      const isAndroid = platform === 'android'
      const isDevtools = platform === 'devtools'
      const rectLeft = rect && typeof rect.left === 'number' ? rect.left : windowWidth
      const rightGap = Math.max(0, windowWidth - rectLeft)
      const minSide = 88
      const maxSide = Math.floor(windowWidth * 0.35)
      const sidePx = Math.max(minSide, Math.min(rightGap, maxSide || minSide))
      const sidePct = windowWidth ? ((sidePx / windowWidth) * 100) : 0
      const sideStyle = `width: ${sidePct.toFixed(2)}%`
      this.setData({
        ios: !isAndroid,
        innerPaddingRight: `padding-right: ${sidePct.toFixed(2)}%`,
        leftWidth: sideStyle,
        safeAreaTop: (isDevtools || isAndroid) && safeTop ? `height: calc(var(--height) + ${safeTop}px); padding-top: ${safeTop}px` : ``,
      })
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    _showChange(show: boolean) {
      const animated = this.data.animated
      let displayStyle = ''
      if (animated) {
        displayStyle = `opacity: ${
          show ? '1' : '0'
        };transition:opacity 0.5s;`
      } else {
        displayStyle = `display: ${show ? '' : 'none'}`
      }
      this.setData({
        displayStyle
      })
    },
    onBackTap() {
      const data = this.data
      if (data.delta) {
        wx.navigateBack({
          delta: data.delta,
          fail: () => {
            wx.reLaunch({ url: '/pages/index/index' })
          }
        })
      }
      this.triggerEvent('back', { delta: data.delta }, {})
    },
    onHomeTap() {
      try {
        const pages = getCurrentPages()
        if (pages && pages.length > 1) {
          wx.navigateBack({
            delta: pages.length - 1,
            fail: () => wx.reLaunch({ url: '/pages/index/index' }),
          })
          this.triggerEvent('home', {}, {})
          return
        }
        const currentPage = pages && pages[0]
        if (currentPage) {
          const route = (currentPage as any).route
          if (route === 'pages/index/index') {
            this.triggerEvent('home', {}, {})
            return
          }
        }
      } catch (e) {
        console.warn('Navigation error:', e)
      }
      wx.reLaunch({ url: '/pages/index/index' })
      this.triggerEvent('home', {}, {})
    },
  },
})
