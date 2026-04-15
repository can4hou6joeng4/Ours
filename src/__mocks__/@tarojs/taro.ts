const storage: Record<string, any> = {}

const Taro = {
  getStorageSync: jest.fn((key: string) => storage[key] ?? ''),
  setStorageSync: jest.fn((key: string, data: any) => { storage[key] = data }),
  removeStorageSync: jest.fn((key: string) => { delete storage[key] }),
  cloud: {
    init: jest.fn(),
    callFunction: jest.fn(),
  },
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  vibrateShort: jest.fn(),
  navigateTo: jest.fn(),
  reLaunch: jest.fn(),
  getSetting: jest.fn(),
  openSetting: jest.fn(),
  requestSubscribeMessage: jest.fn(),
  eventCenter: {
    on: jest.fn(),
    off: jest.fn(),
    trigger: jest.fn(),
  },
}

export default Taro
export const useDidShow = jest.fn()
export const useDidHide = jest.fn()
export const useLaunch = jest.fn()
export const useShareAppMessage = jest.fn()
export const eventCenter = Taro.eventCenter

// 测试辅助：重置 storage
export const __resetStorage = () => {
  Object.keys(storage).forEach(k => delete storage[k])
}
