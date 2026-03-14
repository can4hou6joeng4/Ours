import { useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button, Notify } from '@taroify/core'
import UserHeaderCard from '../../components/UserHeaderCard'
import ProfileEditSheet from '../../components/ProfileEditSheet'
import BindingSheet from '../../components/BindingSheet'
import { getIconifyUrl } from '../../utils/assets'
import { useUserStore } from '../../store'
import { updateUserProfile as updateUserProfileApi } from '../../services'
import type { User } from '../../types'
import './index.scss'

export default function Me() {
  const { user: userInfo, isLoading, fetchUser, updateProfile } = useUserStore()

  const [showEditSheet, setShowEditSheet] = useState(false)
  const [tempNickname, setTempNickname] = useState('')
  const [tempAvatar, setTempAvatar] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBindingSheet, setShowBindingSheet] = useState(false)

  useDidShow(() => {
    fetchUser()
  })

  const handleOpenEdit = () => {
    // 未绑定时提示去绑定
    if (!userInfo?.partnerId) {
      setShowBindingSheet(true)
      return
    }
    setTempNickname(userInfo?.nickName || '')
    setTempAvatar(userInfo?.avatarUrl || '')
    setShowEditSheet(true)
  }

  const onChooseAvatar = (e) => {
    const { avatarUrl } = e.detail
    // 拦截取消选择的情况，不再抛出错误
    if (avatarUrl) {
      setTempAvatar(avatarUrl)
    }
  }

  const handleSaveProfile = async (): Promise<boolean> => {
    if (!tempNickname) {
      Notify.open({ type: 'warning', message: '昵称不能为空' })
      return false
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
      await updateUserProfileApi({
        nickName: tempNickname,
        avatarUrl: finalAvatarUrl
      })

      // 通过 store 同步更新
      updateProfile({ nickName: tempNickname, avatarUrl: finalAvatarUrl })
      setShowEditSheet(false)
      Taro.showToast({ title: '资料已更新', icon: 'success' })
    } catch (err) {
      console.error('保存失败', err)
      Notify.open({ type: 'danger', message: '保存失败' })
    } finally {
      setSaving(false)
      Taro.hideLoading()
    }

    return true
  }

  if (isLoading && !userInfo) return <View className='container'><Text>加载中...</Text></View>

  return (
    <View className='container'>
      {/* 个人资料卡片 */}
      <UserHeaderCard
        userInfo={userInfo}
        onEdit={handleOpenEdit}
      />


      {/* 另一半/绑定状态区 */}
      <View className='binding-section'>
        <Text className='section-label'>PARTNER INFO / 我的另一半</Text>
        <View className='binding-content'>
          {!userInfo?.partnerId ? (
            <View className='binding-guide'>
              <Text className='guide-text'>绑定另一半，开启双人互动空间</Text>
              <Button className='action-btn' onClick={(e) => {
                e.stopPropagation()
                setShowBindingSheet(true)
              }}>
                去绑定
              </Button>
            </View>
          ) : (
            <View className='partner-info-box'>
              <View className='partner-status'>
                已关联伙伴：{userInfo.partnerId.slice(-6)}
              </View>
              <View className='unbind-wrapper'>
                <Button className='unbind-btn-v2' size='mini' plain color='#BBB'>
                  解除绑定 (暂未开放)
                </Button>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 个人资料编辑抽屉 */}
      <ProfileEditSheet
        visible={showEditSheet}
        nickname={tempNickname}
        avatar={tempAvatar}
        saving={saving}
        onClose={() => setShowEditSheet(false)}
        onChangeNickname={setTempNickname}
        onChangeAvatar={setTempAvatar}
        onSave={handleSaveProfile}
      />

      {/* 绑定弹窗 */}
      <BindingSheet
        visible={showBindingSheet}
        onClose={() => setShowBindingSheet(false)}
        onSuccess={() => {
          setShowBindingSheet(false)
          // 刷新页面获取最新绑定状态
          setTimeout(() => Taro.reLaunch({ url: '/pages/me/index' }), 500)
        }}
      />
    </View>
  )
}
