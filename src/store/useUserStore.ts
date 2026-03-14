import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { initUser } from '../services/user'
import type { User } from '../types'

interface UserState {
	user: User | null
	partnerId: string
	isLoading: boolean
	fetchUser: () => Promise<void>
	updateProfile: (partial: Partial<User>) => void
	clearUser: () => void
}

const CACHE_KEY = 'userInfoCache'
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟

/**
 * 全局用户状态管理
 *
 * 替代各页面独立的 smartFetchUser / getStorageSync 模式，
 * 统一管理用户数据获取、缓存和状态同步。
 */
const useUserStore = create<UserState>((set, get) => ({
	user: null,
	partnerId: Taro.getStorageSync('partnerId') || '',
	isLoading: false,

	fetchUser: async () => {
		// 1. 优先读取本地缓存快速渲染
		try {
			const cached = Taro.getStorageSync(CACHE_KEY)
			if (cached && Date.now() - cached.timestamp < CACHE_DURATION && cached.user) {
				set({
					user: cached.user,
					partnerId: cached.user.partnerId || '',
					isLoading: false,
				})
				Taro.setStorageSync('userId', cached.user._id)
				Taro.setStorageSync('partnerId', cached.user.partnerId || '')
			}
		} catch (_) {
			// 缓存读取失败，继续走云端
		}

		// 2. 后台请求云端刷新
		if (get().isLoading) return
		set({ isLoading: true })

		try {
			const result = await initUser()
			if (result?.success && result.user) {
				const user = result.user
				set({
					user,
					partnerId: user.partnerId || '',
					isLoading: false,
				})
				// 同步到本地存储
				Taro.setStorageSync('userId', user._id)
				Taro.setStorageSync('partnerId', user.partnerId || '')
				try {
					Taro.setStorageSync(CACHE_KEY, {
						user,
						todayChange: result.todayChange,
						timestamp: Date.now(),
					})
				} catch (_) {
					// 缓存写入失败不影响主流程
				}
			} else {
				set({ isLoading: false })
			}
		} catch (e) {
			console.error('获取用户信息失败', e)
			set({ isLoading: false })
		}
	},

	updateProfile: (partial) => {
		const current = get().user
		if (!current) return
		const updated = { ...current, ...partial }
		set({
			user: updated,
			partnerId: updated.partnerId || '',
		})
		// 同步缓存
		try {
			Taro.setStorageSync(CACHE_KEY, {
				user: updated,
				timestamp: Date.now(),
			})
		} catch (_) {
			// ignore
		}
	},

	clearUser: () => {
		set({ user: null, partnerId: '', isLoading: false })
		try {
			Taro.removeStorageSync(CACHE_KEY)
			Taro.removeStorageSync('userId')
			Taro.removeStorageSync('partnerId')
		} catch (_) {
			// ignore
		}
	},
}))

export default useUserStore
