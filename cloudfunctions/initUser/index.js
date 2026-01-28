const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    // 1. 检查用户是否已存在
    const userRes = await db.collection('Users').doc(OPENID).get().catch(() => null)

    if (userRes) {
      return { success: true, user: userRes.data }
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
