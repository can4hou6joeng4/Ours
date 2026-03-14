const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()

	try {
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		let todayRecordsQuery = db.collection('Records').where({
			userId: OPENID,
			createTime: _.gte(today)
		})

		if (typeof todayRecordsQuery.field === 'function') {
			todayRecordsQuery = todayRecordsQuery.field({ amount: true })
		}

		const [userRes, recordsRes] = await Promise.all([
			db.collection('Users').doc(OPENID).get().catch(() => null),
			todayRecordsQuery.limit(100).get().catch(() => ({ data: [] }))
		])

		const todayRecords = Array.isArray(recordsRes.data) ? recordsRes.data : []
		const hasUser = !!(userRes && userRes.data)

		if (hasUser) {
			const todayChange = todayRecords.reduce(
				(sum, record) => sum + (record.amount || 0),
				0
			)
			return { success: true, user: userRes.data, todayChange }
		}

		const newUser = {
			_id: OPENID,
			totalPoints: 0,
			partnerId: '',
			createTime: db.serverDate()
		}

		await db.collection('Users').add({ data: newUser })
		return { success: true, user: newUser, todayChange: 0 }
	} catch (e) {
		console.error('初始化用户失败', e)
		return { success: false, message: '操作失败，请重试' }
	}
}
