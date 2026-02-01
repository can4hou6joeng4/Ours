const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { item } = event // { name, points, type }

  try {
    const result = await db.runTransaction(async transaction => {
      const userRes = await transaction.collection('Users').doc(OPENID).get()
      if (!userRes.data) throw new Error('用户不存在')

      const { totalPoints } = userRes.data
      if (totalPoints < item.points) throw new Error('积分不足')

      // 1. 扣减积分
      await transaction.collection('Users').doc(OPENID).update({
        data: {
          totalPoints: _.inc(-item.points)
        }
      })

      // 2. 写入消费记录 (Records 集合)
      await transaction.collection('Records').add({
        data: {
          userId: OPENID,
          type: 'outcome',
          amount: item.points,
          reason: `兑换: ${item.name}`,
          createTime: db.serverDate()
        }
      })

      // 3. 存入我的背包 (Items 集合)
      await transaction.collection('Items').add({
        data: {
          userId: OPENID,
          name: item.name,
          image: item.image || item.cover || '', // 同步存入图片字段
          type: item.type || 'unknown',
          status: 'unused', // unused: 待使用, used: 已使用
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
