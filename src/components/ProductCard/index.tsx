import { View, Text, Image } from '@tarojs/components'
import React from 'react'
import DuxCard from '../DuxCard'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

interface ProductCardProps {
  item: any
  onBuy: (item: any) => void
  onLongPress: (item: any) => void
}

const ProductCard: React.FC<ProductCardProps> = ({ item, onBuy, onLongPress }) => {
  return (
    <DuxCard
      className='product-card-v4 masonry-item'
      shadow={false}
    >
      <View
        className='card-inner-touch'
        onClick={() => onBuy(item)}
        onLongPress={() => onLongPress(item)}
      >
        <View className='card-top'>
          {item.coverImg && /^cloud:\/\//.test(item.coverImg.trim()) ? (
            <Image
              src={item.coverImg.trim()}
              mode='widthFix'
              className='product-image'
              onError={(e) => console.error('图片加载失败:', item.name, e)}
            />
          ) : (
            <View className='icon-circle'>
              <Image src={getIconifyUrl('tabler:gift', '#D4B185')} className='iconify-inner' />
            </View>
          )}
        </View>
        <View className='card-body'>
          <Text className='p-name'>{item.name}</Text>
          <Text className='p-desc'>{item.desc || '暂无描述'}</Text>
          <View className='p-footer'>
            <Text className='p-price'>{item.points} 积分</Text>
          </View>
        </View>
      </View>
    </DuxCard>
  )
}

export default ProductCard
