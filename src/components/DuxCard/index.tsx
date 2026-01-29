import { View } from '@tarojs/components'
import './index.scss'

interface DuxCardProps {
  children: React.ReactNode
  className?: string
  shadow?: boolean
  onClick?: () => void
}

const DuxCard = ({ children, className = '', shadow = true, onClick }: DuxCardProps) => {
  return (
    <View
      className={`dux-card-container ${shadow ? 'has-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </View>
  )
}

export default DuxCard
