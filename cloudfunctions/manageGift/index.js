const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 礼品管理逻辑
 * event: { action: 'add'|'update'|'delete', giftData, giftId }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, giftData, giftId } = event

  try {
    // 权限校验：仅允许创建者操作
    const userRes = await db.collection('Users').doc(OPENID).get()
    if (!userRes.data) throw new Error('用户不存在')

    if (action === 'add') {
      const res = await db.collection('Gifts').add({
        data: {
          ...giftData,
          creatorId: OPENID,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      return { success: true, id: res._id }
    }

    if (action === 'update') {
      await db.collection('Gifts').doc(giftId).update({
        data: {
          ...giftData,
          updateTime: db.serverDate()
        }
      })
      return { success: true }
    }

    if (action === 'delete') {
      await db.collection('Gifts').doc(giftId).remove()
      return { success: true }
    }

    return { success: false, error: '未知操作' }
  } catch (e) {
    console.error(e)
    return { success: false, error: e.message }
  }
}
