import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    if (Taro.cloud) {
      Taro.cloud.init({
        env: 'cloud1-0ghgw7hf443dfb9b',
        traceUser: true,
      })
    }
  })

  return children
}

export default App
