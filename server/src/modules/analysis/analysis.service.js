import { WebsiteReport } from '../../models/WebsiteReport.js';
import { Workspace } from '../../models/Workspace.js';
import { analysisQueue } from '../../queues/analysisQueue.js';
import { isRedisConfigured, redisClient } from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import fs from 'fs/promises';
import {
  buildRegressionComparison,
  buildScoreBreakdown,
  calculateOverallScore,
  classifyDelta
} from './analysis.helpers.js';

const buildGitHubIssueBody = (report, issue) => {
  const lines = [
    `## SiteGrade Finding`,
    ``,
    `- Report URL: ${report.url}`,
    `- Report ID: ${report.id}`,
    `- Severity: ${issue.severity || 'Medium'}`,
    `- Effort: ${issue.effort || 'Medium'}`,
    `- Estimated Impact: +${issue.estimatedScoreImpact ?? 0}`,
    ``,
    `### Problem`,
    issue.issue || issue.title || 'Unspecified issue',
    ``,
    `### Recommendation`,
    issue.recommendation || issue.suggestion || '',
    ``,
    `### Why It Matters`,
    issue.rationale || issue.whyItMatters || '',
    ``,
    `### Expected Outcome`,
    issue.expectedOutcome || 'Improve the affected quality signal and validate with a re-run.'
  ];

  if (issue.codeExample) {
    lines.push('', '### Starter Example', '```', issue.codeExample, '```');
  }

  return lines.join('\n');
};

const getActorIdentity = (actor) => {
  if (actor && typeof actor === 'object' && actor._id) {
    return {
      userId: actor._id,
      email: actor.email || ''
    };
  }

  return {
    userId: actor,
    email: ''
  };
};

const canAccessWorkspaceReport = async (report, actor) => {
  const workspaceId = report?.workspaceContext?.workspaceId;
  const { email } = getActorIdentity(actor);

  if (!workspaceId || !email) {
    return false;
  }

  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) {
    return false;
  }

  return workspace.members?.some((member) =>
    member.email === String(email).trim().toLowerCase() && member.status === 'active'
  );
};

const LIST_REPORTS_CACHE_TTL_SECONDS = Math.max(Number(process.env.LIST_REPORTS_CACHE_TTL_SECONDS) || 60, 1);
const DASHBOARD_INSIGHTS_CACHE_TTL_SECONDS = Math.max(Number(process.env.DASHBOARD_INSIGHTS_CACHE_TTL_SECONDS) || 120, 1);
const REPORT_SUMMARY_PROJECTION = {
  url: 1,
  status: 1,
  overallScore: 1,
  scores: 1,
  techStack: 1,
  siteProfile: 1,
  errorMessage: 1,
  isPublic: 1,
  publicShareToken: 1,
  workspaceContext: 1,
  createdAt: 1,
  updatedAt: 1,
  completedAt: 1,
  failedAt: 1,
  'aiReviewStructured.grade': 1,
  'aiReviewStructured.portfolioReadiness.overallScore': 1
};

const ensureArray = (value) => Array.isArray(value) ? value : [];
const ensureNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const formatMetricLabel = (metric) => metric.replace(/([A-Z])/g, ' $1').trim();
const buildUserCacheTag = (userId) => `sitegrade:analysis:user:${userId}`;
const buildListReportsCacheKey = (userId, filters) => `${buildUserCacheTag(userId)}:reports:${JSON.stringify(filters)}`;
const buildDashboardInsightsCacheKey = (userId) => `${buildUserCacheTag(userId)}:insights`;

const readCache = async (key) => {
  if (!isRedisConfigured || redisClient.status !== 'ready') {
    return null;
  }

  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.warn(`Cache read failed for key ${key}: ${error.message}`);
    return null;
  }
};

const writeCache = async (key, value, ttlSeconds) => {
  if (!isRedisConfigured || redisClient.status !== 'ready') {
    return;
  }

  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    logger.warn(`Cache write failed for key ${key}: ${error.message}`);
  }
};

const invalidateUserAnalysisCache = async (userId) => {
  if (!userId || !isRedisConfigured || redisClient.status !== 'ready') {
    return;
  }

  const cachePrefix = `${buildUserCacheTag(userId)}:*`;

  try {
    const keys = await redisClient.keys(cachePrefix);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    logger.warn(`Cache invalidation failed for user ${userId}: ${error.message}`);
  }
};

