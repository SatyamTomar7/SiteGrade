import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../config/logger.js';

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || './screenshots';

/**
 * Ensures screenshots directory exists
 */
const ensureDir = async () => {
  try {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create screenshots directory:', error);
  }
};

/**
 * Tech stack detection patterns
 */
const TECH_PATTERNS = {
  'React': [
    { type: 'selector', value: '[data-reactroot], [data-reactid]' },
    { type: 'script', value: 'react' },
    { type: 'global', value: 'React' }
  ],
  'Next.js': [
    { type: 'script', value: '_next/static' },
    { type: 'meta', value: 'next.js' }
  ],
  'Vue.js': [
    { type: 'global', value: 'Vue' },
    { type: 'selector', value: '[data-v-app]' },
    { type: 'script', value: 'vue' }
  ],
  'Angular': [
    { type: 'global', value: 'angular' },
    { type: 'selector', value: '[ng-app], [ng-controller]' },
    { type: 'script', value: 'angular' }
  ],
  'Svelte': [
    { type: 'script', value: 'svelte' }
  ],
  'jQuery': [
    { type: 'global', value: 'jQuery' },
    { type: 'script', value: 'jquery' }
  ],
  'Bootstrap': [
    { type: 'css', value: 'bootstrap' },
    { type: 'class', value: 'container-fluid' }
  ],
  'Tailwind CSS': [
    { type: 'class', value: 'tailwind' },
    { type: 'script', value: 'tailwindcss' }
  ],
  'WordPress': [
    { type: 'meta', value: 'WordPress' },
    { type: 'script', value: 'wp-content' },
    { type: 'link', value: 'wp-content' }
  ],
  'Shopify': [
    { type: 'script', value: 'cdn.shopify.com' },
    { type: 'meta', value: 'shopify' }
  ],
  'Wix': [
    { type: 'script', value: 'static.wixstatic.com' },
    { type: 'meta', value: 'wix' }
  ],
  'Webflow': [
    { type: 'meta', value: 'webflow' },
    { type: 'script', value: 'cdn.prod.website-files.com' }
  ],
  'Node.js': [
    { type: 'header', value: 'node.js' },
    { type: 'header', value: 'express' }
  ],
  'PHP': [
    { type: 'header', value: 'php' },
    { type: 'header', value: 'x-powered-by' }
  ],
  'Python/Django': [
    { type: 'header', value: 'django' },
    { type: 'header', value: 'python' }
  ],
  'Ruby on Rails': [
    { type: 'header', value: 'rails' },
    { type: 'header', value: 'ruby' }
  ],
  'Laravel': [
    { type: 'header', value: 'laravel' }
  ],
  'Gatsby': [
    { type: 'script', value: 'gatsby' },
    { type: 'global', value: '___gatsby' }
  ],
  'Nuxt.js': [
    { type: 'global', value: '__NUXT__' },
    { type: 'script', value: '_nuxt' }
  ],
  'Remix': [
    { type: 'meta', value: 'remix' },
    { type: 'script', value: 'remix' }
  ],
  'Astro': [
    { type: 'script', value: 'astro' }
  ],
  'Vite': [
    { type: 'script', value: 'vite' },
    { type: 'global', value: '__vite' }
  ],
  'Webpack': [
    { type: 'script', value: 'webpack' }
  ],
  'TypeScript': [
    { type: 'script', value: '.ts' }
  ],
  'Google Analytics': [
    { type: 'script', value: 'google-analytics.com' },
    { type: 'script', value: 'gtag' }
  ],
  'Stripe': [
    { type: 'script', value: 'js.stripe.com' }
  ],
  'Hotjar': [
    { type: 'script', value: 'hotjar' }
  ],
  'Intercom': [
    { type: 'script', value: 'intercom' }
  ],
  'HubSpot': [
    { type: 'script', value: 'hs-scripts.com' },
    { type: 'script', value: 'hubspot' }
  ],
  'Mailchimp': [
    { type: 'script', value: 'mailchimp' }
  ],
  'Cloudflare': [
    { type: 'header', value: 'cloudflare' },
    { type: 'header', value: 'cf-ray' }
  ],
  'AWS': [
    { type: 'header', value: 'amazon' },
    { type: 'header', value: 'aws' }
  ],
  'Vercel': [
    { type: 'header', value: 'vercel' },
    { type: 'header', value: 'x-vercel' }
  ],
  'Netlify': [
    { type: 'header', value: 'netlify' }
  ],
  'Firebase': [
    { type: 'script', value: 'firebase' },
    { type: 'global', value: 'firebase' }
  ],
  'Supabase': [
    { type: 'script', value: 'supabase' }
  ],
  'Prisma': [
    { type: 'script', value: 'prisma' }
  ],
  'GraphQL': [
    { type: 'script', value: 'graphql' },
    { type: 'global', value: '__APOLLO_CLIENT__' }
  ],
  'Apollo': [
    { type: 'script', value: 'apollo' }
  ],
  'Redux': [
    { type: 'global', value: '__REDUX_DEVTOOLS_EXTENSION__' },
    { type: 'global', value: 'Redux' }
  ],
  'MobX': [
    { type: 'global', value: '__mobxGlobals' }
  ],
  'Three.js': [
    { type: 'global', value: 'THREE' },
    { type: 'script', value: 'three.js' }
  ],
  'GSAP': [
    { type: 'global', value: 'gsap' },
    { type: 'script', value: 'greensock' }
  ],
  'jQuery UI': [
    { type: 'script', value: 'jquery-ui' }
  ],
  'Lodash': [
    { type: 'global', value: '_' },
    { type: 'script', value: 'lodash' }
  ],
  'Moment.js': [
    { type: 'global', value: 'moment' },
    { type: 'script', value: 'moment' }
  ],
  'Axios': [
    { type: 'global', value: 'axios' },
    { type: 'script', value: 'axios' }
  ],
  'Socket.io': [
    { type: 'script', value: 'socket.io' }
  ],
  'Auth0': [
    { type: 'script', value: 'auth0' }
  ],
  'Clerk': [
    { type: 'script', value: 'clerk' }
  ],
  'PostHog': [
    { type: 'script', value: 'posthog' }
  ],
  'Sentry': [
    { type: 'script', value: 'sentry' }
  ],
  'Datadog': [
    { type: 'script', value: 'datadog' }
  ],
  'New Relic': [
    { type: 'script', value: 'newrelic' }
  ],
  'Algolia': [
    { type: 'script', value: 'algolia' }
  ],
  'Elasticsearch': [
    { type: 'script', value: 'elasticsearch' }
  ],
  'MongoDB': [
    { type: 'script', value: 'mongodb' }
  ],
  'PostgreSQL': [
    { type: 'script', value: 'postgresql' }
  ],
  'MySQL': [
    { type: 'script', value: 'mysql' }
  ],
  'Redis': [
    { type: 'script', value: 'redis' }
  ],
  'Docker': [
    { type: 'script', value: 'docker' }
  ],
  'Kubernetes': [
    { type: 'script', value: 'kubernetes' }
  ],
  'Terraform': [
    { type: 'script', value: 'terraform' }
  ],
  'AWS Lambda': [
    { type: 'script', value: 'aws-lambda' }
  ],
  'Serverless': [
    { type: 'script', value: 'serverless' }
  ]
};

