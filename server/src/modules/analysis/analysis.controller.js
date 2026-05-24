import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as analysisService from './analysis.service.js';
import { analysisQueue, analysisQueueEvents } from '../../queues/analysisQueue.js';
import { logger } from '../../config/logger.js';
import { assertSafeAnalysisUrl } from '../../utils/urlSafety.js';
import { normalizeAnalysisUrl } from './analysis.helpers.js';

const normalizeAnalysisConfig = (input = {}) => {
  const scanMode = input.scanMode === 'crawl' ? 'crawl' : 'single';
  const crawlMaxPages = Math.min(Math.max(Number(input.crawlMaxPages) || 1, 1), 25);
  const auditProfiles = Array.isArray(input.auditProfiles)
    ? [...new Set(input.auditProfiles.filter((profile) => ['mobile', 'desktop'].includes(profile)))]
    : [];
  const competitorUrls = Array.isArray(input.competitorUrls)
    ? input.competitorUrls.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  const normalizedWebsiteType = ['auto', 'general', 'portfolio', 'saas', 'ecommerce', 'blog', 'docs', 'business']
    .includes(String(input.websiteType || '').trim().toLowerCase())
    ? String(input.websiteType).trim().toLowerCase()
    : 'auto';

  return {
    scanMode,
    crawlMaxPages: scanMode === 'crawl' ? crawlMaxPages : 1,
    auditProfiles: auditProfiles.length ? auditProfiles : ['mobile'],
    competitorUrls,
    websiteType: normalizedWebsiteType,
    enableFixMode: input.enableFixMode !== false
  };
};

const queueAnalysisForUser = async (userId, inputUrl, rawConfig = {}) => {
  const normalizedUrl = await assertSafeAnalysisUrl(normalizeAnalysisUrl(inputUrl));
  const analysisConfig = normalizeAnalysisConfig(rawConfig);
  const report = await analysisService.createReport(userId, normalizedUrl, analysisConfig);

  try {
    const job = await analysisQueue.add('analyze-website', {
      reportId: report._id.toString(),
      url: normalizedUrl,
      analysisConfig
    });

    logger.info(`Analysis queued: jobId=${job.id}, reportId=${report._id}, url=${normalizedUrl}`);
    return { job, report, normalizedUrl, analysisConfig };
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
};

const resolvePublicAppUrl = (req) => {
  const configuredUrl = process.env.PUBLIC_APP_URL || process.env.CLIENT_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
};

export const createAnalysis = asyncHandler(async (req, res) => {
  const {
    url,
    scanMode,
    crawlMaxPages,
    auditProfiles,
    competitorUrls,
    websiteType,
    enableFixMode
  } = req.body;
  const userId = req.user._id;
  const { job, report, analysisConfig } = await queueAnalysisForUser(userId, url, {
    scanMode,
    crawlMaxPages,
    auditProfiles,
    competitorUrls,
    websiteType,
    enableFixMode
  });

  sendResponse(res, 202, { jobId: job.id, reportId: report._id, analysisConfig }, 'Analysis queued successfully');
});

export const getAnalysisStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const result = await analysisService.getJobStatus(jobId, req.user);
  sendResponse(res, 200, result, 'Job status retrieved');
});

export const streamAnalysisStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed) {
      res.write(': keep-alive\n\n');
    }
  }, 15000);

  const sendEvent = async (eventName = 'status') => {
    if (closed) {
      return false;
    }

    try {
      const result = await analysisService.getJobStatus(jobId, req.user);
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(result)}\n\n`);

      if (result.state === 'completed' || result.state === 'failed') {
        cleanup();
        res.end();
        return false;
      }

      return true;
    } catch (error) {
      logger.warn(`Streaming status failed for job ${jobId}: ${error.message}`);
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
      cleanup();
      res.end();
      return false;
    }
  };

  const handleProgress = async ({ jobId: updatedJobId }) => {
    if (String(updatedJobId) === String(jobId)) {
      await sendEvent('progress');
    }
  };

  const handleCompleted = async ({ jobId: updatedJobId }) => {
    if (String(updatedJobId) === String(jobId)) {
      await sendEvent('completed');
    }
  };

  const handleFailed = async ({ jobId: updatedJobId }) => {
    if (String(updatedJobId) === String(jobId)) {
      await sendEvent('failed');
    }
  };

  const cleanup = () => {
    if (closed) {
      return;
    }

    closed = true;
    clearInterval(heartbeat);
    analysisQueueEvents.off('progress', handleProgress);
    analysisQueueEvents.off('completed', handleCompleted);
    analysisQueueEvents.off('failed', handleFailed);
  };

  req.on('close', cleanup);
  analysisQueueEvents.on('progress', handleProgress);
  analysisQueueEvents.on('completed', handleCompleted);
  analysisQueueEvents.on('failed', handleFailed);

  await sendEvent('connected');
});

export const getReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const report = await analysisService.getReportById(reportId, req.user);
  sendResponse(res, 200, report, 'Report retrieved successfully');
});

export const addReportComment = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const message = String(req.body.message || '').trim();

  if (!message) {
    const error = new Error('Comment message is required');
    error.statusCode = 400;
    throw error;
  }

  const report = await analysisService.addReportComment(reportId, req.user, req.user, message);
  sendResponse(res, 201, report, 'Comment added successfully');
});

export const addReportTask = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const title = String(req.body.title || '').trim();

  if (!title) {
    const error = new Error('Task title is required');
    error.statusCode = 400;
    throw error;
  }

  const report = await analysisService.addReportTask(reportId, req.user, {
    title,
    detail: req.body.detail,
    assigneeName: req.body.assigneeName,
    assigneeEmail: req.body.assigneeEmail,
    status: req.body.status,
    severity: req.body.severity
  });
  sendResponse(res, 201, report, 'Task added successfully');
});

export const updateReportTask = asyncHandler(async (req, res) => {
  const { reportId, taskId } = req.params;
  const report = await analysisService.updateReportTask(reportId, taskId, req.user, req.body);
  sendResponse(res, 200, report, 'Task updated successfully');
});

export const createGitHubIssues = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const result = await analysisService.buildGitHubIssues(reportId, req.user, {
    repoOwner: req.body.repoOwner,
    repoName: req.body.repoName,
    createLive: req.body.createLive === true
  });
  sendResponse(res, 200, result, result.dryRun ? 'GitHub issue drafts generated successfully' : 'GitHub issues created successfully');
});

export const rerunReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const existingReport = await analysisService.getReportById(reportId, req.user);
  const { job, report } = await queueAnalysisForUser(
    req.user._id,
    existingReport.url,
    existingReport.analysisConfig || {}
  );

  sendResponse(res, 202, {
    sourceReportId: reportId,
    jobId: job.id,
    reportId: report._id
  }, 'Re-analysis queued successfully');
});

export const getReportRegression = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const result = await analysisService.getReportRegression(reportId, req.user);
  sendResponse(res, 200, result, 'Regression analysis retrieved successfully');
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
  const clientUrl = resolvePublicAppUrl(req);

  sendResponse(res, 200, {
    ...result,
    shareUrl: `${clientUrl}/shared/${result.publicShareToken}`
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
