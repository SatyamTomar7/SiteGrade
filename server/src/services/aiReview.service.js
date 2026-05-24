import { logger } from '../config/logger.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const normalizeSeverity = (value = '') => {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'low') return 'Low';
  return 'Medium';
};

const normalizeEffort = (value = '') => {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'high') return 'High';
  if (normalized === 'low') return 'Low';
  return 'Medium';
};

const normalizeEstimatedImpact = (value, fallback = 0) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(Math.round(numericValue), 100));
};

const normalizeActionPlan = (items = []) => items.map((item) => ({
  priority: item.priority || 'High Impact',
  severity: normalizeSeverity(item.severity),
  effort: normalizeEffort(item.effort),
  estimatedScoreImpact: normalizeEstimatedImpact(item.estimatedScoreImpact),
  issue: item.issue || '',
  recommendation: item.recommendation || '',
  expectedOutcome: item.expectedOutcome || '',
  rationale: item.rationale || ''
}));

const normalizeAiFixes = (items = []) => items.map((item) => ({
  title: item.title || '',
  category: item.category || '',
  severity: normalizeSeverity(item.severity),
  effort: normalizeEffort(item.effort),
  estimatedScoreImpact: normalizeEstimatedImpact(item.estimatedScoreImpact),
  suggestion: item.suggestion || '',
  codeExample: item.codeExample || '',
  whyItMatters: item.whyItMatters || ''
}));

const inferSiteContext = (puppeteerData = {}) => {
  const techStack = puppeteerData.techStack || [];
  const lowerTitle = (puppeteerData.title || '').toLowerCase();
  const hasCommerceSignals = techStack.some((tech) => ['Shopify', 'Stripe'].includes(tech));
  const hasContentSignals = (puppeteerData.bodyTextLength || 0) > 5000;
  const hasContactSignals = puppeteerData.hasForm;
  const titleLooksLikePortfolio = ['portfolio', 'developer', 'designer', 'engineer'].some((term) => lowerTitle.includes(term));

  let siteType = 'general website';
  if (hasCommerceSignals) siteType = 'ecommerce website';
  else if (titleLooksLikePortfolio) siteType = 'portfolio website';
  else if (hasContentSignals) siteType = 'content-rich marketing or documentation website';
  else if (hasContactSignals) siteType = 'lead-generation or business website';

  return {
    siteType: puppeteerData.pageType || siteType,
    audience: hasCommerceSignals
      ? 'customers who need trust, speed, and conversion clarity'
      : titleLooksLikePortfolio
      ? 'recruiters, hiring managers, and collaborators'
      : hasContentSignals
      ? 'visitors who need clear information and easy navigation'
      : 'users evaluating credibility and usability quickly'
  };
};

/**
 * Generates a structured AI review using Google Gemini API
 * @param {Object} lighthouseData - Lighthouse audit results
 * @param {Object} puppeteerData - Puppeteer scrape results
 * @returns {Promise<Object>} - Structured review with recruiter mode, fixes, and action plan
 */
