const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 【云开发控制台索引建议】
// 集合：Items
// 建议索引：{ userId: 1, status: 1, createTime: -1 }
// 若不方便建立联合索引，至少保证 { userId: 1, createTime: -1 }

exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()
	const rawPage = Number(event && event.page)
	const rawPageSize = Number(event && event.pageSize)
	const status = event && event.status
	const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
	const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 20

	try {
		const where = { userId: OPENID }
		if (status === 'unused' || status === 'used') {
			where.status = status
		}

		const res = await db.collection('Items')
			.where(where)
			.orderBy('createTime', 'desc')
			.skip((page - 1) * pageSize)
			.limit(pageSize)
			.get()

		const data = Array.isArray(res.data) ? res.data : []
		return {
			success: true,
			data,
			page,
			pageSize,
			hasMore: data.length >= pageSize
		}
	} catch (e) {
		console.error('获取背包失败', e)
		return {
			success: false,
			message: '操作失败，请重试'
		}
	}
}
