import { useRef, useEffect, ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface FadeContentProps {
  children: ReactNode
  blur?: boolean
  duration?: number
  delay?: number
  ease?: string
  threshold?: number
  initialOpacity?: number
  className?: string
  style?: Record<string, string>
}

export default function FadeContent({
  children,
  blur = false,
  duration = 1000,
  ease = 'power2.out',
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  className = '',
  style,
  ...props
}: FadeContentProps & Record<string, unknown>) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const startPct = (1 - threshold) * 100

    gsap.set(el, {
      autoAlpha: initialOpacity,
      filter: blur ? 'blur(10px)' : 'blur(0px)',
      willChange: 'opacity, filter, transform',
    })

    const tl = gsap.timeline({
      paused: true,
      delay: typeof delay === 'number' ? delay : delay / 1000,
    })

    tl.to(el, {
      autoAlpha: 1,
      filter: 'blur(0px)',
      duration: typeof duration === 'number' ? duration : duration / 1000,
      ease,
    })

    let scroller: HTMLElement | Window = window
    {
      let p = el.parentElement
      while (p) {
        if (p.classList.contains('details-panel')) { scroller = p; break }
        p = p.parentElement
      }
    }
    const st = ScrollTrigger.create({
      trigger: el,
      start: `top ${startPct}%`,
      scroller,
      once: true,
      onEnter: () => tl.play(),
    })

    return () => {
      st.kill()
      tl.kill()
    }
  }, [blur, duration, ease, delay, threshold, initialOpacity])

  return (
    <div ref={ref} className={className} style={style} {...props}>
      {children}
    </div>
  )
}
