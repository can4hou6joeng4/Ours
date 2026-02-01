import { useRef, useImperativeHandle, forwardRef, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Canvas } from '@tarojs/components'
import './index.scss'

export interface ConfettiRef {
  fire: () => void
}

const Confetti = forwardRef<ConfettiRef>((_, ref) => {
  const canvasRef = useRef<any>(null)
  const particles = useRef<any[]>([])
  const animationFrame = useRef<number | null>(null)
  const ctxRef = useRef<any>(null)
  const canvasInstance = useRef<any>(null)

  const COLORS = ['#D4B185', '#EAD0A8', '#FFFFFF']

  useImperativeHandle(ref, () => ({
    fire: () => {
      if (ctxRef.current && canvasInstance.current) {
        createParticles()
        if (!animationFrame.current) {
          loop()
        }
      }
    }
  }))

  const createParticles = () => {
    const count = 60
    const canvas = canvasInstance.current
    if (!canvas) return

    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: canvas.width / 2,
        y: canvas.height * 0.6,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.7) * 20,
        radius: Math.random() * 4 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
        gravity: 0.5,
        friction: 0.98
      })
    }
  }

  const loop = () => {
    const ctx = ctxRef.current
    const canvas = canvasInstance.current
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    particles.current.forEach((p, index) => {
      p.vx *= p.friction
      p.vy *= p.friction
      p.vy += p.gravity
      p.x += p.vx
      p.y += p.vy
      p.alpha -= 0.015

      if (p.alpha <= 0) {
        particles.current.splice(index, 1)
        return
      }

      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })

    if (particles.current.length > 0) {
      animationFrame.current = canvas.requestAnimationFrame(loop)
    } else {
      animationFrame.current = null
    }
  }

  useEffect(() => {
    const query = Taro.createSelectorQuery()
    query.select('#confettiCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = Taro.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)

          canvasInstance.current = canvas
          ctxRef.current = ctx
        }
      })

    return () => {
      if (animationFrame.current) {
        if (canvasInstance.current) {
          canvasInstance.current.cancelAnimationFrame(animationFrame.current)
        }
      }
    }
  }, [])

  return (
    <Canvas
      type='2d'
      id='confettiCanvas'
      className='confetti-canvas'
    />
  )
})

export default Confetti