export const generateAIReview = async (lighthouseData, puppeteerData) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY not configured, returning fallback review');
    return generateFallbackReview(lighthouseData, puppeteerData);
  }

  const prompt = buildPrompt(lighthouseData, puppeteerData);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              recruiterReview: {
                type: 'string',
                description: 'A detailed 3-4 paragraph review written as if a technical recruiter is evaluating the website quality for a job candidate portfolio. Be honest but constructive. Mention specific metrics.'
              },
              strengths: {
                type: 'array',
                items: { type: 'string' },
                description: '3-5 specific strengths of the website based on the data'
              },
              weaknesses: {
                type: 'array',
                items: { type: 'string' },
                description: '3-5 specific weaknesses or areas for improvement'
              },
              overallGrade: {
                type: 'string',
                enum: ['A+', 'A', 'B', 'C', 'D'],
                description: 'Overall letter grade based on all metrics. A+ = exceptional, A = very good, B = good with room for improvement, C = acceptable but needs work, D = poor'
              },
              portfolioReadiness: {
                type: 'object',
                properties: {
                  overallScore: { type: 'number' },
                  visualPolish: { type: 'number' },
                  trustProfessionalism: { type: 'number' },
                  projectClarity: { type: 'number' },
                  contactClarity: { type: 'number' },
                  mobileReadiness: { type: 'number' },
                  hiringImpression: { type: 'number' },
                  summary: { type: 'string' }
                },
                required: ['overallScore', 'visualPolish', 'trustProfessionalism', 'projectClarity', 'contactClarity', 'mobileReadiness', 'hiringImpression', 'summary']
              },
              recruiterMode: {
                type: 'object',
                properties: {
                  hiringSignal: {
                    type: 'string',
                    description: 'One-line recruiter signal such as strong shortlist, mixed signal, or not yet interview-ready'
                  },
                  recruiterVerdict: {
                    type: 'string',
                    description: 'A concise recruiter-oriented verdict explaining whether the site supports a strong candidate impression'
                  },
                  resumePitch: {
                    type: 'string',
                    description: 'A short project pitch the candidate can reuse on resume or interview introductions'
                  }
                },
                required: ['hiringSignal', 'recruiterVerdict', 'resumePitch']
              },
              actionPlan: {
                type: 'array',
                description: '3-5 prioritized actions ordered by impact',
                items: {
                  type: 'object',
                  properties: {
                    priority: {
                      type: 'string',
                      enum: ['Quick Win', 'High Impact', 'Must Fix']
                    },
                    severity: {
                      type: 'string',
                      enum: ['Low', 'Medium', 'High', 'Critical']
                    },
                    effort: {
                      type: 'string',
                      enum: ['Low', 'Medium', 'High']
                    },
                    estimatedScoreImpact: { type: 'number' },
                    issue: { type: 'string' },
                    recommendation: { type: 'string' },
                    expectedOutcome: { type: 'string' },
                    rationale: { type: 'string' }
                  },
                  required: ['priority', 'severity', 'effort', 'estimatedScoreImpact', 'issue', 'recommendation', 'expectedOutcome', 'rationale']
                }
              },
              aiFixes: {
                type: 'array',
                description: '2-4 practical fix suggestions with concise implementation examples',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    category: { type: 'string' },
                    severity: {
                      type: 'string',
                      enum: ['Low', 'Medium', 'High', 'Critical']
                    },
                    effort: {
                      type: 'string',
                      enum: ['Low', 'Medium', 'High']
                    },
                    estimatedScoreImpact: { type: 'number' },
                    suggestion: { type: 'string' },
                    codeExample: { type: 'string' },
                    whyItMatters: { type: 'string' }
                  },
                  required: ['title', 'category', 'severity', 'effort', 'estimatedScoreImpact', 'suggestion', 'codeExample', 'whyItMatters']
                }
              },
              interviewSummary: {
                type: 'object',
                properties: {
                  resumeBullets: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  projectDescription: { type: 'string' },
                  techStackSummary: { type: 'string' },
                  challengesSolved: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['resumeBullets', 'projectDescription', 'techStackSummary', 'challengesSolved']
              }
            },
            required: ['recruiterReview', 'strengths', 'weaknesses', 'overallGrade', 'portfolioReadiness', 'recruiterMode', 'actionPlan', 'aiFixes', 'interviewSummary']
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(text);
    
    logger.info(`AI review generated with grade: ${parsed.overallGrade}`);
    
    return {
      recruiterReview: parsed.recruiterReview,
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      overallGrade: parsed.overallGrade,
      portfolioReadiness: parsed.portfolioReadiness || {},
      recruiterMode: parsed.recruiterMode || {},
      actionPlan: normalizeActionPlan(parsed.actionPlan || []),
      aiFixes: normalizeAiFixes(parsed.aiFixes || []),
      interviewSummary: parsed.interviewSummary || {}
    };
  } catch (error) {
    logger.error('Gemini API error:', error);
    return generateFallbackReview(lighthouseData, puppeteerData);
  }
};

/**
 * Builds the prompt for Gemini based on audit data
 */
