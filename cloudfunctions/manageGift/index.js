const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function normalizeGiftData(giftData = {}) {
  const points = Number(giftData.points)
  return {
    name: String(giftData.name || '').trim(),
    points: Number.isInteger(points) ? points : 0,
    coverImg: String(giftData.coverImg || '').trim(),
    desc: String(giftData.desc || '').trim()
  }
}

function validateGiftData(giftData) {
  if (!giftData.name) return '礼品名称不能为空'
  if (!Number.isInteger(giftData.points) || giftData.points <= 0) {
    return '积分必须是大于 0 的整数'
  }
  return ''
}

function canManageGift(gift, openid) {
  if (!gift) return false
  return gift.creatorId === openid || gift.partnerId === openid
}

/**
 * 礼品管理逻辑
 * event: { action: 'add'|'update'|'delete', giftData, giftId }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, giftData, giftId } = event

  try {
    // 优化：利用云开发自带的权限隔离，减少冗余的用户表 doc.get() 查询
    // 在小程序端已经过身份校验，此处直接执行业务逻辑以提升响应速度

    if (action === 'add') {
      const normalizedGiftData = normalizeGiftData(giftData)
      const validationMessage = validateGiftData(normalizedGiftData)
      if (validationMessage) return { success: false, message: validationMessage }

      return await db.runTransaction(async transaction => {
        const userRes = await transaction.collection('Users').doc(OPENID).get()
        const { partnerId } = userRes.data || {}

        // 1. 创建礼品记录
        const res = await transaction.collection('Gifts').add({
          data: {
            ...normalizedGiftData,
            creatorId: OPENID,
            partnerId: partnerId || null,  // 记录创建时的伴侣，用于数据隔离
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })

        // 2. 只有在有伙伴时才写入通知
        if (partnerId) {
          await transaction.collection('Notices').add({
            data: {
              type: 'NEW_GIFT',
              title: '🎁 商店上新啦',
              message: `新增了礼品：${normalizedGiftData.name}`,
              points: normalizedGiftData.points,
              senderId: OPENID,
              receiverId: partnerId,
              read: false,
              createTime: db.serverDate()
            }
          })
        }

        return { success: true, id: res._id }
      })
    }

    if (action === 'update') {
      if (!giftId) {
        return { success: false, message: 'giftId 缺失' }
      }

      const giftRes = await db.collection('Gifts').doc(giftId).get().catch(() => null)
      const gift = giftRes?.data
      if (!gift) {
        return { success: false, message: '礼品不存在' }
      }
      if (!canManageGift(gift, OPENID)) {
        return { success: false, message: '无权修改此礼品' }
      }

      const normalizedGiftData = normalizeGiftData(giftData)
      const validationMessage = validateGiftData(normalizedGiftData)
      if (validationMessage) return { success: false, message: validationMessage }

      await db.collection('Gifts').doc(giftId).update({
        data: {
          ...normalizedGiftData,
          updateTime: db.serverDate()
        }
      })
      return { success: true }
    }

    if (action === 'use') {
      const { giftName } = event
      // 使用事务确保：标记礼品已使用 + 记录交互流水
      return await db.runTransaction(async transaction => {
        await transaction.collection('Gifts').doc(giftId).update({
          data: {
            status: 'used',
            useTime: db.serverDate()
          }
        })

        await transaction.collection('Records').add({
          data: {
            userId: OPENID,
            amount: 0,
            reason: `[使用礼品] ${giftName}`,
            type: 'gift_use',
            giftId: giftId,
            createTime: db.serverDate()
          }
        })
        return { success: true }
      })
    }

    if (action === 'delete') {
      // 权限校验：创建者或伴侣可删除
      const giftRes = await db.collection('Gifts').doc(giftId).get().catch(() => null)
      const gift = giftRes?.data
      if (!gift) {
        return { success: false, message: '礼品不存在' }
      }

      if (!canManageGift(gift, OPENID)) {
        return { success: false, message: '无权删除此礼品' }
      }
      await db.collection('Gifts').doc(giftId).remove()
      return { success: true }
    }

    return { success: false, error: '未知操作' }
  } catch (e) {
    console.error('礼品管理失败', e)
    return { success: false, message: e.message || '操作失败' }
  }
}
