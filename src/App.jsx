import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ---------------------------------------------------------------- data --- */

const PER_VISIT = 20
const STORAGE_KEY = 'cleburne-regulars-v1'

const SEED_NAMES = [
  'Chicken-Fried Chuck',
  'Meatloaf Maureen',
  'Two-Plate Pete',
  'Gravy Gary',
  'Sweet Tea Sue',
  'Cornbread Connie',
  'Jell-O Jerry',
  'Pie-Slice Phil',
  'Casserole Carl',
  'Second-Helping Sally'
]

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

const freshState = () => ({
  people: SEED_NAMES.map((name) => ({ id: newId(), name, visits: 0 })),
  daily: {},
  lastVisit: null
})

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const saved = JSON.parse(raw)
    if (!Array.isArray(saved.people)) return freshState()
    return {
      people: saved.people.map((p) => ({
        id: p.id || newId(),
        name: String(p.name || 'Somebody'),
        visits: Math.max(0, Number(p.visits) || 0)
      })),
      daily: saved.daily && typeof saved.daily === 'object' ? saved.daily : {},
      lastVisit: saved.lastVisit || null
    }
  } catch {
    return freshState()
  }
}

const money = (n) => '$' + n.toLocaleString('en-US')

/* ------------------------------------------------------------ confetti --- */

const CONFETTI_COLORS = ['#1B7A43', '#3FBF6E', '#F5B301', '#FFFFFF', '#C97B3C', '#8CE0AB']

function useConfetti() {
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
    (x, y) => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)

      for (let i = 0; i < 46; i++) {
        const angle = (Math.PI * 2 * i) / 46 + Math.random() * 0.4
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

/* ------------------------------------------------------------- screens --- */

function Leaderboard({ people, todayVisits, allTime }) {
  const ranked = useMemo(
    () => [...people].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name)),
    [people]
  )
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="screen">
      <div className="scoreboard">
        <div className="scoreboard-item">
          <span className="scoreboard-value">{money(allTime * PER_VISIT)}</span>
          <span className="scoreboard-label">All-time revenue tracked</span>
        </div>
        <div className="scoreboard-item">
          <span className="scoreboard-value">{money(todayVisits * PER_VISIT)}</span>
          <span className="scoreboard-label">Logged today</span>
        </div>
      </div>

      {ranked.every((p) => p.visits === 0) && (
        <p className="empty-note">Nobody has eaten yet. Go to Check In and start the race! 🍽️</p>
      )}

      <ol className="list">
        {ranked.map((p, i) => (
          <li key={p.id} className={`row rank-${i + 1}`}>
            <span className="rank">{i < 3 && p.visits > 0 ? medals[i] : i + 1}</span>
            <span className="row-main">
              <span className="row-name">{p.name}</span>
              <span className="row-sub">
                {p.visits} {p.visits === 1 ? 'visit' : 'visits'}
              </span>
            </span>
            <span className="row-money">{money(p.visits * PER_VISIT)}</span>
          </li>
        ))}
      </ol>
      <p className="footnote">Every plate counts as {money(PER_VISIT)}. Approximately. Probably. 🍗</p>
    </div>
  )
}

