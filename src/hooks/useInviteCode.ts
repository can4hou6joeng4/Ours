import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'

interface UseInviteCodeOptions {
	partnerId: string
}

export default function useInviteCode({ partnerId }: UseInviteCodeOptions) {
	const [inviteCode, setInviteCode] = useState('')
	const [showInviteConfirm, setShowInviteConfirm] = useState(false)
	const inviteChecked = useRef(false)

	useEffect(() => {
		if (inviteChecked.current) return
		inviteChecked.current = true

		const launchOptions = Taro.getLaunchOptionsSync()
		const code = launchOptions.query?.inviteCode

		if (code && !partnerId) {
			setInviteCode(code.toUpperCase())
			setShowInviteConfirm(true)
		}
	}, [partnerId])

	const closeInviteConfirm = () => setShowInviteConfirm(false)

	return {
		inviteCode,
		showInviteConfirm,
		closeInviteConfirm,
	}
}
