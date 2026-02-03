import { View, Text } from '@tarojs/components'
import { Button } from '@taroify/core'
import React from 'react'
import dayjs from 'dayjs'
import './index.scss'

interface TaskDetailModalProps {
  visible: boolean
  task: any
  currentUserId: string
  onClose: () => void
  onDone: (taskId: string) => void
  onRevoke: (taskId: string) => void
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  visible,
  task,
  currentUserId,
  onClose,
  onDone,
  onRevoke
}) => {
  if (!visible || !task) return null

  return (
    <View
      className='modal-overlay detail-modal-root'
      onClick={onClose}
    >
      <View className='modal-card' onClick={e => e.stopPropagation()}>
        <View className='card-header'>
          <View className='close-btn' style={{ marginLeft: 'auto' }} onClick={onClose}>×</View>
        </View>

        <View className='card-body'>
          <Text className='task-title'>{task.title}</Text>
          <View className='task-type-sub'>
            <Text className={`category-label ${task.type}`}>
              {task.type === 'reward' ? '奖赏任务' : '惩罚任务'}
            </Text>
          </View>

          <View className='info-list'>
            <View className='info-item'>
              <Text className='label'>积分奖励</Text>
              <Text className={`value points ${task.type}`}>
                {task.type === 'reward' ? '+' : '-'}{task.points}
              </Text>
            </View>
            <View className='info-item'>
              <Text className='label'>发布时间</Text>
              <Text className='value'>
                {task.createTime ? dayjs(task.createTime).format('YYYY/MM/DD hh:mm A') : '刚刚'}
              </Text>
            </View>
            <View className='info-item'>
              <Text className='label'>关联身份</Text>
              <Text className='value'>
                {task.creatorId === currentUserId ? '我发布的' : '对方发布'}
              </Text>
            </View>
          </View>
        </View>

        <View className='card-footer'>
          {task.status === 'pending' && (
            <Button className='btn-primary' block onClick={() => onDone(task._id)}>确认完成</Button>
          )}
          {task.creatorId === currentUserId && (
            <Button className='btn-secondary' block onClick={() => {
              onClose()
              onRevoke(task._id)
            }}>撤销此任务</Button>
          )}
        </View>
      </View>
    </View>
  )
}

export default TaskDetailModal
