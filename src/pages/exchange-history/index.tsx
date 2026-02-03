import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import './index.scss'

dayjs.extend(relativeTime)

interface ExchangeHistoryItem {
  _id: string
  name: string
  image: string
  points: number
  status: 'unused' | 'used' | 'deleted'
  createTime: string | Date
  isDeleted: boolean

  purchaseRecord: {
    _id: string
    amount: number
    createTime: string | Date
    operator: string
  }

  useRecord?: {
    _id: string
    useTime: string | Date
    operator: string
    receiver: string
    message: string
  }
}

export default function ExchangeHistory() {
  const [historyList, setHistoryList] = useState<ExchangeHistoryItem[]>([])
  const [filterType, setFilterType] = useState<'all' | 'unused' | 'used'>('all')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const filterTabs = [
    { label: '全部', value: 'all' },
    { label: '待使用', value: 'unused' },
    { label: '已使用', value: 'used' }
  ]

  useDidShow(() => {
    fetchData(true)
  })

  useReachBottom(() => {
    if (!loading && hasMore) {
      fetchData(false)
    }
  })

  const fetchData = async (reset = false) => {
    if (reset) {
      setPage(1)
      setHasMore(true)
    }

    setLoading(true)
    try {
      const { result }: any = await Taro.cloud.callFunction({
        name: 'getExchangeHistory',
        data: {
          page: reset ? 1 : page,
          pageSize: 20,
          filter: filterType
        }
      })

      if (result.success) {
        const newData = result.data
        if (reset) {
          setHistoryList(newData)
        } else {
          setHistoryList(prev => [...prev, ...newData])
        }

        setHasMore(newData.length >= 20)
      }
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (type: 'all' | 'unused' | 'used') => {
    setFilterType(type)
    setPage(1)
    setHasMore(true)
    fetchData(true)
  }

  const formatTime = (time: string | Date) => {
    const date = dayjs(time)
    const fullTime = date.format('YYYY/MM/DD HH:mm')
    const relativeTime = date.fromNow()
    return { fullTime, relativeTime }
  }

  const getStatusLabel = (item: ExchangeHistoryItem) => {
    if (item.isDeleted) return { text: '已删除', className: 'deleted' }
    if (item.status === 'unused') return { text: '待使用', className: 'unused' }
    return { text: '已使用', className: 'used' }
  }

  return (
    <View className='exchange-history-container'>
      {/* 筛选标签 */}
      <View className='filter-bar'>
        {filterTabs.map(tab => (
          <View
            key={tab.value}
            className={`filter-item ${filterType === tab.value ? 'active' : ''}`}
            onClick={() => handleFilterChange(tab.value as any)}
          >
            {tab.label}
          </View>
        ))}
      </View>

      {/* 历史列表 */}
      <ScrollView
        scrollY
        className='history-scroll'
        lowerThreshold={100}
      >
        <View className='history-list'>
          {historyList.map(item => {
            const status = getStatusLabel(item)
            const purchaseTime = formatTime(item.purchaseRecord.createTime)
            const useTime = item.useRecord ? formatTime(item.useRecord.useTime) : null

            return (
              <View
                key={item._id}
                className={`history-card ${item.isDeleted ? 'deleted' : ''}`}
              >
                {/* 物品头部 */}
                <View className='item-header'>
                  {item.image ? (
                    <Image src={item.image} className='item-image' mode='aspectFill' />
                  ) : (
                    <View className='item-placeholder'>
                      <Text className='placeholder-icon'>🎁</Text>
                    </View>
                  )}

                  <View className='item-info'>
                    <Text className='item-name'>{item.name}</Text>
                    <Text className='item-points'>-{item.points} 积分</Text>
                  </View>

                  <View className={`status-badge ${status.className}`}>
                    <Text className='status-text'>{status.text}</Text>
                  </View>
                </View>

                {/* 时间轴 */}
                <View className='timeline'>
                  {/* 购买时间轴节点 */}
                  <View className='timeline-item purchase'>
                    <View className='timeline-dot'></View>
                    <View className='timeline-content'>
                      <Text className='timeline-title'>购买</Text>
                      <Text className='timeline-time'>{purchaseTime.fullTime}</Text>
                      <Text className='timeline-relative'>{purchaseTime.relativeTime}</Text>
                      <Text className='timeline-operator'>{item.purchaseRecord.operator}</Text>
                    </View>
                  </View>

                  {/* 使用时间轴节点（如果有） */}
                  {useTime && (
                    <View className='timeline-item use'>
                      <View className='timeline-dot'></View>
                      <View className='timeline-content'>
                        <Text className='timeline-title'>使用</Text>
                        <Text className='timeline-time'>{useTime.fullTime}</Text>
                        <Text className='timeline-relative'>{useTime.relativeTime}</Text>
                        <Text className='timeline-operator'>
                          {item.useRecord!.operator} → {item.useRecord!.receiver}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )
          })}

          {/* 加载状态 */}
          {loading && (
            <View className='loading-more'>
              <Text>加载中...</Text>
            </View>
          )}

          {/* 没有更多数据 */}
          {!hasMore && historyList.length > 0 && (
            <View className='no-more'>
              <Text>没有更多数据了</Text>
            </View>
          )}

          {/* 空状态 */}
          {historyList.length === 0 && !loading && (
            <View className='empty-state'>
              <Text className='empty-icon'>📦</Text>
              <Text className='empty-text'>暂无兑换记录</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
