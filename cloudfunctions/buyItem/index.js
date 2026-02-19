const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { item } = event // { name, points, type }

  try {
    const itemName = String(item?.name || '').trim()
    const itemPoints = Math.max(0, parseInt(item?.points, 10) || 0)
    const itemImage = String(item?.image || item?.cover || '').trim()
    const itemType = String(item?.type || 'unknown')

    if (!itemName || itemPoints <= 0) {
      throw new Error('礼品信息异常')
    }

    const result = await db.runTransaction(async transaction => {
      const userRes = await transaction.collection('Users').doc(OPENID).get()
      if (!userRes.data) throw new Error('用户不存在')

      const { totalPoints } = userRes.data
      if (totalPoints < itemPoints) throw new Error('积分不足')

      // 1. 扣减积分
      await transaction.collection('Users').doc(OPENID).update({
        data: {
          totalPoints: _.inc(-itemPoints)
        }
      })

      // 2. 存入我的背包 (Items 集合)
      const itemRes = await transaction.collection('Items').add({
        data: {
          userId: OPENID,
          name: itemName,
          image: itemImage,
          type: itemType,
          status: 'unused', // unused: 待使用, used: 已使用
          createTime: db.serverDate()
        }
      })

      // 3. 写入消费记录 (Records 集合)
      await transaction.collection('Records').add({
        data: {
          itemId: itemRes._id,
          userId: OPENID,
          type: 'outcome',
          amount: itemPoints,
          reason: `兑换: ${itemName}`,
          createTime: db.serverDate()
        }
      })

      return { success: true }
    })

    return result
  } catch (e) {
    return { success: false, error: e.message }
  }
}