const buildPrompt = (lighthouseData, puppeteerData) => {
  const scores = lighthouseData.scores || {};
  const metrics = lighthouseData.metrics || {};
  const techStack = puppeteerData.techStack || [];
  const securityScore = puppeteerData.securityScore ?? 0;
  const siteContext = inferSiteContext(puppeteerData);
  const benchmarkData = puppeteerData.benchmarkData || {};
  const fieldData = puppeteerData.fieldData || {};
  const opportunities = lighthouseData.opportunityMap || [];
  const accessibilityIssues = lighthouseData.accessibilityIssueDetails || [];
  
  return `You are a senior website auditor reviewing a ${siteContext.siteType} for overall quality, credibility, performance, accessibility, search visibility, and maintainability.
Analyze the following website audit data and provide a structured assessment that is specific, evidence-based, and useful to the likely audience: ${siteContext.audience}.

LIGHTHOUSE SCORES (out of 100):
- Performance: ${scores.performance || 'N/A'}
- SEO: ${scores.seo || 'N/A'}
- Accessibility: ${scores.accessibility || 'N/A'}
- Best Practices: ${scores.bestPractices || 'N/A'}
- Security: ${securityScore}

CORE WEB VITALS:
- First Contentful Paint: ${metrics.firstContentfulPaint || 'N/A'}
- Largest Contentful Paint: ${metrics.largestContentfulPaint || 'N/A'}
- Time to Interactive: ${metrics.timeToInteractive || 'N/A'}
- Cumulative Layout Shift: ${metrics.cumulativeLayoutShift || 'N/A'}
- Total Blocking Time: ${metrics.totalBlockingTime || 'N/A'}

PUPPETEER ANALYSIS:
- Page Title: ${puppeteerData.title || 'N/A'}
- DOM Elements: ${puppeteerData.domElements || 'N/A'}
- Page Size: ${puppeteerData.pageSize || 'N/A'}
- Load Time: ${puppeteerData.loadTime || 'N/A'}
- Console Errors: ${puppeteerData.consoleErrors || 'N/A'}
- Meta Description Present: ${puppeteerData.hasMetaDescription ? 'Yes' : 'No'}
- Title Length: ${puppeteerData.titleLength || 0}
- Meta Description Length: ${puppeteerData.metaDescriptionLength || 0}
- Viewport Meta Present: ${puppeteerData.hasViewportMeta ? 'Yes' : 'No'}
- Canonical Tag Present: ${puppeteerData.hasCanonicalTag ? 'Yes' : 'No'}
- Robots.txt Accessible: ${puppeteerData.robotsTxtAccessible ? 'Yes' : 'No'}
- Sitemap Accessible: ${puppeteerData.sitemapAccessible ? 'Yes' : 'No'}
- Indexable: ${puppeteerData.isIndexable ? 'Yes' : 'No'}
- Followable: ${puppeteerData.isFollowable ? 'Yes' : 'No'}
- Open Graph Title/Description/Image: ${puppeteerData.openGraph?.titlePresent ? 'Yes' : 'No'} / ${puppeteerData.openGraph?.descriptionPresent ? 'Yes' : 'No'} / ${puppeteerData.openGraph?.imagePresent ? 'Yes' : 'No'}
- Twitter Card Present: ${puppeteerData.twitterCardPresent ? 'Yes' : 'No'}
- Favicon Present: ${puppeteerData.faviconPresent ? 'Yes' : 'No'}
- Images Missing Alt Text: ${puppeteerData.imagesWithoutAlt ?? 'N/A'}
- Structured Data Scripts: ${puppeteerData.structuredDataScripts ?? 'N/A'}
- Internal Links: ${puppeteerData.internalLinks ?? 'N/A'}
- External Links: ${puppeteerData.externalLinks ?? 'N/A'}
- Insecure Forms: ${puppeteerData.insecureFormCount ?? 'N/A'}
- Mixed Content Requests: ${puppeteerData.mixedContentRequests ?? 'N/A'}
- Broken Links: ${puppeteerData.brokenLinks?.length ?? 0}
- Redirect Chains: ${puppeteerData.redirectChains?.length ?? 0}
- Hreflang Tags: ${puppeteerData.hreflangCount ?? 0}
- HTTPS: ${puppeteerData.isHttps ? 'Yes' : 'No'}
- Page Type Classification: ${puppeteerData.pageType || 'N/A'}
- Crawl Summary: ${puppeteerData.crawlData?.totalPagesDiscovered || 1} page(s) reviewed
- Accessibility Samples: ${JSON.stringify(puppeteerData.accessibilitySamples || {})}

TECH STACK DETECTED: ${techStack.join(', ') || 'None detected'}

LIGHTHOUSE OPPORTUNITIES:
${opportunities.slice(0, 8).map((item) => `- [${item.profile}] ${item.title}: estimated impact +${item.estimatedScoreImpact}, savings ${item.displayValue || 'N/A'}`).join('\n') || '- None'}

ACCESSIBILITY ISSUE DETAILS:
${accessibilityIssues.slice(0, 8).map((item) => `- [${item.profile}] ${item.title}: score ${item.score}/100, impacted ${item.impactedElements?.length || 0} elements`).join('\n') || '- None'}

COMPETITOR BENCHMARK:
- Summary: ${benchmarkData.summary || 'No competitors compared'}
- Rank: ${benchmarkData.targetRank || 'N/A'}
- Compared Sites: ${benchmarkData.compared || 0}

FIELD DATA (CrUX):
- Available: ${fieldData.available ? 'Yes' : 'No'}
- LCP p75: ${fieldData.metrics?.largestContentfulPaint ?? 'N/A'}
- INP p75: ${fieldData.metrics?.interactionToNextPaint ?? 'N/A'}
- CLS p75: ${fieldData.metrics?.cumulativeLayoutShift ?? 'N/A'}

HEADINGS STRUCTURE:
- H1 count: ${puppeteerData.headings?.h1 || 0}
- H2 count: ${puppeteerData.headings?.h2 || 0}
- H3 count: ${puppeteerData.headings?.h3 || 0}

In addition to the review, return:
- portfolioReadiness with 0-100 scores for visual polish, trust/professionalism, project clarity, contact clarity, mobile readiness, hiring impression, plus overallScore and summary
- recruiterMode with hiringSignal, recruiterVerdict, and resumePitch
- actionPlan with prioritized items using only Quick Win, High Impact, or Must Fix
- aiFixes with practical fixes and short code examples when relevant, and make them framework-specific whenever the detected stack supports that
- interviewSummary with resumeBullets, projectDescription, techStackSummary, and challengesSolved

Keep recommendations concrete, relevant to this website type, and grounded in the provided metrics. Avoid generic praise.`;
};

