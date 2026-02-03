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
  const [currentTab, setCurrentTab] = useState<'unused' | 'used'>('unused')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [using, setUsing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showExchangeHistory, setShowExchangeHistory] = useState(false)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'unused' | 'used'>('all')

  useDidShow(() => {
    fetchItems()
  })

  // 监听标签切换
  useEffect(() => {
    fetchItems()
  }, [currentTab])

  // 加载兑换历史数据
  const loadExchangeHistory = async (reset = false) => {
    if (!hasMoreHistory && !reset) return

    setHistoryLoading(true)
    try {
      const page = reset ? 1 : historyPage
      const { result }: any = await Taro.cloud.callFunction({
        name: 'getExchangeHistory',
        data: { page, pageSize: 20, filter: historyFilter }
      })

      if (result.success) {
        if (reset) {
          setHistoryList(result.data)
          setHistoryPage(1)
        } else {
          setHistoryList(prev => [...prev, ...result.data])
        }
        setHasMoreHistory(result.data.length >= 20)
        if (!reset) {
          setHistoryPage(prev => prev + 1)
        }
      }
    } catch (e) {
      console.error('加载兑换历史失败', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  // 打开兑换历史弹窗
  const handleShowExchangeHistory = () => {
    setShowExchangeHistory(true)
    loadExchangeHistory(true)
  }

  // 切换历史筛选
  const handleHistoryFilterChange = (filter: 'all' | 'unused' | 'used') => {
    setHistoryFilter(filter)
    loadExchangeHistory(true)
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
      {/* 兑换历史入口按钮 */}
      <View className='exchange-history-entry'>
        <View
          className='history-btn'
          onClick={handleShowExchangeHistory}
        >
          <Image src={getIconifyUrl('tabler:history', '#fff')} className='history-icon' />
          <Text className='history-text'>兑换历史</Text>
          <Text className='history-arrow'>⟩</Text>
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
          )}
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

      {/* 兑换历史底部弹窗 */}
      {showExchangeHistory && (
        <View className='history-sheet-root' onClick={() => setShowExchangeHistory(false)}>
          <View className='history-sheet-content' onClick={e => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='title'>兑换历史</Text>
              <View className='close' onClick={() => setShowExchangeHistory(false)}>×</View>
            </View>

            <View className='sheet-tabs'>
              <View
                className={`tab ${historyFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleHistoryFilterChange('all')}
              >
                全部
              </View>
              <View
                className={`tab ${historyFilter === 'unused' ? 'active' : ''}`}
                onClick={() => handleHistoryFilterChange('unused')}
              >
                待使用
              </View>
              <View
                className={`tab ${historyFilter === 'used' ? 'active' : ''}`}
                onClick={() => handleHistoryFilterChange('used')}
              >
                已使用
              </View>
            </View>

            <ScrollView scrollY className='history-scroll' lowerThreshold={100}>
              {historyList.length === 0 && !historyLoading ? (
                <View className='empty-history'>
                  <Text className='empty-icon'>📦</Text>
                  <Text className='empty-text'>暂无兑换记录</Text>
                </View>
              ) : (
                <View className='history-list'>
                  {historyList.map((item: any) => (
                    <View key={item._id} className={`history-item ${item.isDeleted ? 'deleted' : ''} ${item.status}`}>
                      <View className='item-left'>
                        {item.image ? (
                          <Image src={item.image} className='item-image' mode='aspectFill' />
                        ) : (
                          <View className='item-placeholder'>🎁</View>
                        )}
                      </View>
                      <View className='item-center'>
                        <Text className='item-name'>{item.name}</Text>
                        <Text className='item-points'>-{item.points} 积分</Text>
                      </View>
                      <View className={`item-status ${item.status}`}>
                        {item.isDeleted ? '已删除' : item.status === 'unused' ? '待使用' : '已使用'}
                      </View>
                    </View>
                  ))}
                  {historyLoading && (
                    <View className='loading-more'>加载中...</View>
                  )}
                  {!hasMoreHistory && historyList.length > 0 && (
                    <View className='no-more'>没有更多了</View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}
