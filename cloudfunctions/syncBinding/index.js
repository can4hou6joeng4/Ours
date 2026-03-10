const cloud = require('wx-server-sdk')
const dayjs = require('dayjs')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function findUserByInviteCode(inviteCode, currentUserId) {
  const normalizedCode = inviteCode.toUpperCase()

  const candidateRes = await db.collection('Users')
    .where({
      _id: db.RegExp({
        regexp: `${escapeRegExp(normalizedCode)}$`,
        options: 'i'
      })
    })
    .limit(20)
    .get()

  const matchedUsers = candidateRes.data.filter(user => (
    user._id !== currentUserId &&
    user._id.slice(-6).toUpperCase() === normalizedCode
  ))

  if (matchedUsers.length === 0) return { user: null, ambiguous: false }
  if (matchedUsers.length > 1) return { user: null, ambiguous: true }
  return { user: matchedUsers[0], ambiguous: false }
}

/**
 * 安全截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function safeTruncate(text, maxLength) {
  if (!text) return ''
  const strText = String(text)
  const truncated = strText.substring(0, maxLength)
  return truncated + (strText.length > maxLength ? '...' : '')
}

/**
 * 核心绑定逻辑
 * @param {Object} event - 云函数事件
 * @param {Object} context - 云函数上下文
 * @returns {Promise<Object>} 返回绑定结果
 */
exports.main = async (event, context) => {
  const { partnerCode } = event
  const { OPENID } = cloud.getWXContext()

  const normalizedCode = String(partnerCode || '').trim().toUpperCase()

  if (!normalizedCode) {
    return { success: false, message: '请输入邀请码' }
  }
  if (normalizedCode.length !== 6) {
    return { success: false, message: '邀请码格式不正确' }
  }

  try {
    const { user: targetUser, ambiguous } = await findUserByInviteCode(normalizedCode, OPENID)

    if (ambiguous) {
      return { success: false, message: '邀请码匹配到多个用户，请让对方重新分享邀请链接' }
    }

    if (!targetUser) {
      return { success: false, message: '邀请码无效或对方尚未登录' }
    }

    const partnerOpenid = targetUser._id

    const myInfo = await db.collection('Users').doc(OPENID).get()

    // 精细化绑定状态检查
    const myPartnerId = myInfo.data.partnerId
    const theirPartnerId = targetUser.partnerId

    // 场景1: 双方已经是伴侣
    if (myPartnerId === partnerOpenid && theirPartnerId === OPENID) {
      return { success: false, message: '你们已经是伴侣了 💕', alreadyBound: true }
    }

    // 场景2: 自己已绑定其他人
    if (myPartnerId && myPartnerId !== partnerOpenid) {
      return { success: false, message: '你已有伴侣，无法再次绑定' }
    }

    // 场景3: 对方已绑定其他人
    if (theirPartnerId && theirPartnerId !== OPENID) {
      return { success: false, message: '对方已有伴侣' }
    }

    // 场景4: 单向绑定异常（数据不一致），尝试修复
    if ((myPartnerId === partnerOpenid && !theirPartnerId) ||
        (!myPartnerId && theirPartnerId === OPENID)) {
      // 继续执行绑定流程来修复数据
    }

    await db.runTransaction(async transaction => {
      await transaction.collection('Users').doc(OPENID).update({
        data: { partnerId: partnerOpenid }
      })
      await transaction.collection('Users').doc(partnerOpenid).update({
        data: { partnerId: OPENID }
      })
    })

    try {
      const myInfoRes = await db.collection('Users').doc(OPENID).get()
      const nickName = safeTruncate(myInfoRes.data.nickName, 20)
      
      await cloud.openapi.subscribeMessage.send({
        touser: partnerOpenid,
        templateId: 'fnKrftUCVOwXvlo7exFmer78w_R0JfKR3evP5IxxjhE',
        page: 'pages/index/index',
        data: {
          thing1: { value: '绑定成功' },                               // 变更类型
          time3: { value: dayjs().format('YYYY年MM月DD日 HH:mm') },    // 时间
          thing2: { value: nickName || '对方' }                        // 姓名
        }
      })
    } catch (sendError) {
      console.warn('绑定成功订阅消息发送失败', sendError)
    }

    return { success: true, message: '绑定成功' }

  } catch (err) {
    console.error(err)
    return { success: false, message: '操作失败，请重试' }
  }
}
