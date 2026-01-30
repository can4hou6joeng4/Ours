import { useState, useEffect, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView, Button, Input } from '@tarojs/components'
import { Notify } from '@taroify/core'
import dayjs from 'dayjs'
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
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)

  const watcher = useRef<any>(null)
  const userWatcher = useRef<any>(null)
  const giftWatcher = useRef<any>(null)
  const recordWatcher = useRef<any>(null)
  const lastTaskIds = useRef<Set<string>>(new Set())
  const lastGiftIds = useRef<Set<string>>(new Set())
  const lastRecordIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  // 实时任务指标计算
  const taskStats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    todayAdded: tasks.filter(t => {
      if (!t.createTime) return false
      const d = new Date(t.createTime)
      const today = new Date()
      return d.getFullYear() === today.getFullYear() &&
             d.getMonth() === today.getMonth() &&
             d.getDate() === today.getDate()
    }).length,
    completed: tasks.filter(t => t.status === 'done').length
  }

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
      const userRes = await Taro.cloud.callFunction({ name: 'initUser' })
      const userData = userRes.result as any

      if (userData?.success) {
        const myId = userData.user?._id
        const pId = userData.user?.partnerId
        setPoints(userData.user?.totalPoints || 0)
        setTodayChange(userData.todayChange || 0)
        setCurrentUserId(myId)
        setPartnerId(pId || '')

        const db = Taro.cloud.database()
        const _ = db.command

        // 1. 任务监听器：实时列表 + 动态提醒
        if (watcher.current) watcher.current.close()
        watcher.current = db.collection('Tasks')
          .where(_.or([{ creatorId: myId }, { targetId: myId }]))
          .watch({
            onChange: (snapshot) => {
              const currentIds = new Set(snapshot.docs.map(d => d._id))

              // 提醒逻辑：非首次加载 且 是对方新增的任务
              if (!isFirstLoad.current && pId) {
                snapshot.docChanges.forEach(change => {
                  if (change.dataType === 'add' && !lastTaskIds.current.has(change.doc._id)) {
                    if (change.doc.creatorId === pId) {
                      Notify.open({
                        color: change.doc.type === 'reward' ? 'primary' : 'warning',
                        message: `对方发布了新任务：${change.doc.title}`,
                        duration: 3000
                      })
                    }
                  }
                })
              }

              lastTaskIds.current = currentIds
              setTasks(snapshot.docs.sort((a, b) => (b.createTime as any) - (a.createTime as any)))
              setLoading(false)
            },
            onError: (err) => console.error('任务监听失败', err)
          })

        // 2. 礼品监听器：实时感知商店动态
        if (giftWatcher.current) giftWatcher.current.close()
        giftWatcher.current = db.collection('Gifts')
          .watch({
            onChange: (snapshot) => {
              const currentIds = new Set(snapshot.docs.map(d => d._id))

              if (!isFirstLoad.current && pId) {
                snapshot.docChanges.forEach(change => {
                  if (change.dataType === 'add' && !lastGiftIds.current.has(change.doc._id)) {
                    if (change.doc.creatorId === pId) {
                      Notify.open({
                        color: 'primary',
                        message: `对方上架了新礼品：${change.doc.name}`,
                        background: '#E5C59F', // 香槟金风格
                        duration: 3000
                      })
                    }
                  }
                })
              }
              lastGiftIds.current = currentIds
              isFirstLoad.current = false // 关键：在最后一次基础监听初始化后关闭首次加载判定
            },
            onError: (err) => console.error('礼品监听失败', err)
          })

        // 3. 用户监听器：实时同步积分
        if (userWatcher.current) userWatcher.current.close()
        userWatcher.current = db.collection('Users').doc(myId).watch({
          onChange: (snapshot) => {
            if (snapshot.docs.length > 0) setPoints(snapshot.docs[0].totalPoints || 0)
          },
          onError: (err) => console.error('用户信息监听失败', err)
        })

        // 4. 记录监听器：实时感知惊喜被拆开
        if (recordWatcher.current) recordWatcher.current.close()
        recordWatcher.current = db.collection('Records')
          .where({ userId: pId, type: 'gift_use' })
          .watch({
            onChange: (snapshot) => {
              if (!isFirstLoad.current && pId) {
                snapshot.docChanges.forEach(change => {
                  if (change.dataType === 'add' && !lastRecordIds.current.has(change.doc._id)) {
                    Notify.open({
                      color: 'success',
                      message: `🎉 惊喜已被拆开！对方使用了：${change.doc.reason.replace('[使用礼品] ', '')}`,
                      background: '#E5C59F',
                      duration: 4000
                    })
                  }
                })
              }
              lastRecordIds.current = new Set(snapshot.docs.map(d => d._id))
            },
            onError: (err) => console.error('流水监听失败', err)
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
        setShowDetailModal(false) // 如果在详情页完成，关闭弹窗
      }
    } catch (e) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const handleShowDetail = (task: any) => {
    console.log('触发详情弹窗:', task.title)
    setSelectedTask(task)
    setShowDetailModal(true)
  }

  // 综合过滤逻辑：共有奖赏 + 私有惩罚
  const filteredTasks = tasks.filter(t => {
    const isMyTask = t.targetId === currentUserId || t.type === 'reward' // 奖赏共有，惩罚私有
    if (!isMyTask) return false

    if (currentTab === 'pending') return t.status === 'pending'
    if (currentTab === 'done') return t.status === 'done'
    return t.status !== 'revoked' // 默认不显示已撤销
  })

  if (loading) return <View className='container'><View className='empty-state'><Text>数据加载中...</Text></View></View>

  return (
    <View className='container'>
      {/* 任务看板 */}
      <View className='score-board task-overview-card'>
        <View className='stat-item'>
          <Text className='value'>{taskStats.pending}</Text>
          <Text className='label'>待处理</Text>
        </View>
        <View className='divider' />
        <View className='stat-item'>
          <Text className='value'>{taskStats.todayAdded}</Text>
          <Text className='label'>今日新增</Text>
        </View>
        <View className='divider' />
        <View className='stat-item'>
          <Text className='value'>{taskStats.completed}</Text>
          <Text className='label'>累计完成</Text>
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
      <ScrollView
        scrollY={partnerId && filteredTasks.length > 0}
        className='task-list-main'
      >
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
            <View
              key={task._id}
              className={`task-card-v2 ${task.type}`}
              onClick={() => handleShowDetail(task)}
            >
              <View className='left'>
                <Text className='title-truncated'>{task.title}</Text>
                <View className='tags'>
                  <Text className={`tag ${task.type}`}>{task.type === 'reward' ? '奖赏' : '惩罚'}</Text>
                  {/* 身份关系标签 */}
                  {task.creatorId === currentUserId ? (
                    <Text className='tag identity mine'>我发布的</Text>
                  ) : (
                    <Text className='tag identity partner'>对方发起</Text>
                  )}
                  {task.targetId === currentUserId && (
                    <Text className={`tag identity target ${task.type}`}>
                      {task.type === 'reward' ? '给我的' : '我被罚'}
                    </Text>
                  )}
                </View>
              </View>
              <View className='right'>
                <Text className={`points ${task.type}`}>
                  {task.type === 'reward' ? '+' : '-'}{task.points}
                </Text>
                <View className='actions'>
                  {task.status === 'pending' && (
                    <Button
                      className='done-btn'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDone(task._id)
                      }}
                    >
                      完成
                    </Button>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 任务详情弹窗 (圆角居中/点击外部关闭) */}
      {showDetailModal && selectedTask && (
        <View
          className='modal-overlay detail-modal-root'
          onClick={() => setShowDetailModal(false)}
        >
          <View className='modal-card' onClick={e => e.stopPropagation()}>
            <View className='card-header'>
              <View className='close-btn' style={{ marginLeft: 'auto' }} onClick={() => setShowDetailModal(false)}>×</View>
            </View>

            <View className='card-body'>
              <Text className='task-title'>{selectedTask.title}</Text>
              <View className='task-type-sub'>
                <Text className={`category-label ${selectedTask.type}`}>
                  {selectedTask.type === 'reward' ? '奖赏任务' : '惩罚任务'}
                </Text>
              </View>

              <View className='info-list'>
                <View className='info-item'>
                  <Text className='label'>积分奖励</Text>
                  <Text className={`value points ${selectedTask.type}`}>
                    {selectedTask.type === 'reward' ? '+' : '-'}{selectedTask.points}
                  </Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>发布时间</Text>
                  <Text className='value'>
                    {selectedTask.createTime ? dayjs(selectedTask.createTime).format('YYYY/MM/DD hh:mm A') : '刚刚'}
                  </Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>关联身份</Text>
                  <Text className='value'>
                    {selectedTask.creatorId === currentUserId ? '我发布的' : '对方发布'}
                  </Text>
                </View>
              </View>
            </View>

            <View className='card-footer'>
              {selectedTask.status === 'pending' && (
                <Button className='btn-primary' onClick={() => handleDone(selectedTask._id)}>确认完成</Button>
              )}
              {selectedTask.creatorId === currentUserId && (
                <Button className='btn-secondary' onClick={() => {
                  setShowDetailModal(false)
                  handleRevoke(selectedTask._id)
                }}>撤销此任务</Button>
              )}
            </View>
          </View>
        </View>
      )}

      {/* 发布任务底部抽屉 (重塑为高级侧滑交互) */}
      {showAddModal && (
        <View className='add-sheet-root' onClick={() => setShowAddModal(false)}>
          <View className='sheet-content' onClick={e => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='title'>发布新任务</Text>
              <View className='close' onClick={() => setShowAddModal(false)}>×</View>
            </View>

            <View className='sheet-body'>
              <View className='type-selector-v2'>
                <View
                  className={`type-item ${newTaskType === 'reward' ? 'active reward' : ''}`}
                  onClick={() => setNewTaskType('reward')}
                >
                  奖赏
                </View>
                <View
                  className={`type-item ${newTaskType === 'penalty' ? 'active penalty' : ''}`}
                  onClick={() => setNewTaskType('penalty')}
                >
                  惩罚
                </View>
              </View>

              <View className='form-group'>
                <View className='input-item'>
                  <Text className='label'>任务描述</Text>
                  <Input
                    className='input'
                    placeholder={newTaskType === 'reward' ? '例如：洗碗一次' : '例如：熬夜/乱花钱'}
                    value={newTaskTitle}
                    onInput={(e) => setNewTaskTitle(e.detail.value)}
                  />
                </View>
                <View className='input-item'>
                  <Text className='label'>{newTaskType === 'reward' ? '奖励积分' : '扣除积分'}</Text>
                  <Input
                    className='input'
                    type='number'
                    placeholder='0'
                    value={newTaskPoints}
                    onInput={(e) => setNewTaskPoints(e.detail.value)}
                  />
                </View>
              </View>
            </View>

            <View className='sheet-footer'>
              <Button className='confirm-btn' onClick={handleAddTask}>确认发布</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
