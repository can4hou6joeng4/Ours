import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getIconifyUrl } from '../utils/assets'
import './index.scss'

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)

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

  // 核心修复：更高效的路由同步
  useEffect(() => {
    const updateSelected = () => {
      const pages = Taro.getCurrentPages()
      const currentPage = pages[pages.length - 1]
      if (currentPage) {
        const path = currentPage.route?.replace(/^\//, '')
        const index = LIST.findIndex(item => item.pagePath === path)
        if (index !== -1 && index !== selected) setSelected(index)
      }
    }

    updateSelected()
    // 增加一个微小延迟的二次检查，确保在某些环境下的准确性
    const timer = setTimeout(updateSelected, 50)
    return () => clearTimeout(timer)
  }, [Taro.getCurrentPages().length]) // 监听页面栈长度变化

  const switchTab = (index, url) => {
    if (selected === index) return
    Taro.switchTab({ url: '/' + url })
  }

  return (
    <View className='tab-bar-root'>
      {/* 核心修复：背景遮罩层，防止内容穿透 */}
      <View className='tab-bar-mask'></View>

      <View className='tab-bar-wrapper'>
        <View className='tab-bar-capsule'>
          {LIST.map((item, index) => (
            <View
              key={index}
              className={`tab-item ${selected === index ? 'active' : ''}`}
              onClick={() => switchTab(index, item.pagePath)}
            >
              <Image
                src={getIconifyUrl(item.icon, selected === index ? '#D4B185' : '#888')}
                className='tab-icon'
              />
              <Text className='tab-text'>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
