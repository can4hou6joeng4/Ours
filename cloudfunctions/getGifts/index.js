const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 获取礼品列表（按伴侣关系隔离）
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    // 1. 隔离查询：只返回自己创建或伴侣创建的礼品
    const res = await db.collection('Gifts')
      .where(_.or([
        { creatorId: OPENID },
        { partnerId: OPENID }
      ]))
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()

    // 2. 图片可见性：将 cloud:// fileID 转为临时 HTTPS URL
    const gifts = res.data
    const fileIDs = gifts
      .map(g => g.coverImg)
      .filter(id => id && id.startsWith('cloud://'))

    let fileUrlMap = {}
    if (fileIDs.length > 0) {
      const urlRes = await cloud.getTempFileURL({ fileList: fileIDs })
      urlRes.fileList.forEach(item => {
        if (item.tempFileURL) {
          fileUrlMap[item.fileID] = item.tempFileURL
        }
      })
    }

    // 3. 替换 coverImg 为临时 URL
    const giftsWithUrls = gifts.map(g => ({
      ...g,
      coverImg: fileUrlMap[g.coverImg] || g.coverImg
    }))

    return { success: true, gifts: giftsWithUrls }
  } catch (e) {
    console.error('获取礼品失败', e)
    return { success: false, error: e.message }
  }
}
