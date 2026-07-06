import { Worker } from 'bullmq';
import { closeRedis, connectRedis, isRedisConfigured, redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import * as analysisService from '../modules/analysis/analysis.service.js';
import {
  buildScoreBreakdown,
  inferWebsiteType
} from '../modules/analysis/analysis.helpers.js';
import { analyzeWithPuppeteer } from '../services/puppeteer.service.js';
import { analyzeWithLighthouse } from '../services/lighthouse.service.js';
import { getCruxFieldData } from '../services/crux.service.js';
import { generateAIReview } from '../services/aiReview.service.js';
import { handleScheduledReportCompleted, handleScheduledReportFailed } from '../modules/schedules/schedules.service.js';
import { closeSharedPuppeteerBrowser } from '../utils/browser.js';
import { logMemoryUsage } from '../utils/runtimeDiagnostics.js';
import { fileURLToPath } from 'url';

const workerConcurrency = Math.max(Number(process.env.ANALYSIS_WORKER_CONCURRENCY) || 1, 1);
const workerRateLimitMax = Math.max(Number(process.env.ANALYSIS_WORKER_RATE_LIMIT_MAX) || 5, 1);
const workerRateLimitDurationMs = Math.max(Number(process.env.ANALYSIS_WORKER_RATE_LIMIT_DURATION_MS) || 60000, 1000);
const defaultParallelAuditMode = false;
const shouldRunAuditsInParallel = !['0', 'false', 'no', 'off'].includes(
  String(process.env.ANALYSIS_RUN_AUDITS_IN_PARALLEL ?? String(defaultParallelAuditMode)).trim().toLowerCase()
);
const analysisJobLockDurationMs = Math.max(Number(process.env.ANALYSIS_JOB_LOCK_DURATION_MS) || 600000, 30000);
const analysisJobStalledIntervalMs = Math.max(Number(process.env.ANALYSIS_JOB_STALLED_INTERVAL_MS) || 30000, 5000);
const analysisJobMaxStalledCount = Math.max(Number(process.env.ANALYSIS_JOB_MAX_STALLED_COUNT) || 2, 1);
const shouldClosePuppeteerBeforeLighthouse = !['0', 'false', 'no', 'off'].includes(
  String(process.env.ANALYSIS_CLOSE_PUPPETEER_BEFORE_LIGHTHOUSE ?? 'true').trim().toLowerCase()
);

const averageScoreSet = (sets = []) => ({
  performance: Math.round(sets.reduce((sum, item) => sum + (item.performance || 0), 0) / (sets.length || 1)),
  seo: Math.round(sets.reduce((sum, item) => sum + (item.seo || 0), 0) / (sets.length || 1)),
  accessibility: Math.round(sets.reduce((sum, item) => sum + (item.accessibility || 0), 0) / (sets.length || 1)),
  bestPractices: Math.round(sets.reduce((sum, item) => sum + (item.bestPractices || 0), 0) / (sets.length || 1))
});

const buildCompetitorBenchmark = (targetReport, competitorReports = []) => {
  const successfulCompetitors = competitorReports.filter((item) => item.status === 'completed');

  if (!successfulCompetitors.length) {
    return {
      compared: 0,
      targetRank: 1,
      entries: [],
      summary: 'No competitor benchmark was completed.'
    };
  }

  const entries = [
    { ...targetReport, label: 'Your site', isTarget: true },
    ...successfulCompetitors.map((item) => ({ ...item, label: item.url, isTarget: false }))
  ].sort((a, b) => b.overallScore - a.overallScore);

  const targetRank = entries.findIndex((item) => item.isTarget) + 1;
  return {
    compared: successfulCompetitors.length,
    targetRank,
    entries,
    summary: targetRank === 1
      ? 'Your site currently leads this benchmark set.'
      : `Your site ranks #${targetRank} out of ${entries.length} in this benchmark set.`
  };
};

/**
 * Main analysis processor
 * Orchestrates Puppeteer scrape, Lighthouse audit, and AI review generation
 */
const processAnalysis = async (job) => {
  const { reportId, url, analysisConfig = {} } = job.data;
  const auditProfiles = Array.isArray(analysisConfig.auditProfiles) && analysisConfig.auditProfiles.length
    ? analysisConfig.auditProfiles
    : ['mobile'];
  
  logger.info(`[Job ${job.id}] Starting analysis for ${url}`);

  try {
    await analysisService.markReportProcessing(reportId);

    // Phase 1: Launch core audits concurrently (0-60%)
    await job.updateProgress(5);
    logger.info(
      `[Job ${job.id}] Phase 1: Starting Puppeteer and Lighthouse audits ${shouldRunAuditsInParallel ? 'in parallel' : 'sequentially'}`
    );

    const runPuppeteerAudit = async () => {
      logger.info(`[Job ${job.id}] Starting Puppeteer audit`);
      logMemoryUsage(`[Job ${job.id}] Memory before Puppeteer audit`, {
        reportId,
        url
      });
      const result = await analyzeWithPuppeteer(url, reportId, analysisConfig);
      await job.updateProgress(30);
      logger.info(`[Job ${job.id}] Puppeteer complete - detected ${result.techStack.length} technologies`);
      logMemoryUsage(`[Job ${job.id}] Memory after Puppeteer audit`, {
        reportId,
        url
      });

      if (shouldClosePuppeteerBeforeLighthouse) {
        logger.info(`[Job ${job.id}] Closing shared Puppeteer browser before Lighthouse to reduce memory pressure`);
        await closeSharedPuppeteerBrowser().catch((error) => {
          logger.warn(`[Job ${job.id}] Failed to close shared Puppeteer browser before Lighthouse`, {
            message: error.message
          });
        });
        logMemoryUsage(`[Job ${job.id}] Memory after Puppeteer browser cleanup`, {
          reportId,
          url
        });
      }

      return result;
    };

    const runLighthouseAudits = async () => {
      logger.info(`[Job ${job.id}] Starting Lighthouse audits`, {
        profiles: auditProfiles,
        parallel: shouldRunAuditsInParallel
      });

      if (shouldRunAuditsInParallel) {
        return Promise.all(
          auditProfiles.map((profile) => analyzeWithLighthouse(url, { profile }))
        );
      }

      const results = [];
      for (const profile of auditProfiles) {
        results.push(await analyzeWithLighthouse(url, { profile }));
      }

      return results;
    };

    const trackedFieldDataPromise = getCruxFieldData(url);
    const [puppeteerData, lighthouseProfiles, fieldData] = shouldRunAuditsInParallel
      ? await Promise.all([
          runPuppeteerAudit(),
          runLighthouseAudits(),
          trackedFieldDataPromise
        ])
      : [
          await runPuppeteerAudit(),
          await runLighthouseAudits(),
          await trackedFieldDataPromise
        ];

    await job.updateProgress(60);
    await job.updateProgress(65);
    const lighthouseByProfile = Object.fromEntries(lighthouseProfiles.map((item) => [item.profile, item]));
    const primaryLighthouseData = lighthouseByProfile.mobile || lighthouseProfiles[0];
    const lighthouseData = {
      ...primaryLighthouseData,
      scores: averageScoreSet(lighthouseProfiles.map((item) => item.scores)),
      profiles: lighthouseByProfile,
      opportunityMap: lighthouseProfiles.flatMap((item) =>
        item.opportunityMap.map((opportunity) => ({
          ...opportunity,
          profile: item.profile
        }))
      ),
      accessibilityIssueDetails: lighthouseProfiles.flatMap((item) =>
        item.accessibilityIssueDetails.map((issue) => ({
          ...issue,
          profile: item.profile
        }))
      )
    };
    logger.info(`[Job ${job.id}] Lighthouse complete - Performance: ${lighthouseData.scores.performance}`);
    logMemoryUsage(`[Job ${job.id}] Memory after Lighthouse audits`, {
      reportId,
      url,
      profiles: auditProfiles
    });

    let benchmarkData = {
      compared: 0,
      targetRank: 1,
      entries: [],
      summary: 'No competitor benchmark was completed.'
    };
    if (analysisConfig.competitorUrls?.length) {
      const competitorResults = [];

      for (const competitorUrl of analysisConfig.competitorUrls) {
        try {
          const competitorPuppeteer = await analyzeWithPuppeteer(competitorUrl, `${reportId}-benchmark`, {
            scanMode: 'single',
            crawlMaxPages: 1
          });
          const competitorLighthouse = await analyzeWithLighthouse(competitorUrl, {
            profile: auditProfiles[0] || 'mobile'
          });

          competitorResults.push({
            status: 'completed',
            url: competitorUrl,
            overallScore: Math.round((
              competitorLighthouse.scores.performance +
              competitorLighthouse.scores.seo +
              competitorLighthouse.scores.accessibility +
              competitorLighthouse.scores.bestPractices +
              competitorPuppeteer.securityScore
            ) / 5),
            scores: {
              ...competitorLighthouse.scores,
              security: competitorPuppeteer.securityScore
            },
            pageType: competitorPuppeteer.pageType
          });
        } catch (error) {
          competitorResults.push({
            status: 'failed',
            url: competitorUrl,
            error: error.message
          });
        }
      }

      benchmarkData = buildCompetitorBenchmark({
        url,
        overallScore: Math.round((
          lighthouseData.scores.performance +
          lighthouseData.scores.seo +
          lighthouseData.scores.accessibility +
          lighthouseData.scores.bestPractices +
          puppeteerData.securityScore
        ) / 5),
        scores: {
          ...lighthouseData.scores,
          security: puppeteerData.securityScore
        },
        pageType: puppeteerData.pageType
      }, competitorResults);
      benchmarkData.results = competitorResults;
    }
    await job.updateProgress(72);

    // Phase 2: AI Review Generation (60-85%)
    logger.info(`[Job ${job.id}] Phase 2: AI review generation`);
    
    const aiReviewData = await generateAIReview(lighthouseData, {
      ...puppeteerData,
      benchmarkData,
      fieldData,
      analysisConfig
    });
    await job.updateProgress(85);
    logger.info(`[Job ${job.id}] AI review complete - Grade: ${aiReviewData.overallGrade}`);

    // Phase 3: Compile and save results (85-100%)
    await job.updateProgress(90);
    logger.info(`[Job ${job.id}] Phase 3: Compiling final report`);

    const finalScores = {
      performance: lighthouseData.scores.performance,
      seo: lighthouseData.scores.seo,
      accessibility: lighthouseData.scores.accessibility,
      security: puppeteerData.securityScore,
      bestPractices: lighthouseData.scores.bestPractices
    };
    const detectedWebsiteType = inferWebsiteType({
      requestedType: analysisConfig.websiteType,
      pageType: puppeteerData.pageType,
      crawlData: puppeteerData.crawlData,
      techStack: puppeteerData.techStack,
      title: puppeteerData.title,
      url
    });
    const scoreBreakdown = buildScoreBreakdown(finalScores, {
      websiteType: detectedWebsiteType,
      crawlData: puppeteerData.crawlData
    });
    const siteProfile = {
      requestedType: analysisConfig.websiteType || 'auto',
      detectedType: detectedWebsiteType,
      effectiveType: detectedWebsiteType,
      scoringModel: {
        weights: scoreBreakdown.weights,
        weightedBaseScore: scoreBreakdown.weightedBaseScore,
        crawlContribution: scoreBreakdown.crawlContribution
      },
      roleCoverage: scoreBreakdown.coverage
    };

    // Build comprehensive AI review text
    const aiReviewText = buildAIReviewText(
      aiReviewData,
      lighthouseData,
      puppeteerData,
      benchmarkData,
      fieldData,
      siteProfile
    );

    const results = {
      scores: finalScores,
      aiReview: aiReviewText,
      lighthouseData: {
        profileScores: Object.fromEntries(
          Object.entries(lighthouseData.profiles || {}).map(([profile, data]) => [profile, data.scores])
        ),
        primaryProfile: primaryLighthouseData.profile,
        ...lighthouseData.metrics,
        diagnostics: lighthouseData.diagnostics,
        accessibilityDetails: lighthouseData.accessibilityDetails,
        accessibilityIssueDetails: lighthouseData.accessibilityIssueDetails,
        seoDetails: lighthouseData.seoDetails,
        opportunityMap: lighthouseData.opportunityMap,
        profiles: lighthouseData.profiles,
        rawInfo: lighthouseData.rawLhr
      },
      puppeteerData: {
        screenshotPath: puppeteerData.screenshotPath,
        screenshotFilename: puppeteerData.screenshotFilename,
        finalUrl: puppeteerData.finalUrl,
        title: puppeteerData.title,
        metaDescription: puppeteerData.metaDescription,
        titleLength: puppeteerData.titleLength,
        metaDescriptionLength: puppeteerData.metaDescriptionLength,
        hasMetaDescription: puppeteerData.hasMetaDescription,
        hasViewportMeta: puppeteerData.hasViewportMeta,
        hasCanonicalTag: puppeteerData.hasCanonicalTag,
        canonicalUrl: puppeteerData.canonicalUrl,
        robotsMetaContent: puppeteerData.robotsMetaContent,
        isIndexable: puppeteerData.isIndexable,
        isFollowable: puppeteerData.isFollowable,
        hasNoindex: puppeteerData.hasNoindex,
        hasNofollow: puppeteerData.hasNofollow,
        openGraph: puppeteerData.openGraph,
        twitterCardPresent: puppeteerData.twitterCardPresent,
        faviconPresent: puppeteerData.faviconPresent,
        robotsTxtUrl: puppeteerData.robotsTxtUrl,
        robotsTxtAccessible: puppeteerData.robotsTxtAccessible,
        sitemapUrl: puppeteerData.sitemapUrl,
        sitemapAccessible: puppeteerData.sitemapAccessible,
        isHttps: puppeteerData.isHttps,
        loadTime: puppeteerData.loadTime,
        domElements: puppeteerData.domElements,
        pageSize: puppeteerData.pageSize,
        consoleErrors: puppeteerData.consoleErrors,
        headings: puppeteerData.headings,
        securityHeaders: puppeteerData.securityHeaders,
        securityScore: puppeteerData.securityScore,
        responseStatus: puppeteerData.responseStatus,
        charset: puppeteerData.charset,
        lang: puppeteerData.lang,
        images: puppeteerData.images,
        links: puppeteerData.links,
        hasForm: puppeteerData.hasForm,
        hasTable: puppeteerData.hasTable,
        hasCanvas: puppeteerData.hasCanvas,
        hasVideo: puppeteerData.hasVideo,
        hasAudio: puppeteerData.hasAudio,
        hasIframe: puppeteerData.hasIframe,
        hasSvg: puppeteerData.hasSvg,
        bodyTextLength: puppeteerData.bodyTextLength,
        imagesWithoutAlt: puppeteerData.imagesWithoutAlt,
        structuredDataScripts: puppeteerData.structuredDataScripts,
        hreflangLinks: puppeteerData.hreflangLinks,
        hreflangCount: puppeteerData.hreflangCount,
        internalLinks: puppeteerData.internalLinks,
        externalLinks: puppeteerData.externalLinks,
        insecureFormCount: puppeteerData.insecureFormCount,
        mixedContentRequests: puppeteerData.mixedContentRequests,
        brokenLinks: puppeteerData.brokenLinks,
        redirectChains: puppeteerData.redirectChains,
        checkedLinks: puppeteerData.checkedLinks,
        pageType: puppeteerData.pageType,
        accessibilitySamples: puppeteerData.accessibilitySamples
      },
      crawlData: puppeteerData.crawlData,
      benchmarkData,
      fieldData,
      siteProfile,
      fixMode: {
        enabled: analysisConfig.enableFixMode !== false,
        checklist: aiReviewData.actionPlan.map((item, index) => ({
          id: index + 1,
          title: item.issue,
          task: item.recommendation,
          severity: item.severity,
          effort: item.effort,
          estimatedScoreImpact: item.estimatedScoreImpact
        })),
        starterTasks: aiReviewData.aiFixes.map((fix, index) => ({
          id: index + 1,
          title: fix.title,
          category: fix.category,
          suggestion: fix.suggestion,
          codeExample: fix.codeExample
        }))
      },
      techStack: puppeteerData.techStack,
      aiReviewStructured: {
        grade: aiReviewData.overallGrade,
        strengths: aiReviewData.strengths,
        weaknesses: aiReviewData.weaknesses,
        portfolioReadiness: aiReviewData.portfolioReadiness,
        recruiterMode: aiReviewData.recruiterMode,
        actionPlan: aiReviewData.actionPlan,
        aiFixes: aiReviewData.aiFixes,
        interviewSummary: aiReviewData.interviewSummary
      }
    };

    await job.updateProgress(95);
    
    // Save to database
    const report = await analysisService.updateReportWithResults(reportId, results);
    await handleScheduledReportCompleted(report);
    
    await job.updateProgress(100);
    logger.info(`[Job ${job.id}] Analysis complete for ${url} - Final grade: ${aiReviewData.overallGrade}`);

    return report;
  } catch (error) {
    logMemoryUsage(`[Job ${job.id}] Memory snapshot after analysis failure`, {
      reportId,
      url,
      auditProfiles
    });
    logger.error(`[Job ${job.id}] Analysis failed`, {
      reportId,
      url,
      auditProfiles,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Builds the formatted AI review text from structured data
 */
const buildAIReviewText = (aiReviewData, lighthouseData, puppeteerData, benchmarkData, fieldData, siteProfile = {}) => {
  const { recruiterReview, strengths, weaknesses, overallGrade } = aiReviewData;
  
  const sections = [
    `# SiteGrade Analysis Report`,
    ``,
    `## Overall Assessment: Grade ${overallGrade}`,
    ``,
    `---`,
    ``,
    `## Recruiter Review`,
    ``,
    recruiterReview,
    ``,
    `---`,
    ``,
    `## Key Strengths`,
    ``,
    ...strengths.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `## Areas for Improvement`,
    ``,
    ...weaknesses.map((w, i) => `${i + 1}. ${w}`),
    ``,
    `---`,
    ``,
    `## Technical Summary`,
    ``,
    `**Performance Score:** ${lighthouseData.scores.performance}/100`,
    `**SEO Score:** ${lighthouseData.scores.seo}/100`,
    `**Accessibility Score:** ${lighthouseData.scores.accessibility}/100`,
    `**Best Practices Score:** ${lighthouseData.scores.bestPractices}/100`,
    `**Security Score:** ${puppeteerData.securityScore}/100`,
    `**Page Type:** ${puppeteerData.pageType || 'N/A'}`,
    `**Website Type Profile:** ${siteProfile.effectiveType || 'general'}`,
    ``,
    `**Core Web Vitals:**`,
    `- First Contentful Paint: ${lighthouseData.metrics.firstContentfulPaint}`,
    `- Largest Contentful Paint: ${lighthouseData.metrics.largestContentfulPaint}`,
    `- Time to Interactive: ${lighthouseData.metrics.timeToInteractive}`,
    `- Cumulative Layout Shift: ${lighthouseData.metrics.cumulativeLayoutShift}`,
    `- Total Blocking Time: ${lighthouseData.metrics.totalBlockingTime}`,
    ``,
    `**Page Details:**`,
    `- Title: ${puppeteerData.title || 'N/A'}`,
    `- Load Time: ${puppeteerData.loadTime}`,
    `- DOM Elements: ${puppeteerData.domElements.toLocaleString()}`,
    `- Page Size: ${puppeteerData.pageSize}`,
    `- Console Errors: ${puppeteerData.consoleErrors}`,
    `- HTTPS: ${puppeteerData.isHttps ? 'Yes' : 'No'}`,
    `- Meta Description: ${puppeteerData.hasMetaDescription ? 'Present' : 'Missing'}`,
    `- Viewport Meta: ${puppeteerData.hasViewportMeta ? 'Present' : 'Missing'}`,
    `- Broken Links: ${puppeteerData.brokenLinks?.length || 0}`,
    `- Redirect Chains: ${puppeteerData.redirectChains?.length || 0}`,
    `- Hreflang Tags: ${puppeteerData.hreflangCount || 0}`,
    ``,
    `**Detected Technologies:** ${puppeteerData.techStack.join(', ') || 'None detected'}`,
    `**Audit Profiles:** ${Object.keys(lighthouseData.profiles || {}).join(', ') || lighthouseData.profile}`,
    `**Top Opportunities:** ${(lighthouseData.opportunityMap || []).slice(0, 3).map((item) => `${item.title} (+${item.estimatedScoreImpact})`).join(', ') || 'None highlighted'}`,
    `**Crawl Summary:** ${puppeteerData.crawlData?.totalPagesDiscovered || 1} page(s) reviewed`,
    `**Page Roles Found:** ${Object.entries(puppeteerData.crawlData?.roleCounts || {}).filter(([, count]) => count > 0).map(([role, count]) => `${role} (${count})`).join(', ') || 'homepage (1)'}`,
    `**Competitor Benchmark:** ${benchmarkData?.summary || 'No competitors compared'}`,
    `**Field Data:** ${fieldData?.available ? `LCP p75 ${fieldData.metrics?.largestContentfulPaint ?? 'N/A'}, INP p75 ${fieldData.metrics?.interactionToNextPaint ?? 'N/A'}` : fieldData?.reason || 'Unavailable'}`,
    ``,
    `*Analysis generated by SiteGrade AI*`
  ];

  return sections.join('\n');
};

let workerInstance;
let shutdownHandlersRegistered = false;

export const startAnalysisWorker = () => {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker('website-analysis', processAnalysis, {
    connection: redisClient,
    concurrency: workerConcurrency,
    lockDuration: analysisJobLockDurationMs,
    stalledInterval: analysisJobStalledIntervalMs,
    maxStalledCount: analysisJobMaxStalledCount,
    limiter: {
      max: workerRateLimitMax,
      duration: workerRateLimitDurationMs
    }
  });

  workerInstance.on('completed', (job) => {
    logger.info(`[Job ${job.id}] Completed successfully`);
  });

  workerInstance.on('failed', async (job, err) => {
    logger.error(`[Job ${job?.id}] Failed`, {
      reportId: job?.data?.reportId,
      url: job?.data?.url,
      message: err.message,
      stack: err.stack
    });
    
    if (job?.data?.reportId) {
      try {
        await analysisService.markReportFailed(
          job.data.reportId, 
          err.message || 'Unknown error during analysis'
        );
        await handleScheduledReportFailed(job.data.reportId, err.message || 'Unknown error during analysis');
        logger.info(`[Job ${job.id}] Report marked as failed in database`);
      } catch (dbError) {
        logger.error(`[Job ${job.id}] Failed to update report status:`, dbError);
      }
    }
  });

  workerInstance.on('progress', (job, progress) => {
    logger.debug(`[Job ${job.id}] Progress: ${progress}%`);
  });

  workerInstance.on('active', (job) => {
    logger.info(`[Job ${job.id}] Started processing`);
    logMemoryUsage(`[Job ${job.id}] Memory at job start`, {
      reportId: job?.data?.reportId,
      url: job?.data?.url
    });
  });

  workerInstance.on('stalled', (jobId) => {
    logger.warn(`[Job ${jobId}] Stalled`);
  });

  if (!shutdownHandlersRegistered) {
    shutdownHandlersRegistered = true;

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down worker gracefully...`);
      if (workerInstance) {
        await workerInstance.close();
      }
      await closeSharedPuppeteerBrowser().catch((error) => {
        logger.warn('Failed to close shared Puppeteer browser cleanly', {
          message: error.message
        });
      });
      await closeRedis();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception in worker:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection in worker:', err);
    });
  }

  logger.info('Analysis worker started and listening for jobs', {
    concurrency: workerConcurrency,
    rateLimitMax: workerRateLimitMax,
    rateLimitDurationMs: workerRateLimitDurationMs,
    shouldRunAuditsInParallel,
    analysisJobLockDurationMs,
    analysisJobStalledIntervalMs,
    analysisJobMaxStalledCount
  });
  return workerInstance;
};

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  connectRedis().then((connection) => {
    if (!connection && isRedisConfigured) {
      logger.warn(
        'Worker started while Redis is unavailable. It will rely on reconnect attempts until Redis becomes reachable.'
      );
    }
  });
  startAnalysisWorker();
}
