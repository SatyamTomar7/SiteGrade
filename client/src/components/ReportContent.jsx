import { useNavigate } from 'react-router-dom';
import { ScoreCard } from './ScoreCard';
import { RadarChartComponent } from './RadarChart';
import { TechBadge } from './TechBadge';
import {
  Zap,
  Search,
  Eye,
  Shield,
  Award,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ScanLine,
  FileText,
  Cpu,
  Globe,
  Briefcase,
  Sparkles,
  Wrench,
  Target,
  Trophy,
  FileBadge2
} from 'lucide-react';

const formatLabel = (key) => key.replace(/([A-Z])/g, ' $1').trim();

const formatPrimitiveValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }

  return String(value);
};

const renderDetailValue = (value) => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="text-lg font-semibold text-slate-900 dark:text-white">N/A</p>;
    }

    const allPrimitive = value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item));

    if (allPrimitive) {
      return (
        <p className="text-lg font-semibold text-slate-900 dark:text-white break-words">
          {value.map((item) => formatPrimitiveValue(item)).join(', ')}
        </p>
      );
    }

    return (
      <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([nestedKey, nestedValue]) => (
          <div key={nestedKey} className="border-t border-slate-200 dark:border-dark-border pt-2 first:border-t-0 first:pt-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {formatLabel(nestedKey)}
            </p>
            <div className="text-sm font-medium text-slate-900 dark:text-white break-words">
              {renderDetailValue(nestedValue)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-lg font-semibold text-slate-900 dark:text-white break-words">
      {formatPrimitiveValue(value)}
    </p>
  );
};

const getGradeStyles = (grade) => {
  if (grade === 'A+' || grade === 'A') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
  }

  if (grade === 'B') {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
  }

  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800';
};

const splitReviewParagraphs = (reviewText) => {
  if (!reviewText) {
    return [];
  }

  return reviewText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !paragraph.startsWith('#') && paragraph !== '---' && !/^\d+\.\s/.test(paragraph));
};

