import { View, Text, ScrollView, Image } from '@tarojs/components'
import React from 'react'
import './index.scss'

interface ExchangeHistoryModalProps {
  visible: boolean
  historyList: any[]
  loading: boolean
  hasMore: boolean
  filter: 'all' | 'unused' | 'used'
  onClose: () => void
  onFilterChange: (filter: 'all' | 'unused' | 'used') => void
  onLoadMore: () => void
}

const ExchangeHistoryModal: React.FC<ExchangeHistoryModalProps> = ({
  visible,
  historyList,
  loading,
  hasMore,
  filter,
  onClose,
  onFilterChange,
  onLoadMore
}) => {
  if (!visible) return null

  return (
    <View className='history-sheet-root' onClick={onClose}>
      <View className='history-sheet-content' onClick={e => e.stopPropagation()}>
        <View className='sheet-header'>
          <Text className='title'>兑换历史</Text>
          <View className='close' onClick={onClose}>×</View>
        </View>

        <View className='sheet-tabs'>
          {[
            { label: '全部', value: 'all' },
            { label: '待使用', value: 'unused' },
            { label: '已使用', value: 'used' }
          ].map(tab => (
            <View
              key={tab.value}
              className={`tab ${filter === tab.value ? 'active' : ''}`}
              onClick={() => onFilterChange(tab.value as any)}
            >
              {tab.label}
            </View>
          ))}
        </View>

        <ScrollView
          scrollY
          className='history-scroll'
          lowerThreshold={100}
          onScrollToLower={() => hasMore && !loading && onLoadMore()}
        >
          {historyList.length === 0 && !loading ? (
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
              {loading && (
                <View className='loading-more'>加载中...</View>
              )}
              {!hasMore && historyList.length > 0 && (
                <View className='no-more'>没有更多了</View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  )
}

export default ExchangeHistoryModal
