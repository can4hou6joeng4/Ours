import { useRef, useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import type { Task, Notice, NotifyData } from '../types'

interface WatcherCallbacks {
	onTasksChange: (tasks: Task[]) => void
	onNotification: (data: NotifyData) => void
	onNotice: (notice: Notice) => void
}

export default function useRealtimeWatchers(callbacks: WatcherCallbacks) {
	const watcher = useRef<any>(null)
	const giftWatcher = useRef<any>(null)
	const noticeWatcher = useRef<any>(null)
	const startWatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastTaskIds = useRef<Set<string>>(new Set())
	const lastGiftIds = useRef<Set<string>>(new Set())
	const isFirstLoad = useRef(true)
	const watcherUserId = useRef<string>('')

	const closeAll = useCallback(() => {
		if (startWatchTimer.current) {
			clearTimeout(startWatchTimer.current)
			startWatchTimer.current = null
		}
		if (watcher.current) { watcher.current.close(); watcher.current = null }
		if (giftWatcher.current) { giftWatcher.current.close(); giftWatcher.current = null }
		if (noticeWatcher.current) { noticeWatcher.current.close(); noticeWatcher.current = null }
		watcherUserId.current = ''
	}, [])

	const start = useCallback((myId: string, partnerId: string) => {
		if (watcherUserId.current === myId && watcher.current) {
			return
		}

		if (!myId) {
			console.warn('用户ID为空，跳过监听器启动')
			return
		}

		const db = Taro.cloud.database()
		const _ = db.command

		closeAll()
		watcherUserId.current = myId

		startWatchTimer.current = setTimeout(() => {
			try {
				startWatchTimer.current = null

				// 1. 任务监听器
				watcher.current = db.collection('Tasks')
					.where(_.or([{ creatorId: myId }, { targetId: myId }]))
					.watch({
						onChange: (snapshot) => {
							const currentIds = new Set(snapshot.docs.map(d => d._id))
							if (!isFirstLoad.current && partnerId) {
								snapshot.docChanges.forEach(change => {
									if (change.dataType === 'add' && !lastTaskIds.current.has(change.doc._id)) {
										if (change.doc.creatorId === partnerId) {
											callbacks.onNotification({
												title: '新任务提醒',
												message: change.doc.title,
												type: change.doc.type
											})
										}
									}
								})
							}
							lastTaskIds.current = currentIds
							callbacks.onTasksChange(
								snapshot.docs.sort((a, b) => (b.createTime as any) - (a.createTime as any))
							)
						},
						onError: (err) => console.warn('任务监听暂不可用', err)
					})

				// 2. 礼品监听器
				giftWatcher.current = db.collection('Gifts')
					.where(_.or([{ creatorId: myId }, { partnerId: myId }]))
					.watch({
						onChange: (snapshot) => {
							const currentIds = new Set(snapshot.docs.map(d => d._id))
							if (!isFirstLoad.current && partnerId) {
								snapshot.docChanges.forEach(change => {
									if (change.dataType === 'add' && !lastGiftIds.current.has(change.doc._id)) {
										if (change.doc.creatorId === partnerId) {
											callbacks.onNotification({
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
									callbacks.onNotice(latest)
									Taro.vibrateShort({ type: 'heavy' })
								}
							}
						},
						onError: (err) => console.warn('通知监听暂不可用', err)
					})
			} catch (e) {
				console.warn('监听器启动失败', e)
			}
		}, 300)
	}, [closeAll, callbacks])

	return { start, closeAll }
}
