import express from 'express';
import {
  compareReports,
  createAnalysis,
  deleteReport,
  getDashboardInsights,
  getAnalysisStatus,
  getReport,
  getSharedReport,
  listReports,
  shareReport,
  unshareReport
} from './analysis.controller.js';
import { protect } from '../auth/auth.middleware.js';
import { analysisRateLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.get('/shared/:shareToken', getSharedReport);
router.get('/reports/compare', protect, compareReports);
router.get('/insights', protect, getDashboardInsights);
router.get('/reports', protect, listReports);
router.get('/reports/:reportId', protect, getReport);
router.delete('/reports/:reportId', protect, deleteReport);
router.post('/reports/:reportId/share', protect, shareReport);
router.delete('/reports/:reportId/share', protect, unshareReport);
router.post('/', protect, analysisRateLimiter, createAnalysis);
router.get('/:jobId', protect, getAnalysisStatus);

export default router;
