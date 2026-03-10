const cloud = require('wx-server-sdk')
const dayjs = require('dayjs')
const { normalizeString, normalizeOptionalRequestId } = require('../shared/validation')
const { assertItemOwner } = require('../shared/authz')
const { runWithIdempotencyTransaction } = require('../shared/idempotency')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function safeTruncate(text, maxLength) {
  if (!text) return ''
  const truncated = text.toString().substring(0, maxLength)
  return truncated + (text.toString().length > maxLength ? '...' : '')
}

function fail(message) {
  return { success: false, error: message, message }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const normalizedItemId = normalizeString(event && event.itemId)
  let requestId = ''

  try {
    if (!normalizedItemId) throw new Error('缺少物品ID')
    requestId = normalizeOptionalRequestId(event && event.requestId)
  } catch (validationError) {
    return fail(validationError.message)
  }

  try {
    const txResult = await runWithIdempotencyTransaction({
      db,
      openid: OPENID,
      scope: 'useItem',
      requestId,
      work: async transaction => {
        const itemRes = await transaction.collection('Items').doc(normalizedItemId).get().catch(() => null)
        const item = itemRes && itemRes.data ? itemRes.data : null

        assertItemOwner(item, OPENID)
        if (item.status === 'used') throw new Error('该物品已使用过了')

        const sourceGiftId = normalizeString(item.sourceGiftId)

        await transaction.collection('Items').doc(normalizedItemId).update({
          data: {
            status: 'used',
            useTime: db.serverDate()
          }
        })

        await transaction.collection('Records').add({
          data: {
            userId: OPENID,
            type: 'gift_use',
            amount: 0,
            reason: `[兑换请求] ${item.name}`,
            itemId: normalizedItemId,
            giftId: sourceGiftId || null,
            sourceGiftId: sourceGiftId || null,
            createTime: db.serverDate()
          }
        })

        let subscribePayload = null
        const userRes = await transaction.collection('Users').doc(OPENID).get().catch(() => null)
        const user = userRes && userRes.data ? userRes.data : null
        if (user && user.partnerId) {
          await transaction.collection('Notices').add({
            data: {
              itemId: normalizedItemId,
              giftId: sourceGiftId || null,
              sourceGiftId: sourceGiftId || null,
              type: 'GIFT_USED',
              title: '💝 收到使用请求',
              message: `对方想要使用：${item.name}`,
              points: 0,
              senderId: OPENID,
              receiverId: user.partnerId,
              read: false,
              createTime: db.serverDate()
            }
          })

          subscribePayload = {
            touser: user.partnerId,
            itemName: safeTruncate(item.name, 20),
            nickName: safeTruncate(user.nickName, 10) || '对方'
          }
        }

        const response = { success: true, subscribePayload }
        if (requestId) response.requestId = requestId
        return response
      }
    })

    if (!txResult.__idempotencyReplay && txResult.subscribePayload) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: txResult.subscribePayload.touser,
          templateId: 'bxIAEflde73fD0hcYRnE6LkOCtT6QlVJqb1Zr6AKcmM',
          page: 'pages/inventory/index',
          data: {
            thing31: { value: txResult.subscribePayload.itemName },
            thing24: { value: txResult.subscribePayload.nickName },
            time3: { value: dayjs().format('YYYY年MM月DD日 HH:mm') }
          }
        })
      } catch (sendError) {
        console.warn('礼品使用订阅消息发送失败', sendError)
      }
    }

    const { subscribePayload, __idempotencyReplay, ...result } = txResult || {}
    return result
  } catch (e) {
    return fail(e.message)
  }
}
