import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api, WINDOWS } from './lib/api.js'
import { Loading, Sheet, WindowTabs, money } from './ui.jsx'

/* George's account. One screen: the leaderboard, and a way to hand the app
   to the next customer in line. No adding, no editing, nothing to break. */

export default function Owner({ onSignOut }) {
  const [win, setWin] = useState('lifetime')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [qr, setQR] = useState('')

  const signupLink = window.location.origin + window.location.pathname

  useEffect(() => {
    let live = true
    setRows(null)
    api
      .getLeaderboard(win)
      .then((data) => live && setRows(data))
      .catch((err) => live && setError(err.message || 'Could not load the leaderboard.'))
    return () => {
      live = false
    }
  }, [win])

  useEffect(() => {
    if (!showQR || qr) return
    QRCode.toDataURL(signupLink, { width: 600, margin: 1, color: { dark: '#145C33', light: '#FFFFFF' } })
      .then(setQR)
      .catch(() => setError('Could not draw the QR code.'))
  }, [showQR, qr, signupLink])

  const share = async () => {
    const text = 'Join the Cleburne Cafeteria Regulars leaderboard!'
    try {
      if (navigator.share) await navigator.share({ title: 'Cleburne Regulars', text, url: signupLink })
      else {
        await navigator.clipboard.writeText(signupLink)
        setError('Link copied. Paste it into a text message.')
      }
    } catch {
      /* the share sheet was dismissed, which is not an error */
    }
  }

  const total = rows?.reduce((sum, r) => sum + Number(r.spend_cents), 0) || 0
  const eaters = rows?.filter((r) => Number(r.visits) > 0).length || 0

  return (
    <div className="screen">
      <WindowTabs value={win} onChange={setWin} options={WINDOWS} />

      <div className="scoreboard">
        <div className="scoreboard-item">
          <span className="scoreboard-value">{money(total)}</span>
          <span className="scoreboard-label">{WINDOWS.find((o) => o.key === win).long}</span>
        </div>
        <div className="scoreboard-item">
          <span className="scoreboard-value">{eaters}</span>
          <span className="scoreboard-label">Regulars who ate</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!rows ? (
        <Loading label="Counting the plates…" />
      ) : rows.length === 0 ? (
        <p className="centered muted">Nobody has signed up yet. Tap Invite below and start recruiting.</p>
      ) : (
        <ol className="list">
          {rows.map((r, i) => (
            <li key={r.display_name + i} className={`row rank-${r.place <= 3 ? r.place : 'other'}`}>
              <span className="rank">
                {Number(r.spend_cents) > 0 && r.place <= 3 ? ['🥇', '🥈', '🥉'][r.place - 1] : r.place}
              </span>
              <span className="row-main">
                <span className="row-name">{r.display_name}</span>
                <span className="row-sub">
                  {r.visits} {Number(r.visits) === 1 ? 'visit' : 'visits'}
                </span>
              </span>
              <span className="row-money">{money(r.spend_cents)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="owner-actions">
        <button className="big-btn" onClick={share}>
          📣 Invite a Regular
        </button>
        <button className="big-btn ghost" onClick={() => setShowQR(true)}>
          Show QR code for the table
        </button>
        <button className="link-btn" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      {showQR && (
        <Sheet title="Point a phone at this" onClose={() => setShowQR(false)}>
          {qr ? <img className="qr" src={qr} alt="QR code to join the Regulars leaderboard" /> : <Loading />}
          <p className="hint">
            Print it, tape it to the register. Anyone who scans it lands on the signup page.
          </p>
        </Sheet>
      )}
    </div>
  )
}
