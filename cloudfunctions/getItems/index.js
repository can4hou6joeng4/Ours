const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const QUERY_BATCH_SIZE = 100

async function queryAllItems(userId) {
	let skip = 0
	const result = []

	while (true) {
		const res = await db.collection('Items')
			.where({ userId })
			.orderBy('createTime', 'desc')
			.skip(skip)
			.limit(QUERY_BATCH_SIZE)
			.get()

		const batch = Array.isArray(res.data) ? res.data : []
		result.push(...batch)

		if (batch.length < QUERY_BATCH_SIZE) break
		skip += QUERY_BATCH_SIZE
	}

	return result
}

exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()

	try {
		const items = await queryAllItems(OPENID)
		return {
			success: true,
			data: items
		}
	} catch (e) {
		console.error('获取背包失败', e)
		return {
			success: false,
			error: e.message
		}
	}
}
