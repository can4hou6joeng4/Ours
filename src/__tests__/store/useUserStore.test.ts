import { __resetStorage } from '../../__mocks__/@tarojs/taro'

// 必须在 import store 之前 mock
jest.mock('@tarojs/taro')

// 动态导入以确保 mock 生效
import useUserStore from '../../store/useUserStore'
import Taro from '@tarojs/taro'

describe('useUserStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    __resetStorage()
    // 重置 store 状态
    useUserStore.setState({
      user: null,
      partnerId: '',
      isLoading: false,
    })
  })

  it('应有正确的初始状态', () => {
    const state = useUserStore.getState()
    expect(state.user).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  describe('updateProfile', () => {
    it('应正确更新用户资料', () => {
      // 先设置一个用户
      useUserStore.setState({
        user: {
          _id: 'user1',
          totalPoints: 100,
          partnerId: 'partner1',
          nickName: '小明',
          createTime: '2026-01-01',
        },
      })

      useUserStore.getState().updateProfile({ nickName: '大明' })

      const state = useUserStore.getState()
      expect(state.user?.nickName).toBe('大明')
      expect(state.user?.totalPoints).toBe(100) // 未修改字段保持不变
    })

    it('当用户为空时不应执行更新', () => {
      useUserStore.getState().updateProfile({ nickName: '小明' })
      expect(useUserStore.getState().user).toBeNull()
    })
  })

  describe('clearUser', () => {
    it('应清除用户状态和缓存', () => {
      useUserStore.setState({
        user: {
          _id: 'user1',
          totalPoints: 50,
          partnerId: 'p1',
          createTime: '2026-01-01',
        },
        partnerId: 'p1',
      })

      useUserStore.getState().clearUser()

      const state = useUserStore.getState()
      expect(state.user).toBeNull()
      expect(state.partnerId).toBe('')
      expect(Taro.removeStorageSync).toHaveBeenCalledWith('userInfoCache')
      expect(Taro.removeStorageSync).toHaveBeenCalledWith('userId')
      expect(Taro.removeStorageSync).toHaveBeenCalledWith('partnerId')
    })
  })

  describe('fetchUser', () => {
    it('应在加载中时跳过重复请求', async () => {
      useUserStore.setState({ isLoading: true })

      await useUserStore.getState().fetchUser()

      // 不应调用云函数
      expect(Taro.cloud.callFunction).not.toHaveBeenCalled()
    })
  })
})
