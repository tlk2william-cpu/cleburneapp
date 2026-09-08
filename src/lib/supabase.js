import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Demo mode runs the whole app against fake local data, so the flow can be
// shown to somebody before the database exists.
export const isDemo = new URLSearchParams(location.search).has('demo')
export const isConfigured = Boolean(url && key)

export const supabase = isConfigured ? createClient(url, key) : null
