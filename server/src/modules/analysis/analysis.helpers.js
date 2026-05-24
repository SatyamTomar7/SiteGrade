export const ANALYSIS_SCORE_METRICS = ['overallScore', 'performance', 'seo', 'accessibility', 'security', 'bestPractices'];

export const WEBSITE_TYPES = ['general', 'portfolio', 'saas', 'ecommerce', 'blog', 'docs', 'business'];
export const ANALYSIS_PAGE_ROLES = ['homepage', 'about', 'contact', 'pricing', 'product', 'blog', 'docs', 'login', 'checkout', 'other'];

const SCORE_KEYS = ['performance', 'seo', 'accessibility', 'security', 'bestPractices'];
const DEFAULT_WEIGHTS = {
  performance: 0.2,
  seo: 0.2,
  accessibility: 0.2,
  security: 0.2,
  bestPractices: 0.2
};

const WEBSITE_TYPE_WEIGHTS = {
  general: DEFAULT_WEIGHTS,
  portfolio: {
    performance: 0.24,
    seo: 0.16,
    accessibility: 0.22,
    security: 0.12,
    bestPractices: 0.26
  },
  saas: {
    performance: 0.23,
    seo: 0.13,
    accessibility: 0.18,
    security: 0.22,
    bestPractices: 0.24
  },
  ecommerce: {
    performance: 0.24,
    seo: 0.24,
    accessibility: 0.16,
    security: 0.2,
    bestPractices: 0.16
  },
  blog: {
    performance: 0.2,
    seo: 0.3,
    accessibility: 0.2,
    security: 0.1,
    bestPractices: 0.2
  },
  docs: {
    performance: 0.18,
    seo: 0.14,
    accessibility: 0.3,
    security: 0.12,
    bestPractices: 0.26
  },
  business: {
    performance: 0.21,
    seo: 0.23,
    accessibility: 0.18,
    security: 0.16,
    bestPractices: 0.22
  }
};

const WEBSITE_ROLE_EXPECTATIONS = {
  general: ['homepage'],
  portfolio: ['homepage', 'about', 'contact'],
  saas: ['homepage', 'pricing', 'docs'],
  ecommerce: ['homepage', 'product', 'checkout'],
  blog: ['homepage', 'blog', 'about'],
  docs: ['homepage', 'docs', 'contact'],
  business: ['homepage', 'about', 'contact']
};

const normalizeRoleCount = (roleCounts = {}) => Object.fromEntries(
  ANALYSIS_PAGE_ROLES.map((role) => [role, Number(roleCounts?.[role]) || 0])
);

const buildRoleCoverageScore = (websiteType, crawlData = {}) => {
  const roleCounts = normalizeRoleCount(crawlData.roleCounts);
  const expectedRoles = WEBSITE_ROLE_EXPECTATIONS[websiteType] || WEBSITE_ROLE_EXPECTATIONS.general;
  const presentRoles = expectedRoles.filter((role) => roleCounts[role] > 0);
  const roleCoverageScore = Math.round((presentRoles.length / expectedRoles.length) * 100);
  const successfulPages = Number(crawlData.successfulPages) || 0;
  const totalPagesDiscovered = Math.max(Number(crawlData.totalPagesDiscovered) || 0, 1);
  const crawlReliabilityScore = Math.round((successfulPages / totalPagesDiscovered) * 100);

  return {
    expectedRoles,
    presentRoles,
    missingRoles: expectedRoles.filter((role) => !presentRoles.includes(role)),
    roleCoverageScore,
    crawlReliabilityScore,
    weightedCoverageScore: Math.round((roleCoverageScore * 0.65) + (crawlReliabilityScore * 0.35))
  };
};

export const normalizeWebsiteType = (input = '') => {
  const normalized = String(input || '').trim().toLowerCase();
  return WEBSITE_TYPES.includes(normalized) ? normalized : 'general';
};

export const classifyPageRole = ({ url = '', title = '' } = {}) => {
  const normalizedUrl = String(url).toLowerCase();
  const normalizedTitle = String(title).toLowerCase();
  const keywords = `${normalizedUrl} ${normalizedTitle}`;

  if (['/about', 'about us', 'our story', 'team'].some((term) => keywords.includes(term))) {
    return 'about';
  }

  if (['/contact', 'contact us', 'get in touch'].some((term) => keywords.includes(term))) {
    return 'contact';
  }

  if (['/pricing', 'plans', 'subscriptions', 'compare plans'].some((term) => keywords.includes(term))) {
    return 'pricing';
  }

  if (['/product', '/shop', '/store', 'product details'].some((term) => keywords.includes(term))) {
    return 'product';
  }

  if (['/blog', '/post', '/article', 'blog'].some((term) => keywords.includes(term))) {
    return 'blog';
  }

  if (['docs', 'documentation', '/guide', '/api', '/help'].some((term) => keywords.includes(term))) {
    return 'docs';
  }

  if (['/login', '/signin', '/sign-in', '/auth'].some((term) => keywords.includes(term))) {
    return 'login';
  }

  if (['checkout', '/cart', '/basket'].some((term) => keywords.includes(term))) {
    return 'checkout';
  }

  if (/\/?$/.test(new URL(normalizedUrl.startsWith('http') ? normalizedUrl : 'https://example.com').pathname) && !keywords.includes('checkout')) {
    return 'homepage';
  }

  return 'other';
};

