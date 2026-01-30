import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import './index.scss'

export default function History() {
  const [records, setRecords] = useState<any[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)

  useDidShow(() => {
    fetchRecords()
    fetchUserInfo()
  })

  const handleShowDetail = (record: any) => {
    setSelectedRecord(record)
    setShowDetailModal(true)
  }

  const fetchUserInfo = async () => {
    try {
      const { result }: any = await Taro.cloud.callFunction({ name: 'initUser' })
      if (result.success) {
        setTotalPoints(result.user.totalPoints)
      }
    } catch (e) {
      console.error('获取用户信息失败', e)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const { result }: any = await Taro.cloud.callFunction({
        name: 'getRecords',
        data: { page: 1, pageSize: 50 }
      })

      if (result.success) {
        setRecords(result.data)
      }
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='history-container'>
      {/* 沉浸式资产卡片 - 与兑换页一致 */}
      <View className='asset-summary-card'>
        <View className='asset-info'>
          <Text className='asset-label'>TOTAL ASSETS / 当前总积分</Text>
          <View className='asset-num'>{totalPoints}</View>
        </View>
        <View className='asset-tag'>History</View>
      </View>

      <ScrollView scrollY className='records-list'>
        <Text className='section-title'>TRANSACTION RECORDS / 往期明细</Text>
        {records.length === 0 && !loading ? (
          <View className='empty-state'>
            <View className='empty-icon'>📄</View>
            <Text>暂无积分记录</Text>
          </View>
        ) : (
          records.map(record => {
            const amount = record.amount || record.points || 0

            // 判定是否为支出：明确标记为 outcome 或者数值小于 0
            const isOutcome = record.type === 'outcome' || amount < 0
            const isIncome = !isOutcome

            const displayAmount = Math.abs(amount)

            return (
              <View
                key={record._id}
                className='record-item'
                onClick={() => handleShowDetail(record)}
              >
                <View className='left'>
                  <Text className='record-title'>{record.reason || record.title}</Text>
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

      {/* 积分详情弹窗 (与任务详情风格一致) */}
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
              <Text className='record-detail-title'>{selectedRecord.reason || selectedRecord.title}</Text>

              <View className='info-list'>
                <View className='info-item'>
                  <Text className='label'>积分变动</Text>
                  <Text className={`value points ${(selectedRecord.amount || selectedRecord.points || 0) >= 0 ? 'income' : 'outcome'}`}>
                    {(selectedRecord.amount || selectedRecord.points || 0) >= 0 ? '+' : '-'}{Math.abs(selectedRecord.amount || selectedRecord.points || 0)}
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
