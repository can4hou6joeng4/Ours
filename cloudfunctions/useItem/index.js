const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { itemId } = event

  try {
    const itemRes = await db.collection('Items').doc(itemId).get()

    if (!itemRes.data || itemRes.data.userId !== OPENID) {
      throw new Error('物品不存在或无权操作')
    }

    if (itemRes.data.status === 'used') {
      throw new Error('该物品已在使用过了')
    }

    // 更新状态为已使用
    await db.collection('Items').doc(itemId).update({
      data: {
        status: 'used',
        useTime: db.serverDate()
      }
    })

    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
