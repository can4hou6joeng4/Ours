import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Taro, { useDidShow, useDidHide, useShareAppMessage } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Notify, Button } from '@taroify/core'
import dayjs from 'dayjs'
import EmptyState from '../../components/EmptyState'
import Confetti, { ConfettiRef } from '../../components/Confetti'
import NoticeModal from '../../components/NoticeModal'
import TaskDetailModal from '../../components/TaskDetailModal'
import AddTaskSheet from '../../components/AddTaskSheet'
import BindingSheet from '../../components/BindingSheet'
import InviteConfirmModal from '../../components/InviteConfirmModal'
import { requestSubscribe } from '../../utils/subscribe'
import { smartFetchUser } from '../../utils/userCache'
import SkeletonCard from '../../components/SkeletonCard'
import type { Task, Notice, NotifyData } from '../../types'
import './index.scss'

export default function Index() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentUserId, setCurrentUserId] = useState(Taro.getStorageSync('userId') || '')
  const [partnerId, setPartnerId] = useState(Taro.getStorageSync('partnerId') || '')
  const [currentTab, setCurrentTab] = useState<'pending' | 'done' | 'all'>('pending')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPoints, setNewTaskPoints] = useState('')
  const [newTaskType, setNewTaskType] = useState<'reward' | 'penalty'>('reward')
  const [loading, setLoading] = useState(!Taro.getStorageSync('partnerId'))
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showBindingSheet, setShowBindingSheet] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [showInviteConfirm, setShowInviteConfirm] = useState(false)

  const confettiRef = useRef<ConfettiRef>(null)
  const inviteChecked = useRef(false) // 防止重复检测邀请码

  const filterTabs = [
    { label: '待处理', value: 'pending' },
    { label: '已完成', value: 'done' },
    { label: '全部', value: 'all' }
  ]

  // 自定义通知状态
  const [notifyVisible, setNotifyVisible] = useState(false)
  const [notifyData, setNotifyData] = useState<NotifyData | null>(null)

  const watcher = useRef<any>(null)
  const giftWatcher = useRef<any>(null)
  const noticeWatcher = useRef<any>(null)
  const startWatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTaskIds = useRef<Set<string>>(new Set())
  const lastGiftIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)
  const watcherUserId = useRef<string>('') // 记录当前监听器绑定的用户ID

  // 新增：仪式感消息状态
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [currentNotice, setCurrentNotice] = useState<Notice | null>(null)
  const [isNoticeClosing, setIsNoticeClosing] = useState(false) // 新增：退出动画锁

  // 1. 实时任务指标计算 (性能优化：使用 useMemo)
  const taskStats = useMemo(() => ({
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'waiting_confirmation').length,
    todayAdded: tasks.filter(t => {
      if (!t.createTime) return false
      return dayjs(t.createTime).isSame(dayjs(), 'day')
    }).length,
    completed: tasks.filter(t => t.status === 'done').length
  }), [tasks])

  // 2. 综合过滤逻辑 (性能优化：使用 useMemo)
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const executorId = t.executorId || t.targetId
      const isRelatedTask = t.creatorId === currentUserId || t.targetId === currentUserId || executorId === currentUserId
      if (!isRelatedTask) return false

      if (currentTab === 'pending') return t.status === 'pending' || t.status === 'waiting_confirmation'
      if (currentTab === 'done') return t.status === 'done'
      return t.status !== 'revoked'
    })
  }, [tasks, currentTab, currentUserId])

  const getTaskAction = (task: Task): { label: string, action: 'submit' | 'confirm' } | null => {
    const executorId = task.executorId || task.targetId
    const isExecutor = executorId === currentUserId || task.targetId === currentUserId
    const isCreator = task.creatorId === currentUserId

    if (task.status === 'pending' && isExecutor) {
      return { label: '完成', action: 'submit' }
    }

    if (task.status === 'waiting_confirmation' && isCreator) {
      return { label: '验收', action: 'confirm' }
    }

    return null
  }

  const closeAllWatchers = useCallback(() => {
    if (startWatchTimer.current) {
      clearTimeout(startWatchTimer.current)
      startWatchTimer.current = null
    }
    if (watcher.current) { watcher.current.close(); watcher.current = null }
    if (giftWatcher.current) { giftWatcher.current.close(); giftWatcher.current = null }
    if (noticeWatcher.current) { noticeWatcher.current.close(); noticeWatcher.current = null }
    watcherUserId.current = ''
  }, [])

  useDidShow(() => {
    // 使用智能缓存：优先读取缓存快速显示，后台静默刷新
    smartFetchUser({
      onCacheHit: (cached) => {
        // 立即使用缓存数据渲染 UI
        const user = cached.user
        setCurrentUserId(user?._id || '')
        setPartnerId(user?.partnerId || '')
        setLoading(false)
        // 启动监听器
        if (user?._id) {
          startWatchers(user._id, user.partnerId || '')
        }
      },
      onFresh: (result) => {
        // 后台刷新完成后更新状态
        if (result?.success) {
          setCurrentUserId(result.user?._id || '')
          setPartnerId(result.user?.partnerId || '')
          Taro.setStorageSync('userId', result.user?._id)
          Taro.setStorageSync('partnerId', result.user?.partnerId || '')
        }
      }
    }).then((res: any) => {
      if (!res?.fromCache && res?.success && res?.user?._id) {
        setCurrentUserId(res.user._id)
        setPartnerId(res.user.partnerId || '')
        Taro.setStorageSync('userId', res.user._id)
        Taro.setStorageSync('partnerId', res.user.partnerId || '')
        setLoading(false)
        startWatchers(res.user._id, res.user.partnerId || '')
      }
    })
  })

  useDidHide(() => {
    closeAllWatchers()
  })

  useEffect(() => () => {
    closeAllWatchers()
  }, [closeAllWatchers])

  // 检测邀请码参数（从分享链接进入）
  useEffect(() => {
    if (inviteChecked.current) return
    inviteChecked.current = true

    // 获取启动参数或页面参数
    const launchOptions = Taro.getLaunchOptionsSync()
    const code = launchOptions.query?.inviteCode

    if (code && !partnerId) {
      // 有邀请码且未绑定，显示确认弹窗
      setInviteCode(code.toUpperCase())
      setShowInviteConfirm(true)
    }
  }, [partnerId])

  // 配置分享（支持用户自定义标题）
  useShareAppMessage(() => {
    const customTitle = Taro.getStorageSync('customShareTitle')
    const userCode = Taro.getStorageSync('userId')?.slice(-6)?.toUpperCase() || ''
    return {
      title: customTitle || '邀请你成为我的另一半 💕',
      path: `/pages/index/index?inviteCode=${userCode}`,
      imageUrl: ''
    }
  })

  // 自动触发通知关闭
  useEffect(() => {
    if (notifyVisible) {
      const timer = setTimeout(() => setNotifyVisible(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [notifyVisible])

  const startWatchers = (myId: string, pId: string) => {
    // 核心优化：如果监听器已存在且用户ID未变，跳过重建
    if (watcherUserId.current === myId && watcher.current) {
      return
    }

    if (!myId) {
      console.warn('用户ID为空，跳过监听器启动')
      return
    }

    const db = Taro.cloud.database()
    const _ = db.command

    closeAllWatchers()
    watcherUserId.current = myId // 记录当前用户ID

    // 延迟启动监听器，确保云环境登录完成
    startWatchTimer.current = setTimeout(() => {
      try {
        startWatchTimer.current = null
        // 1. 任务监听器
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
            onError: (err) => console.warn('任务监听暂不可用', err)
          })

        // 2. 礼品监听器
        giftWatcher.current = db.collection('Gifts')
          .where(_.or([{ creatorId: myId }, { partnerId: myId }]))
          .watch({
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
            onError: (err) => console.warn('礼品监听暂不可用', err)
          })

        // 3. 通知监听器
        noticeWatcher.current = db.collection('Notices')
          .where({
            receiverId: myId,
            read: false
          })
          .watch({
            onChange: (snapshot) => {
              const newNotices = snapshot.docChanges
                .filter(change => change.dataType === 'add')
                .map(change => change.doc)

              if (newNotices.length > 0) {
                const latest = newNotices[newNotices.length - 1]
                if (latest.receiverId === myId) {
                  console.log('收到符合条件的通知:', latest)
                  setCurrentNotice(latest)
                  setShowNoticeModal(true)
                  Taro.vibrateShort()
                }
              }
            },
            onError: (err) => console.warn('通知监听暂不可用', err)
          })
      } catch (e) {
        console.warn('监听器启动失败', e)
      }
    }, 300)
  }

  // 关闭通知并标记为已读
  const handleCloseNotice = async () => {
    if (!currentNotice || isNoticeClosing) return

    // 触发粒子动效
    confettiRef.current?.fire()

    // 强化触感反馈：双重微震动
    Taro.vibrateShort()
    setTimeout(() => Taro.vibrateShort(), 100)

    // 1. 延迟启动退出动效，让粒子动效先飞一会儿 (200ms)
    setTimeout(() => {
      setIsNoticeClosing(true)
    }, 200)

    // 2. 延迟执行状态清理 (200ms 停顿 + 600ms 动画 = 800ms)
    setTimeout(() => {
      setShowNoticeModal(false)
      setIsNoticeClosing(false)
    }, 800)

    // 3. 异步更新数据库 (不阻塞 UI)
    try {
      await Taro.cloud.database().collection('Notices').doc(currentNotice._id).update({
        data: { read: true }
      })
    } catch (e) {
      console.error('标记已读失败', e)
    }
  }

  const showNotification = (data: NotifyData) => {
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
            const data = result.result as any
            if (data.success) {
              Taro.showToast({ title: '已撤销' })
            } else {
              Notify.open({ type: 'danger', message: data.message || data.error || '撤销失败' })
            }
          } catch (e) {
            Notify.open({ type: 'danger', message: '撤销失败' })
          } finally {
            Taro.hideLoading()
          }
        }
      }
    })
  }

  const handleAddTask = async () => {
    if (isSubmitting) return
    if (!partnerId) {
      Notify.open({ type: 'warning', message: '请先完成账号绑定' })
      return
    }
    const normalizedTitle = newTaskTitle.trim()
    if (!normalizedTitle) {
      Notify.open({ type: 'warning', message: '请输入任务描述' })
      return
    }
    if (normalizedTitle.length > 40) {
      Notify.open({ type: 'warning', message: '任务描述最多 40 字' })
      return
    }
    const pointsText = newTaskPoints.trim()
    const pointsNum = Number(pointsText)
    if (!/^\d+$/.test(pointsText) || !Number.isInteger(pointsNum) || pointsNum <= 0) {
      Notify.open({ type: 'warning', message: '积分需为正整数' })
      return
    }
    if (pointsNum > 9999) {
      Notify.open({ type: 'warning', message: '积分不能超过 9999' })
      return
    }

    setIsSubmitting(true)
    Taro.showLoading({ title: '发布中' })
    try {
      // 在异步调用前先尝试请求权限 (微信允许在点击回调中尽早调用)
      await requestSubscribe(['NEW_TASK'])

      const res = await Taro.cloud.callFunction({
        name: 'addTask',
        data: {
          title: normalizedTitle,
          points: pointsNum,
          type: newTaskType
        }
      })
      const data = res.result as any
      if (data.success) {
        Taro.showToast({ title: '发布成功' })
        setShowAddModal(false)
        setNewTaskTitle('')
        setNewTaskPoints('')
      } else {
        Notify.open({ type: 'danger', message: data.message || '发布失败' })
      }
    } catch (e) {
      Notify.open({ type: 'danger', message: '网络繁忙，请重试' })
    } finally {
      Taro.hideLoading()
      // 延迟一帧执行 Toast，防止被 hideLoading 误伤
      setTimeout(() => {
        setIsSubmitting(false)
      }, 100)
    }
  }

  const handleDone = async (taskId: string, action: 'submit' | 'confirm' = 'submit') => {
    // 关键修复：在异步操作前先请求订阅权限（必须在用户点击的同步回调中）
    try {
      await requestSubscribe(['TASK_DONE'])
    } catch (e) {
      console.warn('订阅消息请求失败', e)
    }

    Taro.showLoading({ title: '处理中' })
    try {
      const res = await Taro.cloud.callFunction({
        name: 'updateTaskStatus',
        data: { taskId, action }
      })
      const data = res.result as any
      if (data.success) {
        if (action === 'submit') {
          Taro.showToast({ title: '已提交，等待对方验收', icon: 'success' })
        } else if ((data.points || 0) > 0) {
          Taro.showToast({ title: `获得 ${data.points} 积分！`, icon: 'success' })
        } else {
          Taro.showToast({ title: '已确认完成', icon: 'success' })
        }
        setShowDetailModal(false)
      } else {
        Notify.open({ type: 'danger', message: data.message || '操作失败' })
      }
    } catch (e) {
      Notify.open({ type: 'danger', message: '操作失败' })
    } finally {
      Taro.hideLoading()
    }
  }

  const handleShowDetail = (task: Task) => {
    setSelectedTask(task)
    setShowDetailModal(true)
  }

  if (loading) return (
    <View className='container'>
      <View className='skeleton-stack'>
        <SkeletonCard loading row={2} rowWidth='60%'>
          <View className='task-card-v2 skeleton-placeholder-card' />
        </SkeletonCard>
        {[1, 2, 3].map(item => (
          <SkeletonCard key={item} loading row={3}>
            <View className='task-card-v2 skeleton-placeholder-card' />
          </SkeletonCard>
        ))}
      </View>
      {/* 即使在加载中，如果收到仪式感通知也允许弹出，增强即时感 */}
      <NoticeModal
        visible={showNoticeModal}
        notice={currentNotice}
        closing={isNoticeClosing}
        onClose={handleCloseNotice}
      />
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
            onAction={() => setShowBindingSheet(true)}
          />
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon='tabler:mood-smile'
            title='暂无相关任务'
            desc='点击右下角“+”号发布一个新任务吧'
          />
        ) : (
          filteredTasks.map(task => {
            const taskAction = getTaskAction(task)

            return (
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
                    {taskAction && (
                      <Button
                        className='done-btn-v2'
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDone(task._id, taskAction.action)
                        }}
                      >
                        {taskAction.label}
                      </Button>
                    )}
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* 悬浮发布按钮 (v2) - 移动至末尾确保层级 */}
      <Button
        className='fab-btn-v2'
        onClick={() => {
          if (!partnerId) {
            setShowBindingSheet(true)
            return
          }
          setShowAddModal(true)
        }}
      >
        +
      </Button>

      {/* 全场景仪式感弹窗 (名片式设计) - 移至末尾确保物理最高层级 */}
      <NoticeModal
        visible={showNoticeModal}
        notice={currentNotice}
        closing={isNoticeClosing}
        onClose={handleCloseNotice}
      />

      {/* 任务详情弹窗 */}
      <TaskDetailModal
        visible={showDetailModal}
        task={selectedTask}
        currentUserId={currentUserId}
        onClose={() => setShowDetailModal(false)}
        onDone={handleDone}
        onRevoke={handleRevoke}
      />

      {/* 发布任务底部抽屉 */}
      <AddTaskSheet
        visible={showAddModal}
        title={newTaskTitle}
        points={newTaskPoints}
        type={newTaskType}
        onClose={() => setShowAddModal(false)}
        onChangeTitle={setNewTaskTitle}
        onChangePoints={setNewTaskPoints}
        onChangeType={setNewTaskType}
        onConfirm={handleAddTask}
      />

      {/* 绑定弹窗 */}
      <BindingSheet
        visible={showBindingSheet}
        onClose={() => setShowBindingSheet(false)}
        onSuccess={() => {
          // 绑定成功后刷新页面数据
          setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 500)
        }}
      />

      {/* 邀请确认弹窗 */}
      <InviteConfirmModal
        visible={showInviteConfirm}
        inviteCode={inviteCode}
        onClose={() => setShowInviteConfirm(false)}
        onSuccess={() => {
          setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 500)
        }}
      />
    </View>
  )
}
