import { ApiError } from '../utils/ApiError.js';

const PROFILE_COLUMNS =
  'id, email, display_name, avatar_url, age_group, role, total_xp, current_level';

// Services hold the database / business logic. They receive the Supabase
// client so RLS is enforced for the calling user.
export async function getProfileById(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw ApiError.notFound('Profile not found');
  return data;
}
