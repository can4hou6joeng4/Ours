import Taro from '@tarojs/taro'
import { callCloud } from '../../services/cloud'

jest.mock('@tarojs/taro')

describe('callCloud 云函数调用封装', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应正确调用云函数并返回结果', async () => {
    const mockResult = { success: true, data: { id: '123' } };
    (Taro.cloud.callFunction as jest.Mock).mockResolvedValue({ result: mockResult })

    const result = await callCloud('addTask', { title: '测试', points: 10 })

    expect(Taro.cloud.callFunction).toHaveBeenCalledWith({
      name: 'addTask',
      data: { title: '测试', points: 10 },
    })
    expect(result).toEqual(mockResult)
  })

  it('应在无参数时正确调用', async () => {
    const mockResult = { success: true };
    (Taro.cloud.callFunction as jest.Mock).mockResolvedValue({ result: mockResult })

    const result = await callCloud('getUserInfo')

    expect(Taro.cloud.callFunction).toHaveBeenCalledWith({
      name: 'getUserInfo',
      data: undefined,
    })
    expect(result).toEqual(mockResult)
  })

  it('应在调用失败时返回错误结果', async () => {
    (Taro.cloud.callFunction as jest.Mock).mockRejectedValue(new Error('网络超时'))

    const result = await callCloud('addTask', { title: '测试' })

    expect(result.success).toBe(false)
    expect(result.message).toBe('网络异常，请稍后重试')
  })
})
