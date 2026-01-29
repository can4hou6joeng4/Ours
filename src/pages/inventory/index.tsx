import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

export default function Inventory() {
  const [items, setItems] = useState<any[]>([])
  const [currentTab, setCurrentTab] = useState<'unused' | 'used'>('unused')
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    fetchItems()
  })

  const fetchItems = async () => {
    setLoading(true)
    try {
      const { result }: any = await Taro.cloud.callFunction({ name: 'getItems' })
      if (result.success) {
        setItems(result.data)
      }
    } catch (e) {
      Taro.showToast({ title: '获取背包失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleUse = async (item) => {
    const confirm = await Taro.showModal({
      title: '确认使用',
      content: `确定要现在使用“${item.name}”吗？`
    })

    if (!confirm.confirm) return

    Taro.showLoading({ title: '核销中...' })
    try {
      const { result }: any = await Taro.cloud.callFunction({
        name: 'useItem',
        data: { itemId: item._id }
      })

      if (result.success) {
        Taro.showToast({ title: '使用成功', icon: 'success' })
        fetchItems()
      } else {
        Taro.showToast({ title: result.error || '操作失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const filteredItems = items.filter(i => i.status === currentTab)

  // 根据类型获取图标
  const getItemIcon = (name: string) => {
    if (name.includes('电影')) return 'tabler:movie'
    if (name.includes('家务')) return 'tabler:vacuum-cleaner'
    if (name.includes('盒')) return 'tabler:gift'
    if (name.includes('奶茶')) return 'tabler:cup'
    if (name.includes('金牌')) return 'tabler:medal'
    return 'tabler:box'
  }

  return (
    <View className='inventory-container'>
      <View className='tabs-header'>
        <View className='tabs-capsule'>
          <View
            className={`tab-item ${currentTab === 'unused' ? 'active' : ''}`}
            onClick={() => setCurrentTab('unused')}
          >
            待使用
          </View>
          <View
            className={`tab-item ${currentTab === 'used' ? 'active' : ''}`}
            onClick={() => setCurrentTab('used')}
          >
            已使用
          </View>
        </View>
      </View>

      <ScrollView scrollY className='items-scroll'>
        <View className='items-inner'>
          {filteredItems.length === 0 && !loading ? (
            <View className='empty-state'>
              <Image src={getIconifyUrl('tabler:package-off', '#8E8E93')} className='empty-icon-img' />
              <Text className='empty-text'>背包空空如也</Text>
            </View>
          ) : (
            <View className='items-grid'>
              {filteredItems.map(item => (
                <View key={item._id} className={`item-card-v4 ${currentTab}`}>
                  <View className='item-icon-box'>
                    <Image src={getIconifyUrl(getItemIcon(item.name), currentTab === 'unused' ? '#D4B185' : '#BBB')} className='inner-icon' />
                  </View>
                  <View className='item-info'>
                    <Text className='item-name'>{item.name}</Text>
                    <Text className='item-time'>
                      {currentTab === 'unused'
                        ? `${dayjs(item.createTime).format('YYYY.MM.DD HH:mm')} 获得`
                        : `${dayjs(item.useTime).format('YYYY.MM.DD HH:mm')} 已使用`
                      }
                    </Text>
                  </View>
                  {currentTab === 'unused' && (
                    <View className='use-btn-pill' onClick={() => handleUse(item)}>使用</View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
