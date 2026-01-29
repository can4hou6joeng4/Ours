import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import './index.scss'

export default function History() {
  const [records, setRecords] = useState<any[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    fetchRecords()
    fetchUserInfo()
  })

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

      <View className='records-list'>
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
              <View key={record._id} className='record-item'>
                <View className='left'>
                  <Text className='record-title'>{record.reason || record.title}</Text>
                  <Text className='record-time'>
                    {dayjs(record.createTime || record.timestamp).format('YYYY-MM-DD HH:mm')}
                  </Text>
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
    </View>
  )
}
