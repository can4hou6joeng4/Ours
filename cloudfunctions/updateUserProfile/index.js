const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 更新用户资料
 * event: { avatarUrl, nickName }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { avatarUrl, nickName } = event

  try {
    const updateData = {}
    if (avatarUrl) updateData.avatarUrl = avatarUrl
    if (nickName) updateData.nickName = nickName

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: '无更新内容' }
    }

    await db.collection('Users').doc(OPENID).update({
      data: updateData
    })

    return { success: true }
  } catch (e) {
    console.error(e)
    return { success: false, error: e.message }
  }
}
