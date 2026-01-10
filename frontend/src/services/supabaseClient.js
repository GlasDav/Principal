/**
 * Supabase Client Configuration
 * 
 * Usage:
 *   import { supabase } from '@/services/supabaseClient'
 *   
 *   // Auth
 *   const { data, error } = await supabase.auth.signInWithPassword({ email, password })
 *   
 *   // Database
 *   const { data } = await supabase.from('transactions').select('*')
 *   
 *   // Realtime
 *   supabase
 *     .channel('transactions')
 *     .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, handler)
 *     .subscribe()
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
})

/**
 * Helper to get current session token for FastAPI calls
 */
export const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
}

/**
 * Helper to get current user
 */
export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}