export const ReportContent = ({
  report,
  heading = 'Analysis Report',
  backTo = '/dashboard',
  backLabel = 'Back',
  headerActions = null,
  banner = null
}) => {
  const navigate = useNavigate();
  const scores = report.scores || {};
  const aiReviewStructured = report.aiReviewStructured || {};
  const recruiterMode = aiReviewStructured.recruiterMode || {};
  const actionPlan = aiReviewStructured.actionPlan || [];
  const aiFixes = aiReviewStructured.aiFixes || [];
  const portfolioReadiness = aiReviewStructured.portfolioReadiness || {};
  const interviewSummary = aiReviewStructured.interviewSummary || {};
  const reviewParagraphs = splitReviewParagraphs(report.aiReview);
  const overallScore = Math.round(
    (scores.performance + scores.seo + scores.accessibility + scores.security + scores.bestPractices) / 5
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {banner}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <button
                onClick={() => navigate(backTo)}
                className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
              </button>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {heading}
              </h1>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <ScanLine className="w-4 h-4" />
                <span className="font-mono text-sm break-all">{report.url}</span>
              </div>
            </div>

            <div className="flex w-full sm:w-auto flex-col items-stretch gap-3 sm:items-end">
              <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                overallScore >= 90
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : overallScore >= 70
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {overallScore >= 90 ? <CheckCircle2 className="w-5 h-5" /> : overallScore >= 70 ? <AlertCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                Overall: {overallScore}/100
              </div>
              {headerActions}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <ScoreCard
            title="Performance"
            score={scores.performance || 0}
            icon={<Zap className="w-5 h-5 text-amber-500" />}
            description="Core Web Vitals & load speed"
          />
          <ScoreCard
            title="SEO"
            score={scores.seo || 0}
            icon={<Search className="w-5 h-5 text-blue-500" />}
            description="Search optimization"
          />
          <ScoreCard
            title="Accessibility"
            score={scores.accessibility || 0}
            icon={<Eye className="w-5 h-5 text-purple-500" />}
            description="WCAG compliance"
          />
          <ScoreCard
            title="Security"
            score={scores.security || 0}
            icon={<Shield className="w-5 h-5 text-emerald-500" />}
            description="Headers & HTTPS"
          />
          <ScoreCard
            title="Best Practices"
            score={scores.bestPractices || 0}
            icon={<Award className="w-5 h-5 text-rose-500" />}
            description="Code quality"
          />
        </div>

        {portfolioReadiness.overallScore > 0 && (
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary-600" />
              Portfolio Readiness
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
              <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/70 dark:bg-primary-900/10 p-5 lg:col-span-1">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300 mb-2">
                  Overall Readiness
                </p>
                <p className="text-4xl font-bold text-slate-900 dark:text-white">{portfolioReadiness.overallScore}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{portfolioReadiness.summary}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:col-span-3">
                {[
                  ['Visual Polish', portfolioReadiness.visualPolish],
                  ['Trust & Professionalism', portfolioReadiness.trustProfessionalism],
                  ['Project Clarity', portfolioReadiness.projectClarity],
                  ['Contact Clarity', portfolioReadiness.contactClarity],
                  ['Mobile Readiness', portfolioReadiness.mobileReadiness],
                  ['Hiring Impression', portfolioReadiness.hiringImpression]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-3 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{value ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <RadarChartComponent scores={scores} />

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              AI Review
            </h3>
            <div className="space-y-6">
              {aiReviewStructured.grade && (
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Overall AI Assessment
                    </p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">
                      Candidate-style review summary
                    </p>
                  </div>
                  <div className={`self-start rounded-full border px-4 py-2 text-lg font-bold sm:self-auto ${getGradeStyles(aiReviewStructured.grade)}`}>
                    Grade {aiReviewStructured.grade}
                  </div>
                </div>
              )}

              {reviewParagraphs.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-5 space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Summary
                  </p>
                  {reviewParagraphs.map((paragraph, index) => (
                    <p key={index} className="text-slate-600 dark:text-slate-300 leading-7">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/10 p-5">
                  <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-4">
                    Strengths
                  </p>
                  {aiReviewStructured.strengths?.length ? (
                    <ul className="space-y-3 list-disc pl-5">
                      {aiReviewStructured.strengths.map((strength, index) => (
                        <li key={index} className="text-slate-700 dark:text-slate-200 leading-6">
                          {strength}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-300">No strengths available.</p>
                  )}
                </div>

                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/10 p-5">
                  <p className="text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-4">
                    Areas For Improvement
                  </p>
                  {aiReviewStructured.weaknesses?.length ? (
                    <ul className="space-y-3 list-disc pl-5">
                      {aiReviewStructured.weaknesses.map((weakness, index) => (
                        <li key={index} className="text-slate-700 dark:text-slate-200 leading-6">
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-300">No improvement areas available.</p>
                  )}
                </div>
              </div>

              {!aiReviewStructured.grade && reviewParagraphs.length === 0 && (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {report.aiReview || 'No AI review available.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {(recruiterMode.hiringSignal || recruiterMode.recruiterVerdict || recruiterMode.resumePitch) && (
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary-600" />
              Recruiter Mode
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Hiring Signal
                </p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">
                  {recruiterMode.hiringSignal || 'N/A'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5 lg:col-span-2">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Recruiter Verdict
                </p>
                <p className="text-slate-700 dark:text-slate-200 leading-7">
                  {recruiterMode.recruiterVerdict || 'No recruiter verdict available.'}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/10 p-5 lg:col-span-3">
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-2">
                  Resume Pitch
                </p>
                <p className="text-slate-700 dark:text-slate-200 leading-7">
                  {recruiterMode.resumePitch || 'No resume pitch available.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {(interviewSummary.projectDescription || interviewSummary.resumeBullets?.length || interviewSummary.techStackSummary || interviewSummary.challengesSolved?.length) && (
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <FileBadge2 className="w-5 h-5 text-primary-600" />
              Interview-Ready Summary
            </h3>
            <div className="space-y-6">
              {interviewSummary.projectDescription && (
                <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5">
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Project Description
                  </p>
                  <p className="text-slate-700 dark:text-slate-200 leading-7">{interviewSummary.projectDescription}</p>
                </div>
              )}

              {interviewSummary.resumeBullets?.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5">
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Resume Bullets
                  </p>
                  <ul className="space-y-3 list-disc pl-5">
                    {interviewSummary.resumeBullets.map((bullet, index) => (
                      <li key={index} className="text-slate-700 dark:text-slate-200 leading-6">{bullet}</li>
                    ))}
                  </ul>
                </div>
              )}

              {interviewSummary.techStackSummary && (
                <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5">
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Tech Stack Summary
                  </p>
                  <p className="text-slate-700 dark:text-slate-200 leading-7">{interviewSummary.techStackSummary}</p>
                </div>
              )}

              {interviewSummary.challengesSolved?.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5">
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Challenges Solved
                  </p>
                  <ul className="space-y-3 list-disc pl-5">
                    {interviewSummary.challengesSolved.map((challenge, index) => (
                      <li key={index} className="text-slate-700 dark:text-slate-200 leading-6">{challenge}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {actionPlan.length > 0 && (
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-600" />
              Prioritized Action Plan
            </h3>
            <div className="space-y-4">
              {actionPlan.map((item, index) => (
                <div key={`${item.priority}-${index}`} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {item.issue}
                      </p>
                      <p className="mt-2 text-slate-600 dark:text-slate-300 leading-7">
                        {item.recommendation}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      item.priority === 'Must Fix'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        : item.priority === 'High Impact'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    Expected outcome: {item.expectedOutcome}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {aiFixes.length > 0 && (
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary-600" />
              AI Fix Generator
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {aiFixes.map((fix, index) => (
                <div key={`${fix.title}-${index}`} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary-600" />
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{fix.title}</p>
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    {fix.category}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200 leading-7 mb-4">
                    {fix.suggestion}
                  </p>
                  <div className="rounded-lg bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                    <pre className="text-xs whitespace-pre-wrap break-words">{fix.codeExample}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.techStack && report.techStack.length > 0 && (
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary-600" />
              Detected Tech Stack
            </h3>
            <div className="flex flex-wrap gap-2">
              {report.techStack.map((tech, index) => (
                <TechBadge key={index} tech={tech} />
              ))}
            </div>
          </div>
        )}

        {report.puppeteerData?.screenshotPath && (
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary-600" />
              Captured Snapshot
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 break-all">
              Screenshot saved at: {report.puppeteerData.screenshotPath}
            </p>
          </div>
        )}

        {report.lighthouseData && Object.keys(report.lighthouseData).length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary-600" />
              Lighthouse Metrics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Object.entries(report.lighthouseData).map(([key, value]) => (
                <div key={key} className="p-4 rounded-lg bg-slate-50 dark:bg-dark-surface border border-slate-200 dark:border-dark-border">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    {formatLabel(key)}
                  </p>
                  {renderDetailValue(value)}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.puppeteerData && Object.keys(report.puppeteerData).length > 0 && (
          <div className="card mt-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary-600" />
              Puppeteer Analysis
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Object.entries(report.puppeteerData).map(([key, value]) => (
                <div key={key} className="p-4 rounded-lg bg-slate-50 dark:bg-dark-surface border border-slate-200 dark:border-dark-border">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    {formatLabel(key)}
                  </p>
                  {renderDetailValue(value)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