export const normalizeAnalysisUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) {
    const error = new Error('URL is required');
    error.statusCode = 400;
    throw error;
  }

  let candidate = url.trim();
  if (!candidate.startsWith('http://') && !candidate.startsWith('https://')) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);

    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';

    if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }

    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    return parsed.toString();
  } catch {
    const error = new Error('Invalid URL');
    error.statusCode = 400;
    throw error;
  }
};

export const classifyDelta = (delta, threshold = 3) => {
  if (delta >= threshold) {
    return 'improved';
  }

  if (delta <= -threshold) {
    return 'regressed';
  }

  return 'stable';
};

export const buildRegressionComparison = (baseline, latest) => {
  const comparisons = ANALYSIS_SCORE_METRICS.map((metric) => {
    const baselineValue = metric === 'overallScore'
      ? baseline.overallScore
      : baseline.scores?.[metric] ?? 0;
    const latestValue = metric === 'overallScore'
      ? latest.overallScore
      : latest.scores?.[metric] ?? 0;
    const delta = latestValue - baselineValue;

    return {
      metric,
      baseline: baselineValue,
      latest: latestValue,
      delta,
      direction: classifyDelta(delta)
    };
  });

  const regressions = comparisons.filter((item) => item.direction === 'regressed');
  const improvements = comparisons.filter((item) => item.direction === 'improved');

  return {
    comparisons,
    summary: {
      regressionCount: regressions.length,
      improvementCount: improvements.length,
      overallDirection: classifyDelta(
        comparisons.find((item) => item.metric === 'overallScore')?.delta ?? 0,
        1
      )
    }
  };
};

export const classifyPageType = ({ url = '', title = '', bodyTextLength = 0, hasForm = false, techStack = [] } = {}) => {
  const normalizedUrl = String(url).toLowerCase();
  const normalizedTitle = String(title).toLowerCase();
  const keywords = `${normalizedUrl} ${normalizedTitle}`;

  if (['product', '/shop', '/pricing', 'checkout', 'cart'].some((term) => keywords.includes(term))) {
    return 'product';
  }

  if (['/blog', '/post', '/article', 'news', 'guides'].some((term) => keywords.includes(term))) {
    return 'blog';
  }

  if (['docs', 'documentation', '/help', '/guide', '/api'].some((term) => keywords.includes(term))) {
    return 'docs';
  }

  if (
    ['portfolio', 'case study', 'projects', 'developer', 'designer'].some((term) => keywords.includes(term)) ||
    techStack.some((tech) => ['React', 'Next.js', 'Vite'].includes(tech))
  ) {
    return 'portfolio';
  }

  if (hasForm || bodyTextLength < 3000) {
    return 'landing page';
  }

  return 'marketing site';
};

export const inferWebsiteType = ({
  requestedType = 'general',
  pageType = '',
  crawlData = {},
  techStack = [],
  title = '',
  url = ''
} = {}) => {
  const normalizedRequestedType = normalizeWebsiteType(requestedType);
  if (normalizedRequestedType !== 'general') {
    return normalizedRequestedType;
  }

  const normalizedPageType = String(pageType || '').toLowerCase();
  const keywords = `${String(title).toLowerCase()} ${String(url).toLowerCase()}`;
  const roleCounts = normalizeRoleCount(crawlData.roleCounts);

  if (normalizedPageType.includes('portfolio') || ['portfolio', 'case study', 'developer'].some((term) => keywords.includes(term))) {
    return 'portfolio';
  }

  if (roleCounts.product > 0 || roleCounts.checkout > 0 || ['shopify', 'stripe', 'woocommerce'].some((tech) => techStack.map((item) => String(item).toLowerCase()).includes(tech))) {
    return 'ecommerce';
  }

  if (roleCounts.pricing > 0 || roleCounts.login > 0 || ['saas', 'app', 'dashboard'].some((term) => keywords.includes(term))) {
    return 'saas';
  }

  if (roleCounts.docs > 0 || normalizedPageType === 'docs') {
    return 'docs';
  }

  if (roleCounts.blog > 0 || normalizedPageType === 'blog') {
    return 'blog';
  }

  if (roleCounts.about > 0 && roleCounts.contact > 0) {
    return 'business';
  }

  return 'general';
};

export const buildScoreBreakdown = (scores = {}, options = {}) => {
  const websiteType = normalizeWebsiteType(options.websiteType);
  const weights = WEBSITE_TYPE_WEIGHTS[websiteType] || DEFAULT_WEIGHTS;
  const weightedBaseScore = SCORE_KEYS.reduce((sum, key) => {
    const value = Number(scores?.[key]) || 0;
    return sum + (value * weights[key]);
  }, 0);
  const coverage = buildRoleCoverageScore(websiteType, options.crawlData);
  const crawlContribution = ((coverage.weightedCoverageScore || 0) / 100) * 8;
  const weightedMetricContribution = weightedBaseScore * 0.92;
  const overallScore = Math.max(0, Math.min(100, Math.round(weightedMetricContribution + crawlContribution)));

  return {
    websiteType,
    weights,
    weightedBaseScore: Math.round(weightedBaseScore),
    coverage,
    crawlContribution: Math.round(crawlContribution),
    overallScore
  };
};

export const calculateOverallScore = (scores = {}, options = {}) => buildScoreBreakdown(scores, options).overallScore;
