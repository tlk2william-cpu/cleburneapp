import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api, WINDOWS, todayISO } from './lib/api.js'
import { Loading, Sheet, WindowTabs, money, ordinal, parseCents, prettyDate, useConfetti } from './ui.jsx'

/* The regular's app: log what you spent, see your own numbers and your place
   in the field. Other people's totals are never shown here. */

const MILESTONES = [50000, 100000, 250000, 500000, 1000000]

function LogSheet({ visit, onClose, onSaved, onDelete }) {
  const editing = Boolean(visit)
  const [amount, setAmount] = useState(editing ? (visit.amount_cents / 100).toFixed(2) : '')
  const [ateOn, setAteOn] = useState(editing ? visit.ate_on : todayISO())
  const [note, setNote] = useState(visit?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => inputRef.current?.focus(), [])

  const cents = parseCents(amount)

  const save = async (e) => {
    e.preventDefault()
    if (!cents) {
      setError('Enter what you spent, like 18.75')
      return
    }
    setBusy(true)
    try {
      if (editing) await api.updateVisit(visit.id, { amount_cents: cents, note: note.trim() || null })
      else await api.addVisit({ amount_cents: cents, ate_on: ateOn, note: note.trim() })
      onSaved(cents)
    } catch (err) {
      setError(err.message || 'Could not save that. Try again.')
      setBusy(false)
    }
  }

  return (
    <Sheet title={editing ? 'Fix this meal' : 'What did you spend?'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="amount-field">
          <span className="amount-symbol">$</span>
          <input
            ref={inputRef}
            className="amount-input"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setError('')
            }}
            inputMode="decimal"
            placeholder="0.00"
            enterKeyHint="done"
            aria-label="Amount spent in dollars"
          />
        </div>

        {!editing && (
          <div className="day-picker">
            <button
              type="button"
              className={ateOn === todayISO() ? 'day active' : 'day'}
              onClick={() => setAteOn(todayISO())}
            >
              Today
            </button>
            <button
              type="button"
              className={ateOn !== todayISO() ? 'day active' : 'day'}
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 1)
                setAteOn(d.toISOString().slice(0, 10))
              }}
            >
              Yesterday
            </button>
          </div>
        )}

        <input
          className="text-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you get? (optional)"
          maxLength={120}
        />

        {error && <p className="error">{error}</p>}

        <button className="big-btn" type="submit" disabled={busy || !cents}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Log it'}
        </button>

        {editing && (
          <button type="button" className="big-btn ghost danger-text" onClick={() => onDelete(visit)}>
            Delete this meal
          </button>
        )}
      </form>
    </Sheet>
  )
}

