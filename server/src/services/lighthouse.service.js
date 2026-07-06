import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { logger } from '../config/logger.js';
import { getBrowserLaunchArgs, getChromeExecutablePath } from '../utils/browser.js';
import { logMemoryUsage } from '../utils/runtimeDiagnostics.js';

const lighthouseTimeoutMs = Math.max(Number(process.env.LIGHTHOUSE_TIMEOUT_MS) || 120000, 30000);

const PERFORMANCE_OPPORTUNITY_AUDITS = [
  'render-blocking-resources',
  'unused-javascript',
  'unused-css-rules',
  'offscreen-images',
  'modern-image-formats',
  'uses-optimized-images',
  'uses-text-compression',
  'server-response-time',
  'unminified-javascript',
  'unminified-css'
];

const ACCESSIBILITY_DETAIL_AUDITS = [
  'aria-roles',
  'aria-name',
  'button-name',
  'link-name',
  'image-alt',
  'label',
  'color-contrast',
  'heading-order',
  'html-has-lang',
  'meta-viewport'
];

const getProfileConfig = (profile = 'mobile') => {
  if (profile === 'desktop') {
    return {
      screenEmulation: {
        mobile: false,
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        disabled: false
      },
      formFactor: 'desktop',
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0
      }
    };
  }

  return {
    screenEmulation: {
      mobile: true,
      width: 360,
      height: 640,
      deviceScaleFactor: 2,
      disabled: false
    },
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 565,
      downloadThroughputKbps: 1474.56,
      uploadThroughputKbps: 675
    }
  };
};