const buildReportSummary = (report) => ({
  id: report._id,
  url: report.url,
  status: report.status,
  overallScore: report.overallScore ?? calculateOverallScore(report.scores),
  portfolioReadinessScore: ensureNumber(report.aiReviewStructured?.portfolioReadiness?.overallScore, 0),
  scores: report.scores,
  grade: report.aiReviewStructured?.grade || null,
  techStack: ensureArray(report.techStack),
  siteProfile: report.siteProfile || {},
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  completedAt: report.completedAt,
  failedAt: report.failedAt,
  errorMessage: report.errorMessage,
  isPublic: !!report.isPublic,
  publicShareToken: report.isPublic ? report.publicShareToken : null,
  workspaceContext: report.workspaceContext || { workspaceId: null, workspaceName: '' }
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

const ensureOwnedReport = async (reportId, actor) => {
  const report = await WebsiteReport.findById(reportId);
  const { userId } = getActorIdentity(actor);

  if (!report) {
    const error = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (report.userId.toString() !== userId.toString()) {
    const hasWorkspaceAccess = await canAccessWorkspaceReport(report, actor);
    if (!hasWorkspaceAccess) {
      const error = new Error('Not authorized to access this report');
      error.statusCode = 403;
      throw error;
    }
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

export const createReport = async (userId, url, analysisConfig = {}) => {
  const report = await WebsiteReport.create({
    userId,
    url,
    status: 'pending',
    analysisConfig,
    scheduleContext: {
      scheduleId: analysisConfig.scheduleId || null,
      triggeredBy: analysisConfig.triggeredBy === 'schedule' ? 'schedule' : 'manual'
    }
  });

  await invalidateUserAnalysisCache(report.userId);
  
  return report;
};

export const getJobStatus = async (jobId, actor) => {
  const job = await analysisQueue.getJob(jobId);
  const { userId } = getActorIdentity(actor);
  
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
      const hasWorkspaceAccess = await canAccessWorkspaceReport(report, actor);
      if (!hasWorkspaceAccess) {
        const error = new Error('Not authorized to access this report');
        error.statusCode = 403;
        throw error;
      }
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

export const addReportComment = async (reportId, userId, author, message) => {
  const report = await ensureOwnedReport(reportId, userId);
  report.collaboration = report.collaboration || { comments: [], tasks: [] };
  report.collaboration.comments.push({
    authorName: author.name || '',
    authorEmail: author.email || '',
    message
  });
  await report.save();
  return normalizeReport(report.toObject());
};

export const addReportTask = async (reportId, userId, taskInput) => {
  const report = await ensureOwnedReport(reportId, userId);
  report.collaboration = report.collaboration || { comments: [], tasks: [] };
  report.collaboration.tasks.push({
    title: taskInput.title,
    detail: taskInput.detail || '',
    assigneeName: taskInput.assigneeName || '',
    assigneeEmail: taskInput.assigneeEmail || '',
    status: taskInput.status || 'open',
    severity: taskInput.severity || 'Medium'
  });
  await report.save();
  return normalizeReport(report.toObject());
};

export const updateReportTask = async (reportId, taskId, userId, updates) => {
  const report = await ensureOwnedReport(reportId, userId);
  const task = report.collaboration?.tasks?.id(taskId);

  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  if (updates.title !== undefined) task.title = updates.title;
  if (updates.detail !== undefined) task.detail = updates.detail;
  if (updates.assigneeName !== undefined) task.assigneeName = updates.assigneeName;
  if (updates.assigneeEmail !== undefined) task.assigneeEmail = updates.assigneeEmail;
  if (updates.status !== undefined) task.status = updates.status;
  if (updates.severity !== undefined) task.severity = updates.severity;
  task.updatedAt = new Date();

  await report.save();
  return normalizeReport(report.toObject());
};

export const getReportRegression = async (reportId, actor) => {
  const { userId } = getActorIdentity(actor);
  const currentReport = await ensureOwnedReport(reportId, actor);

  if (currentReport.status !== 'completed') {
    const error = new Error('Only completed reports can be used for regression analysis');
    error.statusCode = 400;
    throw error;
  }

  const previousReport = await WebsiteReport.findOne({
    userId,
    url: currentReport.url,
    status: 'completed',
    createdAt: { $lt: currentReport.createdAt }
  })
    .sort({ createdAt: -1 })
    .lean();

  const current = normalizeReport(currentReport.toObject());

  if (!previousReport) {
    return {
      hasBaseline: false,
      currentReport: buildReportSummary(current)
    };
  }

  const baseline = normalizeReport(previousReport);
  const { comparisons, summary } = buildRegressionComparison(baseline, current);

  return {
    hasBaseline: true,
    currentReport: buildReportSummary(current),
    baselineReport: buildReportSummary(baseline),
    comparisons,
    summary
  };
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
  const normalizedFilters = {
    search: search.trim(),
    status: status || 'all',
    minScore: minScore ?? '',
    dateFrom: dateFrom || '',
    dateTo: dateTo || '',
    sortBy,
    page: safePage,
    limit: safeLimit
  };
  const cacheKey = buildListReportsCacheKey(userId, normalizedFilters);
  const cached = await readCache(cacheKey);

  if (cached) {
    return cached;
  }

  const [reports, total] = await Promise.all([
    WebsiteReport.find(query, REPORT_SUMMARY_PROJECTION).sort(sort).skip(skip).limit(safeLimit).lean(),
    WebsiteReport.countDocuments(query)
  ]);

  const result = {
    reports: reports.map(buildReportSummary),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1)
    }
  };

  await writeCache(cacheKey, result, LIST_REPORTS_CACHE_TTL_SECONDS);
  return result;
};

export const getDashboardInsights = async (userId) => {
  const cacheKey = buildDashboardInsightsCacheKey(userId);
  const cached = await readCache(cacheKey);

  if (cached) {
    return cached;
  }

  const reports = await WebsiteReport.find(
    { userId, status: 'completed' },
    {
      url: 1,
      overallScore: 1,
      scores: 1,
      createdAt: 1,
      'aiReviewStructured.portfolioReadiness.overallScore': 1,
      'aiReviewStructured.actionPlan.issue': 1
    }
  )
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

  const reportsByUrl = new Map();
  reports.forEach((report) => {
    const key = report.url;
    const list = reportsByUrl.get(key) || [];
    list.push(report);
    reportsByUrl.set(key, list);
  });

  const recentRegressions = [];
  reportsByUrl.forEach((urlReports) => {
    for (let i = 1; i < urlReports.length; i += 1) {
      const baseline = normalizeReport(urlReports[i - 1]);
      const latest = normalizeReport(urlReports[i]);
      const { summary } = buildRegressionComparison(baseline, latest);

      if (summary.overallDirection === 'regressed') {
        recentRegressions.push({
          url: latest.url,
          reportId: latest.id,
          baselineReportId: baseline.id,
          createdAt: latest.createdAt,
          overallScoreDelta: latest.overallScore - baseline.overallScore,
          regressionCount: summary.regressionCount
        });
      }
    }
  });

  recentRegressions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const result = {
    trend,
    repeatedIssues,
    bestReport,
    worstReport,
    improvementStreak,
    recentRegressions: recentRegressions.slice(0, 5)
  };

  await writeCache(cacheKey, result, DASHBOARD_INSIGHTS_CACHE_TTL_SECONDS);
  return result;
};

export const deleteReport = async (reportId, userId) => {
  const report = await ensureOwnedReport(reportId, userId);
  await removeScreenshotIfPresent(report.toObject());
  await report.deleteOne();
  await invalidateUserAnalysisCache(report.userId);
};

export const enableReportSharing = async (reportId, userId) => {
  const report = await ensureOwnedReport(reportId, userId);
  report.isPublic = true;
  report.sharedAt = new Date();
  report.ensureShareToken();
  await report.save();
  await invalidateUserAnalysisCache(report.userId);

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
  await invalidateUserAnalysisCache(report.userId);
};

export const compareReports = async (leftReportId, rightReportId, userId) => {
  const [leftReport, rightReport] = await Promise.all([
    ensureOwnedReport(leftReportId, userId),
    ensureOwnedReport(rightReportId, userId)
  ]);

  const incompleteReport = [leftReport, rightReport].find((report) => report.status !== 'completed');
  if (incompleteReport) {
    const error = new Error('Only completed reports can be compared');
    error.statusCode = 400;
    throw error;
  }

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
  const leftRoleCounts = left.crawlData?.roleCounts || {};
  const rightRoleCounts = right.crawlData?.roleCounts || {};
  const allRoles = [...new Set([...Object.keys(leftRoleCounts), ...Object.keys(rightRoleCounts)])];

  const addedTech = [...rightTech].filter((tech) => !leftTech.has(tech));
  const removedTech = [...leftTech].filter((tech) => !rightTech.has(tech));
  const pageRoleComparison = allRoles
    .map((role) => ({
      role,
      left: leftRoleCounts[role] ?? 0,
      right: rightRoleCounts[role] ?? 0,
      delta: (rightRoleCounts[role] ?? 0) - (leftRoleCounts[role] ?? 0)
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.role.localeCompare(b.role));
  const changedMetrics = scoreComparison
    .filter((item) => item.metric !== 'overallScore' && item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((item) => `${formatMetricLabel(item.metric)} ${item.delta > 0 ? '+' : ''}${item.delta}`);
  const leftType = left.siteProfile?.effectiveType || left.analysisConfig?.websiteType || 'general';
  const rightType = right.siteProfile?.effectiveType || right.analysisConfig?.websiteType || 'general';

  return {
    leftReport: buildReportSummary(left),
    rightReport: buildReportSummary(right),
    scoreComparison,
    summary: {
      sameUrl: left.url === right.url,
      overallDirection: classifyDelta(
        (scoreComparison.find((item) => item.metric === 'overallScore')?.delta ?? 0),
        1
      ),
      strongestChanges: changedMetrics,
      siteTypeChanged: leftType !== rightType
    },
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
      },
      siteProfile: {
        left: {
          requestedType: left.analysisConfig?.websiteType || 'auto',
          detectedType: left.siteProfile?.detectedType || leftType,
          effectiveType: leftType,
          missingRoles: left.siteProfile?.roleCoverage?.missingRoles || []
        },
        right: {
          requestedType: right.analysisConfig?.websiteType || 'auto',
          detectedType: right.siteProfile?.detectedType || rightType,
          effectiveType: rightType,
          missingRoles: right.siteProfile?.roleCoverage?.missingRoles || []
        }
      },
      crawlCoverage: {
        left: {
          totalPagesDiscovered: left.crawlData?.totalPagesDiscovered || 1,
          successfulPages: left.crawlData?.successfulPages || 0,
          roleCounts: leftRoleCounts
        },
        right: {
          totalPagesDiscovered: right.crawlData?.totalPagesDiscovered || 1,
          successfulPages: right.crawlData?.successfulPages || 0,
          roleCounts: rightRoleCounts
        },
        pageRoleComparison
      },
      screenshots: {
        left: left.puppeteerData?.screenshotFilename || null,
        right: right.puppeteerData?.screenshotFilename || null
      }
    }
  };
};

export const buildGitHubIssues = async (reportId, userId, options = {}) => {
  const report = await getReportById(reportId, userId);
  const actionPlan = report.aiReviewStructured?.actionPlan || [];
  const aiFixes = report.aiReviewStructured?.aiFixes || [];
  const selectedItems = [
    ...actionPlan.map((item) => ({ ...item, kind: 'action' })),
    ...aiFixes.map((item) => ({ ...item, kind: 'fix', issue: item.title, recommendation: item.suggestion, rationale: item.whyItMatters }))
  ]
    .filter((item) => ['Critical', 'High'].includes(item.severity) || item.priority === 'Must Fix')
    .slice(0, 6);

  const issues = selectedItems.map((item) => ({
    title: `[SiteGrade] ${item.issue || item.title}`,
    labels: ['sitegrade', String(item.severity || 'medium').toLowerCase()],
    body: buildGitHubIssueBody(report, item)
  }));

  const result = {
    dryRun: !options.createLive,
    count: issues.length,
    issues
  };

  if (!options.createLive || !options.repoOwner || !options.repoName || !process.env.GITHUB_TOKEN) {
    return result;
  }

  const createdIssues = [];
  for (const issue of issues) {
    const response = await fetch(`https://api.github.com/repos/${options.repoOwner}/${options.repoName}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SiteGrade'
      },
      body: JSON.stringify(issue)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`GitHub issue creation failed: ${response.status} - ${errorText}`);
      error.statusCode = 502;
      throw error;
    }

    const created = await response.json();
    createdIssues.push({
      id: created.id,
      number: created.number,
      url: created.html_url,
      title: created.title
    });
  }

  return {
    ...result,
    dryRun: false,
    createdIssues
  };
};

export const updateReportWithResults = async (reportId, data) => {
  const scoreBreakdown = buildScoreBreakdown(data.scores, {
    websiteType: data.siteProfile?.effectiveType,
    crawlData: data.crawlData
  });
  const overallScore = scoreBreakdown.overallScore;
  const siteProfile = data.siteProfile
    ? {
        ...data.siteProfile,
        scoringModel: {
          ...(data.siteProfile.scoringModel || {}),
          weightedBaseScore: scoreBreakdown.weightedBaseScore,
          crawlContribution: scoreBreakdown.crawlContribution,
          weights: scoreBreakdown.weights
        },
        roleCoverage: scoreBreakdown.coverage
      }
    : undefined;
  const report = await WebsiteReport.findByIdAndUpdate(
    reportId,
    {
      status: 'completed',
      scores: data.scores,
      overallScore,
      aiReview: data.aiReview,
      lighthouseData: data.lighthouseData,
      puppeteerData: data.puppeteerData,
      crawlData: data.crawlData,
      benchmarkData: data.benchmarkData,
      fieldData: data.fieldData,
      siteProfile,
      fixMode: data.fixMode,
      techStack: data.techStack,
      aiReviewStructured: data.aiReviewStructured,
      completedAt: new Date()
    },
    { new: true }
  );

  if (report?.userId) {
    await invalidateUserAnalysisCache(report.userId);
  }
  
  return report;
};

export const markReportProcessing = async (reportId) => {
  const report = await WebsiteReport.findByIdAndUpdate(reportId, { status: 'processing' }, { new: true });
  if (report?.userId) {
    await invalidateUserAnalysisCache(report.userId);
  }
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

  if (report?.userId) {
    await invalidateUserAnalysisCache(report.userId);
  }
  
  return report;
};
