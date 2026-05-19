import { logger } from '../config/logger.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

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
                    issue: { type: 'string' },
                    recommendation: { type: 'string' },
                    expectedOutcome: { type: 'string' }
                  },
                  required: ['priority', 'issue', 'recommendation', 'expectedOutcome']
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
                    suggestion: { type: 'string' },
                    codeExample: { type: 'string' }
                  },
                  required: ['title', 'category', 'suggestion', 'codeExample']
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
      actionPlan: parsed.actionPlan || [],
      aiFixes: parsed.aiFixes || [],
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
  
  return `You are a senior technical recruiter evaluating a website for quality and engineering excellence. 
Analyze the following website audit data and provide a structured assessment.

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
- Viewport Meta Present: ${puppeteerData.hasViewportMeta ? 'Yes' : 'No'}
- HTTPS: ${puppeteerData.isHttps ? 'Yes' : 'No'}

TECH STACK DETECTED: ${techStack.join(', ') || 'None detected'}

HEADINGS STRUCTURE:
- H1 count: ${puppeteerData.headings?.h1 || 0}
- H2 count: ${puppeteerData.headings?.h2 || 0}
- H3 count: ${puppeteerData.headings?.h3 || 0}

In addition to the review, return:
- portfolioReadiness with 0-100 scores for visual polish, trust/professionalism, project clarity, contact clarity, mobile readiness, hiring impression, plus overallScore and summary
- recruiterMode with hiringSignal, recruiterVerdict, and resumePitch
- actionPlan with prioritized items using only Quick Win, High Impact, or Must Fix
- aiFixes with practical fixes and short code examples when relevant
- interviewSummary with resumeBullets, projectDescription, techStackSummary, and challengesSolved

Keep recommendations concrete, portfolio-focused, and useful for job placements.`;
};

/**
 * Generates a fallback review when Gemini API is unavailable
 */
