import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getIconifyUrl } from '../utils/assets'
import './index.scss'

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)

  // 监听路由变化同步选中状态
  useEffect(() => {
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    if (currentPage) {
      const path = currentPage.route
      const index = LIST.findIndex(item => item.pagePath === path || item.pagePath === `/${path}`)
      if (index !== -1) setSelected(index)
    }
  }, [])

  const LIST = [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      icon: 'tabler:home'
    },
    {
      pagePath: 'pages/store/index',
      text: '兑换',
      icon: 'tabler:refresh'
    },
    {
      pagePath: 'pages/me/index',
      text: '我的',
      icon: 'tabler:user'
    }
  ]

  const switchTab = (index, url) => {
    Taro.switchTab({ url: '/' + url })
    setSelected(index)
  }

  return (
    <View className='tab-bar-wrapper'>
      <View className='tab-bar-capsule'>
        {LIST.map((item, index) => (
          <View
            key={index}
            className={`tab-item ${selected === index ? 'active' : ''}`}
            onClick={() => switchTab(index, item.pagePath)}
          >
            <Image
              src={getIconifyUrl(item.icon, selected === index ? '#D4B185' : '#666')}
              className='tab-icon'
            />
            <Text className='tab-text'>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
