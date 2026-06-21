import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { type PageType } from './types'
import './Dock.css'

const navItems: { id: PageType; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '▦', label: 'Dashboard' },
  { id: 'services', icon: '⬡', label: 'Services' },
  { id: 'dependencies', icon: '⇌', label: 'Dependencies' },
  { id: 'checks', icon: '✓', label: 'Checks' },
]

export function TextType({ texts }: { texts: string[] }) {
  const [displayed, setDisplayed] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [charIdx, setCharIdx] = useState(0)
  const [textIdx, setTextIdx] = useState(0)
  const currentText = texts[textIdx]

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (isDeleting) {
      if (displayed === '') {
        setIsDeleting(false)
        setCharIdx(0)
        setTextIdx(p => (p + 1) % texts.length)
      } else {
        timer = setTimeout(() => setDisplayed(p => p.slice(0, -1)), 35)
      }
    } else {
      if (charIdx < currentText.length) {
        timer = setTimeout(() => {
          setDisplayed(p => p + currentText[charIdx])
          setCharIdx(p => p + 1)
        }, 70)
      } else {
        timer = setTimeout(() => setIsDeleting(true), 2500)
      }
    }
    return () => clearTimeout(timer)
  }, [displayed, isDeleting, charIdx, textIdx, currentText, texts])

  return (
    <span className="dock-text-type">
      <span>{displayed}</span>
      <motion.span
        className="text-type__cursor"
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
      >|</motion.span>
    </span>
  )
}

export default function Dock({
  page,
  setPage,
}: {
  page: PageType
  setPage: (p: PageType) => void
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <div className="dock-outer">
      <div
        className={`dock-panel${hoveredIdx !== null ? ' hovered' : ''}`}
        onMouseLeave={() => setHoveredIdx(null)}
        role="toolbar"
        aria-label="Application dock"
      >
        <div className="dock-divider" aria-hidden="true" />

        {/* Nav items */}
        {navItems.map((item, i) => (
          <button
            key={item.id}
            className={`dock-item${page === item.id ? ' active' : ''}${hoveredIdx === i ? ' hovered' : ''}`}
            onClick={() => setPage(item.id)}
            onMouseEnter={() => setHoveredIdx(i)}
            aria-label={item.label}
          >
            <span className="hover-circle" aria-hidden="true" />
            <span className="icon-stack">
              <span className="dock-item-icon">{item.icon}</span>
              <span className="dock-item-icon-hover" aria-hidden="true">{item.icon}</span>
            </span>
            <span className="dock-label">{item.label}</span>
          </button>
        ))}

        <div className="dock-divider" aria-hidden="true" />

        {/* Util: Profile */}
        <button className="dock-util-item" aria-label="Profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        {/* Util: Settings */}
        <button className="dock-util-item" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </div>
  )
}
