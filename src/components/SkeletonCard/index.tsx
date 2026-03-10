import type { FC, PropsWithChildren } from 'react'
import { Skeleton } from '@taroify/core'
import type { SkeletonProps } from '@taroify/core/skeleton/skeleton.shared'
import './index.scss'

interface SkeletonCardProps extends Pick<SkeletonProps, 'row' | 'rowWidth' | 'title' | 'avatar'> {
	loading: boolean
	className?: string
}

const SkeletonCard: FC<PropsWithChildren<SkeletonCardProps>> = ({
	loading,
	className,
	children,
	row = 3,
	rowWidth = '100%',
	title = true,
	avatar = false
}) => {
	const cls = ['skeleton-card', className].filter(Boolean).join(' ')

	return (
		<Skeleton
			className={cls}
			loading={loading}
			row={row}
			rowWidth={rowWidth}
			title={title}
			avatar={avatar}
			animate
			round
		>
			{children}
		</Skeleton>
	)
}

export default SkeletonCard
