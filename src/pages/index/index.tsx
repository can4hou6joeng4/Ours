import { useState, useEffect, useRef, useMemo } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Notify, Tabs, Button, Input, Popup } from '@taroify/core'
import dayjs from 'dayjs'
import EmptyState from '../../components/EmptyState'
import Confetti, { ConfettiRef } from '../../components/Confetti'
import './index.scss'

export default function Index() {
  const [tasks, setTasks] = useState<any[]>([])
  const [points, setPoints] = useState(0)
  const [todayChange, setTodayChange] = useState(0)
  const [currentUserId, setCurrentUserId] = useState(Taro.getStorageSync('userId') || '')
  const [partnerId, setPartnerId] = useState(Taro.getStorageSync('partnerId') || '')
  const [currentTab, setCurrentTab] = useState<'pending' | 'done' | 'all'>('pending')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPoints, setNewTaskPoints] = useState('')
  const [newTaskType, setNewTaskType] = useState<'reward' | 'penalty'>('reward')
  const [loading, setLoading] = useState(!Taro.getStorageSync('partnerId'))
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false) // 新增：提交锁

  const confettiRef = useRef<ConfettiRef>(null)

  const filterTabs = [
    { label: '待完成', value: 'pending' },
    { label: '已完成', value: 'done' },
    { label: '全部', value: 'all' }
  ]

  // 自定义通知状态
  const [notifyVisible, setNotifyVisible] = useState(false)
  const [notifyData, setNotifyData] = useState<any>(null)

  const watcher = useRef<any>(null)
  const userWatcher = useRef<any>(null)
  const giftWatcher = useRef<any>(null)
  const noticeWatcher = useRef<any>(null) // 新增消息监听器
  const lastTaskIds = useRef<Set<string>>(new Set())
  const lastGiftIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  // 新增：仪式感消息状态
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [currentNotice, setCurrentNotice] = useState<any>(null)
  const [isNoticeClosing, setIsNoticeClosing] = useState(false) // 新增：退出动画锁

  // 1. 实时任务指标计算 (性能优化：使用 useMemo)
  const taskStats = useMemo(() => ({
    pending: tasks.filter(t => t.status === 'pending').length,
    todayAdded: tasks.filter(t => {
      if (!t.createTime) return false
      return dayjs(t.createTime).isSame(dayjs(), 'day')
    }).length,
    completed: tasks.filter(t => t.status === 'done').length
  }), [tasks])

  // 2. 综合过滤逻辑 (性能优化：使用 useMemo)
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const isMyTask = t.targetId === currentUserId || t.type === 'reward'
      if (!isMyTask) return false

      if (currentTab === 'pending') return t.status === 'pending'
      if (currentTab === 'done') return t.status === 'done'
      return t.status !== 'revoked'
    })
  }, [tasks, currentTab, currentUserId])

  useDidShow(() => {
    // 优先刷新用户信息，确保登录态正常后再启动监听
    refreshUserInfo().then((res: any) => {
      if (res?.success && res?.user?._id) {
        startWatchers(res.user._id, res.user.partnerId || '')
      }
    })
  })

  // 自动触发通知关闭
  useEffect(() => {
    if (notifyVisible) {
      const timer = setTimeout(() => setNotifyVisible(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [notifyVisible])

  const refreshUserInfo = async () => {
    try {
      const { result }: any = await Taro.cloud.callFunction({ name: 'initUser' })
      if (result?.success) {
        const myId = result.user?._id
        const pId = result.user?.partnerId || ''

        setPoints(result.user?.totalPoints || 0)
        setTodayChange(result.todayChange || 0)

        setCurrentUserId(myId)
        setPartnerId(pId)
        Taro.setStorageSync('userId', myId)
        Taro.setStorageSync('partnerId', pId)
        return result
      }
    } catch (e) {
      console.error('刷新信息失败', e)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }

  const startWatchers = (myId: string, pId: string) => {
    const db = Taro.cloud.database()
    const _ = db.command

    // 1. 任务监听器
    if (watcher.current) watcher.current.close()
    watcher.current = db.collection('Tasks')
      .where(_.or([{ creatorId: myId }, { targetId: myId }]))
      .watch({
        onChange: (snapshot) => {
          const currentIds = new Set(snapshot.docs.map(d => d._id))
          if (!isFirstLoad.current && pId) {
            snapshot.docChanges.forEach(change => {
              if (change.dataType === 'add' && !lastTaskIds.current.has(change.doc._id)) {
                if (change.doc.creatorId === pId) {
                  showNotification({
                    title: '新任务提醒',
                    message: change.doc.title,
                    type: change.doc.type
                  })
                }
              }
            })
          }
          lastTaskIds.current = currentIds
          setTasks(snapshot.docs.sort((a, b) => (b.createTime as any) - (a.createTime as any)))
        },
        onError: (err) => console.error('任务监听失败', err)
      })

    // 2. 礼品监听器
    if (giftWatcher.current) giftWatcher.current.close()
    giftWatcher.current = db.collection('Gifts').watch({
      onChange: (snapshot) => {
        const currentIds = new Set(snapshot.docs.map(d => d._id))
        if (!isFirstLoad.current && pId) {
          snapshot.docChanges.forEach(change => {
            if (change.dataType === 'add' && !lastGiftIds.current.has(change.doc._id)) {
              if (change.doc.creatorId === pId) {
                showNotification({
                  title: '商店上新',
                  message: change.doc.name,
                  type: 'reward'
                })
              }
            }
          })
        }
        lastGiftIds.current = currentIds
        isFirstLoad.current = false
      },
      onError: (err) => console.error('礼品监听失败', err)
    })

    // 3. 用户监听器
    if (userWatcher.current) userWatcher.current.close()
    userWatcher.current = db.collection('Users').doc(myId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) setPoints(snapshot.docs[0].totalPoints || 0)
      },
      onError: (err) => console.error('用户信息监听失败', err)
    })

    // 4. 新增：仪式感通知监听器 (核心逻辑)
    if (noticeWatcher.current) noticeWatcher.current.close()
    noticeWatcher.current = db.collection('Notices')
      .where({
        receiverId: myId,
        read: false
      })
      .watch({
        onChange: (snapshot) => {
          // 只处理新增的消息，避免重复弹出
          const newNotices = snapshot.docChanges
            .filter(change => change.dataType === 'add')
            .map(change => change.doc)

            if (newNotices.length > 0) {
              const latest = newNotices[newNotices.length - 1]
              // 额外校验：确保 receiverId 匹配当前用户且类型匹配
              if (latest.receiverId === myId) {
                console.log('收到符合条件的通知:', latest)
                setCurrentNotice(latest)
                setShowNoticeModal(true)
                Taro.vibrateShort()
              }
            }
          },
        onError: (err) => console.error('通知监听失败', err)
      })
  }

  // 关闭通知并标记为已读
  const handleCloseNotice = async () => {
    if (!currentNotice || isNoticeClosing) return

    // 触发粒子动效
    confettiRef.current?.fire()

    // 1. 触发退出动效
    setIsNoticeClosing(true)
    Taro.vibrateShort() // 轻微震动，提示“已阅”

    // 2. 延迟执行状态清理，等待动画结束 (400ms 与 SCSS transition 对齐)
    setTimeout(() => {
      setShowNoticeModal(false)
      setIsNoticeClosing(false)
    }, 400)

    // 3. 异步更新数据库 (不阻塞 UI)
    try {
      await Taro.cloud.database().collection('Notices').doc(currentNotice._id).update({
        data: { read: true }
      })
    } catch (e) {
      console.error('标记已读失败', e)
    }
  }

  const showNotification = (data: any) => {
    setNotifyData(data)
    setNotifyVisible(true)
    Taro.vibrateShort() // 震动反馈，增强感知
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
    if (isSubmitting || !newTaskTitle || !newTaskPoints) return
    if (!partnerId) {
      Taro.showToast({ title: '请先完成账号绑定', icon: 'none' })
      return
    }

    setIsSubmitting(true)
    Taro.showLoading({ title: '发布中' })
    try {
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
      } else {
        Taro.showToast({ title: data.message || '发布失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络繁忙，请重试', icon: 'none' })
    } finally {
      Taro.hideLoading()
      // 延迟一帧执行 Toast，防止被 hideLoading 误伤
      setTimeout(() => {
        setIsSubmitting(false)
      }, 100)
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
        setShowDetailModal(false)
      }
    } catch (e) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const handleShowDetail = (task: any) => {
    setSelectedTask(task)
    setShowDetailModal(true)
  }

  if (loading) return (
    <View className='container'>
      <View className='empty-state'><Text>数据加载中...</Text></View>
      {/* 即使在加载中，如果收到仪式感通知也允许弹出，增强即时感 */}
      {showNoticeModal && currentNotice && (
        <View className='notice-modal-root' onClick={handleCloseNotice}>
          <View className='notice-card' onClick={e => e.stopPropagation()}>
            <View className='card-header'>
              <View className='notice-tag'>{currentNotice.type}</View>
              <View className='close-btn' onClick={handleCloseNotice}>×</View>
            </View>
            <View className='card-body'>
              <View className='notice-icon-box'>
                {currentNotice.type === 'NEW_TASK' && <Text className='emoji'>✨</Text>}
                {currentNotice.type === 'TASK_DONE' && <Text className='emoji'>🎉</Text>}
                {currentNotice.type === 'NEW_GIFT' && <Text className='emoji'>🎁</Text>}
                {currentNotice.type === 'GIFT_USED' && <Text className='emoji'>💝</Text>}
              </View>
              <Text className='notice-title'>{currentNotice.title}</Text>
              <View className='notice-message-box'>
                <Text className='notice-message'>{currentNotice.message}</Text>
              </View>
              {currentNotice.points !== 0 && (
                <View className='notice-points'>
                  <Text className='label'>积分变动</Text>
                  <Text className={`value ${currentNotice.points > 0 ? 'plus' : 'minus'}`}>
                    {currentNotice.points > 0 ? '+' : ''}{currentNotice.points}
                  </Text>
                </View>
              )}
            </View>
            <View className='card-footer'>
              <Button className='btn-confirm' block onClick={handleCloseNotice}>我已收到 ⟩</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )

  return (
    <View className='container'>
      <Confetti ref={confettiRef} />
      {/* 极简悬浮通知 (保留作为次级反馈) */}
      <Notify
        visible={notifyVisible}
        className='minimal-float-notify'
        onClick={() => setNotifyVisible(false)}
      >
        {notifyData && (
          <View className='notify-content'>
            <View className='notify-icon'>✨</View>
            <View className='notify-body'>
              <Text className='notify-title'>{notifyData.title}</Text>
              <Text className='notify-desc'>{notifyData.message}</Text>
            </View>
            <Button
              className='notify-btn'
              onClick={(e) => {
                e.stopPropagation()
                setNotifyVisible(false)
              }}
            >
              知道了
            </Button>
          </View>
        )}
      </Notify>

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

      {/* 任务筛选标签栏 (重塑为与背包一致的胶囊样式) */}
      <View className='tabs-header'>
        <View className='tabs-capsule'>
          {filterTabs.map(tab => (
            <View
              key={tab.value}
              className={`tab-item ${currentTab === tab.value ? 'active' : ''}`}
              onClick={() => setCurrentTab(tab.value as any)}
            >
              {tab.label}
            </View>
          ))}
        </View>
      </View>

      {/* 悬浮发布按钮 (v2) */}

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
                      className='done-btn-v2'
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

      {/* 悬浮发布按钮 (v2) - 移动至末尾确保层级 */}
      <Button
        className='fab-btn-v2'
        onClick={() => setShowAddModal(true)}
      >
        +
      </Button>

      {/* 全场景仪式感弹窗 (名片式设计) - 移至末尾确保物理最高层级 */}
      {showNoticeModal && currentNotice && (
        <View className='notice-modal-root' onClick={handleCloseNotice}>
          <View className={`notice-card ${isNoticeClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <View className='card-header'>
              <View className='notice-tag'>{currentNotice.type}</View>
              <View className='close-btn' onClick={handleCloseNotice}>×</View>
            </View>

            <View className='card-body'>
              <View className='notice-icon-box'>
                {currentNotice.type === 'NEW_TASK' && <Text className='emoji'>✨</Text>}
                {currentNotice.type === 'TASK_DONE' && <Text className='emoji'>🎉</Text>}
                {currentNotice.type === 'NEW_GIFT' && <Text className='emoji'>🎁</Text>}
                {currentNotice.type === 'GIFT_USED' && <Text className='emoji'>💝</Text>}
              </View>

              <Text className='notice-title'>{currentNotice.title}</Text>
              <View className='notice-message-box'>
                <Text className='notice-message'>{currentNotice.message}</Text>
              </View>

              {currentNotice.points !== 0 && (
                <View className='notice-points'>
                  <Text className='label'>积分变动</Text>
                  <Text className={`value ${currentNotice.points > 0 ? 'plus' : 'minus'}`}>
                    {currentNotice.points > 0 ? '+' : ''}{currentNotice.points}
                  </Text>
                </View>
              )}
            </View>

            <View className='card-footer'>
              <Button className='btn-confirm' block onClick={handleCloseNotice}>
                我已收到 ⟩
              </Button>
            </View>
          </View>
        </View>
      )}

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
                <Button className='btn-primary' block onClick={() => handleDone(selectedTask._id)}>确认完成</Button>
              )}
              {selectedTask.creatorId === currentUserId && (
                <Button className='btn-secondary' block onClick={() => {
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
                    className='custom-input'
                    placeholder={newTaskType === 'reward' ? '例如：洗碗一次' : '例如：熬夜/乱花钱'}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.detail.value)}
                  />
                </View>
                <View className='input-item'>
                  <Text className='label'>{newTaskType === 'reward' ? '奖励积分' : '扣除积分'}</Text>
                  <Input
                    className='custom-input'
                    type='number'
                    placeholder='0'
                    value={newTaskPoints}
                    onChange={(e) => setNewTaskPoints(e.detail.value)}
                  />
                </View>
              </View>
            </View>

            <View className='sheet-footer'>
              <Button className='confirm-btn' block onClick={handleAddTask}>确认发布</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