/**
 * Analyzes a website using Puppeteer
 * @param {string} url - URL to analyze
 * @param {string} reportId - Report ID for screenshot naming
 * @returns {Promise<Object>} - Puppeteer analysis results
 */
export const analyzeWithPuppeteer = async (url, reportId) => {
  await ensureDir();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    // Collect console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect network requests for tech detection
    const scripts = [];
    const stylesheets = [];
    const headers = {};
    
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const headerObj = response.headers();
        
        Object.entries(headerObj).forEach(([key, value]) => {
          headers[key.toLowerCase()] = value;
        });

        if (url.endsWith('.js') || url.includes('.js?')) {
          scripts.push(url);
        }
        if (url.endsWith('.css') || url.includes('.css?')) {
          stylesheets.push(url);
        }
      } catch {
        // Ignore errors from responses
      }
    });

    // Navigate and measure load time
    const startTime = Date.now();
    const navigationResponse = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    const loadTime = Date.now() - startTime;

    if (!navigationResponse) {
      throw new Error('Failed to load page - no navigation response');
    }

    // Wait a bit for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${reportId}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    // Extract page data
    const pageData = await page.evaluate(() => {
      const getMetaContent = (name) => {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta ? meta.getAttribute('content') : null;
      };

      const headings = {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length,
        h4: document.querySelectorAll('h4').length,
        h5: document.querySelectorAll('h5').length,
        h6: document.querySelectorAll('h6').length
      };

      const allScripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      const allStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
      const allMetas = Array.from(document.querySelectorAll('meta')).map(m => ({
        name: m.getAttribute('name') || m.getAttribute('property'),
        content: m.getAttribute('content')
      }));

      return {
        title: document.title,
        description: getMetaContent('description') || getMetaContent('og:description'),
        viewport: getMetaContent('viewport'),
        charset: document.characterSet,
        lang: document.documentElement.lang,
        headings,
        domElements: document.querySelectorAll('*').length,
        images: document.querySelectorAll('img').length,
        links: document.querySelectorAll('a').length,
        scripts: allScripts,
        stylesheets: allStyles,
        metas: allMetas,
        hasForm: document.querySelectorAll('form').length > 0,
        hasTable: document.querySelectorAll('table').length > 0,
        hasCanvas: document.querySelectorAll('canvas').length > 0,
        hasVideo: document.querySelectorAll('video').length > 0,
        hasAudio: document.querySelectorAll('audio').length > 0,
        hasIframe: document.querySelectorAll('iframe').length > 0,
        hasSvg: document.querySelectorAll('svg').length > 0,
        htmlSize: document.documentElement.outerHTML.length,
        bodyTextLength: document.body.innerText.length
      };
    });

    // Detect tech stack
    const techStack = await detectTechStack(page, scripts, stylesheets, headers, pageData);

    // Calculate page size estimate
    const pageSizeKB = Math.round(pageData.htmlSize / 1024);

    // Check HTTPS
    const isHttps = url.startsWith('https://');

    // Check security headers
    const securityHeaders = {
      'content-security-policy': !!headers['content-security-policy'],
      'strict-transport-security': !!headers['strict-transport-security'],
      'x-frame-options': !!headers['x-frame-options'],
      'x-content-type-options': !!headers['x-content-type-options'],
      'referrer-policy': !!headers['referrer-policy'],
      'permissions-policy': !!headers['permissions-policy']
    };

    const securityScore = Math.round(
      (Object.values(securityHeaders).filter(Boolean).length / Object.keys(securityHeaders).length) * 100
    );

    return {
      screenshotPath,
      title: pageData.title,
      metaDescription: pageData.description,
      hasMetaDescription: !!pageData.description,
      hasViewportMeta: !!pageData.viewport,
      isHttps,
      loadTime: `${loadTime}ms`,
      domElements: pageData.domElements,
      pageSize: `${pageSizeKB}KB`,
      consoleErrors: consoleErrors.length,
      headings: pageData.headings,
      techStack,
      securityHeaders,
      securityScore,
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
      scripts: pageData.scripts,
      stylesheets: pageData.stylesheets
    };
  } catch (error) {
    logger.error('Puppeteer analysis error:', error);
    throw error;
  } finally {
    await browser.close();
  }
};

