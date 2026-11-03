import { supabaseAdmin, supabaseForUser } from '../lib/supabase.js';

// Requires "Authorization: Bearer <supabase access token>" from the frontend.
// Sets req.user (Supabase auth user) and req.supabase (RLS-scoped client).
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  req.accessToken = token;
  req.supabase = supabaseForUser(token);
  next();
}
