import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Notify } from '@taroify/core'
import { requestSubscribe } from '../utils/subscribe'
import {
	addTask as addTaskApi,
	updateTaskStatus as updateTaskStatusApi,
	revokeTask as revokeTaskApi,
} from '../services'

interface AddTaskParams {
	title: string
	points: string
	type: 'reward' | 'penalty'
}

interface UseTaskActionsOptions {
	partnerId: string
	onAddSuccess?: () => void
	onDoneSuccess?: () => void
}

export default function useTaskActions({ partnerId, onAddSuccess, onDoneSuccess }: UseTaskActionsOptions) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleAddTask = useCallback(async ({ title, points: pointsText, type }: AddTaskParams) => {
		if (isSubmitting) return
		if (!partnerId) {
			Notify.open({ type: 'warning', message: '请先完成账号绑定' })
			return
		}
		const normalizedTitle = title.trim()
		if (!normalizedTitle) {
			Notify.open({ type: 'warning', message: '请输入任务描述' })
			return
		}
		if (normalizedTitle.length > 40) {
			Notify.open({ type: 'warning', message: '任务描述最多 40 字' })
			return
		}
		const trimmedPoints = pointsText.trim()
		const pointsNum = Number(trimmedPoints)
		if (!/^\d+$/.test(trimmedPoints) || !Number.isInteger(pointsNum) || pointsNum <= 0) {
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
			await requestSubscribe(['NEW_TASK'])

			const data = await addTaskApi({
				title: normalizedTitle,
				points: pointsNum,
				type,
			})
			if (data.success) {
				Taro.showToast({ title: '发布成功' })
				onAddSuccess?.()
			} else {
				Notify.open({ type: 'danger', message: data.message || '发布失败' })
			}
		} catch (_e) {
			Notify.open({ type: 'danger', message: '网络繁忙，请重试' })
		} finally {
			Taro.hideLoading()
			setTimeout(() => setIsSubmitting(false), 100)
		}
	}, [isSubmitting, partnerId, onAddSuccess])

	const handleDone = useCallback(async (taskId: string, action: 'submit' | 'confirm' = 'submit') => {
		try {
			await requestSubscribe(['TASK_DONE'])
		} catch (_e) {
			console.warn('订阅消息请求失败', _e)
		}

		Taro.showLoading({ title: '处理中' })
		try {
			const data = await updateTaskStatusApi({ taskId, action })
			if (data.success) {
				if (action === 'submit') {
					Taro.showToast({ title: '已提交，等待对方验收', icon: 'success' })
				} else if ((data.points || 0) > 0) {
					Taro.showToast({ title: `获得 ${data.points} 积分！`, icon: 'success' })
				} else {
					Taro.showToast({ title: '已确认完成', icon: 'success' })
				}
				onDoneSuccess?.()
			} else {
				Notify.open({ type: 'danger', message: data.message || '操作失败' })
			}
		} catch (_e) {
			Notify.open({ type: 'danger', message: '操作失败' })
		} finally {
			Taro.hideLoading()
		}
	}, [onDoneSuccess])

	const handleRevoke = useCallback(async (taskId: string) => {
		Taro.showModal({
			title: '确认撤销？',
			content: '如果是惩罚任务，扣除的积分将退回',
			success: async (res) => {
				if (res.confirm) {
					Taro.showLoading({ title: '撤销中' })
					try {
						const data = await revokeTaskApi({ taskId })
						if (data.success) {
							Taro.showToast({ title: '已撤销' })
						} else {
							Notify.open({ type: 'danger', message: data.message || data.error || '撤销失败' })
						}
					} catch (_e) {
						Notify.open({ type: 'danger', message: '撤销失败' })
					} finally {
						Taro.hideLoading()
					}
				}
			}
		})
	}, [])

	return {
		isSubmitting,
		handleAddTask,
		handleDone,
		handleRevoke,
	}
}
