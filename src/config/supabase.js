import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const options = { auth: { persistSession: false, autoRefreshToken: false } };

// Admin client: bypasses RLS. Use ONLY for trusted server work
// (e.g. inserting xp_events, saving ai_evaluations).
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, options);

// Per-request client that acts as the logged-in user, so RLS policies apply.
export function supabaseForUser(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    ...options,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
