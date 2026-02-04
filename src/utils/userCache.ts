/**
 * 用户信息缓存工具
 * 避免每个页面都调用 initUser 云函数导致冷启动延迟
 */
import Taro from '@tarojs/taro'

const CACHE_KEY = 'userInfoCache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 分钟缓存有效期

interface CachedUserInfo {
  user: any
  todayChange?: number
  timestamp: number
}

/**
 * 获取缓存的用户信息
 */
export const getCachedUser = (): CachedUserInfo | null => {
  try {
    const cached = Taro.getStorageSync(CACHE_KEY)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached
    }
  } catch (e) {
    console.error('读取用户缓存失败', e)
  }
  return null
}

/**
 * 设置用户信息缓存
 */
export const setCachedUser = (user: any, todayChange?: number) => {
  try {
    Taro.setStorageSync(CACHE_KEY, {
      user,
      todayChange,
      timestamp: Date.now()
    })
  } catch (e) {
    console.error('设置用户缓存失败', e)
  }
}

/**
 * 清除用户缓存 (用于登出或强制刷新)
 */
export const clearUserCache = () => {
  try {
    Taro.removeStorageSync(CACHE_KEY)
  } catch (e) {
    console.error('清除用户缓存失败', e)
  }
}

/**
 * 智能获取用户信息
 * 优先使用缓存，后台静默刷新
 */
export const smartFetchUser = async (options?: {
  forceRefresh?: boolean
  onCacheHit?: (cached: CachedUserInfo) => void
  onFresh?: (result: any) => void
}): Promise<any> => {
  const { forceRefresh = false, onCacheHit, onFresh } = options || {}

  // 1. 尝试使用缓存
  if (!forceRefresh) {
    const cached = getCachedUser()
    if (cached) {
      onCacheHit?.(cached)
      // 后台静默刷新
      refreshUserInBackground(onFresh)
      return { success: true, user: cached.user, todayChange: cached.todayChange, fromCache: true }
    }
  }

  // 2. 缓存失效或强制刷新，直接请求
  return await fetchUserFromCloud(onFresh)
}

/**
 * 从云端获取用户信息
 */
const fetchUserFromCloud = async (onFresh?: (result: any) => void): Promise<any> => {
  try {
    const { result }: any = await Taro.cloud.callFunction({ name: 'initUser' })
    if (result?.success) {
      setCachedUser(result.user, result.todayChange)
      onFresh?.(result)
    }
    return result
  } catch (e) {
    console.error('获取用户信息失败', e)
    return { success: false }
  }
}

/**
 * 后台静默刷新
 */
const refreshUserInBackground = (onFresh?: (result: any) => void) => {
  // 使用 setTimeout 确保不阻塞主线程
  setTimeout(async () => {
    await fetchUserFromCloud(onFresh)
  }, 100)
}
