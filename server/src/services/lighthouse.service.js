import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { logger } from '../config/logger.js';
import { getChromeExecutablePath } from '../utils/browser.js';

/**
 * Runs Lighthouse audit on a URL
 * @param {string} url - URL to audit
 * @returns {Promise<Object>} - Lighthouse results with scores and metrics
 */
export const analyzeWithLighthouse = async (url) => {
  const chrome = await chromeLauncher.launch({
    chromePath: getChromeExecutablePath(),
    chromeFlags: [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas'
    ]
  });

  try {
    const options = {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
      throttling: {
        rttMs: 150,
        throughputKbps: 1638.4,
        cpuSlowdownMultiplier: 4,
        requestLatencyMs: 565,
        downloadThroughputKbps: 1474.5600000000002,
        uploadThroughputKbps: 675
      },
      screenEmulation: {
        mobile: true,
        width: 360,
        height: 640,
        deviceScaleFactor: 2,
        disabled: false
      },
      formFactor: 'mobile'
    };

    const runnerResult = await lighthouse(url, options);
    const lhr = runnerResult.lhr;

    // Extract scores (0-100)
    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100)
    };

    // Extract Core Web Vitals and key metrics
    const audits = lhr.audits;

    const metrics = {
      firstContentfulPaint: formatMetric(audits['first-contentful-paint']?.numericValue),
      largestContentfulPaint: formatMetric(audits['largest-contentful-paint']?.numericValue),
      timeToInteractive: formatMetric(audits['interactive']?.numericValue),
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue?.toFixed(3) || '0',
      totalBlockingTime: formatMetric(audits['total-blocking-time']?.numericValue),
      speedIndex: formatMetric(audits['speed-index']?.numericValue),
      firstMeaningfulPaint: formatMetric(audits['first-meaningful-paint']?.numericValue),
      maxPotentialFid: formatMetric(audits['max-potential-fid']?.numericValue)
    };

    // Extract additional useful data
    const diagnostics = {
      totalByteWeight: formatBytes(audits['total-byte-weight']?.numericValue),
      numRequests: audits['network-requests']?.details?.items?.length || 0,
      numJsRequests: audits['network-requests']?.details?.items?.filter(i => i.resourceType === 'Script').length || 0,
      numCssRequests: audits['network-requests']?.details?.items?.filter(i => i.resourceType === 'Stylesheet').length || 0,
      numImageRequests: audits['network-requests']?.details?.items?.filter(i => i.resourceType === 'Image').length || 0,
      numFontRequests: audits['network-requests']?.details?.items?.filter(i => i.resourceType === 'Font').length || 0,
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
      hasRedirects: (audits['redirects']?.details?.items?.length || 0) > 0,
      domSize: audits['dom-size']?.numericValue || 0,
      noDocumentWrite: audits['no-document-write']?.score === 1,
      externalAnchorsUseRelNoopener: audits['external-anchors-use-rel-noopener']?.score === 1,
      passwordInputsCanBePastedInto: audits['password-inputs-can-be-pasted-into']?.score === 1
    };

    // Accessibility specific details
    const accessibilityDetails = {
      ariaRolesValid: audits['aria-roles']?.score === 1,
      ariaNamesValid: audits['aria-name']?.score === 1,
      colorContrastValid: audits['color-contrast']?.score === 1,
      imageAltValid: audits['image-alt']?.score === 1,
      labelValid: audits['label']?.score === 1,
      tabIndexValid: audits['tabindex']?.score === 1,
      focusableControls: audits['focusable-controls']?.score === 1,
      logicalTabOrder: audits['logical-tab-order']?.score === 1,
      bypassValid: audits['bypass']?.score === 1,
      headingOrderValid: audits['heading-order']?.score === 1,
      metaViewportValid: audits['meta-viewport']?.score === 1
    };

    // SEO specific details
    const seoDetails = {
      canonicalValid: audits['canonical']?.score === 1,
      hreflangValid: audits['hreflang']?.score === 1,
      isCrawlable: audits['is-crawlable']?.score === 1,
      linksHaveDescriptiveText: audits['link-text']?.score === 1,
      pageHasTitle: audits['document-title']?.score === 1,
      pageHasMetaDescription: audits['meta-description']?.score === 1,
      structuredDataValid: audits['structured-data']?.score === 1,
      httpStatusCodeValid: audits['http-status-code']?.score === 1
    };

    logger.info(`Lighthouse audit complete - Performance: ${scores.performance}, SEO: ${scores.seo}, A11y: ${scores.accessibility}, BP: ${scores.bestPractices}`);

    return {
      scores,
      metrics,
      diagnostics,
      accessibilityDetails,
      seoDetails,
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
    logger.error('Lighthouse audit error:', error);
    throw error;
  } finally {
    await chrome.kill();
  }
};

/**
 * Formats metric value to readable string
 */
const formatMetric = (value) => {
  if (value === undefined || value === null) return 'N/A';
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
};

/**
 * Formats bytes to readable string
 */
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};
