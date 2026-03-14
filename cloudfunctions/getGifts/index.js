const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 获取礼品列表（按伴侣关系隔离）
 *
 * 索引建议：
 * - Gifts: { creatorId: 1, createTime: -1 }
 * - Gifts: { partnerId: 1, createTime: -1 }
 *
 * 性能优化：不再服务端调用 getTempFileURL 换签，
 * 小程序 Image 组件原生支持 cloud:// 文件 ID。
 */
exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()

	try {
		const res = await db.collection('Gifts')
			.where(_.or([
				{ creatorId: OPENID },
				{ partnerId: OPENID }
			]))
			.orderBy('createTime', 'desc')
			.limit(100)
			.get()

		const gifts = Array.isArray(res.data) ? res.data : []
		return { success: true, gifts }
	} catch (e) {
		console.error('获取礼品失败', e)
		return { success: false, message: '操作失败，请重试' }
	}
}
