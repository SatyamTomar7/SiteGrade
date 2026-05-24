import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScoreBreakdown,
  buildRegressionComparison,
  calculateOverallScore,
  classifyPageType,
  classifyPageRole,
  classifyDelta,
  inferWebsiteType,
  normalizeAnalysisUrl
} from './analysis.helpers.js';

test('normalizeAnalysisUrl adds https and canonicalizes casing, hash, and default port', () => {
  const normalized = normalizeAnalysisUrl('Example.COM:443/path///#section');
  assert.equal(normalized, 'https://example.com/path');
});

test('normalizeAnalysisUrl preserves root slash and query string', () => {
  const normalized = normalizeAnalysisUrl('https://Example.com/?q=test#hero');
  assert.equal(normalized, 'https://example.com/?q=test');
});

test('normalizeAnalysisUrl throws a 400 error for invalid input', () => {
  assert.throws(
    () => normalizeAnalysisUrl(''),
    (error) => error.message === 'URL is required' && error.statusCode === 400
  );

  assert.throws(
    () => normalizeAnalysisUrl('not a valid url with spaces'),
    (error) => error.message === 'Invalid URL' && error.statusCode === 400
  );
});

test('calculateOverallScore supports custom website-type weighting', () => {
  const overallScore = calculateOverallScore({
    performance: 90,
    seo: 80,
    accessibility: 70,
    security: 60,
    bestPractices: 50
  }, {
    websiteType: 'portfolio',
    crawlData: {
      totalPagesDiscovered: 3,
      successfulPages: 3,
      roleCounts: {
        homepage: 1,
        about: 1,
        contact: 1
      }
    }
  });

  assert.equal(overallScore, 72);
});

test('classifyDelta uses thresholds for improved, stable, and regressed', () => {
  assert.equal(classifyDelta(4), 'improved');
  assert.equal(classifyDelta(2), 'stable');
  assert.equal(classifyDelta(-4), 'regressed');
  assert.equal(classifyDelta(1, 1), 'improved');
});

test('buildRegressionComparison summarizes regressions and improvements across metrics', () => {
  const baseline = {
    overallScore: 80,
    scores: {
      performance: 85,
      seo: 82,
      accessibility: 78,
      security: 79,
      bestPractices: 76
    }
  };

  const latest = {
    overallScore: 76,
    scores: {
      performance: 81,
      seo: 84,
      accessibility: 79,
      security: 72,
      bestPractices: 77
    }
  };

  const comparison = buildRegressionComparison(baseline, latest);

  assert.equal(comparison.summary.overallDirection, 'regressed');
  assert.equal(comparison.summary.regressionCount, 3);
  assert.equal(comparison.summary.improvementCount, 0);
  assert.deepEqual(
    comparison.comparisons.find((item) => item.metric === 'seo'),
    {
      metric: 'seo',
      baseline: 82,
      latest: 84,
      delta: 2,
      direction: 'stable'
    }
  );
});

test('classifyPageType identifies common page intent heuristically', () => {
  assert.equal(
    classifyPageType({
      url: 'https://example.com/docs/getting-started',
      title: 'Getting Started Documentation',
      bodyTextLength: 8000
    }),
    'docs'
  );

  assert.equal(
    classifyPageType({
      url: 'https://example.com/portfolio',
      title: 'Developer Portfolio',
      bodyTextLength: 1200,
      techStack: ['React']
    }),
    'portfolio'
  );
});

test('classifyPageRole identifies key page roles from url and title', () => {
  assert.equal(
    classifyPageRole({
      url: 'https://example.com/pricing',
      title: 'Pricing Plans'
    }),
    'pricing'
  );

  assert.equal(
    classifyPageRole({
      url: 'https://example.com/',
      title: 'Acme Home'
    }),
    'homepage'
  );
});

test('inferWebsiteType uses requested type first, then crawl and content signals', () => {
  assert.equal(
    inferWebsiteType({
      requestedType: 'portfolio',
      pageType: 'landing page'
    }),
    'portfolio'
  );

  assert.equal(
    inferWebsiteType({
      requestedType: 'general',
      crawlData: {
        roleCounts: {
          pricing: 1,
          login: 1
        }
      },
      title: 'Acme SaaS Platform'
    }),
    'saas'
  );
});

test('buildScoreBreakdown reports missing expected roles for the detected site type', () => {
  const breakdown = buildScoreBreakdown({
    performance: 88,
    seo: 82,
    accessibility: 79,
    security: 84,
    bestPractices: 80
  }, {
    websiteType: 'ecommerce',
    crawlData: {
      totalPagesDiscovered: 2,
      successfulPages: 2,
      roleCounts: {
        homepage: 1,
        product: 1
      }
    }
  });

  assert.equal(breakdown.websiteType, 'ecommerce');
  assert.deepEqual(breakdown.coverage.missingRoles, ['checkout']);
  assert.equal(breakdown.overallScore, 83);
});