function Attendance({ people, onVisit, onDelete, editing, setEditing, popId, popKey }) {
  const sorted = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name)), [people])

  return (
    <div className="screen screen-checkin">
      <div className="section-head">
        <h2 className="section-title">Who just walked in?</h2>
        <button className="link-btn" onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      <ul className="list">
        {sorted.map((p) => (
          <li key={p.id} className={`row ${editing ? 'row-editing' : ''}`}>
            {editing && (
              <button className="delete-btn" onClick={() => onDelete(p)} aria-label={`Remove ${p.name}`}>
                ✕
              </button>
            )}
            <span className="row-main">
              <span className="row-name">{p.name}</span>
              <span className="row-sub">
                {p.visits} {p.visits === 1 ? 'visit' : 'visits'} · {money(p.visits * PER_VISIT)}
              </span>
            </span>
            {!editing && (
              <button className="visit-btn" onClick={(e) => onVisit(p, e)}>
                <span className="visit-btn-plus">+</span>
                <span className="visit-btn-label">Ate!</span>
                {popId === p.id && (
                  <span key={popKey} className="pop">
                    +{money(PER_VISIT)}
                  </span>
                )}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="footnote">Tap “Ate!” once per plate. That is the whole job. 👏</p>
    </div>
  )
}

/* --------------------------------------------------------------- sheets --- */

function Sheet({ title, onClose, children }) {
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

function AddSheet({ onAdd, onClose }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  useEffect(() => inputRef.current?.focus(), [])

  const submit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    onClose()
  }

  return (
    <Sheet title="Add a regular" onClose={onClose}>
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
        />
        <button className="big-btn" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </Sheet>
  )
}

function SettingsSheet({ stats, lastVisitName, onUndo, onReset, onClose }) {
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <Sheet title="Settings" onClose={onClose}>
      <dl className="stats">
        <div>
          <dt>Regulars</dt>
          <dd>{stats.people}</dd>
        </div>
        <div>
          <dt>Total visits</dt>
          <dd>{stats.visits}</dd>
        </div>
        <div>
          <dt>Revenue tracked</dt>
          <dd>{money(stats.visits * PER_VISIT)}</dd>
        </div>
      </dl>

      {lastVisitName && (
        <button className="big-btn ghost" onClick={onUndo}>
          Undo last check-in ({lastVisitName})
        </button>
      )}

      <p className="hint">
        To keep this on your iPhone: tap the <strong>Share</strong> button in Safari, then{' '}
        <strong>Add to Home Screen</strong>.
      </p>

      <div className="danger-zone">
        {confirmReset ? (
          <>
            <p className="hint">This erases every visit and every dollar. Are you sure?</p>
            <button className="big-btn danger" onClick={onReset}>
              Yes, erase everything
            </button>
            <button className="big-btn ghost" onClick={() => setConfirmReset(false)}>
              Never mind
            </button>
          </>
        ) : (
          <button className="link-btn danger-link" onClick={() => setConfirmReset(true)}>
            Reset all totals
          </button>
        )}
      </div>
    </Sheet>
  )
}

function ConfirmDelete({ person, onCancel, onConfirm }) {
  return (
    <Sheet title="Remove this regular?" onClose={onCancel}>
      <p className="hint">
        <strong>{person.name}</strong> and their {money(person.visits * PER_VISIT)} will be gone for good.
      </p>
      <button className="big-btn danger" onClick={onConfirm}>
        Remove {person.name}
      </button>
      <button className="big-btn ghost" onClick={onCancel}>
        Keep them
      </button>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ app --- */

export default function App() {
  const [state, setState] = useState(loadState)
  const [tab, setTab] = useState('home')
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState(null) // 'add' | 'settings' | null
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pop, setPop] = useState({ id: null, key: 0 })
  const { canvasRef, burst } = useConfetti()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* private mode, out of space: totals just won't persist */
    }
  }, [state])

  // Switching tabs should always start at the top of the new list.
  useEffect(() => window.scrollTo(0, 0), [tab])

  const allTime = state.people.reduce((sum, p) => sum + p.visits, 0)
  const todayVisits = state.daily[dayKey()] || 0
  const lastVisitName = state.lastVisit
    ? state.people.find((p) => p.id === state.lastVisit.id)?.name || null
    : null

  const logVisit = (person, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2)
    setPop((prev) => ({ id: person.id, key: prev.key + 1 }))
    navigator.vibrate?.(18)

    const today = dayKey()
    setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === person.id ? { ...p, visits: p.visits + 1 } : p)),
      daily: { ...s.daily, [today]: (s.daily[today] || 0) + 1 },
      lastVisit: { id: person.id, day: today }
    }))
  }

  const addPerson = (name) =>
    setState((s) => ({ ...s, people: [...s.people, { id: newId(), name, visits: 0 }] }))

  const removePerson = (id) =>
    setState((s) => ({
      ...s,
      people: s.people.filter((p) => p.id !== id),
      lastVisit: s.lastVisit?.id === id ? null : s.lastVisit
    }))

  const undoLastVisit = () =>
    setState((s) => {
      if (!s.lastVisit) return s
      const { id, day } = s.lastVisit
      return {
        ...s,
        people: s.people.map((p) => (p.id === id ? { ...p, visits: Math.max(0, p.visits - 1) } : p)),
        daily: { ...s.daily, [day]: Math.max(0, (s.daily[day] || 0) - 1) },
        lastVisit: null
      }
    })

  return (
    <div className="app">
      <canvas ref={canvasRef} className="confetti" aria-hidden="true" />

      <header className="header">
        <div>
          <h1 className="brand">Cleburne Cafeteria</h1>
          <p className="tagline">Regulars Leaderboard</p>
        </div>
        <button className="gear" onClick={() => setSheet('settings')} aria-label="Settings">
          ⚙︎
        </button>
      </header>

      <main className="main">
        {tab === 'home' ? (
          <Leaderboard people={state.people} todayVisits={todayVisits} allTime={allTime} />
        ) : (
          <Attendance
            people={state.people}
            onVisit={logVisit}
            onDelete={setPendingDelete}
            editing={editing}
            setEditing={setEditing}
            popId={pop.id}
            popKey={pop.key}
          />
        )}
      </main>

      {tab === 'checkin' && !editing && (
        <button className="fab" onClick={() => setSheet('add')} aria-label="Add a person">
          +
        </button>
      )}

      <nav className="tabs">
        <button className={tab === 'home' ? 'tab active' : 'tab'} onClick={() => setTab('home')}>
          <span className="tab-icon">🏆</span>
          <span className="tab-label">Leaderboard</span>
        </button>
        <button
          className={tab === 'checkin' ? 'tab active' : 'tab'}
          onClick={() => {
            setTab('checkin')
            setEditing(false)
          }}
        >
          <span className="tab-icon">🍽️</span>
          <span className="tab-label">Check In</span>
        </button>
      </nav>

      {sheet === 'add' && <AddSheet onAdd={addPerson} onClose={() => setSheet(null)} />}
      {sheet === 'settings' && (
        <SettingsSheet
          stats={{ people: state.people.length, visits: allTime }}
          lastVisitName={lastVisitName}
          onUndo={() => {
            undoLastVisit()
            setSheet(null)
          }}
          onReset={() => {
            setState(freshState())
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDelete
          person={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            removePerson(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}
