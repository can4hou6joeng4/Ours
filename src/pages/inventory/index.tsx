import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useEffect } from 'react'
import dayjs from 'dayjs'
import { Dialog, Button } from '@taroify/core'
import { getIconifyUrl } from '../../utils/assets'
import { requestSubscribe } from '../../utils/subscribe'
import './index.scss'

export default function Inventory() {
  const [items, setItems] = useState<any[]>([])
  const [currentTab, setCurrentTab] = useState<'unused' | 'used' | 'records'>('unused')
  const [usageRecords, setUsageRecords] = useState<any[]>([])
  const [recordFilter, setRecordFilter] = useState<'all' | 'sent' | 'received'>('all')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [using, setUsing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useDidShow(() => {
    if (currentTab === 'records') {
      fetchUsageRecords()
    } else {
      fetchItems()
    }
  })

  // 监听标签切换
  useEffect(() => {
    if (currentTab === 'records') {
      fetchUsageRecords()
    } else {
      fetchItems()
    }
  }, [currentTab])

  const fetchUsageRecords = async () => {
    setLoading(true)
    try {
      const { result }: any = await Taro.cloud.callFunction({
        name: 'getGiftUsageRecords',
        data: { page: 1, pageSize: 50 }
      })
      if (result.success) {
        setUsageRecords(result.data)
      }
    } catch (e) {
      console.error('获取记录失败', e)
    } finally {
      setLoading(false)
    }
  }

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

  const openUseConfirm = (item) => {
    setSelectedItem(item)
    setShowConfirm(true)
  }

  const handleConfirmUse = async () => {
    if (!selectedItem || using) return

    setUsing(true)
    try {
      const { result }: any = await Taro.cloud.callFunction({
        name: 'useItem',
        data: { itemId: selectedItem._id }
      })

      if (result.success) {
        Taro.showToast({ title: '兑换申请已发出', icon: 'success' })
        setShowConfirm(false)
        fetchItems()
        // 如果当前有记录tab，也同步刷新一下
        if (currentTab === 'records') fetchUsageRecords()
        // 成功后引导订阅
        requestSubscribe(['GIFT_USED'])
      } else {
        Taro.showToast({ title: result.error || '操作失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setUsing(false)
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const isStatusMatch = i.status === currentTab
      const isSearchMatch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (i.desc && i.desc.toLowerCase().includes(searchTerm.toLowerCase()))
      return isStatusMatch && isSearchMatch
    })
  }, [items, currentTab, searchTerm])

  const filteredRecords = useMemo(() => {
    if (recordFilter === 'all') return usageRecords
    return usageRecords.filter(r => r.direction === recordFilter)
  }, [usageRecords, recordFilter])

  // 礼品堆叠逻辑：按名称分组
  const stackedItems = filteredItems.reduce((acc: any[], item) => {
    const existing = acc.find(i => i.name === item.name)
    if (existing) {
      existing.count = (existing.count || 1) + 1
      // 保持最早的获得时间展示，或者更新为最新，这里选择保持
    } else {
      acc.push({ ...item, count: 1 })
    }
    return acc
  }, [])

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
      <View className='search-container'>
        <View className='search-bar'>
          <Image src={getIconifyUrl('tabler:search', '#999')} className='search-icon' />
          <Input
            className='search-input'
            placeholder='搜索礼品名称...'
            value={searchTerm}
            onInput={e => setSearchTerm(e.detail.value)}
          />
        </View>
      </View>

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
          <View
            className={`tab-item ${currentTab === 'records' ? 'active' : ''}`}
            onClick={() => setCurrentTab('records')}
          >
            兑换记录
          </View>
        </View>
      </View>

      <ScrollView scrollY className='items-scroll'>
        <View className='items-inner'>
          {currentTab === 'records' ? (
            <View className='records-section'>
              <View className='filter-bar'>
                <View
                  className={`filter-item ${recordFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setRecordFilter('all')}
                >全部</View>
                <View
                  className={`filter-item ${recordFilter === 'sent' ? 'active' : ''}`}
                  onClick={() => setRecordFilter('sent')}
                >我的请求</View>
                <View
                  className={`filter-item ${recordFilter === 'received' ? 'active' : ''}`}
                  onClick={() => setRecordFilter('received')}
                >收到的请求</View>
              </View>

              {filteredRecords.length === 0 && !loading ? (
                <View className='empty-state'>
                  <Image src={getIconifyUrl('tabler:history-off', '#8E8E93')} className='empty-icon-img' />
                  <Text className='empty-text'>暂无兑换记录</Text>
                </View>
              ) : (
                <View className='records-list'>
                  {filteredRecords.map(record => (
                    <View key={record._id} className={`record-card ${record.direction}`}>
                      <View className='record-left'>
                        <View className='icon-box'>
                          {record.direction === 'sent' ? '📤' : '📥'}
                        </View>
                        <View className='info'>
                          <Text className='name'>{record.giftName}</Text>
                          <Text className='time'>{dayjs(record.createTime).format('MM/DD HH:mm')}</Text>
                        </View>
                      </View>
                      <View className={`status-badge ${record.direction}`}>
                        {record.direction === 'sent' ? '我发起' : '待履行'}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            filteredItems.length === 0 && !loading ? (
              <View className='empty-state'>
              <Image src={getIconifyUrl('tabler:package-off', '#8E8E93')} className='empty-icon-img' />
              <Text className='empty-text'>背包空空如也</Text>
            </View>
          ) : (
            <View className='items-grid'>
              {stackedItems.map(item => (
                <View key={item._id} className={`item-card-v4 ${currentTab} ${item.count > 1 ? 'is-stacked' : ''}`}>
                  <View className='item-icon-box'>
                    {item.image || item.cover ? (
                      <Image
                        src={item.image || item.cover}
                        className='inner-icon thumb-img'
                        mode='aspectFill'
                      />
                    ) : (
                      <Image
                        src={getIconifyUrl(getItemIcon(item.name), currentTab === 'unused' ? '#D4B185' : '#BBB')}
                        className='inner-icon'
                      />
                    )}
                    {item.count > 1 && (
                      <View className='item-count-badge'>x{item.count}</View>
                    )}
                  </View>
                  <View className='item-info'>
                    <Text className='item-name'>{item.name}</Text>
                    <Text className='item-time'>
                      {currentTab === 'unused'
                        ? `${dayjs(item.createTime).format('YYYY.MM.DD HH:mm')} 获得`
                        : `${dayjs(item.useTime).format('YYYY.MM.DD HH:mm')} 已兑换`
                      }
                    </Text>
                  </View>
                  {currentTab === 'unused' && (
                    <View className='use-btn-pill' onClick={() => openUseConfirm(item)}>去使用</View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 使用确认弹窗 */}
      <Dialog open={showConfirm} onClose={() => !using && setShowConfirm(false)}>
        <Dialog.Header>确认使用</Dialog.Header>
        <Dialog.Content>
          确定要向对方发起“{selectedItem?.name}”的使用申请吗？
          对方将立即收到通知。
        </Dialog.Content>
        <Dialog.Actions>
          <Button onClick={() => !using && setShowConfirm(false)}>取消</Button>
          <Button loading={using} onClick={handleConfirmUse}>确认使用</Button>
        </Dialog.Actions>
      </Dialog>
    </View>
  )
}
