const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { itemId } = event

  try {
    return await db.runTransaction(async transaction => {
      const itemRes = await transaction.collection('Items').doc(itemId).get()

      if (!itemRes.data || itemRes.data.userId !== OPENID) {
        throw new Error('物品不存在或无权操作')
      }

      if (itemRes.data.status === 'used') {
        throw new Error('该物品已在使用过了')
      }

      // 1. 更新状态为已使用
      await transaction.collection('Items').doc(itemId).update({
        data: {
          status: 'used',
          useTime: db.serverDate()
        }
      })

      // 2. 写入一条交互流水，用于触发对方的 Notify 提醒
      await transaction.collection('Records').add({
        data: {
          userId: OPENID,
          type: 'gift_use',
          amount: 0,
          reason: `[兑换请求] ${itemRes.data.name}`,
          giftId: itemId,
          createTime: db.serverDate()
        }
      })

      // 3. 写入正式通知，用于首页仪式感弹窗
      const userRes = await transaction.collection('Users').doc(OPENID).get()
      if (userRes.data && userRes.data.partnerId) {
        await transaction.collection('Notices').add({
          data: {
            type: 'GIFT_USED',
            title: '💝 收到使用请求',
            message: `对方想要使用：${itemRes.data.name}`,
            points: 0,
            senderId: OPENID,
            receiverId: userRes.data.partnerId,
            read: false,
            createTime: db.serverDate()
          }
        })
      }

      return { success: true }
    })
  } catch (e) {
    return { success: false, error: e.message }
  }
}
