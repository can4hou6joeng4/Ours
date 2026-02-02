const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 核心绑定逻辑
 * event.partnerCode: 对方的邀请码 (OpenID 后 6 位)
 */
exports.main = async (event, context) => {
  const { partnerCode } = event
  const { OPENID } = cloud.getWXContext()

  if (!partnerCode) {
    return { success: false, message: '请输入邀请码' }
  }

  try {
    // 1. 获取所有用户来匹配邀请码 (在 Users 集合中)
    const partnerRes = await db.collection('Users').get()

    // 匹配 OpenID 后 6 位
    const targetUser = partnerRes.data.find(u =>
      u._id !== OPENID && u._id.slice(-6).toUpperCase() === partnerCode.toUpperCase()
    )

    if (!targetUser) {
      return { success: false, message: '邀请码无效或对方尚未登录' }
    }

    const partnerOpenid = targetUser._id

    // 2. 检查绑定状态
    const myInfo = await db.collection('Users').doc(OPENID).get()
    if (myInfo.data.partnerId || targetUser.partnerId) {
      return { success: false, message: '一方已存在绑定关系' }
    }

    // 3. 事务处理原子绑定
    await db.runTransaction(async transaction => {
      await transaction.collection('Users').doc(OPENID).update({
        data: { partnerId: partnerOpenid }
      })
      await transaction.collection('Users').doc(partnerOpenid).update({
        data: { partnerId: OPENID }
      })
    })

    // 4. 发送订阅消息通知对方 (被动方)
    try {
      const myInfoRes = await db.collection('Users').doc(OPENID).get()
      await cloud.openapi.subscribeMessage.send({
        touser: partnerOpenid,
        templateId: 'fnKrftUCVOwXvlo7exFmer78w_R0JfKR3evP5IxxjhE', // 关系绑定状态更新提醒
        page: 'pages/index/index',
        data: {
          thing1: { value: '已成功建立绑定关系' },
          time3: { value: new Date().toLocaleString() },
          name2: { value: myInfoRes.data.nickName || '对方' }
        }
      })
    } catch (sendError) {
      console.warn('绑定成功订阅消息发送失败', sendError)
    }

    return { success: true, message: '绑定成功' }

  } catch (err) {
    console.error(err)
    return { success: false, message: '错误: ' + err.message }
  }
}
