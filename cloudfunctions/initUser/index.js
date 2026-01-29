const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    // 1. 检查用户是否已存在
    const userRes = await db.collection('Users').doc(OPENID).get().catch(() => null)

    if (userRes) {
      const userData = userRes.data

      // 聚合当日积分变动
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const recordsRes = await db.collection('Records').where({
        userId: OPENID,
        createTime: _.gte(today)
      }).get()

      const todayChange = recordsRes.data.reduce((sum, record) => sum + (record.amount || 0), 0)

      return {
        success: true,
        user: userData,
        todayChange
      }
    }

    // 2. 如果不存在，则创建新用户
    // 使用 .add({ data: { _id: ... } }) 是创建指定 ID 文档的最稳妥方式
    const newUser = {
      _id: OPENID,
      totalPoints: 0,
      partnerId: '',
      createTime: db.serverDate()
    }

    await db.collection('Users').add({ data: newUser })

    return { success: true, user: newUser }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
