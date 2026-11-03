import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { getMyProfile } from '../controllers/profile.controller.js';

const router = Router();

router.get('/me', requireAuth, getMyProfile);

export default router;
