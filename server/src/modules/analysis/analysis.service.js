import { WebsiteReport } from '../../models/WebsiteReport.js';
import { analysisQueue } from '../../queues/analysisQueue.js';
import { logger } from '../../config/logger.js';
import fs from 'fs/promises';

const calculateOverallScore = (scores = {}) => {
  const values = [
    scores.performance ?? 0,
    scores.seo ?? 0,
    scores.accessibility ?? 0,
    scores.security ?? 0,
    scores.bestPractices ?? 0
  ];

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const ensureArray = (value) => Array.isArray(value) ? value : [];
const ensureNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

const buildReportSummary = (report) => ({
  id: report._id,
  url: report.url,
  status: report.status,
  overallScore: report.overallScore ?? calculateOverallScore(report.scores),
  portfolioReadinessScore: ensureNumber(report.aiReviewStructured?.portfolioReadiness?.overallScore, 0),
  scores: report.scores,
  grade: report.aiReviewStructured?.grade || null,
  techStack: ensureArray(report.techStack),
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  completedAt: report.completedAt,
  failedAt: report.failedAt,
  errorMessage: report.errorMessage,
  isPublic: !!report.isPublic,
  publicShareToken: report.isPublic ? report.publicShareToken : null
});

const normalizeReport = (report) => {
  if (!report) {
    return null;
  }

  const normalized = {
    ...report,
    id: report._id,
    overallScore: report.overallScore ?? calculateOverallScore(report.scores)
  };

  delete normalized.__v;
  delete normalized.userId;

  return normalized;
};

const ensureOwnedReport = async (reportId, userId) => {
  const report = await WebsiteReport.findById(reportId);

  if (!report) {
    const error = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (report.userId.toString() !== userId.toString()) {
    const error = new Error('Not authorized to access this report');
    error.statusCode = 403;
    throw error;
  }

  return report;
};

const removeScreenshotIfPresent = async (report) => {
  const screenshotPath = report?.puppeteerData?.screenshotPath;

  if (!screenshotPath) {
    return;
  }

  try {
    await fs.unlink(screenshotPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`Failed to remove screenshot for report ${report._id}: ${error.message}`);
    }
  }
};

export const createReport = async (userId, url) => {
  const report = await WebsiteReport.create({
    userId,
    url,
    status: 'pending'
  });
  
  return report;
};

export const getJobStatus = async (jobId, userId) => {
  const job = await analysisQueue.getJob(jobId);
  
  if (!job) {
    const error = new Error('Job not found');
    error.statusCode = 404;
    throw error;
  }
  
  const state = await job.getState();
  const progress = job.progress || 0;
  
  let report = null;
  if (job.data?.reportId) {
    report = await WebsiteReport.findById(job.data.reportId).lean();

    if (!report) {
      const error = new Error('Report not found');
      error.statusCode = 404;
      throw error;
    }

    if (report.userId.toString() !== userId.toString()) {
      const error = new Error('Not authorized to access this report');
      error.statusCode = 403;
      throw error;
    }
  }
  
  return {
    jobId: job.id,
    state,
    progress,
    report: normalizeReport(report)
  };
};

export const getReportById = async (reportId, userId) => {
  const report = await ensureOwnedReport(reportId, userId);
  return normalizeReport(report.toObject());
};

export const getSharedReportByToken = async (shareToken) => {
  const report = await WebsiteReport.findOne({
    publicShareToken: shareToken,
    isPublic: true
  }).lean();

  if (!report) {
    const error = new Error('Shared report not found');
    error.statusCode = 404;
    throw error;
  }

  return normalizeReport(report);
};

export const listReports = async (userId, filters) => {
  const {
    search = '',
    status,
    minScore,
    dateFrom,
    dateTo,
    sortBy = 'newest',
    page = 1,
    limit = 12
  } = filters;

  const query = { userId };

  if (search.trim()) {
    query.url = { $regex: search.trim(), $options: 'i' };
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  if (minScore !== undefined && minScore !== null && minScore !== '') {
    query.overallScore = { ...(query.overallScore || {}), $gte: Number(minScore) };
  }

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) {
      query.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  let sort = { createdAt: -1 };
  if (sortBy === 'oldest') {
    sort = { createdAt: 1 };
  } else if (sortBy === 'highest-score') {
    sort = { overallScore: -1, createdAt: -1 };
  } else if (sortBy === 'lowest-score') {
    sort = { overallScore: 1, createdAt: -1 };
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (safePage - 1) * safeLimit;

  const [reports, total] = await Promise.all([
    WebsiteReport.find(query).sort(sort).skip(skip).limit(safeLimit).lean(),
    WebsiteReport.countDocuments(query)
  ]);

  return {
    reports: reports.map(buildReportSummary),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1)
    }
  };
};

export const getDashboardInsights = async (userId) => {
  const reports = await WebsiteReport.find({ userId, status: 'completed' })
    .sort({ createdAt: 1 })
    .lean();

  const trend = reports.map((report) => ({
    id: report._id,
    url: report.url,
    createdAt: report.createdAt,
    overallScore: report.overallScore ?? calculateOverallScore(report.scores),
    portfolioReadinessScore: ensureNumber(report.aiReviewStructured?.portfolioReadiness?.overallScore, 0)
  }));

  const repeatedIssueMap = new Map();
  reports.forEach((report) => {
    ensureArray(report.aiReviewStructured?.actionPlan).forEach((item) => {
      const key = item.issue || 'Unspecified issue';
      repeatedIssueMap.set(key, (repeatedIssueMap.get(key) || 0) + 1);
    });
  });

  const repeatedIssues = [...repeatedIssueMap.entries()]
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const bestReport = trend.length
    ? trend.reduce((best, current) => current.overallScore > best.overallScore ? current : best, trend[0])
    : null;
  const worstReport = trend.length
    ? trend.reduce((worst, current) => current.overallScore < worst.overallScore ? current : worst, trend[0])
    : null;

  let improvementStreak = 0;
  for (let i = trend.length - 1; i > 0; i -= 1) {
    if (trend[i].overallScore >= trend[i - 1].overallScore) {
      improvementStreak += 1;
    } else {
      break;
    }
  }

  return {
    trend,
    repeatedIssues,
    bestReport,
    worstReport,
    improvementStreak
  };
};

export const deleteReport = async (reportId, userId) => {
  const report = await ensureOwnedReport(reportId, userId);
  await removeScreenshotIfPresent(report.toObject());
  await report.deleteOne();
};

export const enableReportSharing = async (reportId, userId) => {
  const report = await ensureOwnedReport(reportId, userId);
  report.isPublic = true;
  report.sharedAt = new Date();
  report.ensureShareToken();
  await report.save();

  return {
    reportId: report._id,
    publicShareToken: report.publicShareToken,
    sharedAt: report.sharedAt
  };
};

export const disableReportSharing = async (reportId, userId) => {
  const report = await ensureOwnedReport(reportId, userId);
  report.isPublic = false;
  report.sharedAt = null;
  report.publicShareToken = undefined;
  await report.save();
};

export const compareReports = async (leftReportId, rightReportId, userId) => {
  const [leftReport, rightReport] = await Promise.all([
    ensureOwnedReport(leftReportId, userId),
    ensureOwnedReport(rightReportId, userId)
  ]);

  const left = normalizeReport(leftReport.toObject());
  const right = normalizeReport(rightReport.toObject());
  const metrics = ['overallScore', 'performance', 'seo', 'accessibility', 'security', 'bestPractices'];

  const scoreComparison = metrics.map((metric) => {
    const leftValue = metric === 'overallScore'
      ? left.overallScore
      : left.scores?.[metric] ?? 0;
    const rightValue = metric === 'overallScore'
      ? right.overallScore
      : right.scores?.[metric] ?? 0;

    return {
      metric,
      left: leftValue,
      right: rightValue,
      delta: rightValue - leftValue
    };
  });

  const leftTech = new Set(left.techStack || []);
  const rightTech = new Set(right.techStack || []);

  const addedTech = [...rightTech].filter((tech) => !leftTech.has(tech));
  const removedTech = [...leftTech].filter((tech) => !rightTech.has(tech));

  return {
    leftReport: buildReportSummary(left),
    rightReport: buildReportSummary(right),
    scoreComparison,
    changes: {
      addedTech,
      removedTech,
      consoleErrors: {
        left: left.puppeteerData?.consoleErrors ?? 0,
        right: right.puppeteerData?.consoleErrors ?? 0,
        delta: (right.puppeteerData?.consoleErrors ?? 0) - (left.puppeteerData?.consoleErrors ?? 0)
      },
      loadTime: {
        left: left.puppeteerData?.loadTime ?? 'N/A',
        right: right.puppeteerData?.loadTime ?? 'N/A'
      },
      grade: {
        left: left.aiReviewStructured?.grade ?? 'N/A',
        right: right.aiReviewStructured?.grade ?? 'N/A'
      }
    }
  };
};

export const updateReportWithResults = async (reportId, data) => {
  const overallScore = calculateOverallScore(data.scores);
  const report = await WebsiteReport.findByIdAndUpdate(
    reportId,
    {
      status: 'completed',
      scores: data.scores,
      overallScore,
      aiReview: data.aiReview,
      lighthouseData: data.lighthouseData,
      puppeteerData: data.puppeteerData,
      techStack: data.techStack,
      aiReviewStructured: data.aiReviewStructured,
      completedAt: new Date()
    },
    { new: true }
  );
  
  return report;
};

export const markReportProcessing = async (reportId) => {
  await WebsiteReport.findByIdAndUpdate(reportId, { status: 'processing' });
};

export const markReportFailed = async (reportId, errorMessage) => {
  const report = await WebsiteReport.findByIdAndUpdate(
    reportId,
    {
      status: 'failed',
      overallScore: 0,
      errorMessage,
      failedAt: new Date()
    },
    { new: true }
  );
  
  return report;
};
