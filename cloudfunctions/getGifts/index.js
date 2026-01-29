const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 获取礼品列表
 */
exports.main = async (event, context) => {
  try {
    const res = await db.collection('Gifts')
      .orderBy('createTime', 'desc')
      .get()

    return { success: true, gifts: res.data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
