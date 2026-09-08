import React, { useCallback, useEffect, useRef } from 'react'

/* Small pieces shared by both kinds of account. */

export const money = (cents) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Money is stored as whole cents, so parse the string by hand rather than
// letting floating point turn $19.99 into 1998.9999999999998 cents.
export const parseCents = (text) => {
  const cleaned = String(text).replace(/[$,\s]/g, '')
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '' || cleaned === '.') return null
  const [dollars, decimals = ''] = cleaned.split('.')
  const cents = Number(dollars || 0) * 100 + Number(decimals.padEnd(2, '0'))
  return cents > 0 ? cents : null
}

export const prettyDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - date) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export const ordinal = (n) => {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
}

/* ------------------------------------------------------------- confetti --- */

const CONFETTI_COLORS = ['#1B7A43', '#3FBF6E', '#F5B301', '#FFFFFF', '#C97B3C', '#8CE0AB']

export function useConfetti() {
  const canvasRef = useRef(null)
  const bits = useRef([])
  const frame = useRef(0)

  const tick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    bits.current = bits.current.filter((b) => b.life > 0)
    for (const b of bits.current) {
      b.life -= 1
      b.vy += 0.32
      b.x += b.vx
      b.y += b.vy
      b.spin += b.spinRate
      ctx.save()
      ctx.globalAlpha = Math.min(1, b.life / 26)
      ctx.translate(b.x, b.y)
      ctx.rotate(b.spin)
      ctx.fillStyle = b.color
      ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
      ctx.restore()
    }
    frame.current = bits.current.length ? requestAnimationFrame(tick) : 0
  }, [])

  const burst = useCallback(
    (x = window.innerWidth / 2, y = window.innerHeight / 2, count = 46) => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
        const speed = 4 + Math.random() * 7
        bits.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          size: 8 + Math.random() * 8,
          spin: Math.random() * Math.PI,
          spinRate: (Math.random() - 0.5) * 0.4,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          life: 60 + Math.random() * 30
        })
      }
      if (!frame.current) frame.current = requestAnimationFrame(tick)
    },
    [tick]
  )

  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  return { canvasRef, burst }
}

/* --------------------------------------------------------------- pieces --- */

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="link-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function WindowTabs({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          className={value === o.key ? 'segment active' : 'segment'}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return <p className="centered muted">{label}</p>
}
