const crypto = require('crypto')
const { ensure, normalizeOptionalRequestId, normalizeString } = require('./validation')

function buildIdempotencyDocId(scope, openid, requestId) {
	const normalizedScope = normalizeString(scope) || 'unknown'
	const digest = crypto
		.createHash('sha1')
		.update(`${normalizedScope}:${openid}:${requestId}`)
		.digest('hex')
	return `idem_${normalizedScope}_${digest}`
}

async function runWithIdempotencyTransaction(options) {
	const { db, openid, scope, requestId, work } = options || {}
	ensure(db, 'db 实例缺失')
	ensure(openid, 'openid 缺失')
	ensure(scope, 'scope 缺失')
	ensure(typeof work === 'function', 'work 必须是函数')

	const normalizedRequestId = normalizeOptionalRequestId(requestId)
	const enableIdempotency = Boolean(normalizedRequestId)

	const wrapped = await db.runTransaction(async transaction => {
		if (!enableIdempotency) {
			const response = await work(transaction, { requestId: '' })
			return { replay: false, response }
		}

		const docId = buildIdempotencyDocId(scope, openid, normalizedRequestId)
		const idemRef = transaction.collection('RequestIdempotency').doc(docId)
		const idemRes = await idemRef.get().catch(() => null)
		const idemData = idemRes && idemRes.data ? idemRes.data : null

		if (idemData && idemData.status === 'done' && idemData.response) {
			return { replay: true, response: idemData.response }
		}
		if (idemData && idemData.status === 'processing') {
			throw new Error('请求正在处理中，请稍后重试')
		}

		await idemRef.set({
			data: {
				scope,
				openid,
				requestId: normalizedRequestId,
				status: 'processing',
				createTime: db.serverDate(),
				updateTime: db.serverDate()
			}
		})

		const response = await work(transaction, { requestId: normalizedRequestId })

		await idemRef.update({
			data: {
				status: 'done',
				response,
				updateTime: db.serverDate()
			}
		})

		return { replay: false, response }
	})

	const finalResponse = Object.assign({}, wrapped.response)
	if (enableIdempotency && !Object.prototype.hasOwnProperty.call(finalResponse, 'requestId')) {
		finalResponse.requestId = normalizedRequestId
	}
	finalResponse.__idempotencyReplay = Boolean(wrapped.replay)
	return finalResponse
}

module.exports = {
	buildIdempotencyDocId,
	runWithIdempotencyTransaction
}