/**
 * Detects tech stack from various signals
 */
const detectTechStack = async (page, networkScripts, networkStyles, headers, pageData) => {
  const detected = new Set();

  // Check globals
  const globals = await page.evaluate(() => {
    const checks = {
      'React': typeof React !== 'undefined',
      'Vue.js': typeof Vue !== 'undefined',
      'Angular': typeof angular !== 'undefined',
      'jQuery': typeof jQuery !== 'undefined',
      'GSAP': typeof gsap !== 'undefined',
      'Three.js': typeof THREE !== 'undefined',
      'Redux': typeof Redux !== 'undefined' || typeof __REDUX_DEVTOOLS_EXTENSION__ !== 'undefined',
      'MobX': typeof __mobxGlobals !== 'undefined',
      'Axios': typeof axios !== 'undefined',
      'Moment.js': typeof moment !== 'undefined',
      'Lodash': typeof _ !== 'undefined',
      'Socket.io': typeof io !== 'undefined',
      'Firebase': typeof firebase !== 'undefined',
      'Gatsby': typeof ___gatsby !== 'undefined',
      'Nuxt.js': typeof __NUXT__ !== 'undefined',
      'Vite': typeof __vite !== 'undefined'
    };
    return Object.entries(checks).filter(([_, exists]) => exists).map(([name]) => name);
  });

  globals.forEach(tech => detected.add(tech));

  // Check all sources for patterns
  const allSources = [
    ...networkScripts,
    ...networkStyles,
    ...pageData.scripts,
    ...pageData.stylesheets,
    ...pageData.metas.map(m => `${m.name || ''} ${m.content || ''}`)
  ];

  const headerValues = Object.entries(headers).map(([k, v]) => `${k} ${v}`).join(' ');

  for (const [tech, patterns] of Object.entries(TECH_PATTERNS)) {
    if (detected.has(tech)) continue;

    for (const pattern of patterns) {
      let found = false;

      if (pattern.type === 'script' || pattern.type === 'css' || pattern.type === 'link') {
        found = allSources.some(src => src.toLowerCase().includes(pattern.value.toLowerCase()));
      } else if (pattern.type === 'header') {
        found = headerValues.toLowerCase().includes(pattern.value.toLowerCase());
      } else if (pattern.type === 'meta') {
        found = pageData.metas.some(m => 
          (m.name || '').toLowerCase().includes(pattern.value.toLowerCase()) ||
          (m.content || '').toLowerCase().includes(pattern.value.toLowerCase())
        );
      } else if (pattern.type === 'class') {
        const hasClass = await page.evaluate((cls) => {
          return document.querySelector(`[class*="${cls}"]`) !== null;
        }, pattern.value);
        found = hasClass;
      }

      if (found) {
        detected.add(tech);
        break;
      }
    }
  }

  // Additional checks from page content
  const contentChecks = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const checks = [];
    if (html.includes('wp-content')) checks.push('WordPress');
    if (html.includes('Shopify')) checks.push('Shopify');
    if (html.includes('Webflow')) checks.push('Webflow');
    if (html.includes('Wix')) checks.push('Wix');
    if (html.includes('data-reactroot')) checks.push('React');
    if (html.includes('data-v-app')) checks.push('Vue.js');
    if (html.includes('ng-app')) checks.push('Angular');
    return checks;
  });

  contentChecks.forEach(tech => detected.add(tech));

  return Array.from(detected).sort();
};