/**
 * Generates a fallback review when Gemini API is unavailable
 */
const generateFallbackReview = (lighthouseData, puppeteerData) => {
  const scores = lighthouseData.scores || {};
  const securityScore = puppeteerData.securityScore ?? 0;
  const siteContext = inferSiteContext(puppeteerData);
  const avgScore = Math.round(
    (
      (scores.performance ?? 0) +
      (scores.seo ?? 0) +
      (scores.accessibility ?? 0) +
      (scores.bestPractices ?? 0) +
      securityScore
    ) / 5
  );

  let grade = 'D';
  if (avgScore >= 95) grade = 'A+';
  else if (avgScore >= 85) grade = 'A';
  else if (avgScore >= 70) grade = 'B';
  else if (avgScore >= 50) grade = 'C';

  const strengths = [];
  const weaknesses = [];
  const actionPlan = [];
  const aiFixes = [];
  const resumeBullets = [
    `Improved a ${siteContext.siteType} by tracking technical quality across performance, accessibility, search visibility, security, and frontend stability.`,
    'Used automated audit data to identify the highest-impact fixes and convert raw metrics into a prioritized improvement plan.',
    'Measured technical progress over repeated analysis runs to validate whether changes improved quality signals.'
  ];
  const challengesSolved = [
    'Balanced performance, accessibility, SEO, and security recommendations instead of optimizing for a single score alone.',
    'Converted raw audit findings into practical actions that can be implemented and re-tested.',
    'Highlighted issues likely to affect trust, usability, and maintainability before they become larger product problems.'
  ];

  if (scores.performance >= 80) strengths.push('Strong performance metrics with fast load times');
  else {
    weaknesses.push('Performance needs optimization - consider image compression and code splitting');
    actionPlan.push({
      priority: 'High Impact',
      severity: 'High',
      effort: 'Medium',
      estimatedScoreImpact: 18,
      issue: 'Slow performance metrics',
      recommendation: 'Compress large assets, lazy-load non-critical content, and reduce blocking scripts.',
      expectedOutcome: 'Faster load time, improved Core Web Vitals, and stronger first impression.',
      rationale: 'Performance problems visibly slow the experience and directly weaken quality signals.'
    });
    aiFixes.push({
      title: 'Improve performance with lazy loading',
      category: 'Performance',
      severity: 'High',
      effort: 'Low',
      estimatedScoreImpact: 12,
      suggestion: 'Lazy-load below-the-fold media and defer non-critical JavaScript.',
      codeExample: '<img src="/hero.jpg" loading="lazy" alt="Project preview" />',
      whyItMatters: 'This reduces initial network and rendering work, which usually improves user-perceived speed quickly.'
    });
  }

  if (scores.seo >= 80) strengths.push('Good SEO foundation with proper meta tags and structure');
  else {
    weaknesses.push('SEO improvements needed - missing or incomplete meta descriptions');
    actionPlan.push({
      priority: 'Quick Win',
      severity: 'Medium',
      effort: 'Low',
      estimatedScoreImpact: 10,
      issue: 'Weak search metadata',
      recommendation: 'Add a specific title, meta description, and Open Graph tags for portfolio pages.',
      expectedOutcome: 'Improved search presentation and better professional polish when links are shared.',
      rationale: 'Metadata gaps weaken discoverability and make shared links look incomplete or unpolished.'
    });
    aiFixes.push({
      title: 'Add SEO and social metadata',
      category: 'SEO',
      severity: 'Medium',
      effort: 'Low',
      estimatedScoreImpact: 8,
      suggestion: 'Create unique title and description tags for the landing page and featured projects.',
      codeExample: '<meta name="description" content="Frontend developer portfolio with React, Node.js, and full-stack case studies." />',
      whyItMatters: 'Search snippets and social previews often shape the first impression before a user even visits the site.'
    });
  }

  if (scores.accessibility >= 80) strengths.push('Accessible design with proper ARIA labels and contrast');
  else {
    weaknesses.push('Accessibility gaps detected - add ARIA labels and improve color contrast');
    actionPlan.push({
      priority: 'Must Fix',
      severity: 'High',
      effort: 'Medium',
      estimatedScoreImpact: 16,
      issue: 'Accessibility barriers',
      recommendation: 'Fix heading order, add missing alt text/labels, and improve low-contrast UI elements.',
      expectedOutcome: 'More inclusive experience and a stronger signal of engineering maturity.',
      rationale: 'Accessibility issues block real users and are often interpreted as a quality and care problem.'
    });
    aiFixes.push({
      title: 'Fix form accessibility',
      category: 'Accessibility',
      severity: 'High',
      effort: 'Low',
      estimatedScoreImpact: 10,
      suggestion: 'Ensure every form control has a visible label and accessible name.',
      codeExample: '<label for="email">Email</label><input id="email" name="email" type="email" />',
      whyItMatters: 'Labeled controls are a core accessibility baseline and immediately improve usability for assistive technology users.'
    });
  }

  if (securityScore >= 80) strengths.push('Security headers properly configured');
  else {
    weaknesses.push('Security headers missing - implement CSP and HSTS');
    actionPlan.push({
      priority: 'Must Fix',
      severity: 'High',
      effort: 'Medium',
      estimatedScoreImpact: 14,
      issue: 'Security posture is weak',
      recommendation: 'Add core security headers including CSP, HSTS, and X-Content-Type-Options.',
      expectedOutcome: 'Improved trust signal for recruiters and better baseline hardening.',
      rationale: 'Weak security headers are a visible trust gap and reduce the baseline resilience of the site.'
    });
    aiFixes.push({
      title: 'Set basic security headers',
      category: 'Security',
      severity: 'High',
      effort: 'Low',
      estimatedScoreImpact: 9,
      suggestion: 'Configure server or hosting platform to send common protective headers.',
      codeExample: "res.setHeader('X-Content-Type-Options', 'nosniff');",
      whyItMatters: 'Security headers are relatively quick to add and improve both trust and platform hardening.'
    });
  }

  if (puppeteerData.consoleErrors === 0) strengths.push('Clean console with no JavaScript errors');
  else {
    weaknesses.push(`${puppeteerData.consoleErrors} console errors detected - fix JavaScript issues`);
    actionPlan.push({
      priority: 'High Impact',
      severity: 'Medium',
      effort: 'Medium',
      estimatedScoreImpact: 8,
      issue: 'JavaScript console errors reduce quality perception',
      recommendation: 'Fix runtime errors and broken asset references before sharing the portfolio publicly.',
      expectedOutcome: 'Cleaner UX and stronger confidence during recruiter or interviewer review.',
      rationale: 'Console errors often correlate with broken features or hidden instability that users eventually notice.'
    });
  }

  if (puppeteerData.headings?.h1 === 1) strengths.push('Proper heading hierarchy with single H1');
  else {
    weaknesses.push('Heading structure needs improvement - ensure exactly one H1 per page');
    actionPlan.push({
      priority: 'Quick Win',
      severity: 'Medium',
      effort: 'Low',
      estimatedScoreImpact: 6,
      issue: 'Weak heading hierarchy',
      recommendation: 'Use one clear H1 and logical H2/H3 sections for projects, skills, and contact areas.',
      expectedOutcome: 'Better semantics, improved accessibility, and clearer recruiter scanning.',
      rationale: 'Heading structure improves both semantic quality and how quickly visitors can understand the page.'
    });
  }

  const recruiterMode = {
    hiringSignal: grade === 'A+' || grade === 'A'
      ? 'Strong quality signal'
      : grade === 'B'
      ? 'Mixed signal with good upside'
      : 'Needs focused improvement',
    recruiterVerdict: grade === 'A+' || grade === 'A'
      ? `This ${siteContext.siteType} creates a credible and well-executed impression with only minor gaps.`
      : grade === 'B'
      ? `This ${siteContext.siteType} is solid overall, but a few visible issues still weaken trust and usability.`
      : `This ${siteContext.siteType} currently shows enough friction or inconsistency that it may undermine confidence for visitors.`,
    resumePitch: `Improved a ${siteContext.siteType} using audit-driven recommendations across performance, accessibility, SEO, security, and frontend quality.`
  };

  const portfolioReadiness = {
    overallScore: avgScore,
    visualPolish: Math.max(Math.min(Math.round(((scores.bestPractices ?? 0) + (scores.performance ?? 0)) / 2), 100), 0),
    trustProfessionalism: Math.max(Math.min(Math.round((securityScore + (scores.bestPractices ?? 0)) / 2), 100), 0),
    projectClarity: puppeteerData.headings?.h1 === 1 ? 82 : 58,
    contactClarity: puppeteerData.hasForm ? 84 : 56,
    mobileReadiness: puppeteerData.hasViewportMeta ? 88 : 52,
    hiringImpression: grade === 'A+' || grade === 'A' ? 92 : grade === 'B' ? 74 : 48,
    summary: grade === 'A+' || grade === 'A'
      ? `This ${siteContext.siteType} is in strong shape and communicates quality clearly.`
      : grade === 'B'
      ? `This ${siteContext.siteType} has a solid base, but a few important issues still reduce confidence.`
      : `This ${siteContext.siteType} needs clearer execution and stronger fundamentals before it will feel dependable.`
  };

  const interviewSummary = {
    resumeBullets,
    projectDescription: `This analysis evaluates a ${siteContext.siteType} using automated audit signals and browser inspection to surface the most important quality issues.`,
    techStackSummary: `Automated analysis combined performance, SEO, accessibility, security, and runtime checks${puppeteerData.techStack?.length ? ` while detecting technologies such as ${puppeteerData.techStack.slice(0, 4).join(', ')}` : ''}.`,
    challengesSolved
  };

  const review = `This ${siteContext.siteType} demonstrates ${avgScore >= 70 ? 'solid' : 'concerning'} technical quality with an overall score of ${avgScore}/100.

${scores.performance >= 70 ? 'The performance metrics show acceptable load times, though there is always room for optimization through caching strategies and asset minification.' : 'Performance is a critical concern - the site loads slowly which will impact user experience and search rankings significantly.'}

${scores.seo >= 70 ? 'SEO fundamentals are in place with proper meta tags and semantic HTML structure.' : 'SEO requires immediate attention - missing meta descriptions and poor semantic structure will hurt discoverability.'}

${scores.accessibility >= 70 ? 'Accessibility considerations show awareness of inclusive design principles.' : 'Accessibility is lacking - this creates barriers for users with disabilities and may expose the site to compliance risks.'}

The detected tech stack (${puppeteerData.techStack?.join(', ') || 'unknown'}) suggests a ${puppeteerData.techStack?.length > 3 ? 'modern, layered' : 'basic'} implementation. ${puppeteerData.consoleErrors > 0 ? `However, the ${puppeteerData.consoleErrors} console errors indicate quality control issues that should be addressed.` : 'The clean console output reflects good frontend discipline.'}

Overall, this site would ${grade === 'A' || grade === 'A+' ? 'make a strong impression on visitors and stakeholders' : grade === 'B' ? 'feel credible, but still benefit from a targeted improvement pass' : 'require significant work before it feels polished and dependable'}.`;

  return {
    recruiterReview: review,
    strengths: strengths.length > 0 ? strengths : ['Website is functional and accessible'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['No major weaknesses detected'],
    overallGrade: grade,
    portfolioReadiness,
    recruiterMode,
    actionPlan: normalizeActionPlan(actionPlan.slice(0, 5)),
    aiFixes: normalizeAiFixes(aiFixes.slice(0, 4)),
    interviewSummary
  };
};
