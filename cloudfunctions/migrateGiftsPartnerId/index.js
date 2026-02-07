const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 数据迁移：为历史礼品补全 partnerId 字段
 * 一次性执行，执行完成后可删除此云函数
 */
exports.main = async () => {
  const giftsRes = await db.collection('Gifts').get()
  const gifts = giftsRes.data

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const gift of gifts) {
    // 已有 partnerId 则跳过
    if (gift.partnerId !== undefined) {
      skipped++
      continue
    }

    try {
      const userRes = await db.collection('Users').doc(gift.creatorId).get()
      const partnerId = userRes.data?.partnerId || null

      await db.collection('Gifts').doc(gift._id).update({
        data: { partnerId }
      })
      updated++
    } catch (e) {
      console.warn(`迁移礼品 ${gift._id} 失败`, e)
      failed++
    }
  }

  return {
    success: true,
    total: gifts.length,
    updated,
    skipped,
    failed
  }
}