const generateFallbackReview = (lighthouseData, puppeteerData) => {
  const scores = lighthouseData.scores || {};
  const securityScore = puppeteerData.securityScore ?? 0;
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
    'Built SiteGrade, a full-stack website analysis platform that combines automated audits, browser inspection, and AI-generated recommendations.',
    'Integrated Lighthouse, Puppeteer, Redis queues, and AI evaluation into an asynchronous reporting workflow.',
    'Designed recruiter-focused reporting with actionable fixes, hiring-signal feedback, and exportable shareable reports.'
  ];
  const challengesSolved = [
    'Coordinated async analysis jobs and report persistence across multiple audit stages.',
    'Merged technical scoring with recruiter-style narrative feedback and prioritized recommendations.',
    'Handled public sharing, historical tracking, and reusable reporting flows across the product.'
  ];

  if (scores.performance >= 80) strengths.push('Strong performance metrics with fast load times');
  else {
    weaknesses.push('Performance needs optimization - consider image compression and code splitting');
    actionPlan.push({
      priority: 'High Impact',
      issue: 'Slow performance metrics',
      recommendation: 'Compress large assets, lazy-load non-critical content, and reduce blocking scripts.',
      expectedOutcome: 'Faster load time, improved Core Web Vitals, and stronger first impression.'
    });
    aiFixes.push({
      title: 'Improve performance with lazy loading',
      category: 'Performance',
      suggestion: 'Lazy-load below-the-fold media and defer non-critical JavaScript.',
      codeExample: '<img src="/hero.jpg" loading="lazy" alt="Project preview" />'
    });
  }

  if (scores.seo >= 80) strengths.push('Good SEO foundation with proper meta tags and structure');
  else {
    weaknesses.push('SEO improvements needed - missing or incomplete meta descriptions');
    actionPlan.push({
      priority: 'Quick Win',
      issue: 'Weak search metadata',
      recommendation: 'Add a specific title, meta description, and Open Graph tags for portfolio pages.',
      expectedOutcome: 'Improved search presentation and better professional polish when links are shared.'
    });
    aiFixes.push({
      title: 'Add SEO and social metadata',
      category: 'SEO',
      suggestion: 'Create unique title and description tags for the landing page and featured projects.',
      codeExample: '<meta name="description" content="Frontend developer portfolio with React, Node.js, and full-stack case studies." />'
    });
  }

  if (scores.accessibility >= 80) strengths.push('Accessible design with proper ARIA labels and contrast');
  else {
    weaknesses.push('Accessibility gaps detected - add ARIA labels and improve color contrast');
    actionPlan.push({
      priority: 'Must Fix',
      issue: 'Accessibility barriers',
      recommendation: 'Fix heading order, add missing alt text/labels, and improve low-contrast UI elements.',
      expectedOutcome: 'More inclusive experience and a stronger signal of engineering maturity.'
    });
    aiFixes.push({
      title: 'Fix form accessibility',
      category: 'Accessibility',
      suggestion: 'Ensure every form control has a visible label and accessible name.',
      codeExample: '<label for="email">Email</label><input id="email" name="email" type="email" />'
    });
  }

  if (securityScore >= 80) strengths.push('Security headers properly configured');
  else {
    weaknesses.push('Security headers missing - implement CSP and HSTS');
    actionPlan.push({
      priority: 'Must Fix',
      issue: 'Security posture is weak',
      recommendation: 'Add core security headers including CSP, HSTS, and X-Content-Type-Options.',
      expectedOutcome: 'Improved trust signal for recruiters and better baseline hardening.'
    });
    aiFixes.push({
      title: 'Set basic security headers',
      category: 'Security',
      suggestion: 'Configure server or hosting platform to send common protective headers.',
      codeExample: "res.setHeader('X-Content-Type-Options', 'nosniff');"
    });
  }

  if (puppeteerData.consoleErrors === 0) strengths.push('Clean console with no JavaScript errors');
  else {
    weaknesses.push(`${puppeteerData.consoleErrors} console errors detected - fix JavaScript issues`);
    actionPlan.push({
      priority: 'High Impact',
      issue: 'JavaScript console errors reduce quality perception',
      recommendation: 'Fix runtime errors and broken asset references before sharing the portfolio publicly.',
      expectedOutcome: 'Cleaner UX and stronger confidence during recruiter or interviewer review.'
    });
  }

  if (puppeteerData.headings?.h1 === 1) strengths.push('Proper heading hierarchy with single H1');
  else {
    weaknesses.push('Heading structure needs improvement - ensure exactly one H1 per page');
    actionPlan.push({
      priority: 'Quick Win',
      issue: 'Weak heading hierarchy',
      recommendation: 'Use one clear H1 and logical H2/H3 sections for projects, skills, and contact areas.',
      expectedOutcome: 'Better semantics, improved accessibility, and clearer recruiter scanning.'
    });
  }

  const recruiterMode = {
    hiringSignal: grade === 'A+' || grade === 'A'
      ? 'Strong shortlist signal'
      : grade === 'B'
      ? 'Mixed signal with good upside'
      : 'Not yet interview-ready',
    recruiterVerdict: grade === 'A+' || grade === 'A'
      ? 'This portfolio supports a strong candidate impression and helps validate engineering quality quickly.'
      : grade === 'B'
      ? 'The site shows promise, but a few visible issues may weaken confidence during fast recruiter screening.'
      : 'The site currently creates doubts about polish and execution, which could hurt placement outcomes.',
    resumePitch: 'Built SiteGrade to combine automated audits, browser analysis, and AI-generated improvement guidance into a recruiter-focused portfolio evaluation platform.'
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
      ? 'This portfolio is close to placement-ready and gives a strong professional impression.'
      : grade === 'B'
      ? 'This portfolio shows solid promise, but a few polish and clarity gaps still affect its hiring impact.'
      : 'This portfolio needs clearer presentation and stronger execution before it becomes placement-ready.'
  };

  const interviewSummary = {
    resumeBullets,
    projectDescription: 'SiteGrade is a recruiter-focused portfolio evaluation platform that analyzes websites using Lighthouse, Puppeteer, async job processing, and AI-generated guidance.',
    techStackSummary: `React, Node.js, MongoDB, Redis, BullMQ, Puppeteer, Lighthouse, and AI review flows${puppeteerData.techStack?.length ? ` with detected frontend stack signals such as ${puppeteerData.techStack.slice(0, 4).join(', ')}` : ''}.`,
    challengesSolved
  };

  const review = `This website demonstrates ${avgScore >= 70 ? 'solid' : 'concerning'} engineering practices with an overall score of ${avgScore}/100. 

${scores.performance >= 70 ? 'The performance metrics show acceptable load times, though there is always room for optimization through caching strategies and asset minification.' : 'Performance is a critical concern - the site loads slowly which will impact user experience and search rankings significantly.'}

${scores.seo >= 70 ? 'SEO fundamentals are in place with proper meta tags and semantic HTML structure.' : 'SEO requires immediate attention - missing meta descriptions and poor semantic structure will hurt discoverability.'}

${scores.accessibility >= 70 ? 'Accessibility considerations show awareness of inclusive design principles.' : 'Accessibility is lacking - this creates barriers for users with disabilities and may expose the site to compliance risks.'}

The detected tech stack (${puppeteerData.techStack?.join(', ') || 'unknown'}) suggests a ${puppeteerData.techStack?.length > 3 ? 'modern, well-architected' : 'basic'} approach to development. ${puppeteerData.consoleErrors > 0 ? `However, the ${puppeteerData.consoleErrors} console errors indicate quality control issues that should be addressed.` : 'The clean console output reflects good development discipline.'}

Overall, this site would ${grade === 'A' || grade === 'A+' ? 'make a strong impression in a technical review' : grade === 'B' ? 'pass a technical screening with notes for improvement' : 'require significant work before being portfolio-ready'}.`;

  return {
    recruiterReview: review,
    strengths: strengths.length > 0 ? strengths : ['Website is functional and accessible'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['No major weaknesses detected'],
    overallGrade: grade,
    portfolioReadiness,
    recruiterMode,
    actionPlan: actionPlan.slice(0, 5),
    aiFixes: aiFixes.slice(0, 4),
    interviewSummary
  };
};
