import { Router } from 'express';
import healthRoutes from './health.routes.js';
import profileRoutes from './profile.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/profile', profileRoutes);
// TODO: router.use('/chapters', chapterRoutes);   // learning page
// TODO: router.use('/tests', testRoutes);         // testing page + Gemini grading
// TODO: router.use('/progress', progressRoutes);  // chapter_progress, xp_events

export default router;
