import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/profile/me — the logged-in user's profile (level, XP, etc.)
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, age_group, role, total_xp, current_level')
    .eq('id', req.user.id)
    .single();

  if (error) throw error;
  res.json(data);
});

export default router;
