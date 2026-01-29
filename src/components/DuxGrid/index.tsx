import { View } from '@tarojs/components'
import './index.scss'

interface DuxGridProps {
  column?: number
  gap?: number
  children: React.ReactNode
  className?: string
}

const DuxGrid = ({ column = 2, gap = 24, children, className = '' }: DuxGridProps) => {
  return (
    <View
      className={`dux-grid-container ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${column}, 1fr)`,
        gap: `${gap}rpx`
      }}
    >
      {children}
    </View>
  )
}

export default DuxGrid
