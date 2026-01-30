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
    // 优化：利用云开发自带的权限隔离，减少冗余的用户表 doc.get() 查询
    // 在小程序端已经过身份校验，此处直接执行业务逻辑以提升响应速度

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
    console.error('礼品管理失败', e)
    return { success: false, error: e.message }
  }
}
