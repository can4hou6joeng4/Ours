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
  onDone: (taskId: string, action: 'submit' | 'confirm') => void
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

  const isExecutor = task.executorId === currentUserId || task.targetId === currentUserId
  const isCreator = task.creatorId === currentUserId

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
            {/* 状态标签 */}
            {task.status === 'waiting_confirmation' && <Text className='status-tag waiting'>待验收</Text>}
            {task.status === 'done' && <Text className='status-tag done'>已完成</Text>}
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
                {isCreator ? '我发布的' : '对方发布'}
              </Text>
            </View>
          </View>
        </View>

        <View className='card-footer'>
          {/* 1. 待完成：执行者可见 */}
          {task.status === 'pending' && isExecutor && (
            <Button className='btn-primary' block onClick={() => onDone(task._id, 'submit')}>我已完成</Button>
          )}

          {/* 2. 待验收：发布者可见 */}
          {task.status === 'waiting_confirmation' && isCreator && (
            <Button className='btn-primary' block onClick={() => onDone(task._id, 'confirm')}>确认完成</Button>
          )}

          {/* 3. 等待中提示 */}
          {task.status === 'pending' && !isExecutor && (
             <Button className='btn-disabled' block disabled>等待对方完成</Button>
          )}
          {task.status === 'waiting_confirmation' && !isCreator && (
             <Button className='btn-disabled' block disabled>等待对方验收</Button>
          )}

          {/* 撤销按钮：仅发布者在未完成时可见 */}
          {isCreator && task.status !== 'done' && (
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
