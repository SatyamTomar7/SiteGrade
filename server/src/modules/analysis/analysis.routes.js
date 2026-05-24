import express from 'express';
import {
  compareReports,
  createAnalysis,
  createGitHubIssues,
  deleteReport,
  getDashboardInsights,
  getAnalysisStatus,
  getReport,
  addReportComment,
  getReportRegression,
  getSharedReport,
  listReports,
  addReportTask,
  rerunReport,
  streamAnalysisStatus,
  shareReport,
  unshareReport,
  updateReportTask
} from './analysis.controller.js';
import { protect } from '../auth/auth.middleware.js';
import { analysisRateLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.get('/shared/:shareToken', getSharedReport);
router.get('/reports/compare', protect, compareReports);
router.get('/insights', protect, getDashboardInsights);
router.get('/reports', protect, listReports);
router.get('/reports/:reportId/regression', protect, getReportRegression);
router.get('/reports/:reportId', protect, getReport);
router.post('/reports/:reportId/comments', protect, addReportComment);
router.post('/reports/:reportId/tasks', protect, addReportTask);
router.patch('/reports/:reportId/tasks/:taskId', protect, updateReportTask);
router.post('/reports/:reportId/github-issues', protect, createGitHubIssues);
router.delete('/reports/:reportId', protect, deleteReport);
router.post('/reports/:reportId/rerun', protect, analysisRateLimiter, rerunReport);
router.post('/reports/:reportId/share', protect, shareReport);
router.delete('/reports/:reportId/share', protect, unshareReport);
router.post('/', protect, analysisRateLimiter, createAnalysis);
router.get('/stream/:jobId', protect, streamAnalysisStatus);
router.get('/:jobId', protect, getAnalysisStatus);

export default router;
