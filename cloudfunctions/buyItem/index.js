const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function canAccessGift(gift, openid) {
  if (!gift) return false
  return gift.creatorId === openid || gift.partnerId === openid
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { giftId, item } = event // 新版传 giftId；兼容读取 item.giftId

  try {
    const normalizedGiftId = String(giftId || item?.giftId || '').trim()
    if (!normalizedGiftId) throw new Error('缺少礼品ID')

    const result = await db.runTransaction(async transaction => {
      const [userRes, giftRes] = await Promise.all([
        transaction.collection('Users').doc(OPENID).get(),
        transaction.collection('Gifts').doc(normalizedGiftId).get().catch(() => null)
      ])

      if (!userRes.data) throw new Error('用户不存在')
      const gift = giftRes?.data
      if (!gift) throw new Error('礼品不存在')
      if (!canAccessGift(gift, OPENID)) throw new Error('无权兑换该礼品')

      const itemName = String(gift.name || '').trim()
      const giftPoints = Number(gift.points)
      const itemPoints = Number.isInteger(giftPoints) ? giftPoints : 0
      const itemImage = String(gift.coverImg || '').trim()
      const itemType = 'gift'

      if (!itemName || itemPoints <= 0) throw new Error('礼品信息异常')

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
          sourceGiftId: normalizedGiftId,
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
          giftId: normalizedGiftId,
          userId: OPENID,
          type: 'outcome',
          amount: itemPoints,
          reason: `兑换: ${itemName}`,
          createTime: db.serverDate()
        }
      })

      return { success: true, itemId: itemRes._id, cost: itemPoints }
    })

    return result
  } catch (e) {
    return { success: false, error: e.message }
  }
}
