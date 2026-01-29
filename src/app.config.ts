export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/store/index',
    'pages/history/index',
    'pages/me/index',
    'pages/inventory/index',
    'pages/binding/index',
    'pages/gift-edit/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '兑换',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F8F9FE'
  },
  tabBar: {
    custom: true,
    color: '#6A6A6A',
    selectedColor: '#7B61FF',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '任务'
      },
      {
        pagePath: 'pages/store/index',
        text: '兑换'
      },
      {
        pagePath: 'pages/inventory/index',
        text: '背包'
      },
      {
        pagePath: 'pages/me/index',
        text: '我的'
      }
    ]
  }
})
