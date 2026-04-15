import { useState, useEffect, useRef, useMemo } from 'react'
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
import SkeletonCard from '../../components/SkeletonCard'
import { useUserStore } from '../../store'
import { useRealtimeWatchers, useInviteCode, useTaskActions } from '../../hooks'
import type { Task, Notice as NoticeType, NotifyData } from '../../types'
import './index.scss'

export default function Index() {
	const { user, partnerId, fetchUser } = useUserStore()
	const currentUserId = user?._id || ''

	const [tasks, setTasks] = useState<Task[]>([])
	const [currentTab, setCurrentTab] = useState<'pending' | 'done' | 'all'>('pending')
	const [loading, setLoading] = useState(!partnerId)
	const [showDetailModal, setShowDetailModal] = useState(false)
	const [selectedTask, setSelectedTask] = useState<Task | null>(null)
	const [showAddModal, setShowAddModal] = useState(false)
	const [newTaskTitle, setNewTaskTitle] = useState('')
	const [newTaskPoints, setNewTaskPoints] = useState('')
	const [newTaskType, setNewTaskType] = useState<'reward' | 'penalty'>('reward')
	const [showBindingSheet, setShowBindingSheet] = useState(false)
	const [showNoticeModal, setShowNoticeModal] = useState(false)
	const [currentNotice, setCurrentNotice] = useState<NoticeType | null>(null)

	// 自定义通知状态
	const [notifyVisible, setNotifyVisible] = useState(false)
	const [notifyData, setNotifyData] = useState<NotifyData | null>(null)

	const confettiRef = useRef<ConfettiRef>(null)

	// -- 自定义 Hooks --
	const { inviteCode, showInviteConfirm, closeInviteConfirm } = useInviteCode({ partnerId })

	const watchers = useRealtimeWatchers({
		onTasksChange: setTasks,
		onNotification: (data) => {
			setNotifyData(data)
			setNotifyVisible(true)
			Taro.vibrateShort()
		},
		onNotice: (notice) => {
			setCurrentNotice(notice)
			setShowNoticeModal(true)
		},
	})

	const { handleAddTask, handleDone, handleRevoke } = useTaskActions({
		partnerId,
		onAddSuccess: () => {
			setShowAddModal(false)
			setNewTaskTitle('')
			setNewTaskPoints('')
		},
		onDoneSuccess: () => setShowDetailModal(false),
	})

	const filterTabs = [
		{ label: '待处理', value: 'pending' },
		{ label: '已完成', value: 'done' },
		{ label: '全部', value: 'all' },
	]

	// 实时任务指标
	const taskStats = useMemo(() => ({
		pending: tasks.filter(t => t.status === 'pending' || t.status === 'waiting_confirmation').length,
		todayAdded: tasks.filter(t => {
			if (!t.createTime) return false
			return dayjs(t.createTime).isSame(dayjs(), 'day')
		}).length,
		completed: tasks.filter(t => t.status === 'done').length,
	}), [tasks])

	// 综合过滤
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
		if (task.status === 'pending' && isExecutor) return { label: '完成', action: 'submit' }
		if (task.status === 'waiting_confirmation' && isCreator) return { label: '验收', action: 'confirm' }
		return null
	}

	useDidShow(() => {
		fetchUser().then(() => {
			const state = useUserStore.getState()
			const uid = state.user?._id || ''
			const pid = state.partnerId || ''
			if (uid) {
				setLoading(false)
				watchers.start(uid, pid)
			}
		})
	})

	useDidHide(() => watchers.closeAll())

	useEffect(() => () => watchers.closeAll(), [watchers.closeAll])

	// 自动关闭通知
	useEffect(() => {
		if (notifyVisible) {
			const timer = setTimeout(() => setNotifyVisible(false), 4000)
			return () => clearTimeout(timer)
		}
	}, [notifyVisible])

	// 分享配置
	useShareAppMessage(() => {
		const customTitle = Taro.getStorageSync('customShareTitle')
		const userCode = Taro.getStorageSync('userId')?.slice(-6)?.toUpperCase() || ''
		return {
			title: customTitle || '邀请你成为我的另一半 💕',
			path: `/pages/index/index?inviteCode=${userCode}`,
			imageUrl: '',
		}
	})

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
			<NoticeModal
				visible={showNoticeModal}
				notice={currentNotice}
				onClose={() => setShowNoticeModal(false)}
				onConfettiRef={confettiRef}
			/>
		</View>
	)

	return (
		<View className='container'>
			<Confetti ref={confettiRef} />

			{/* 极简悬浮通知 */}
			<Notify
				open={notifyVisible}
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

			{/* 任务筛选标签栏 */}
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

			{/* 任务列表 */}
			<ScrollView
				scrollY={!!partnerId && filteredTasks.length > 0}
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
						desc='点击右下角"+"号发布一个新任务吧'
					/>
				) : (
					filteredTasks.map(task => {
						const taskAction = getTaskAction(task)
						return (
							<View
								key={task._id}
								className={`task-card-v2 ${task.type}`}
								onClick={() => {
									setSelectedTask(task)
									setShowDetailModal(true)
								}}
							>
								<View className='left'>
									<Text className='title-truncated'>{task.title}</Text>
									<View className='tags'>
										<Text className={`tag ${task.type}`}>{task.type === 'reward' ? '奖赏' : '惩罚'}</Text>
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

			{/* 悬浮发布按钮 */}
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

			{/* 仪式感通知弹窗 */}
			<NoticeModal
				visible={showNoticeModal}
				notice={currentNotice}
				onClose={() => setShowNoticeModal(false)}
				onConfettiRef={confettiRef}
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
				onConfirm={() => handleAddTask({
					title: newTaskTitle,
					points: newTaskPoints,
					type: newTaskType,
				})}
			/>

			{/* 绑定弹窗 */}
			<BindingSheet
				visible={showBindingSheet}
				onClose={() => setShowBindingSheet(false)}
				onSuccess={() => {
					setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 500)
				}}
			/>

			{/* 邀请确认弹窗 */}
			<InviteConfirmModal
				visible={showInviteConfirm}
				inviteCode={inviteCode}
				onClose={closeInviteConfirm}
				onSuccess={() => {
					setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 500)
				}}
			/>
		</View>
	)
}
