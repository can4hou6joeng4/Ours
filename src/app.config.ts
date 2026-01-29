export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/store/index',
    'pages/history/index',
    'pages/me/index',
    'pages/inventory/index',
    'pages/binding/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'Ours',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F8F9FE'
  },
  tabBar: {
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
        pagePath: 'pages/me/index',
        text: '我的'
      }
    ]
  }
})
