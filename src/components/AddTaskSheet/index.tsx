import { View, Text } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import React from 'react'
import './index.scss'

interface AddTaskSheetProps {
  visible: boolean
  title: string
  points: string
  type: 'reward' | 'penalty'
  onClose: () => void
  onChangeTitle: (val: string) => void
  onChangePoints: (val: string) => void
  onChangeType: (type: 'reward' | 'penalty') => void
  onConfirm: () => void
}

const AddTaskSheet: React.FC<AddTaskSheetProps> = ({
  visible,
  title,
  points,
  type,
  onClose,
  onChangeTitle,
  onChangePoints,
  onChangeType,
  onConfirm
}) => {
  if (!visible) return null

  return (
    <View className='add-sheet-root' onClick={onClose}>
      <View className='sheet-content' onClick={e => e.stopPropagation()}>
        <View className='sheet-header'>
          <Text className='title'>发布新任务</Text>
          <View className='close' onClick={onClose}>×</View>
        </View>

        <View className='sheet-body'>
          <View className='type-selector-v2'>
            <View
              className={`type-item ${type === 'reward' ? 'active reward' : ''}`}
              onClick={() => onChangeType('reward')}
            >
              奖赏
            </View>
            <View
              className={`type-item ${type === 'penalty' ? 'active penalty' : ''}`}
              onClick={() => onChangeType('penalty')}
            >
              惩罚
            </View>
          </View>

          <View className='form-group'>
            <View className='input-item'>
              <Text className='label'>任务描述</Text>
              <Input
                className='custom-input'
                placeholder={type === 'reward' ? '例如：洗碗一次' : '例如：熬夜/乱花钱'}
                value={title}
                onChange={(e) => onChangeTitle(e.detail.value)}
              />
            </View>
            <View className='input-item'>
              <Text className='label'>{type === 'reward' ? '奖励积分' : '扣除积分'}</Text>
              <Input
                className='custom-input'
                type='number'
                placeholder='0'
                value={points}
                onChange={(e) => onChangePoints(e.detail.value)}
              />
            </View>
          </View>
        </View>

        <View className='sheet-footer'>
          <Button className='confirm-btn' block onClick={onConfirm}>确认发布</Button>
        </View>
      </View>
    </View>
  )
}

export default AddTaskSheet
