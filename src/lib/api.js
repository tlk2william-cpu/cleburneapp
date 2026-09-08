import { supabase, isDemo, isConfigured } from './supabase.js'

/* Every call the app makes to its data lives here, in two flavours: the real
   Supabase one, and a local fake used by ?demo=1. The screens never know
   which is running. */

export const WINDOWS = [
  { key: 'week', label: 'Week', long: 'this week' },
  { key: 'month', label: 'Month', long: 'this month' },
  { key: 'year', label: 'Year', long: 'this year' },
  { key: 'lifetime', label: 'All time', long: 'all time' }
]

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ---------------------------------------------------------- real backend --- */

const real = {
  async getUser() {
    const { data } = await supabase.auth.getUser()
    return data.user || null
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user || null))
    return () => data.subscription.unsubscribe()
  },
  async sendMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    })
    if (error) throw error
  },
  async signOut() {
    await supabase.auth.signOut()
  },
  async getDashboard() {
    const { data, error } = await supabase.rpc('my_dashboard')
    if (error) throw error
    return data
  },
  async setDisplayName(name) {
    const user = await real.getUser()
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', user.id)
    if (error) throw error
  },
  async listVisits(limit = 50) {
    const { data, error } = await supabase
      .from('visits')
      .select('id, ate_on, amount_cents, note')
      .order('ate_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data
  },
  async addVisit({ amount_cents, ate_on, note }) {
    const user = await real.getUser()
    const { error } = await supabase
      .from('visits')
      .insert({ user_id: user.id, amount_cents, ate_on, note: note || null })
    if (error) throw error
  },
  async updateVisit(id, fields) {
    const { error } = await supabase.from('visits').update(fields).eq('id', id)
    if (error) throw error
  },
  async deleteVisit(id) {
    const { error } = await supabase.from('visits').delete().eq('id', id)
    if (error) throw error
  },
  async getLeaderboard(win) {
    const { data, error } = await supabase.rpc('leaderboard', { win })
    if (error) throw error
    return data
  }
}

/* ------------------------------------------------------------- demo mode --- */

const DEMO_KEY = 'cleburne-demo-v1'
const DEMO_NAMES = [
  ['Sweet Tea Sue', 101998, 7],
  ['Chicken-Fried Chuck', 84250, 6],
  ['Meatloaf Maureen', 61300, 5],
  ['Two-Plate Pete', 45775, 4],
  ['Cornbread Connie', 31200, 3],
  ['Jell-O Jerry', 22450, 2],
  ['Pie-Slice Phil', 12000, 1],
  ['Casserole Carl', 4599, 1]
]

const demoLoad = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY))
    if (saved?.me) return saved
  } catch {
    /* fall through to a fresh demo */
  }
  return { me: null, visits: [], others: DEMO_NAMES }
}
const demoSave = (s) => localStorage.setItem(DEMO_KEY, JSON.stringify(s))
let demoState = demoLoad()
let demoListener = null

const demoWindowStart = (win) => {
  const d = new Date()
  if (win === 'week') d.setDate(d.getDate() - d.getDay())
  else if (win === 'month') d.setDate(1)
  else if (win === 'year') {
    d.setMonth(0)
    d.setDate(1)
  } else return '0000-01-01'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const demoTotals = (win) => {
  const start = demoWindowStart(win)
  const mine = demoState.visits.filter((v) => v.ate_on >= start)
  // Fake regulars keep a stable share of their lifetime number per window,
  // so the board looks plausible in every tab.
  const share = { week: 0.12, month: 0.4, year: 0.85, lifetime: 1 }[win]
  const others = demoState.others.map(([name, cents, visits]) => ({
    display_name: name,
    spend_cents: Math.round(cents * share),
    visits: Math.max(win === 'lifetime' ? visits : Math.round(visits * share), 0)
  }))
  const me = {
    display_name: demoState.me?.display_name || 'You',
    spend_cents: mine.reduce((sum, v) => sum + v.amount_cents, 0),
    visits: mine.length,
    isMe: true
  }
  return [...others, me].sort((a, b) => b.spend_cents - a.spend_cents)
}

const demo = {
  async getUser() {
    return demoState.me ? { id: 'demo-user', email: demoState.me.email } : null
  },
  onAuthChange(cb) {
    demoListener = cb
    return () => {
      demoListener = null
    }
  },
  async sendMagicLink(email) {
    // No email in demo mode: signing in is instant.
    demoState = { ...demoState, me: { email, display_name: 'New Regular', role: 'regular' } }
    demoSave(demoState)
    demoListener?.({ id: 'demo-user', email })
  },
  async signOut() {
    demoState = { ...demoState, me: null }
    demoSave(demoState)
    demoListener?.(null)
  },
  async getDashboard() {
    const windows = {}
    for (const { key } of WINDOWS) {
      const board = demoTotals(key)
      const mine = board.find((r) => r.isMe)
      windows[key] = {
        spend_cents: mine.spend_cents,
        visits: mine.visits,
        rank: board.findIndex((r) => r.isMe) + 1
      }
    }
    return {
      display_name: demoState.me.display_name,
      role: demoState.me.role,
      total_regulars: demoState.others.length + 1,
      windows
    }
  },
  async setDisplayName(name) {
    demoState = { ...demoState, me: { ...demoState.me, display_name: name } }
    demoSave(demoState)
  },
  async listVisits() {
    return [...demoState.visits].sort((a, b) => b.ate_on.localeCompare(a.ate_on) || b.id - a.id)
  },
  async addVisit({ amount_cents, ate_on, note }) {
    demoState.visits.push({ id: Date.now(), amount_cents, ate_on, note: note || null })
    demoSave(demoState)
  },
  async updateVisit(id, fields) {
    demoState.visits = demoState.visits.map((v) => (v.id === id ? { ...v, ...fields } : v))
    demoSave(demoState)
  },
  async deleteVisit(id) {
    demoState.visits = demoState.visits.filter((v) => v.id !== id)
    demoSave(demoState)
  },
  async getLeaderboard(win) {
    return demoTotals(win).map((row, i) => ({
      place: i + 1,
      display_name: row.display_name,
      spend_cents: row.spend_cents,
      visits: row.visits
    }))
  },
  // Demo-only: flip between the two kinds of account without a database.
  becomeOwner(isOwner) {
    demoState = { ...demoState, me: { ...demoState.me, role: isOwner ? 'owner' : 'regular' } }
    demoSave(demoState)
  }
}

export const api = isDemo || !isConfigured ? demo : real
export const demoApi = demo
