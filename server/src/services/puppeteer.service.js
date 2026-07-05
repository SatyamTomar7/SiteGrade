import path from 'path';
import fs from 'fs/promises';
import { logger } from '../config/logger.js';
import { getPuppeteerBrowser } from '../utils/browser.js';
import { classifyPageRole, classifyPageType } from '../modules/analysis/analysis.helpers.js';

const SCREENSHOTS_DIR = path.resolve(process.env.SCREENSHOTS_DIR || './screenshots');
const postLoadDelayMs = Math.max(Number(process.env.PUPPETEER_POST_LOAD_DELAY_MS) || 1000, 0);
const navigationTimeoutMs = Math.max(Number(process.env.PUPPETEER_NAVIGATION_TIMEOUT_MS) || 45000, 5000);
const navigationWaitUntil = String(process.env.PUPPETEER_WAIT_UNTIL || 'domcontentloaded').trim().toLowerCase();
const captureScreenshots = !['0', 'false', 'no', 'off'].includes(
  String(process.env.ANALYSIS_CAPTURE_SCREENSHOTS ?? 'true').trim().toLowerCase()
);
const fetchTimeoutMs = Math.max(Number(process.env.ANALYSIS_FETCH_TIMEOUT_MS) || 8000, 1000);
const linkCheckConcurrency = Math.max(Number(process.env.ANALYSIS_LINK_CHECK_CONCURRENCY) || 4, 1);

const TECH_PATTERNS = {
  React: [{ type: 'selector', value: '[data-reactroot], [data-reactid]' }, { type: 'script', value: 'react' }, { type: 'global', value: 'React' }],
  'Next.js': [{ type: 'script', value: '_next/static' }, { type: 'meta', value: 'next.js' }],
  'Vue.js': [{ type: 'global', value: 'Vue' }, { type: 'selector', value: '[data-v-app]' }, { type: 'script', value: 'vue' }],
  Angular: [{ type: 'global', value: 'angular' }, { type: 'selector', value: '[ng-app], [ng-controller]' }, { type: 'script', value: 'angular' }],
  Svelte: [{ type: 'script', value: 'svelte' }],
  jQuery: [{ type: 'global', value: 'jQuery' }, { type: 'script', value: 'jquery' }],
  'Tailwind CSS': [{ type: 'script', value: 'tailwindcss' }],
  WordPress: [{ type: 'meta', value: 'WordPress' }, { type: 'script', value: 'wp-content' }, { type: 'link', value: 'wp-content' }],
  Shopify: [{ type: 'script', value: 'cdn.shopify.com' }, { type: 'meta', value: 'shopify' }],
  Webflow: [{ type: 'meta', value: 'webflow' }, { type: 'script', value: 'cdn.prod.website-files.com' }],
  Vite: [{ type: 'script', value: 'vite' }, { type: 'global', value: '__vite' }],
  Stripe: [{ type: 'script', value: 'js.stripe.com' }],
  Cloudflare: [{ type: 'header', value: 'cloudflare' }, { type: 'header', value: 'cf-ray' }],
  Vercel: [{ type: 'header', value: 'vercel' }, { type: 'header', value: 'x-vercel' }],
  Netlify: [{ type: 'header', value: 'netlify' }]
};

const ACCESSIBILITY_SAMPLE_LIMIT = 5;
const LINK_CHECK_LIMIT = 25;
const resolveWaitUntil = () => {
  if (['load', 'networkidle0', 'networkidle2', 'domcontentloaded'].includes(navigationWaitUntil)) {
    return navigationWaitUntil;
  }

  return 'domcontentloaded';
};

const ensureDir = async () => {
  try {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create screenshots directory:', error);
  }
};

