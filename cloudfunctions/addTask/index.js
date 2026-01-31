const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 任务发布与即时扣分逻辑
 * event: { title, points, type }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { title, points, type, targetId: customTargetId } = event

  try {
    // 性能优化：并行获取发布者资料
    const userRes = await db.collection('Users').doc(OPENID).get().catch(() => ({ data: {} }))
    const { partnerId } = userRes.data || {}

    if (!partnerId) return { success: false, message: '请先绑定伙伴' }

    const targetId = customTargetId || (type === 'reward' ? OPENID : partnerId)
    const pointsNum = Number(points)

    const newTask = {
      title,
      points: pointsNum,
      type,
      status: type === 'reward' ? 'pending' : 'done',
      creatorId: OPENID,
      targetId,
      createTime: db.serverDate()
    }

    // 性能分流：如果是奖赏任务，无需昂贵的事务处理
    if (type === 'reward') {
      const res = await db.collection('Tasks').add({ data: newTask })
      // 写入通知记录
      await db.collection('Notices').add({
        data: {
          type: 'NEW_TASK',
          title: '✨ 收到新任务',
          message: title,
          points: pointsNum,
          senderId: OPENID,
          receiverId: targetId,
          read: false,
          createTime: db.serverDate()
        }
      })
      return { success: true, id: res._id }
    }

    // 如果是惩罚任务，使用事务处理积分扣除与流水记录
    return await db.runTransaction(async transaction => {
      // 1. 原子更新积分 (inc 命令能防止并发写冲突，且比手动计算更快)
      await transaction.collection('Users').doc(targetId).update({
        data: { totalPoints: _.inc(-pointsNum) }
      })

      // 2. 记录流水
      await transaction.collection('Records').add({
        data: {
          userId: targetId,
          amount: -pointsNum,
          reason: `[惩罚] ${title}`,
          type: 'penalty',
          createTime: db.serverDate()
        }
      })

      // 3. 创建任务
      const addRes = await transaction.collection('Tasks').add({ data: newTask })

      // 4. 写入通知记录
      await transaction.collection('Notices').add({
        data: {
          type: 'NEW_TASK',
          title: '💢 收到惩罚任务',
          message: title,
          points: -pointsNum,
          senderId: OPENID,
          receiverId: targetId,
          read: false,
          createTime: db.serverDate()
        }
      })
      return { success: true, id: addRes._id }
    })
  } catch (e) {
    console.error('发布任务失败', e)
    return { success: false, error: e.message }
  }
}
