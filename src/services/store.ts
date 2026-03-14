import { callCloud } from './cloud'
import type {
	BuyItemResponse,
	UseItemResponse,
	GetItemsResponse,
	GetGiftsResponse,
	ManageGiftResponse,
	GetExchangeHistoryResponse,
	HistoryFilter,
	ItemStatus,
} from '../types'

/** 兑换礼品（购买） */
export async function buyItem(data: {
	giftId: string
	requestId?: string
}): Promise<BuyItemResponse> {
	return callCloud<BuyItemResponse>('buyItem', data)
}

/** 使用背包物品 */
export async function useItem(data: {
	itemId: string
}): Promise<UseItemResponse> {
	return callCloud<UseItemResponse>('useItem', data)
}

/** 获取背包物品列表 */
export async function getItems(data: {
	page?: number
	pageSize?: number
	status?: ItemStatus
}): Promise<GetItemsResponse> {
	return callCloud<GetItemsResponse>('getItems', data)
}

/** 获取礼品列表 */
export async function getGifts(): Promise<GetGiftsResponse> {
	return callCloud<GetGiftsResponse>('getGifts')
}

/** 管理礼品（新增/编辑/删除） */
export async function manageGift(data: {
	action: 'add' | 'update' | 'delete'
	giftId?: string
	giftData?: {
		name: string
		points: number
		coverImg?: string
		desc?: string
	}
}): Promise<ManageGiftResponse> {
	return callCloud<ManageGiftResponse>('manageGift', data)
}

/** 获取兑换历史 */
export async function getExchangeHistory(data: {
	page?: number
	pageSize?: number
	filter?: HistoryFilter
	targetUserId?: string
}): Promise<GetExchangeHistoryResponse> {
	return callCloud<GetExchangeHistoryResponse>('getExchangeHistory', data)
}
