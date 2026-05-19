import { Worker } from 'bullmq';
import { closeRedis, connectRedis, isRedisConfigured, redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import * as analysisService from '../modules/analysis/analysis.service.js';
import { analyzeWithPuppeteer } from '../services/puppeteer.service.js';
import { analyzeWithLighthouse } from '../services/lighthouse.service.js';
import { generateAIReview } from '../services/aiReview.service.js';
import { fileURLToPath } from 'url';

/**
 * Main analysis processor
 * Orchestrates Puppeteer scrape, Lighthouse audit, and AI review generation
 */
const processAnalysis = async (job) => {
  const { reportId, url } = job.data;
  
  logger.info(`[Job ${job.id}] Starting analysis for ${url}`);

  try {
    await analysisService.markReportProcessing(reportId);

    // Phase 1: Puppeteer Analysis (0-30%)
    await job.updateProgress(5);
    logger.info(`[Job ${job.id}] Phase 1: Puppeteer analysis`);
    
    const puppeteerData = await analyzeWithPuppeteer(url, reportId);
    await job.updateProgress(30);
    logger.info(`[Job ${job.id}] Puppeteer complete - detected ${puppeteerData.techStack.length} technologies`);

    // Phase 2: Lighthouse Audit (30-60%)
    await job.updateProgress(35);
    logger.info(`[Job ${job.id}] Phase 2: Lighthouse audit`);
    
    const lighthouseData = await analyzeWithLighthouse(url);
    await job.updateProgress(60);
    logger.info(`[Job ${job.id}] Lighthouse complete - Performance: ${lighthouseData.scores.performance}`);

    // Phase 3: AI Review Generation (60-85%)
    await job.updateProgress(65);
    logger.info(`[Job ${job.id}] Phase 3: AI review generation`);
    
    const aiReviewData = await generateAIReview(lighthouseData, puppeteerData);
    await job.updateProgress(85);
    logger.info(`[Job ${job.id}] AI review complete - Grade: ${aiReviewData.overallGrade}`);

    // Phase 4: Compile and save results (85-100%)
    await job.updateProgress(90);
    logger.info(`[Job ${job.id}] Phase 4: Compiling final report`);

    // Calculate security score from Puppeteer headers + Lighthouse best practices
    const securityScore = Math.round(
      (puppeteerData.securityScore + lighthouseData.scores.bestPractices) / 2
    );

    const finalScores = {
      performance: lighthouseData.scores.performance,
      seo: lighthouseData.scores.seo,
      accessibility: lighthouseData.scores.accessibility,
      security: securityScore,
      bestPractices: lighthouseData.scores.bestPractices
    };

    // Build comprehensive AI review text
    const aiReviewText = buildAIReviewText(aiReviewData, lighthouseData, puppeteerData);

    const results = {
      scores: finalScores,
      aiReview: aiReviewText,
      lighthouseData: {
        ...lighthouseData.metrics,
        diagnostics: lighthouseData.diagnostics,
        accessibilityDetails: lighthouseData.accessibilityDetails,
        seoDetails: lighthouseData.seoDetails,
        rawInfo: lighthouseData.rawLhr
      },
      puppeteerData: {
        screenshotPath: puppeteerData.screenshotPath,
        title: puppeteerData.title,
        metaDescription: puppeteerData.metaDescription,
        hasMetaDescription: puppeteerData.hasMetaDescription,
        hasViewportMeta: puppeteerData.hasViewportMeta,
        isHttps: puppeteerData.isHttps,
        loadTime: puppeteerData.loadTime,
        domElements: puppeteerData.domElements,
        pageSize: puppeteerData.pageSize,
        consoleErrors: puppeteerData.consoleErrors,
        headings: puppeteerData.headings,
        securityHeaders: puppeteerData.securityHeaders,
        securityScore: puppeteerData.securityScore,
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
        bodyTextLength: puppeteerData.bodyTextLength
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
    
    await job.updateProgress(100);
    logger.info(`[Job ${job.id}] Analysis complete for ${url} - Final grade: ${aiReviewData.overallGrade}`);

    return report;
  } catch (error) {
    logger.error(`[Job ${job.id}] Analysis failed:`, error);
    throw error;
  }
};

/**
 * Builds the formatted AI review text from structured data
 */
const buildAIReviewText = (aiReviewData, lighthouseData, puppeteerData) => {
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
    ``,
    `**Detected Technologies:** ${puppeteerData.techStack.join(', ') || 'None detected'}`,
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
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000
    }
  });

  workerInstance.on('completed', (job) => {
    logger.info(`[Job ${job.id}] Completed successfully`);
  });

  workerInstance.on('failed', async (job, err) => {
    logger.error(`[Job ${job?.id}] Failed:`, err.message);
    
    if (job?.data?.reportId) {
      try {
        await analysisService.markReportFailed(
          job.data.reportId, 
          err.message || 'Unknown error during analysis'
        );
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

  logger.info('Analysis worker started and listening for jobs');
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
