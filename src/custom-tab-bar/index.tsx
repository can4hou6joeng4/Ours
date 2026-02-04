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
      icon: 'solar:home-2-bold',
      iconOutline: 'solar:home-2-linear'
    },
    {
      pagePath: 'pages/store/index',
      text: '兑换',
      icon: 'solar:bag-heart-bold',
      iconOutline: 'solar:bag-heart-linear'
    },
    {
      pagePath: 'pages/inventory/index',
      text: '背包',
      icon: 'solar:box-bold',
      iconOutline: 'solar:box-linear'
    },
    {
      pagePath: 'pages/me/index',
      text: '我的',
      icon: 'solar:user-rounded-bold',
      iconOutline: 'solar:user-rounded-linear'
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
                src={getIconifyUrl(
                  selected === index ? item.icon : item.iconOutline,
                  selected === index ? '#D4B185' : '#666666'
                )}
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