export default function Regular({ onSignOut }) {
  const [tab, setTab] = useState('log')
  const [dash, setDash] = useState(null)
  const [visits, setVisits] = useState([])
  const [win, setWin] = useState('lifetime')
  const [sheet, setSheet] = useState(null) // null | 'new' | visit object
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState('')
  const { canvasRef, burst } = useConfetti()

  const refresh = useCallback(async () => {
    const [d, v] = await Promise.all([api.getDashboard(), api.listVisits()])
    setDash(d)
    setVisits(v)
    return d
  }, [])

  useEffect(() => {
    refresh().catch(() => setToast('Could not reach the leaderboard. Check your signal.'))
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const afterSave = async (cents) => {
    const before = dash?.windows?.lifetime?.spend_cents || 0
    setSheet(null)
    burst(window.innerWidth / 2, window.innerHeight / 3)
    const updated = await refresh()
    const after = updated?.windows?.lifetime?.spend_cents || 0
    const passed = MILESTONES.find((m) => before < m && after >= m)
    setToast(passed ? `${money(passed)} at Cleburne. You are a legend. 🏆` : `${money(cents)} logged!`)
  }

  if (!dash) return <Loading label="Getting your numbers…" />

  const w = dash.windows?.[win] || { spend_cents: 0, visits: 0, rank: dash.total_regulars }
  const avg = w.visits ? Math.round(w.spend_cents / w.visits) : 0

  return (
    <>
      <canvas ref={canvasRef} className="confetti" aria-hidden="true" />

      {tab === 'log' ? (
        <div className="screen">
          <div className="hero">
            <p className="hero-kicker">Hey {dash.display_name},</p>
            <h2 className="hero-title">Did you eat at Cleburne?</h2>
            <button className="hero-btn" onClick={() => setSheet('new')}>
              🍽️ Log a meal
            </button>
          </div>

          <h3 className="section-title">Your meals</h3>
          {visits.length === 0 ? (
            <p className="centered muted">Nothing logged yet. Your first plate is one tap away.</p>
          ) : (
            <ul className="list">
              {visits.map((v) => (
                <li key={v.id} className="row">
                  <span className="row-main">
                    <span className="row-name">{prettyDate(v.ate_on)}</span>
                    {v.note && <span className="row-sub">{v.note}</span>}
                  </span>
                  <span className="row-money">{money(v.amount_cents)}</span>
                  <button className="edit-btn" onClick={() => setSheet(v)} aria-label={`Edit ${v.ate_on}`}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="footnote">Honor system. Log what you actually spent. 🤝</p>
        </div>
      ) : (
        <div className="screen">
          <h2 className="section-title">{dash.display_name}</h2>
          <WindowTabs value={win} onChange={setWin} options={WINDOWS} />

          <div className="big-stat">
            <span className="big-stat-value">{money(w.spend_cents)}</span>
            <span className="big-stat-label">{WINDOWS.find((o) => o.key === win).long}</span>
          </div>

          <div className="stat-row">
            <div className="stat">
              <span className="stat-value">{w.visits}</span>
              <span className="stat-label">{w.visits === 1 ? 'visit' : 'visits'}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{avg ? money(avg) : '—'}</span>
              <span className="stat-label">average plate</span>
            </div>
          </div>

          <div className={`rank-card place-${w.rank <= 3 ? w.rank : 'other'}`}>
            <span className="rank-medal">{['🥇', '🥈', '🥉'][w.rank - 1] || '🍽️'}</span>
            <span className="rank-text">
              You are <strong>{ordinal(w.rank)}</strong> of {dash.total_regulars}{' '}
              {dash.total_regulars === 1 ? 'Regular' : 'Regulars'}
            </span>
          </div>

          <p className="footnote">Only you can see your numbers. Everyone else just sees their own.</p>
          <button className="big-btn ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}

      <nav className="tabs">
        <button className={tab === 'log' ? 'tab active' : 'tab'} onClick={() => setTab('log')}>
          <span className="tab-icon">🍽️</span>
          <span className="tab-label">My meals</span>
        </button>
        <button className={tab === 'me' ? 'tab active' : 'tab'} onClick={() => setTab('me')}>
          <span className="tab-icon">🏆</span>
          <span className="tab-label">My standing</span>
        </button>
      </nav>

      {sheet && (
        <LogSheet
          visit={sheet === 'new' ? null : sheet}
          onClose={() => setSheet(null)}
          onSaved={afterSave}
          onDelete={(v) => {
            setSheet(null)
            setConfirmDelete(v)
          }}
        />
      )}

      {confirmDelete && (
        <Sheet title="Delete this meal?" onClose={() => setConfirmDelete(null)}>
          <p className="hint">
            {prettyDate(confirmDelete.ate_on)}, {money(confirmDelete.amount_cents)}. This cannot be undone.
          </p>
          <button
            className="big-btn danger"
            onClick={async () => {
              await api.deleteVisit(confirmDelete.id)
              setConfirmDelete(null)
              await refresh()
              setToast('Deleted.')
            }}
          >
            Delete it
          </button>
          <button className="big-btn ghost" onClick={() => setConfirmDelete(null)}>
            Keep it
          </button>
        </Sheet>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
