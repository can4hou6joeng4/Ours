import { useState, useEffect, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView, Button, Input } from '@tarojs/components'
import EmptyState from '../../components/EmptyState'
import './index.scss'

export default function Index() {
  const [tasks, setTasks] = useState<any[]>([])
  const [points, setPoints] = useState(0)
  const [todayChange, setTodayChange] = useState(0)
  const [currentUserId, setCurrentUserId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [currentTab, setCurrentTab] = useState<'pending' | 'done' | 'all'>('pending')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPoints, setNewTaskPoints] = useState('')
  const [newTaskType, setNewTaskType] = useState<'reward' | 'penalty'>('reward')
  const [loading, setLoading] = useState(true)
  const watcher = useRef<any>(null)
  const userWatcher = useRef<any>(null)

  useDidShow(() => {
    initDataAndWatch()
  })

  // 页面卸载或隐藏时，关闭监听器防止内存泄漏
  useEffect(() => {
    return () => {
      if (watcher.current) {
        watcher.current.close()
      }
      if (userWatcher.current) {
        userWatcher.current.close()
      }
    }
  }, [])

  const initDataAndWatch = async () => {
    try {
      // 1. 获取用户信息，确定身份和绑定关系
      const userRes = await Taro.cloud.callFunction({ name: 'initUser' })
      const userData = userRes.result as any

      if (userData?.success) {
        const myId = userData.user?._id
        const pId = userData.user?.partnerId
        setPoints(userData.user?.totalPoints || 0)
        setTodayChange(userData.todayChange || 0)
        setCurrentUserId(myId)
        setPartnerId(pId || '')

        // 2. 开启实时监听 (监听属于这两人的所有任务)
        const db = Taro.cloud.database()
        const _ = db.command

        if (watcher.current) watcher.current.close()

        watcher.current = db.collection('Tasks')
          .where(_.or([
            { creatorId: myId },
            { targetId: myId }
          ]))
          .watch({
            onChange: (snapshot) => {
              // 关键：监听到变化立即更新 UI，无需重新调用 fetchData
              setTasks(snapshot.docs.sort((a, b) =>
                (b.createTime as any) - (a.createTime as any)
              ))
              setLoading(false)
            },
            onError: (err) => {
              console.error('监听失败', err)
              fetchData() // 降级处理
            }
          })

        // 3. 开启用户信息的实时监听 (为了实时更新积分)
        if (userWatcher.current) userWatcher.current.close()
        userWatcher.current = db.collection('Users')
          .doc(myId)
          .watch({
            onChange: (snapshot) => {
              if (snapshot.docs.length > 0) {
                const updatedUser = snapshot.docs[0]
                setPoints(updatedUser.totalPoints || 0)
              }
            },
            onError: (err) => {
              console.error('用户信息监听失败', err)
            }
          })
      }
    } catch (e) {
      console.error('初始化监听失败', e)
    }
  }

  const fetchData = async () => {
    try {
      const [tasksRes, userRes] = await Promise.all([
        Taro.cloud.callFunction({ name: 'getTasks' }),
        Taro.cloud.callFunction({ name: 'initUser' })
      ])

      const tasksData = tasksRes.result as any
      const userData = userRes.result as any

      if (userData?.success) {
        // 安全读取：使用 totalPoints 字段名并配合可选链
        setPoints(userData.user?.totalPoints || 0)
        setTodayChange(userData.todayChange || 0)
        setCurrentUserId(userData.user?._id || '')
        setPartnerId(userData.user?.partnerId || '')
      }
      if (tasksData?.success) {
        setTasks(tasksData.tasks || [])
      }
    } catch (e) {
      console.error('获取数据失败', e)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (taskId: string) => {
    Taro.showModal({
      title: '确认撤销？',
      content: '如果是惩罚任务，扣除的积分将退回',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '撤销中' })
          try {
            const result = await Taro.cloud.callFunction({
              name: 'revokeTask',
              data: { taskId }
            })
            if ((result.result as any).success) {
              Taro.showToast({ title: '已撤销' })
              // watch 会自动更新列表，无需 fetchData
            }
          } catch (e) {
            Taro.showToast({ title: '撤销失败', icon: 'none' })
          } finally {
            Taro.hideLoading()
          }
        }
      }
    })
  }

  const handleAddTask = async () => {
    if (!newTaskTitle || !newTaskPoints) return

    // 防御性校验：确保已获取到绑定伙伴的 ID
    if (!partnerId) {
      Taro.showToast({ title: '请先完成账号绑定', icon: 'none' })
      return
    }

    Taro.showLoading({ title: '发布中' })
    try {
      console.log('正在发布任务，参数:', { title: newTaskTitle, points: newTaskPoints, type: newTaskType, targetId: partnerId })

      const res = await Taro.cloud.callFunction({
        name: 'addTask',
        data: {
          title: newTaskTitle,
          points: newTaskPoints,
          type: newTaskType,
          targetId: partnerId
        }
      })
      const data = res.result as any
      if (data.success) {
        Taro.showToast({ title: '发布成功' })
        setShowAddModal(false)
        setNewTaskTitle('')
        setNewTaskPoints('')
        // watch 会自动更新
      }
    } catch (e) {
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const handleDone = async (taskId: string) => {
    Taro.showLoading({ title: '处理中' })
    try {
      const res = await Taro.cloud.callFunction({
        name: 'updateTaskStatus',
        data: { taskId }
      })
      const data = res.result as any
      if (data.success) {
        Taro.showToast({ title: `获得 ${data.points} 积分！`, icon: 'success' })
        // watch 会自动更新
      }
    } catch (e) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  // 综合过滤逻辑：共有奖赏 + 私有惩罚
  const filteredTasks = tasks.filter(t => {
    const isMyTask = t.targetId === currentUserId || t.type === 'reward' // 奖赏共有，惩罚私有
    if (!isMyTask) return false

    if (currentTab === 'pending') return t.status === 'pending'
    if (currentTab === 'done') return t.status === 'done'
    return true
  })

  if (loading) return <View className='container'><Text>数据加载中...</Text></View>

  return (
    <View className='container'>
      {/* 积分看板 (理物风格) */}
      <View className='score-board'>
        <View className='stat-item'>
          <Text className='value'>{points}</Text>
          <Text className='label'>总资产积分</Text>
        </View>
        <View className='divider' />
        <View className='stat-item'>
          <Text className='value'>{todayChange > 0 ? `+${todayChange}` : todayChange}</Text>
          <Text className='label'>今日变动</Text>
        </View>
      </View>

      {/* 悬浮发布按钮 */}
      <View className='fab-btn' onClick={() => setShowAddModal(true)}>+</View>

      {/* Tab 切换 */}
      <View className='tab-bar'>
        <View className={`tab-item ${currentTab === 'pending' ? 'active' : ''}`} onClick={() => setCurrentTab('pending')}>待完成</View>
        <View className={`tab-item ${currentTab === 'done' ? 'active' : ''}`} onClick={() => setCurrentTab('done')}>已完成</View>
        <View className={`tab-item ${currentTab === 'all' ? 'active' : ''}`} onClick={() => setCurrentTab('all')}>全部</View>
      </View>

      {/* 任务列表 */}
      <ScrollView scrollY className='task-list-main'>
        {!partnerId ? (
          <EmptyState
            icon='tabler:link'
            title='尚未开启连接'
            desc='完成另一半绑定后，方可发布与查看双人任务'
            btnText='去绑定'
            onAction={() => Taro.navigateTo({ url: '/pages/binding/index' })}
          />
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon='tabler:mood-smile'
            title='暂无相关任务'
            desc='点击右下角“+”号发布一个新任务吧'
          />
        ) : (
          filteredTasks.map(task => (
            <View key={task._id} className={`task-card-v2 ${task.type}`}>
              <View className='left'>
                <Text className='title'>{task.title}</Text>
                <View className='tags'>
                  <Text className={`tag ${task.type}`}>{task.type === 'reward' ? '奖赏' : '惩罚'}</Text>
                  <Text className='time'>{task.createTime ? new Date(task.createTime).toLocaleString().slice(5, 16) : '刚刚'}</Text>
                </View>
              </View>
              <View className='right'>
                <Text className={`points ${task.type}`}>
                  {task.type === 'reward' ? '+' : '-'}{task.points}
                </Text>
                <View className='actions'>
                  {task.status === 'pending' && (
                    <Button className='done-btn' onClick={() => handleDone(task._id)}>完成</Button>
                  )}
                  {task.creatorId === currentUserId && (
                    <Button className='revoke-btn' onClick={() => handleRevoke(task._id)}>撤销</Button>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 发布弹窗 */}
      {showAddModal && (
        <View className='modal-overlay'>
          <View className='modal-content'>
            <Text className='modal-title'>发布新任务</Text>
            <View className='type-selector'>
              <View className={`type-item ${newTaskType === 'reward' ? 'active reward' : ''}`} onClick={() => setNewTaskType('reward')}>奖赏</View>
              <View className={`type-item ${newTaskType === 'penalty' ? 'active penalty' : ''}`} onClick={() => setNewTaskType('penalty')}>惩罚</View>
            </View>
            <Input className='input' placeholder={newTaskType === 'reward' ? '任务描述 (例如：洗碗一次)' : '惩罚原因 (例如：熬夜/乱花钱)'} value={newTaskTitle} onInput={(e) => setNewTaskTitle(e.detail.value)} />
            <Input className='input' type='number' placeholder={newTaskType === 'reward' ? '奖励积分' : '扣除积分'} value={newTaskPoints} onInput={(e) => setNewTaskPoints(e.detail.value)} />
            <View className='btns'>
              <Button className='cancel' onClick={() => setShowAddModal(false)}>取消</Button>
              <Button className='confirm' onClick={handleAddTask}>确认发布</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
