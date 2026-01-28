import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
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

  return (
    <View className='inventory-container'>
      <View className='tabs-header'>
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

      <ScrollView scrollY className='items-scroll'>
        {filteredItems.length === 0 && !loading ? (
          <View className='empty-state'>
            <Text className='empty-icon'>📦</Text>
            <Text>背包空空如也~</Text>
          </View>
        ) : (
          <View className='items-grid'>
            {filteredItems.map(item => (
              <View key={item._id} className='item-card'>
                <View className={`item-icon-bg ${item.type}`}>
                  <Text className='item-icon'>🎁</Text>
                </View>
                <View className='item-info'>
                  <Text className='item-name'>{item.name}</Text>
                  <Text className='item-time'>
                    {currentTab === 'unused'
                      ? `获得于: ${dayjs(item.createTime).format('MM-DD HH:mm')}`
                      : `使用于: ${dayjs(item.useTime).format('MM-DD HH:mm')}`
                    }
                  </Text>
                </View>
                {currentTab === 'unused' && (
                  <View className='use-btn' onClick={() => handleUse(item)}>立即使用</View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