const withTimeoutFetch = async (targetUrl, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    return await fetch(targetUrl, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

const checkUrlAccessible = async (targetUrl) => {
  if (!targetUrl) return false;

  try {
    const response = await withTimeoutFetch(targetUrl, {
      method: 'GET',
      redirect: 'follow'
    });

    return response.ok;
  } catch {
    return false;
  }
};

const inspectLink = async (targetUrl) => {
  const chain = [];
  let currentUrl = targetUrl;

  try {
    for (let i = 0; i < 5; i += 1) {
      const response = await withTimeoutFetch(currentUrl, {
        method: 'GET',
        redirect: 'manual'
      });

      chain.push({
        url: currentUrl,
        status: response.status
      });

      if (response.status >= 300 && response.status < 400) {
        const nextLocation = response.headers.get('location');
        if (!nextLocation) {
          break;
        }

        currentUrl = new URL(nextLocation, currentUrl).toString();
        continue;
      }

      return {
        ok: response.ok,
        finalUrl: currentUrl,
        status: response.status,
        redirectChain: chain
      };
    }
  } catch (error) {
    return {
      ok: false,
      finalUrl: currentUrl,
      status: 0,
      redirectChain: chain,
      error: error.message
    };
  }

  return {
    ok: true,
    finalUrl: currentUrl,
    status: chain.at(-1)?.status || 200,
    redirectChain: chain
  };
};

const inspectLinks = async (links = []) => {
  const uniqueLinks = [...new Set(links.filter(Boolean))].slice(0, LINK_CHECK_LIMIT);
  const results = await mapWithConcurrency(uniqueLinks, linkCheckConcurrency, (link) => inspectLink(link));

  const brokenLinks = [];
  const redirectChains = [];

  results.forEach((result, index) => {
    if (!result.ok || result.status >= 400) {
      brokenLinks.push({
        url: uniqueLinks[index],
        status: result.status || 'ERR',
        finalUrl: result.finalUrl
      });
    }

    if ((result.redirectChain || []).length > 1) {
      redirectChains.push({
        url: uniqueLinks[index],
        steps: result.redirectChain
      });
    }
  });

  return {
    checkedLinks: uniqueLinks.length,
    brokenLinks,
    redirectChains
  };
};

const summarizeAccessibilityDetails = (pageData) => ({
  imagesMissingAlt: pageData.imageAltSamples.slice(0, ACCESSIBILITY_SAMPLE_LIMIT),
  unlabeledInputs: pageData.unlabeledInputSamples.slice(0, ACCESSIBILITY_SAMPLE_LIMIT),
  buttonsMissingText: pageData.buttonTextSamples.slice(0, ACCESSIBILITY_SAMPLE_LIMIT),
  skippedHeadingLevels: pageData.headingSequence.skippedLevels
});

const detectTechStack = async (page, networkScripts, networkStyles, headers, pageData) => {
  const detected = new Set();

  const globals = await page.evaluate(() => {
    const checks = {
      React: typeof React !== 'undefined',
      'Vue.js': typeof Vue !== 'undefined',
      Angular: typeof angular !== 'undefined',
      jQuery: typeof jQuery !== 'undefined',
      Vite: typeof __vite !== 'undefined'
    };
    return Object.entries(checks).filter(([, exists]) => exists).map(([name]) => name);
  });

  globals.forEach((tech) => detected.add(tech));

  const allSources = [
    ...networkScripts,
    ...networkStyles,
    ...pageData.scripts,
    ...pageData.stylesheets,
    ...pageData.metas.map((meta) => `${meta.name || ''} ${meta.content || ''}`)
  ];

  const headerValues = Object.entries(headers).map(([key, value]) => `${key} ${value}`).join(' ');

  for (const [tech, patterns] of Object.entries(TECH_PATTERNS)) {
    if (detected.has(tech)) continue;

    for (const pattern of patterns) {
      let found = false;

      if (pattern.type === 'script' || pattern.type === 'link') {
        found = allSources.some((src) => src.toLowerCase().includes(pattern.value.toLowerCase()));
      } else if (pattern.type === 'header') {
        found = headerValues.toLowerCase().includes(pattern.value.toLowerCase());
      } else if (pattern.type === 'meta') {
        found = pageData.metas.some((meta) =>
          (meta.name || '').toLowerCase().includes(pattern.value.toLowerCase()) ||
          (meta.content || '').toLowerCase().includes(pattern.value.toLowerCase())
        );
      } else if (pattern.type === 'selector') {
        found = await page.evaluate((selector) => Boolean(document.querySelector(selector)), pattern.value);
      } else if (pattern.type === 'global') {
        found = globals.includes(tech);
      }

      if (found) {
        detected.add(tech);
        break;
      }
    }
  }

  return Array.from(detected).sort();
};

const crawlSite = async (browser, startUrl, internalCandidateUrls, maxPages) => {
  const startRole = classifyPageRole({ url: startUrl, title: '' });
  const startType = classifyPageType({ url: startUrl });

  if (maxPages <= 1) {
    return {
      pages: [{
        url: startUrl,
        pageType: startType,
        pageRole: startRole,
        status: 200,
        loadTimeMs: 0
      }],
      totalPagesDiscovered: 1,
      successfulPages: 1,
      pageTypes: { [startType]: 1 },
      roleCounts: { [startRole]: 1 },
      roleHighlights: [{ role: startRole, url: startUrl, pageType: startType }]
    };
  }

  const queue = internalCandidateUrls.filter((candidate) => candidate !== startUrl);
  const pages = [];
  const pageTypes = {};
  const roleCounts = { [startRole]: 1 };
  const roleHighlights = [{ role: startRole, url: startUrl, pageType: startType }];
  let successfulPages = 1;

  for (const targetUrl of queue.slice(0, maxPages - 1)) {
    let page;

    try {
      page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      const startedAt = Date.now();
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: navigationTimeoutMs
      });
      const title = await page.title();
      const bodyTextLength = await page.evaluate(() => document.body?.innerText?.length || 0);
      const hasForm = await page.evaluate(() => document.querySelectorAll('form').length > 0);
      const pageType = classifyPageType({ url: targetUrl, title, bodyTextLength, hasForm });
      const pageRole = classifyPageRole({ url: targetUrl, title });

      pages.push({
        url: targetUrl,
        title,
        status: response?.status() || 0,
        loadTimeMs: Date.now() - startedAt,
        pageType,
        pageRole
      });

      pageTypes[pageType] = (pageTypes[pageType] || 0) + 1;
      roleCounts[pageRole] = (roleCounts[pageRole] || 0) + 1;
      successfulPages += 1;
      if (!roleHighlights.some((item) => item.role === pageRole)) {
        roleHighlights.push({ role: pageRole, url: targetUrl, pageType });
      }
    } catch (error) {
      pages.push({
        url: targetUrl,
        title: '',
        status: 0,
        loadTimeMs: 0,
        pageType: 'unknown',
        pageRole: 'other',
        error: error.message
      });
      pageTypes.unknown = (pageTypes.unknown || 0) + 1;
      roleCounts.other = (roleCounts.other || 0) + 1;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  return {
    pages: [
      { url: startUrl, pageType: startType, pageRole: startRole, status: 200, loadTimeMs: 0 },
      ...pages
    ],
    totalPagesDiscovered: Math.min(maxPages, queue.length + 1),
    successfulPages,
    pageTypes,
    roleCounts,
    roleHighlights
  };
};

export const analyzeWithPuppeteer = async (url, reportId, options = {}) => {
  await ensureDir();

  const browser = await getPuppeteerBrowser();
  let page;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    const consoleErrors = [];
    const scripts = [];
    const stylesheets = [];
    const networkHeaders = {};
    const mixedContentRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', async (response) => {
      try {
        const responseUrl = response.url();
        Object.entries(response.headers()).forEach(([key, value]) => {
          networkHeaders[key.toLowerCase()] = value;
        });

        if (responseUrl.startsWith('http://')) {
          mixedContentRequests.push(responseUrl);
        }

        if (responseUrl.endsWith('.js') || responseUrl.includes('.js?')) {
          scripts.push(responseUrl);
        }

        if (responseUrl.endsWith('.css') || responseUrl.includes('.css?')) {
          stylesheets.push(responseUrl);
        }
      } catch {
        // Ignore response parsing issues.
      }
    });

    const startTime = Date.now();
    const waitUntil = resolveWaitUntil();
    const navigationResponse = await page.goto(url, {
      waitUntil,
      timeout: navigationTimeoutMs
    });
    const loadTime = Date.now() - startTime;

    logger.info('Puppeteer navigation completed', {
      url,
      waitUntil,
      navigationTimeoutMs,
      loadTime
    });

    if (!navigationResponse) {
      throw new Error('Failed to load page - no navigation response');
    }

    const documentHeaders = Object.fromEntries(
      Object.entries(navigationResponse.headers()).map(([key, value]) => [key.toLowerCase(), value])
    );
    const finalUrl = page.url();
    const siteOrigin = new URL(finalUrl).origin;

    if (postLoadDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, postLoadDelayMs));
    }

    let screenshotFilename = null;
    let screenshotPath = null;

    if (captureScreenshots) {
      screenshotFilename = `${reportId}.png`;
      screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFilename);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });
    }

    const pageData = await page.evaluate(() => {
      const getMetaContent = (name) => {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta ? meta.getAttribute('content') : null;
      };

      const canonicalLink = document.querySelector('link[rel="canonical"]');
      const robotsMeta = document.querySelector('meta[name="robots"]');
      const hreflangLinks = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map((link) => ({
        hreflang: link.getAttribute('hreflang'),
        href: link.getAttribute('href')
      }));
      const imageElements = Array.from(document.querySelectorAll('img'));
      const schemaScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const anchors = Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
        href: anchor.href,
        text: anchor.textContent?.trim() || '',
        rel: anchor.getAttribute('rel') || ''
      }));
      const forms = Array.from(document.querySelectorAll('form'));
      const unlabeledInputs = Array.from(document.querySelectorAll('input, textarea, select')).filter((field) => {
        const id = field.getAttribute('id');
        const ariaLabel = field.getAttribute('aria-label');
        const ariaLabelledBy = field.getAttribute('aria-labelledby');
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        return !ariaLabel && !ariaLabelledBy && !label;
      });
      const emptyButtons = Array.from(document.querySelectorAll('button')).filter((button) => {
        return !(button.textContent || '').trim() && !button.getAttribute('aria-label');
      });
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) => Number(heading.tagName.slice(1)));
      const skippedLevels = [];

      for (let i = 1; i < headings.length; i += 1) {
        if (headings[i] - headings[i - 1] > 1) {
          skippedLevels.push({
            from: headings[i - 1],
            to: headings[i]
          });
        }
      }

      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      return {
        title: document.title,
        description: getMetaContent('description') || getMetaContent('og:description'),
        viewport: getMetaContent('viewport'),
        charset: document.characterSet,
        lang: document.documentElement.lang,
        headings: {
          h1: document.querySelectorAll('h1').length,
          h2: document.querySelectorAll('h2').length,
          h3: document.querySelectorAll('h3').length,
          h4: document.querySelectorAll('h4').length,
          h5: document.querySelectorAll('h5').length,
          h6: document.querySelectorAll('h6').length
        },
        headingSequence: {
          total: headings.length,
          skippedLevels
        },
        domElements: document.querySelectorAll('*').length,
        images: imageElements.length,
        links: anchors.length,
        scripts: Array.from(document.querySelectorAll('script[src]')).map((script) => script.src),
        stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.href),
        metas: Array.from(document.querySelectorAll('meta')).map((meta) => ({
          name: meta.getAttribute('name') || meta.getAttribute('property'),
          content: meta.getAttribute('content')
        })),
        hasForm: forms.length > 0,
        hasTable: document.querySelectorAll('table').length > 0,
        hasCanvas: document.querySelectorAll('canvas').length > 0,
        hasVideo: document.querySelectorAll('video').length > 0,
        hasAudio: document.querySelectorAll('audio').length > 0,
        hasIframe: document.querySelectorAll('iframe').length > 0,
        hasSvg: document.querySelectorAll('svg').length > 0,
        htmlSize: document.documentElement.outerHTML.length,
        bodyTextLength: document.body.innerText.length,
        canonicalUrl: canonicalLink?.href || '',
        robotsMetaContent: robotsMeta?.getAttribute('content') || '',
        openGraph: {
          titlePresent: Boolean(ogTitle),
          descriptionPresent: Boolean(ogDescription),
          imagePresent: Boolean(ogImage)
        },
        twitterCardPresent: Boolean(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')),
        faviconPresent: Boolean(document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')),
        imagesWithoutAlt: imageElements.filter((img) => !img.hasAttribute('alt') || !img.getAttribute('alt')?.trim()).length,
        imageAltSamples: imageElements
          .filter((img) => !img.hasAttribute('alt') || !img.getAttribute('alt')?.trim())
          .slice(0, 5)
          .map((img) => ({
            src: img.currentSrc || img.getAttribute('src') || '',
            alt: img.getAttribute('alt') || ''
          })),
        structuredDataScripts: schemaScripts.length,
        anchors,
        hreflangLinks,
        internalLinks: anchors.filter((anchor) => {
          try {
            return new URL(anchor.href, window.location.href).origin === window.location.origin;
          } catch {
            return false;
          }
        }).length,
        externalLinks: anchors.filter((anchor) => {
          try {
            return new URL(anchor.href, window.location.href).origin !== window.location.origin;
          } catch {
            return false;
          }
        }).length,
        insecureFormCount: forms.filter((form) => {
          const action = form.getAttribute('action');
          if (!action) return window.location.protocol !== 'https:';
          try {
            return new URL(action, window.location.href).protocol === 'http:';
          } catch {
            return false;
          }
        }).length,
        unlabeledInputSamples: unlabeledInputs.slice(0, 5).map((field) => ({
          tag: field.tagName.toLowerCase(),
          name: field.getAttribute('name') || '',
          type: field.getAttribute('type') || ''
        })),
        buttonTextSamples: emptyButtons.slice(0, 5).map((button) => ({
          html: button.outerHTML.slice(0, 200)
        }))
      };
    });

    const techStack = await detectTechStack(page, scripts, stylesheets, documentHeaders, pageData);
    const pageSizeKB = Math.round(pageData.htmlSize / 1024);
    const isHttps = finalUrl.startsWith('https://');
    const robotsMetaLower = (pageData.robotsMetaContent || '').toLowerCase();
    const hasNoindex = robotsMetaLower.includes('noindex');
    const hasNofollow = robotsMetaLower.includes('nofollow');
    const robotsTxtUrl = `${siteOrigin}/robots.txt`;
    const sitemapUrl = `${siteOrigin}/sitemap.xml`;
    const pageType = classifyPageType({
      url: finalUrl,
      title: pageData.title,
      bodyTextLength: pageData.bodyTextLength,
      hasForm: pageData.hasForm,
      techStack
    });

    const [robotsTxtAccessible, sitemapAccessible, linkInspection] = await Promise.all([
      checkUrlAccessible(robotsTxtUrl),
      checkUrlAccessible(sitemapUrl),
      inspectLinks(pageData.anchors.map((anchor) => anchor.href))
    ]);

    const internalCandidateUrls = [
      finalUrl,
      ...pageData.anchors
        .map((anchor) => anchor.href)
        .filter((href) => {
          try {
            return new URL(href).origin === siteOrigin;
          } catch {
            return false;
          }
        })
    ];
    const crawlData = await crawlSite(
      browser,
      finalUrl,
      [...new Set(internalCandidateUrls)],
      options.scanMode === 'crawl' ? Math.min(Math.max(Number(options.crawlMaxPages) || 1, 1), 10) : 1
    );

    const securityHeaders = {
      'content-security-policy': !!documentHeaders['content-security-policy'],
      'strict-transport-security': !!documentHeaders['strict-transport-security'],
      'x-frame-options': !!documentHeaders['x-frame-options'],
      'x-content-type-options': !!documentHeaders['x-content-type-options'],
      'referrer-policy': !!documentHeaders['referrer-policy'],
      'permissions-policy': !!documentHeaders['permissions-policy']
    };

    const securitySignals = [isHttps, ...Object.values(securityHeaders)];
    const securityScore = Math.round((securitySignals.filter(Boolean).length / securitySignals.length) * 100);

    return {
      screenshotPath,
      screenshotFilename,
      finalUrl,
      title: pageData.title,
      metaDescription: pageData.description,
      titleLength: pageData.title?.length || 0,
      metaDescriptionLength: pageData.description?.length || 0,
      hasMetaDescription: !!pageData.description,
      hasViewportMeta: !!pageData.viewport,
      hasCanonicalTag: !!pageData.canonicalUrl,
      canonicalUrl: pageData.canonicalUrl,
      robotsMetaContent: pageData.robotsMetaContent,
      isIndexable: !hasNoindex,
      isFollowable: !hasNofollow,
      hasNoindex,
      hasNofollow,
      openGraph: pageData.openGraph,
      twitterCardPresent: pageData.twitterCardPresent,
      faviconPresent: pageData.faviconPresent,
      robotsTxtUrl,
      robotsTxtAccessible,
      sitemapUrl,
      sitemapAccessible,
      isHttps,
      loadTime: `${loadTime}ms`,
      domElements: pageData.domElements,
      pageSize: `${pageSizeKB}KB`,
      consoleErrors: consoleErrors.length,
      headings: pageData.headings,
      pageType,
      securityHeaders,
      securityScore,
      responseStatus: navigationResponse.status(),
      charset: pageData.charset,
      lang: pageData.lang,
      images: pageData.images,
      links: pageData.links,
      hasForm: pageData.hasForm,
      hasTable: pageData.hasTable,
      hasCanvas: pageData.hasCanvas,
      hasVideo: pageData.hasVideo,
      hasAudio: pageData.hasAudio,
      hasIframe: pageData.hasIframe,
      hasSvg: pageData.hasSvg,
      bodyTextLength: pageData.bodyTextLength,
      imagesWithoutAlt: pageData.imagesWithoutAlt,
      structuredDataScripts: pageData.structuredDataScripts,
      hreflangLinks: pageData.hreflangLinks,
      hreflangCount: pageData.hreflangLinks.length,
      internalLinks: pageData.internalLinks,
      externalLinks: pageData.externalLinks,
      insecureFormCount: pageData.insecureFormCount,
      mixedContentRequests: mixedContentRequests.length,
      scripts: pageData.scripts,
      stylesheets: pageData.stylesheets,
      brokenLinks: linkInspection.brokenLinks,
      redirectChains: linkInspection.redirectChains,
      checkedLinks: linkInspection.checkedLinks,
      accessibilitySamples: summarizeAccessibilityDetails(pageData),
      crawlData,
      techStack
    };
  } catch (error) {
    logger.error('Puppeteer analysis error:', error);
    throw error;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
};
const mapWithConcurrency = async (items = [], concurrency, mapper) => {
  const results = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const itemIndex = currentIndex;
      currentIndex += 1;
      results[itemIndex] = await mapper(items[itemIndex], itemIndex);
    }
  });

  await Promise.all(workers);
  return results;
};
