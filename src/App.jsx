import React, { useCallback, useEffect, useState } from 'react'
import { api, demoApi } from './lib/api.js'
import { isConfigured, isDemo } from './lib/supabase.js'
import Owner from './Owner.jsx'
import Regular from './Regular.jsx'
import { Loading } from './ui.jsx'

/* Root: works out who is looking at the app, then gets out of the way. */

function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.sendMagicLink(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send the link. Check the address and try again.')
    }
    setBusy(false)
  }

  if (sent) {
    return (
      <div className="screen welcome">
        <p className="welcome-emoji">📬</p>
        <h2 className="hero-title">Check your email</h2>
        <p className="hint centered">
          We sent a sign-in link to <strong>{email}</strong>. Open it on this phone and you are in. No
          password, ever.
        </p>
        <button className="big-btn ghost" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="screen welcome">
      <p className="welcome-emoji">🍽️</p>
      <h2 className="hero-title">Join the Regulars</h2>
      <p className="hint centered">
        Log what you spend at Cleburne Cafeteria and see where you rank against everybody else who
        eats here. Your numbers stay private. Only your place in line is shared.
      </p>
      <form onSubmit={submit}>
        <input
          className="text-input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          enterKeyHint="go"
          aria-label="Your email address"
        />
        {error && <p className="error">{error}</p>}
        <button className="big-btn" type="submit" disabled={busy || !email.trim()}>
          {busy ? 'Sending…' : 'Email me a sign-in link'}
        </button>
      </form>
      <p className="footnote">We only use your email to sign you in. Nobody sees it but you.</p>
    </div>
  )
}

function ChooseName({ onDone }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    await api.setDisplayName(name.trim())
    onDone()
  }

  return (
    <div className="screen welcome">
      <p className="welcome-emoji">👋</p>
      <h2 className="hero-title">What should we call you?</h2>
      <p className="hint centered">This is the name George sees on the leaderboard. Have fun with it.</p>
      <form onSubmit={submit}>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Gravy Gary"
          autoCapitalize="words"
          maxLength={40}
          aria-label="Your display name"
        />
        <button className="big-btn" type="submit" disabled={busy || name.trim().length < 2}>
          {busy ? 'Saving…' : "That's me"}
        </button>
      </form>
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="screen welcome">
      <p className="welcome-emoji">🔌</p>
      <h2 className="hero-title">Not connected yet</h2>
      <p className="hint centered">
        This app needs its database before anyone can sign in. The setup steps are in the project
        README, under “Connecting Supabase.”
      </p>
      <a className="big-btn ghost" href="?demo=1">
        Try the demo instead
      </a>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(null)
  const [needsName, setNeedsName] = useState(false)

  const loadProfile = useCallback(async () => {
    const dash = await api.getDashboard()
    setProfile(dash)
    setNeedsName(!dash.display_name || dash.display_name === 'New Regular')
  }, [])

  useEffect(() => {
    if (!isConfigured && !isDemo) return
    api.getUser().then((u) => setUser(u))
    return api.onAuthChange((u) => {
      setUser(u)
      setProfile(null)
    })
  }, [])

  useEffect(() => {
    if (user) loadProfile().catch(() => setProfile(null))
  }, [user, loadProfile])

  const signOut = async () => {
    await api.signOut()
    setUser(null)
    setProfile(null)
  }

  let body
  if (!isConfigured && !isDemo) body = <NotConfigured />
  else if (user === undefined) body = <Loading label="One moment…" />
  else if (!user) body = <SignIn />
  else if (!profile) body = <Loading label="Setting your table…" />
  else if (needsName) body = <ChooseName onDone={() => loadProfile()} />
  else if (profile.role === 'owner') body = <Owner onSignOut={signOut} />
  else body = <Regular onSignOut={signOut} />

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="brand">Cleburne Cafeteria</h1>
          <p className="tagline">{profile?.role === 'owner' ? 'Regulars Leaderboard' : 'Regulars Club'}</p>
        </div>
      </header>

      <main className="main">{body}</main>

      {isDemo && profile && (
        <button
          className="demo-toggle"
          onClick={async () => {
            demoApi.becomeOwner(profile.role !== 'owner')
            await loadProfile()
          }}
        >
          Demo: view as {profile.role === 'owner' ? 'a Regular' : 'George'}
        </button>
      )}
    </div>
  )
}
