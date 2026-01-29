import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button, Image, Input } from '@tarojs/components'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

export default function Me() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    fetchUserInfo()
  })

  const fetchUserInfo = async () => {
    setLoading(true)
    try {
      const res = await Taro.cloud.callFunction({ name: 'initUser' })
      const data = res.result as any
      if (data.success) {
        setUserInfo(data.user)
      }
    } catch (e) {
      console.error('获取用户信息失败', e)
    } finally {
      setLoading(false)
    }
  }

  const onChooseAvatar = async (e) => {
    const { avatarUrl } = e.detail
    Taro.showLoading({ title: '上传中' })

    try {
      // 1. 上传到云存储
      const suffix = /\.[^\.]+$/.exec(avatarUrl)?.[0] || '.png'
      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(-6)}${suffix}`,
        filePath: avatarUrl
      })

      // 2. 更新到数据库
      await Taro.cloud.callFunction({
        name: 'updateUserProfile',
        data: { avatarUrl: uploadRes.fileID }
      })

      setUserInfo({ ...userInfo, avatarUrl: uploadRes.fileID })
      Taro.showToast({ title: '头像已更新' })
    } catch (err) {
      console.error('上传头像失败', err)
      Taro.showToast({ title: '更新失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const onNicknameBlur = async (e) => {
    const nickName = e.detail.value
    if (!nickName || nickName === userInfo?.nickName) return

    try {
      await Taro.cloud.callFunction({
        name: 'updateUserProfile',
        data: { nickName }
      })
      setUserInfo({ ...userInfo, nickName })
      Taro.showToast({ title: '昵称已更新' })
    } catch (err) {
      console.error('更新昵称失败', err)
    }
  }

  if (loading) return <View className='container'><Text>加载中...</Text></View>

  return (
    <View className='container'>
      {/* 个人资料卡片 (黑金风格) */}
      <View className='user-card'>
        <Button
          className='avatar-wrapper'
          openType='chooseAvatar'
          onChooseAvatar={onChooseAvatar}
        >
          <View className='avatar-placeholder'>
            {userInfo?.avatarUrl ? (
              <Image src={userInfo.avatarUrl} className='avatar-image' mode='aspectFill' />
            ) : (
              <Image src={getIconifyUrl('tabler:user-circle', '#D4B185')} className='avatar-icon' />
            )}
          </View>
        </Button>
        <View className='info'>
          <Input
            type='nickname'
            className='nickname-input'
            value={userInfo?.nickName || (userInfo?.partnerId ? 'PREMIUM USER' : 'GUEST')}
            onBlur={onNicknameBlur}
            onConfirm={onNicknameBlur}
            placeholder='点击设置昵称'
          />
          <Text className={`points ${(userInfo?.totalPoints || 0) < 0 ? 'negative' : ''}`}>
            积分资产：{userInfo?.totalPoints || 0}
          </Text>
        </View>
      </View>

      {/* 另一半/绑定状态区 */}
      <View className='binding-section'>
        <Text className='section-label'>PARTNER INFO / 我的另一半</Text>
        <View className='binding-content'>
          {!userInfo?.partnerId ? (
            <View className='binding-guide'>
              <Text className='guide-text'>绑定另一半，开启双人互动空间</Text>
              <Button className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}>
                去绑定
              </Button>
            </View>
          ) : (
            <View className='partner-info-box'>
              <View className='partner-status'>
                已关联伙伴：{userInfo.partnerId.slice(-6)}
              </View>
              <Button className='unbind-btn'>解除绑定 (暂未开放)</Button>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
