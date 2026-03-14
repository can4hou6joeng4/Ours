import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useRef, useState } from 'react'
import dayjs from 'dayjs'
import './index.scss'
import { smartFetchUser } from '../../utils/userCache'
import { getRecords as getRecordsApi } from '../../services'
import type { PointRecord } from '../../types'

const DATA_CACHE_DURATION = 30 * 1000

export default function History() {
  const [records, setRecords] = useState<PointRecord[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<(PointRecord & { cleanTitle?: string }) | null>(null)
  const [filterActive, setFilterActive] = useState('all')
  const recordsLoadingRef = useRef(false)
  const lastFetchTimeRef = useRef(0)

  const filterTabs = [
    { label: '全部', value: 'all' },
    { label: '奖赏', value: 'reward' },
    { label: '兑换', value: 'exchange' },
    { label: '扣除', value: 'penalty' }
  ]

  useDidShow(() => {
    const now = Date.now()
    const shouldSkipRecordsFetch = records.length > 0 && now - lastFetchTimeRef.current < DATA_CACHE_DURATION

    if (shouldSkipRecordsFetch) {
      fetchUserInfo()
      return
    }

    Promise.all([fetchRecords(), fetchUserInfo()])
  })

  const handleShowDetail = (record: any) => {
    setSelectedRecord(record)
    setShowDetailModal(true)
  }

  const fetchUserInfo = async () => {
    try {
      const result: any = await smartFetchUser({
        onCacheHit: (cached) => {
          setTotalPoints(cached.user?.totalPoints || 0)
        }
      })

      if (result?.success) {
        setTotalPoints(result.user?.totalPoints || 0)
      }
    } catch (e) {
      console.error('获取用户信息失败', e)
    }
  }

  const fetchRecords = async () => {
    if (recordsLoadingRef.current) return

    recordsLoadingRef.current = true
    setLoading(true)
    try {
      const result = await getRecordsApi({ page: 1, pageSize: 50, summaryOnly: true })

      if (result.success) {
        setRecords(Array.isArray(result.data) ? result.data : [])
        lastFetchTimeRef.current = Date.now()
      }
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      recordsLoadingRef.current = false
      setLoading(false)
    }
  }

  return (
    <View className='history-container'>
      <View className='asset-summary-card'>
        <View className='asset-info'>
          <Text className='asset-label'>TOTAL ASSETS / 当前总积分</Text>
          <View className='asset-num'>{totalPoints}</View>
        </View>
        <View className='asset-tag'>History</View>
      </View>

      <ScrollView scrollY className='records-list'>
        <Text className='section-title'>TRANSACTION RECORDS / 往期明细</Text>

        <View className='filter-bar'>
          {filterTabs.map(tab => (
            <View
              key={tab.value}
              className={`filter-item ${filterActive === tab.value ? 'active' : ''}`}
              onClick={() => setFilterActive(tab.value)}
            >
              {tab.label}
            </View>
          ))}
        </View>

        {records.length === 0 && !loading ? (
          <View className='empty-state'>
            <View className='empty-icon'>📄</View>
            <Text>暂无积分记录</Text>
          </View>
        ) : (
          records
            .filter(record => {
              const amount = record.amount || record.points || 0
              const rawTitle = record.reason || record.title || ''
              const isExchange = rawTitle.includes('兑换') || record.type === 'exchange' || record.type === 'gift'
              const isOutcome = record.type === 'outcome' || amount < 0 || isExchange
              const isIncome = !isOutcome

              if (filterActive === 'all') return true
              if (filterActive === 'reward') return isIncome && !isExchange
              if (filterActive === 'exchange') return isExchange
              if (filterActive === 'penalty') return isOutcome && !isExchange
              return true
            })
            .map(record => {
              const amount = record.amount || record.points || 0
              const rawTitle = record.reason || record.title || ''
              const isExchange = rawTitle.includes('兑换') || record.type === 'exchange' || record.type === 'gift'
              const isOutcome = record.type === 'outcome' || amount < 0 || isExchange
              const isIncome = !isOutcome
              const displayAmount = Math.abs(amount)
              const cleanTitle = rawTitle
                .replace(/^\[.*?\]\s*/, '')
                .replace(/^兑换[：:]\s*/, '')

              return (
                <View
                  key={record._id}
                  className='record-item'
                  onClick={() => handleShowDetail({ ...record, cleanTitle })}
                >
                  <View className='left'>
                    <Text className='record-title'>{cleanTitle}</Text>
                  </View>
                  <View className={`right ${isIncome ? 'income' : 'outcome'}`}>
                    <Text className='points-val'>
                      {isIncome ? '+' : '-'}{displayAmount}
                    </Text>
                  </View>
                </View>
              )
            })
        )}
      </ScrollView>

      {showDetailModal && selectedRecord && (
        <View
          className='modal-overlay detail-modal-root'
          onClick={() => setShowDetailModal(false)}
        >
          <View className='modal-card' onClick={e => e.stopPropagation()}>
            <View className='card-header'>
              <View className='close-btn' style={{ marginLeft: 'auto' }} onClick={() => setShowDetailModal(false)}>×</View>
            </View>

            <View className='card-body'>
              <Text className='record-detail-title'>{selectedRecord.cleanTitle}</Text>

              <View className='task-type-sub'>
                <Text className={`category-label ${
                  (selectedRecord.reason || selectedRecord.title || '').includes('兑换') || selectedRecord.type === 'exchange' || selectedRecord.type === 'gift'
                    ? 'penalty'
                    : (selectedRecord.type === 'reward' || (selectedRecord.amount || 0) > 0 ? 'reward' : 'penalty')
                }`}>
                  {(selectedRecord.reason || selectedRecord.title || '').includes('兑换') || selectedRecord.type === 'exchange' || selectedRecord.type === 'gift'
                    ? '兑换'
                    : (selectedRecord.type === 'reward' || (selectedRecord.amount || 0) > 0 ? '奖赏' : '惩罚')}
                </Text>
              </View>

              <View className='info-list'>
                <View className='info-item'>
                  <Text className='label'>积分变动</Text>
                  <Text className={`value points ${selectedRecord.type === 'reward' || (selectedRecord.amount || 0) > 0 ? 'reward' : 'penalty'}`}>
                    {selectedRecord.type === 'reward' || (selectedRecord.amount || 0) > 0 ? '+' : '-'}{Math.abs(selectedRecord.amount || selectedRecord.points || 0)}
                  </Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>记录时间</Text>
                  <Text className='value'>
                    {dayjs(selectedRecord.createTime || selectedRecord.timestamp).format('YYYY/MM/DD HH:mm')}
                  </Text>
                </View>
              </View>
            </View>

            <View className='card-footer'>
              <Button className='btn-primary' onClick={() => setShowDetailModal(false)}>确定</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
