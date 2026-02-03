const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 获取礼品使用记录 (基于 Notices 集合中的 GIFT_USED 类型)
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { page = 1, pageSize = 20 } = event

  try {
    // 查询当前用户发送（我使用的）或接收（对方使用的）的礼品申请
    const res = await db.collection('Notices')
      .where({
        type: 'GIFT_USED',
        _or: [
          { senderId: OPENID },
          { receiverId: OPENID }
        ]
      })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    // 处理并清洗数据
    const data = res.data.map(item => {
      // 提取礼品名称：从 "对方想要使用：XXX" 中提取
      const giftName = item.message.replace('对方想要使用：', '')

      return {
        _id: item._id,
        giftName,
        direction: item.senderId === OPENID ? 'sent' : 'received',
        createTime: item.createTime,
        read: item.read,
        title: item.title
      }
    })

    return {
      success: true,
      data
    }
  } catch (e) {
    console.error('获取礼品记录失败', e)
    return {
      success: false,
      error: e.message
    }
  }
}
