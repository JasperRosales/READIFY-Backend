import * as profileService from '../services/profile.service.js';

// Controllers handle req/res only; logic lives in services.
export async function getMyProfile(req, res) {
  const profile = await profileService.getProfileById(req.supabase, req.user.id);
  res.json(profile);
}