const formatMetric = (value) => {
  if (value === undefined || value === null) return 'N/A';
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const estimateOpportunityImpact = (audit) => {
  const savingsMs = audit?.details?.overallSavingsMs || audit?.numericValue || 0;
  const savingsBytes = audit?.details?.overallSavingsBytes || 0;
  const impact = Math.round(
    Math.min(
      25,
      (savingsMs / 250) + (savingsBytes / (150 * 1024)) + ((1 - (audit?.score ?? 0)) * 10)
    )
  );

  return Math.max(1, impact);
};

const buildOpportunityMap = (audits = {}) => (
  PERFORMANCE_OPPORTUNITY_AUDITS
    .map((auditKey) => {
      const audit = audits[auditKey];
      if (!audit || audit.score === 1) {
        return null;
      }

      return {
        auditKey,
        title: audit.title || auditKey,
        description: audit.description || '',
        estimatedScoreImpact: estimateOpportunityImpact(audit),
        estimatedSavingsMs: Math.round(audit?.details?.overallSavingsMs || 0),
        estimatedSavingsBytes: Math.round(audit?.details?.overallSavingsBytes || 0),
        displayValue: audit.displayValue || 'Opportunity available'
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.estimatedScoreImpact - a.estimatedScoreImpact)
);

const buildAccessibilityIssueDetails = (audits = {}) => (
  ACCESSIBILITY_DETAIL_AUDITS
    .map((auditKey) => {
      const audit = audits[auditKey];
      if (!audit || audit.score === 1) {
        return null;
      }

      const impactedElements = Array.isArray(audit?.details?.items)
        ? audit.details.items.slice(0, 5).map((item) => ({
            nodeLabel: item?.node?.selector || item?.node?.snippet || item?.node?.explanation || 'Element',
            text: item?.node?.snippet || item?.node?.nodeLabel || item?.explanation || ''
          }))
        : [];

      return {
        auditKey,
        title: audit.title || auditKey,
        description: audit.description || '',
        score: Math.round((audit.score || 0) * 100),
        impactedElements
      };
    })
    .filter(Boolean)
);

export const analyzeWithLighthouse = async (url, options = {}) => {
  const profile = options.profile === 'desktop' ? 'desktop' : 'mobile';
  let chrome;

  try {
    const chromePath = await getChromeExecutablePath();
    const chromeFlags = ['--headless', ...getBrowserLaunchArgs()];

    logMemoryUsage('Memory before Lighthouse Chrome launch', {
      url,
      profile
    });
    logger.info('Launching Chrome for Lighthouse audit', {
      url,
      profile,
      chromePath,
      platform: process.platform
    });

    chrome = await chromeLauncher.launch({
      chromePath,
      chromeFlags,
      logLevel: 'error'
    });
    logMemoryUsage('Memory after Lighthouse Chrome launch', {
      url,
      profile,
      chromePort: chrome.port
    });

    const profileConfig = getProfileConfig(profile);
    const runnerResult = await Promise.race([
      lighthouse(url, {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        port: chrome.port,
        throttling: profileConfig.throttling,
        screenEmulation: profileConfig.screenEmulation,
        formFactor: profileConfig.formFactor
      }),
      new Promise((_, reject) => {
        const timeoutError = new Error(`Lighthouse audit timed out after ${lighthouseTimeoutMs}ms`);
        timeoutError.code = 'LIGHTHOUSE_TIMEOUT';
        setTimeout(() => reject(timeoutError), lighthouseTimeoutMs);
      })
    ]);

    if (!runnerResult?.lhr) {
      const error = new Error('Lighthouse did not return a valid LHR payload');
      error.code = 'LIGHTHOUSE_EMPTY_RESULT';
      throw error;
    }

    const lhr = runnerResult.lhr;
    const audits = lhr.audits;

    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100)
    };

    const metrics = {
      firstContentfulPaint: formatMetric(audits['first-contentful-paint']?.numericValue),
      largestContentfulPaint: formatMetric(audits['largest-contentful-paint']?.numericValue),
      timeToInteractive: formatMetric(audits.interactive?.numericValue),
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue?.toFixed(3) || '0',
      totalBlockingTime: formatMetric(audits['total-blocking-time']?.numericValue),
      speedIndex: formatMetric(audits['speed-index']?.numericValue),
      firstMeaningfulPaint: formatMetric(audits['first-meaningful-paint']?.numericValue),
      maxPotentialFid: formatMetric(audits['max-potential-fid']?.numericValue)
    };

    const diagnostics = {
      totalByteWeight: formatBytes(audits['total-byte-weight']?.numericValue),
      numRequests: audits['network-requests']?.details?.items?.length || 0,
      numJsRequests: audits['network-requests']?.details?.items?.filter((item) => item.resourceType === 'Script').length || 0,
      numCssRequests: audits['network-requests']?.details?.items?.filter((item) => item.resourceType === 'Stylesheet').length || 0,
      numImageRequests: audits['network-requests']?.details?.items?.filter((item) => item.resourceType === 'Image').length || 0,
      numFontRequests: audits['network-requests']?.details?.items?.filter((item) => item.resourceType === 'Font').length || 0,
      mainThreadWork: formatMetric(audits['mainthread-work-breakdown']?.numericValue),
      bootupTime: formatMetric(audits['bootup-time']?.numericValue),
      unusedJs: formatBytes(audits['unused-javascript']?.details?.overallSavingsBytes),
      unusedCss: formatBytes(audits['unused-css-rules']?.details?.overallSavingsBytes),
      renderBlockingResources: audits['render-blocking-resources']?.details?.items?.length || 0,
      offscreenImages: audits['offscreen-images']?.details?.items?.length || 0,
      unminifiedJs: audits['unminified-javascript']?.details?.items?.length || 0,
      unminifiedCss: audits['unminified-css']?.details?.items?.length || 0,
      usesHttp2: audits['uses-http2']?.score === 1,
      usesHttps: audits['is-on-https']?.score === 1,
      hasRedirects: (audits.redirects?.details?.items?.length || 0) > 0,
      domSize: audits['dom-size']?.numericValue || 0,
      noDocumentWrite: audits['no-document-write']?.score === 1,
      externalAnchorsUseRelNoopener: audits['external-anchors-use-rel-noopener']?.score === 1,
      passwordInputsCanBePastedInto: audits['password-inputs-can-be-pasted-into']?.score === 1
    };

    const accessibilityDetails = {
      ariaRolesValid: audits['aria-roles']?.score === 1,
      ariaNamesValid: audits['aria-name']?.score === 1,
      colorContrastValid: audits['color-contrast']?.score === 1,
      imageAltValid: audits['image-alt']?.score === 1,
      labelValid: audits.label?.score === 1,
      tabIndexValid: audits.tabindex?.score === 1,
      focusableControls: audits['focusable-controls']?.score === 1,
      logicalTabOrder: audits['logical-tab-order']?.score === 1,
      bypassValid: audits.bypass?.score === 1,
      headingOrderValid: audits['heading-order']?.score === 1,
      metaViewportValid: audits['meta-viewport']?.score === 1
    };

    const seoDetails = {
      canonicalValid: audits.canonical?.score === 1,
      hreflangValid: audits.hreflang?.score === 1,
      isCrawlable: audits['is-crawlable']?.score === 1,
      linksHaveDescriptiveText: audits['link-text']?.score === 1,
      pageHasTitle: audits['document-title']?.score === 1,
      pageHasMetaDescription: audits['meta-description']?.score === 1,
      structuredDataValid: audits['structured-data']?.score === 1,
      httpStatusCodeValid: audits['http-status-code']?.score === 1
    };

    const opportunityMap = buildOpportunityMap(audits);
    const accessibilityIssueDetails = buildAccessibilityIssueDetails(audits);

    logger.info(`Lighthouse ${profile} audit complete - Performance: ${scores.performance}, SEO: ${scores.seo}, A11y: ${scores.accessibility}, BP: ${scores.bestPractices}`, {
      url,
      finalUrl: lhr.finalUrl,
      warnings: lhr.runWarnings?.length || 0,
      runWarnings: lhr.runWarnings || []
    });
    logMemoryUsage('Memory after Lighthouse audit completed', {
      url,
      profile
    });

    return {
      profile,
      scores,
      metrics,
      diagnostics,
      accessibilityDetails,
      accessibilityIssueDetails,
      seoDetails,
      opportunityMap,
      rawLhr: {
        finalUrl: lhr.finalUrl,
        fetchTime: lhr.fetchTime,
        userAgent: lhr.userAgent,
        environment: lhr.environment,
        configSettings: lhr.configSettings,
        runWarnings: lhr.runWarnings || []
      }
    };
  } catch (error) {
    logMemoryUsage('Memory snapshot during Lighthouse audit failure', {
      url,
      profile,
      code: error.code
    });
    logger.error(`Lighthouse ${profile} audit error`, {
      url,
      profile,
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
        logMemoryUsage('Memory after Lighthouse Chrome termination', {
          url,
          profile
        });
      } catch (error) {
        logger.warn('Failed to terminate Lighthouse Chrome process cleanly', {
          url,
          profile,
          message: error.message
        });
      }
    }
  }
};
