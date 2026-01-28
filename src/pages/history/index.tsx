import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import './index.scss'

export default function History() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    fetchRecords()
  })

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
      <View className='history-header'>
        <Text className='title'>积分明细</Text>
        <Text className='subtitle'>记录每一分的变化</Text>
      </View>

      <ScrollView scrollY className='records-list'>
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
