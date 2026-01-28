const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const itemsRes = await db.collection('Items')
      .where({
        userId: OPENID
      })
      .orderBy('createTime', 'desc')
      .get()

    return {
      success: true,
      data: itemsRes.data
    }
  } catch (e) {
    console.error('获取背包失败', e)
    return {
      success: false,
      error: e.message
    }
  }
}
