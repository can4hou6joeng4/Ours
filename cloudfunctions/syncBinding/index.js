const cloud = require('wx-server-sdk')
const dayjs = require('dayjs')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const INVITE_CODE_LENGTH = 6
const REGEX_FALLBACK_LIMIT = 3

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function findUserByInviteCode(inviteCode, currentUserId) {
  const normalizedCode = inviteCode.toUpperCase()

  // 低风险优化：当前邀请码语义等于用户 _id 后 6 位。
  // 若当前集合主键就是 openid / 稳定用户 id，那么可先尝试 doc(candidateId) 做精确路径命中。
  // 但在现有数据结构下，我们无法安全反推出完整 _id，因此这里不强行构造 candidateId，
  // 避免误命中或引入错误绑定。
  // 长期建议：为 Users 增加独立 inviteCode 字段，并建立唯一索引，彻底替代后缀正则扫描。

  const candidateRes = await db.collection('Users')
    .where({
      _id: db.RegExp({
        regexp: `${escapeRegExp(normalizedCode)}$`,
        options: 'i'
      })
    })
    .limit(REGEX_FALLBACK_LIMIT)
    .get()

  const candidates = Array.isArray(candidateRes.data) ? candidateRes.data : []
  let matchedUser = null
  let matchedCount = 0

  for (let i = 0; i < candidates.length; i += 1) {
    const user = candidates[i]
    if (!user || user._id === currentUserId) continue
    if (String(user._id).slice(-INVITE_CODE_LENGTH).toUpperCase() !== normalizedCode) continue

    matchedCount += 1
    if (matchedCount === 1) {
      matchedUser = user
    } else {
      return { user: null, ambiguous: true }
    }
  }

  if (matchedCount === 0) return { user: null, ambiguous: false }
  return { user: matchedUser, ambiguous: false }
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
  if (normalizedCode.length !== INVITE_CODE_LENGTH) {
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
          thing1: { value: '绑定成功' },
          time3: { value: dayjs().format('YYYY年MM月DD日 HH:mm') },
          thing2: { value: nickName || '对方' }
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
