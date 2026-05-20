import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as analysisService from './analysis.service.js';
import { analysisQueue } from '../../queues/analysisQueue.js';
import { logger } from '../../config/logger.js';
import { assertSafeAnalysisUrl } from '../../utils/urlSafety.js';

const normalizeUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) {
    const error = new Error('URL is required');
    error.statusCode = 400;
    throw error;
  }

  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
};

export const createAnalysis = asyncHandler(async (req, res) => {
  const { url } = req.body;
  const userId = req.user._id;
  
  const normalizedUrl = await assertSafeAnalysisUrl(normalizeUrl(url));
  
  const report = await analysisService.createReport(userId, normalizedUrl);
  
  let job;

  try {
    job = await analysisQueue.add('analyze-website', {
      reportId: report._id.toString(),
      url: normalizedUrl
    }, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 60 * 60
      },
      removeOnFail: {
        count: 50,
        age: 7 * 24 * 60 * 60
      }
    });
  } catch (error) {
    logger.error(`Failed to queue analysis for report ${report._id}:`, error);
    await analysisService.markReportFailed(
      report._id,
      'Analysis queue is temporarily unavailable. Please try again in a moment.'
    );

    const queueError = new Error('Analysis queue is temporarily unavailable. Please try again in a moment.');
    queueError.statusCode = 503;
    throw queueError;
  }
  
  logger.info(`Analysis queued: jobId=${job.id}, reportId=${report._id}, url=${normalizedUrl}`);
  
  sendResponse(res, 202, { jobId: job.id, reportId: report._id }, 'Analysis queued successfully');
});

export const getAnalysisStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const result = await analysisService.getJobStatus(jobId, req.user._id);
  sendResponse(res, 200, result, 'Job status retrieved');
});

export const getReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const report = await analysisService.getReportById(reportId, req.user._id);
  sendResponse(res, 200, report, 'Report retrieved successfully');
});

export const listReports = asyncHandler(async (req, res) => {
  const result = await analysisService.listReports(req.user._id, req.query);
  sendResponse(res, 200, result, 'Reports retrieved successfully');
});

export const getDashboardInsights = asyncHandler(async (req, res) => {
  const result = await analysisService.getDashboardInsights(req.user._id);
  sendResponse(res, 200, result, 'Dashboard insights retrieved successfully');
});

export const deleteReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  await analysisService.deleteReport(reportId, req.user._id);
  sendResponse(res, 200, null, 'Report deleted successfully');
});

export const shareReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const result = await analysisService.enableReportSharing(reportId, req.user._id);
  const clientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;

  sendResponse(res, 200, {
    ...result,
    shareUrl: `${clientUrl.replace(/\/$/, '')}/shared/${result.publicShareToken}`
  }, 'Share link created successfully');
});

export const unshareReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  await analysisService.disableReportSharing(reportId, req.user._id);
  sendResponse(res, 200, null, 'Share link disabled successfully');
});

export const getSharedReport = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;
  const report = await analysisService.getSharedReportByToken(shareToken);
  sendResponse(res, 200, report, 'Shared report retrieved successfully');
});

export const compareReports = asyncHandler(async (req, res) => {
  const { left, right } = req.query;

  if (!left || !right) {
    const error = new Error('Both left and right report ids are required');
    error.statusCode = 400;
    throw error;
  }

  const result = await analysisService.compareReports(left, right, req.user._id);
  sendResponse(res, 200, result, 'Reports compared successfully');
});
