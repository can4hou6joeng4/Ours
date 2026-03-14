import { useState, useCallback } from 'react'
import { getExchangeHistory as getExchangeHistoryApi } from '../services'
import type { ExchangeHistoryItem, HistoryFilter } from '../types'

const PAGE_SIZE = 20

interface UseExchangeHistoryOptions {
	targetUserId?: string
}

export default function useExchangeHistory(options: UseExchangeHistoryOptions = {}) {
	const [historyList, setHistoryList] = useState<ExchangeHistoryItem[]>([])
	const [historyLoading, setHistoryLoading] = useState(false)
	const [historyPage, setHistoryPage] = useState(1)
	const [hasMoreHistory, setHasMoreHistory] = useState(true)
	const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')

	const loadHistory = useCallback(async ({
		reset = false,
		filter,
	}: {
		reset?: boolean
		filter?: HistoryFilter
	} = {}) => {
		if (historyLoading) return
		const activeFilter = filter ?? historyFilter
		if (!hasMoreHistory && !reset) return

		setHistoryLoading(true)
		try {
			const requestPage = reset ? 1 : historyPage
			const result = await getExchangeHistoryApi({
				page: requestPage,
				pageSize: PAGE_SIZE,
				filter: activeFilter,
				targetUserId: options.targetUserId,
			})

			if (result.success) {
				const nextData = Array.isArray(result.data) ? result.data : []
				setHistoryList(prev => (reset ? nextData : [...prev, ...nextData]))
				setHasMoreHistory(nextData.length >= PAGE_SIZE)
				setHistoryPage(requestPage + 1)
			}
		} catch (e) {
			console.error('加载兑换历史失败', e)
		} finally {
			setHistoryLoading(false)
		}
	}, [historyLoading, hasMoreHistory, historyPage, historyFilter, options.targetUserId])

	const changeFilter = useCallback((filter: HistoryFilter) => {
		setHistoryFilter(filter)
		setHistoryPage(1)
		setHasMoreHistory(true)
		// 需要通过 reset + filter 参数调用，因为 state 未立即更新
		loadHistory({ reset: true, filter })
	}, [loadHistory])

	const openHistory = useCallback(() => {
		loadHistory({ reset: true, filter: historyFilter })
	}, [loadHistory, historyFilter])

	return {
		historyList,
		historyLoading,
		hasMoreHistory,
		historyFilter,
		loadHistory,
		changeFilter,
		openHistory,
	}
}
