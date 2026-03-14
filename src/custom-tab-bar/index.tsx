import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { TAB_ICONS } from '../utils/icons'
import './index.scss'

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)

  const LIST = [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      iconKey: 'home' as const,
    },
    {
      pagePath: 'pages/store/index',
      text: '兑换',
      iconKey: 'refresh' as const,
    },
    {
      pagePath: 'pages/inventory/index',
      text: '背包',
      iconKey: 'package' as const,
    },
    {
      pagePath: 'pages/me/index',
      text: '我的',
      iconKey: 'user' as const,
    }
  ]

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
    const timer = setTimeout(updateSelected, 50)
    return () => clearTimeout(timer)
  }, [Taro.getCurrentPages().length])

  const switchTab = (index, url) => {
    if (selected === index) return
    Taro.switchTab({ url: '/' + url })
  }

  return (
    <View className='tab-bar-root'>
      <View className='tab-bar-container'>
        <View className='tab-bar-inner'>
          {LIST.map((item, index) => (
            <View
              key={index}
              className={`tab-item ${selected === index ? 'active' : ''}`}
              onClick={() => switchTab(index, item.pagePath)}
            >
              <Image
                src={selected === index
                  ? TAB_ICONS[item.iconKey].active
                  : TAB_ICONS[item.iconKey].inactive
                }
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
