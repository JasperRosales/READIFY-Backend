import { supabaseAdmin, supabaseForUser } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';

// Requires "Authorization: Bearer <supabase access token>" from the frontend.
// Sets req.user (Supabase auth user) and req.supabase (RLS-scoped client).
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or invalid Authorization header');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  req.user = data.user;
  req.supabase = supabaseForUser(token);
  next();
}
