const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 获取礼品列表（按伴侣关系隔离）
 *
 * 索引依赖（云开发控制台建议建立）：
 * - Gifts: { creatorId: 1, createTime: -1 }
 * - Gifts: { partnerId: 1, createTime: -1 }
 *
 * 说明：当前 where(_.or([...])) 会分别命中 creatorId / partnerId 条件，
 * 依赖上述索引避免全表扫描。
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const startedAt = Date.now()
  const mark = (label, extra = {}) => console.log('[perf]', 'getGifts', label, { ms: Date.now() - startedAt, ...extra })

  try {
    mark('start')
    const res = await db.collection('Gifts')
      .where(_.or([
        { creatorId: OPENID },
        { partnerId: OPENID }
      ]))
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()

    const gifts = Array.isArray(res.data) ? res.data : []
    mark('query_done', { count: gifts.length })

    const fileIDs = []
    const seenFileIDs = new Set()

    for (let i = 0; i < gifts.length; i += 1) {
      const coverImg = gifts[i] && gifts[i].coverImg
      if (!coverImg || typeof coverImg !== 'string') continue
      if (coverImg.startsWith('https://')) continue
      if (!coverImg.startsWith('cloud://')) continue
      if (seenFileIDs.has(coverImg)) continue
      seenFileIDs.add(coverImg)
      fileIDs.push(coverImg)
    }
    mark('collect_fileids_done', { count: fileIDs.length })

    const fileUrlMap = Object.create(null)
    if (fileIDs.length > 0) {
      const urlRes = await cloud.getTempFileURL({ fileList: fileIDs })
      const tempFileList = Array.isArray(urlRes.fileList) ? urlRes.fileList : []
      for (let i = 0; i < tempFileList.length; i += 1) {
        const item = tempFileList[i]
        if (item && item.fileID && item.tempFileURL) {
          fileUrlMap[item.fileID] = item.tempFileURL
        }
      }
      mark('get_temp_urls_done', { count: tempFileList.length })
    } else {
      mark('get_temp_urls_done', { count: 0 })
    }

    for (let i = 0; i < gifts.length; i += 1) {
      const gift = gifts[i]
      const coverImg = gift && gift.coverImg
      if (!coverImg || typeof coverImg !== 'string') continue
      if (coverImg.startsWith('https://')) continue
      if (!coverImg.startsWith('cloud://')) continue
      if (fileUrlMap[coverImg]) {
        gift.coverImg = fileUrlMap[coverImg]
      }
    }
    mark('replace_urls_done', { count: gifts.length })
    mark('total_done', { count: gifts.length })

    return { success: true, gifts }
  } catch (e) {
    console.error('获取礼品失败', e)
    return { success: false, message: '操作失败，请重试' }
  }
}
