import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button, Image, Input } from '@tarojs/components'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

export default function Me() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [tempNickname, setTempNickname] = useState('')
  const [tempAvatar, setTempAvatar] = useState('')
  const [saving, setSaving] = useState(false)

  useDidShow(() => {
    fetchUserInfo()
  })

  const handleOpenEdit = () => {
    setTempNickname(userInfo?.nickName || '')
    setTempAvatar(userInfo?.avatarUrl || '')
    setShowEditSheet(true)
  }

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

  const onChooseAvatar = (e) => {
    const { avatarUrl } = e.detail
    // 拦截取消选择的情况，不再抛出错误
    if (avatarUrl) {
      setTempAvatar(avatarUrl)
    }
  }

  const handleSaveProfile = async () => {
    if (!tempNickname) {
      Taro.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      let finalAvatarUrl = userInfo?.avatarUrl

      // 1. 如果头像发生了变化（且是临时路径），则执行上传
      if (tempAvatar && tempAvatar !== userInfo?.avatarUrl && !tempAvatar.startsWith('cloud://')) {
        Taro.showLoading({ title: '正在上传头像...' })
        const suffix = /\.[^\.]+$/.exec(tempAvatar)?.[0] || '.png'
        const uploadRes = await Taro.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(-6)}${suffix}`,
          filePath: tempAvatar
        })
        finalAvatarUrl = uploadRes.fileID
      }

      // 2. 统一更新用户资料
      Taro.showLoading({ title: '正在保存...' })
      await Taro.cloud.callFunction({
        name: 'updateUserProfile',
        data: {
          nickName: tempNickname,
          avatarUrl: finalAvatarUrl
        }
      })

      setUserInfo({ ...userInfo, nickName: tempNickname, avatarUrl: finalAvatarUrl })
      setShowEditSheet(false)
      Taro.showToast({ title: '资料已更新', icon: 'success' })
    } catch (err) {
      console.error('保存失败', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
      Taro.hideLoading()
    }
  }

  if (loading) return <View className='container'><Text>加载中...</Text></View>

  return (
    <View className='container'>
      {/* 个人资料卡片 (去除多余图标) */}
      <View className='user-card' onClick={handleOpenEdit}>
        <View className='avatar-placeholder'>
          {userInfo?.avatarUrl ? (
            <Image src={userInfo.avatarUrl} className='avatar-image' mode='aspectFill' />
          ) : (
            <Image src={getIconifyUrl('tabler:user-circle', '#D4B185')} className='avatar-icon' />
          )}
        </View>
        <View className='info'>
          <Text className='nickname-display'>
            {userInfo?.nickName || (userInfo?.partnerId ? 'PREMIUM USER' : 'GUEST')}
          </Text>
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
              <Button className='action-btn' onClick={(e) => {
                e.stopPropagation()
                Taro.navigateTo({ url: '/pages/binding/index' })
              }}>
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

      {/* 个人资料编辑抽屉 (对齐礼品编辑风格) */}
      {showEditSheet && (
        <View className='edit-sheet-root' onClick={() => !saving && setShowEditSheet(false)}>
          <View className='sheet-content' onClick={e => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='title'>个人资料设置</Text>
              <View className='close' onClick={() => !saving && setShowEditSheet(false)}>×</View>
            </View>

            <View className='sheet-body'>
              <View className='profile-edit-box'>
                <Button
                  className='avatar-edit-btn'
                  openType='chooseAvatar'
                  onChooseAvatar={onChooseAvatar}
                >
                  <View className='avatar-preview'>
                    {tempAvatar ? (
                      <Image src={tempAvatar} className='img' mode='aspectFill' />
                    ) : (
                      <Image src={getIconifyUrl('tabler:camera', '#D4B185')} className='icon' />
                    )}
                    <View className='upload-badge'>更换头像</View>
                  </View>
                </Button>

                <View className='nickname-edit-area'>
                  <Text className='label'>修改昵称</Text>
                  <Input
                    type='nickname'
                    className='input'
                    value={tempNickname}
                    onInput={e => setTempNickname(e.detail.value)}
                    onBlur={e => setTempNickname(e.detail.value)}
                    placeholder='输入你的专属昵称'
                  />
                </View>
              </View>
            </View>

            <View className='sheet-footer'>
              <Button
                className='save-btn'
                loading={saving}
                onClick={handleSaveProfile}
              >
                保存资料
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
