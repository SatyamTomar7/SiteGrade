import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildAssetUrl } from '../api/axios';
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
  ChevronDown
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
        <p className="break-words text-lg font-semibold text-slate-900 dark:text-white">
          {value.map((item) => formatPrimitiveValue(item)).join(', ')}
        </p>
      );
    }

    return (
      <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([nestedKey, nestedValue]) => (
          <div key={nestedKey} className="border-t border-slate-200 pt-2 first:border-t-0 first:pt-0 dark:border-dark-border">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {formatLabel(nestedKey)}
            </p>
            <div className="break-words text-sm font-medium text-slate-900 dark:text-white">
              {renderDetailValue(nestedValue)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="break-words text-lg font-semibold text-slate-900 dark:text-white">
      {formatPrimitiveValue(value)}
    </p>
  );
};

const getGradeStyles = (grade) => {
  if (grade === 'A+' || grade === 'A') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300';
  }

  if (grade === 'B') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300';
  }

  return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300';
};

const getSeverityStyles = (severity) => {
  if (severity === 'Critical') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  }

  if (severity === 'High') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }

  if (severity === 'Low') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  return 'bg-slate-100 text-slate-700 dark:bg-dark-border dark:text-slate-300';
};

const getEffortStyles = (effort) => {
  if (effort === 'High') {
    return 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';
  }

  if (effort === 'Low') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }

  return 'bg-slate-100 text-slate-700 dark:bg-dark-border dark:text-slate-300';
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

const SectionCard = ({ title, icon, description, children }) => (
  <div className="card mb-8">
    <div className="mb-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
        {icon}
        {title}
      </h3>
      {description && <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {children}
  </div>
);

const InsightTile = ({ label, value, tone = 'default', helper = '' }) => {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-900/10'
      : tone === 'warn'
      ? 'border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-900/10'
      : 'border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface';

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
      {helper && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p>}
    </div>
  );
};

const EmptyPanel = ({ title, copy }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 dark:border-dark-border dark:bg-dark-surface">
    <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{copy}</p>
  </div>
);

const MoreDetailsPanel = ({ title, children }) => (
  <details className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-dark-border dark:bg-dark-surface/80">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-white">
      <span>{title}</span>
      <ChevronDown className="h-4 w-4" />
    </summary>
    <div className="mt-5">{children}</div>
  </details>
);

export const ReportContent = ({
  report,
  heading = 'Analysis Report',
  backTo = '/dashboard',
  backLabel = 'Back',
  headerActions = null,
  banner = null
}) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const scores = report.scores || {};
  const aiReviewStructured = report.aiReviewStructured || {};
  const recruiterMode = aiReviewStructured.recruiterMode || {};
  const actionPlan = aiReviewStructured.actionPlan || [];
  const aiFixes = aiReviewStructured.aiFixes || [];
  const portfolioReadiness = aiReviewStructured.portfolioReadiness || {};
  const interviewSummary = aiReviewStructured.interviewSummary || {};
  const reviewParagraphs = splitReviewParagraphs(report.aiReview);
  const analysisConfig = report.analysisConfig || {};
  const crawlData = report.crawlData || {};
  const siteProfile = report.siteProfile || {};
  const roleCoverage = siteProfile.roleCoverage || {};
  const benchmarkData = report.benchmarkData || {};
  const fieldData = report.fieldData || {};
  const fixMode = report.fixMode || {};
  const topAction = actionPlan[0] || fixMode.checklist?.[0] || null;
  const overallScore = report.overallScore ?? Math.round(
    (scores.performance + scores.seo + scores.accessibility + scores.security + scores.bestPractices) / 5
  );
  const screenshotUrl = report.puppeteerData?.screenshotFilename
    ? buildAssetUrl(`/screenshots/${report.puppeteerData.screenshotFilename}`)
    : '';

  const sectionTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'fixes', label: 'Fixes' },
    { id: 'details', label: 'Details' }
  ];

  return (
    <div className="page-shell">
      <div className="page-container">
        {banner}

        <div className="mb-8 rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-dark-border dark:bg-dark-surface/90 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <button
                onClick={() => navigate(backTo)}
                className="mb-6 inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </button>

              <h1 className="section-title mb-3 text-3xl sm:text-4xl">
                {heading}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
                <ScanLine className="h-4 w-4" />
                <span className="break-all font-mono text-sm">{report.url}</span>
              </div>
            </div>

            <div className="flex w-full flex-col items-stretch gap-3 xl:max-w-sm xl:items-end">
              <div className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold ${
                overallScore >= 90
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : overallScore >= 70
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {overallScore >= 90 ? <CheckCircle2 className="h-5 w-5" /> : overallScore >= 70 ? <AlertCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                Overall score: {overallScore}/100
              </div>
              {headerActions}
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <ScoreCard
            title="Performance"
            score={scores.performance || 0}
            icon={<Zap className="h-5 w-5 text-amber-500" />}
            description="Core Web Vitals & speed"
          />
          <ScoreCard
            title="SEO"
            score={scores.seo || 0}
            icon={<Search className="h-5 w-5 text-blue-500" />}
            description="Search readiness"
          />
          <ScoreCard
            title="Accessibility"
            score={scores.accessibility || 0}
            icon={<Eye className="h-5 w-5 text-purple-500" />}
            description="Usability & inclusion"
          />
          <ScoreCard
            title="Security"
            score={scores.security || 0}
            icon={<Shield className="h-5 w-5 text-emerald-500" />}
            description="Trust signals"
          />
          <ScoreCard
            title="Best Practices"
            score={scores.bestPractices || 0}
            icon={<Award className="h-5 w-5 text-rose-500" />}
            description="Implementation quality"
          />
        </div>

        <SectionCard
          title="At A Glance"
          icon={<ScanLine className="h-5 w-5 text-primary-600" />}
          description="Start here for the most important context before diving into details."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InsightTile
              label="AI grade"
              value={aiReviewStructured.grade ? `Grade ${aiReviewStructured.grade}` : 'No grade yet'}
              tone={aiReviewStructured.grade === 'A+' || aiReviewStructured.grade === 'A' ? 'good' : aiReviewStructured.grade === 'B' ? 'warn' : 'default'}
            />
            <InsightTile
              label="Top priority"
              value={topAction?.issue || topAction?.title || 'No urgent issue highlighted'}
              helper={topAction?.recommendation || topAction?.task || ''}
            />
            <InsightTile
              label="Site profile"
              value={siteProfile.effectiveType || analysisConfig.websiteType || 'general'}
              helper={roleCoverage.missingRoles?.length ? `Missing roles: ${roleCoverage.missingRoles.join(', ')}` : 'Expected page coverage looks healthy.'}
            />
            <InsightTile
              label="Pages reviewed"
              value={crawlData.totalPagesDiscovered || 1}
              helper={`${report.puppeteerData?.brokenLinks?.length || 0} broken links found`}
            />
          </div>
        </SectionCard>

        <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {sectionTabs.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={
                activeSection === section.id
                  ? 'btn-primary w-full px-4 py-3 text-sm'
                  : 'btn-secondary w-full px-4 py-3 text-sm'
              }
            >
              {section.label}
            </button>
          ))}
        </div>

        {activeSection === 'overview' && (
          <>
            {(actionPlan.length > 0 || fixMode.checklist?.length > 0) && (
              <SectionCard
                title="Top Next Steps"
                icon={<Target className="h-5 w-5 text-primary-600" />}
                description="These are the first actions worth paying attention to."
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {[...actionPlan.slice(0, 2), ...(fixMode.checklist?.slice(0, 1) || [])].slice(0, 3).map((item, index) => (
                    <div key={`${item.issue || item.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-900 dark:text-white">{item.issue || item.title}</p>
                        {item.severity && (
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getSeverityStyles(item.severity)}`}>
                            {item.severity}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {item.recommendation || item.task || 'No follow-up summary available.'}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <RadarChartComponent scores={scores} />

              <SectionCard
                title="AI Review"
                icon={<FileText className="h-5 w-5 text-primary-600" />}
                description="The short version of what is working, what is weak, and what to fix first."
              >
                <div className="space-y-6">
                  {aiReviewStructured.grade && (
                    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Overall AI assessment</p>
                        <p className="text-xl font-semibold text-slate-900 dark:text-white">Website quality summary</p>
                      </div>
                      <div className={`self-start rounded-full border px-4 py-2 text-lg font-bold sm:self-auto ${getGradeStyles(aiReviewStructured.grade)}`}>
                        Grade {aiReviewStructured.grade}
                      </div>
                    </div>
                  )}

                  {reviewParagraphs.length > 0 && (
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-dark-border dark:bg-dark-surface">
                      {reviewParagraphs.map((paragraph, index) => (
                        <p key={index} className="leading-7 text-slate-600 dark:text-slate-300">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-800 dark:bg-emerald-900/10">
                      <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Strengths</p>
                      {aiReviewStructured.strengths?.length ? (
                        <ul className="list-disc space-y-3 pl-5">
                          {aiReviewStructured.strengths.map((strength, index) => (
                            <li key={index} className="leading-6 text-slate-700 dark:text-slate-200">{strength}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-600 dark:text-slate-300">No strengths available.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-800 dark:bg-amber-900/10">
                      <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Watchouts</p>
                      {aiReviewStructured.weaknesses?.length ? (
                        <ul className="list-disc space-y-3 pl-5">
                          {aiReviewStructured.weaknesses.map((weakness, index) => (
                            <li key={index} className="leading-6 text-slate-700 dark:text-slate-200">{weakness}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-600 dark:text-slate-300">No improvement areas available.</p>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {(portfolioReadiness.overallScore > 0 || recruiterMode.hiringSignal || screenshotUrl || report.techStack?.length > 0) && (
              <MoreDetailsPanel title="View more insights">
                <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    {portfolioReadiness.overallScore > 0 && (
                      <SectionCard
                        title="Readiness Summary"
                        icon={<Trophy className="h-5 w-5 text-primary-600" />}
                        description="A cleaner summary of trust, clarity, and presentation quality."
                      >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                          <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-5 dark:border-primary-800 dark:bg-primary-900/10 lg:col-span-1">
                            <p className="text-sm font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">Overall readiness</p>
                            <p className="mt-3 text-4xl font-bold text-slate-900 dark:text-white">{portfolioReadiness.overallScore}</p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{portfolioReadiness.summary}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:col-span-3">
                            {[
                              ['Visual polish', portfolioReadiness.visualPolish],
                              ['Trust', portfolioReadiness.trustProfessionalism],
                              ['Project clarity', portfolioReadiness.projectClarity],
                              ['Contact clarity', portfolioReadiness.contactClarity],
                              ['Mobile readiness', portfolioReadiness.mobileReadiness],
                              ['Hiring impression', portfolioReadiness.hiringImpression]
                            ].map(([label, value]) => (
                              <InsightTile key={label} label={label} value={value ?? 0} />
                            ))}
                          </div>
                        </div>
                      </SectionCard>
                    )}

                    {(recruiterMode.hiringSignal || recruiterMode.recruiterVerdict || recruiterMode.resumePitch) && (
                      <SectionCard
                        title="Decision Summary"
                        icon={<Briefcase className="h-5 w-5 text-primary-600" />}
                        description="A concise readout of how the site presents itself."
                      >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <InsightTile label="Quality signal" value={recruiterMode.hiringSignal || 'N/A'} />
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-dark-border dark:bg-dark-surface lg:col-span-2">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Verdict</p>
                            <p className="mt-2 leading-7 text-slate-700 dark:text-slate-200">
                              {recruiterMode.recruiterVerdict || 'No recruiter verdict available.'}
                            </p>
                          </div>
                          {recruiterMode.resumePitch && (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-800 dark:bg-blue-900/10 lg:col-span-3">
                              <p className="text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">Reusable pitch</p>
                              <p className="mt-2 leading-7 text-slate-700 dark:text-slate-200">{recruiterMode.resumePitch}</p>
                            </div>
                          )}
                        </div>
                      </SectionCard>
                    )}
                  </div>

                  <div>
                    {report.techStack?.length > 0 && (
                      <SectionCard
                        title="Detected Tech Stack"
                        icon={<Cpu className="h-5 w-5 text-primary-600" />}
                        description="A quick read on the visible platform and frontend tooling."
                      >
                        <div className="flex flex-wrap gap-2">
                          {report.techStack.map((tech, index) => (
                            <TechBadge key={index} tech={tech} />
                          ))}
                        </div>
                      </SectionCard>
                    )}

                    {screenshotUrl && (
                      <SectionCard
                        title="Captured Snapshot"
                        icon={<Globe className="h-5 w-5 text-primary-600" />}
                        description="Use the screenshot as a quick visual reference while reading the summary."
                      >
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-dark-border dark:bg-dark-surface">
                          <img
                            src={screenshotUrl}
                            alt={`Captured snapshot of ${report.url}`}
                            className="h-auto w-full"
                            loading="lazy"
                          />
                        </div>
                      </SectionCard>
                    )}
                  </div>
                </div>
              </MoreDetailsPanel>
            )}
          </>
        )}

        {activeSection === 'fixes' && (
          <>
            {actionPlan.length > 0 && (
              <SectionCard
                title="Prioritized Action Plan"
                icon={<Target className="h-5 w-5 text-primary-600" />}
                description="These are the highest-value improvements to work through first."
              >
                <div className="space-y-4">
                  {actionPlan.map((item, index) => (
                    <div key={`${item.priority}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-dark-border dark:bg-dark-surface">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-900 dark:text-white">{item.issue}</p>
                          <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">{item.recommendation}</p>
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
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getSeverityStyles(item.severity)}`}>
                          Severity: {item.severity || 'Medium'}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getEffortStyles(item.effort)}`}>
                          Effort: {item.effort || 'Medium'}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                          Impact: +{item.estimatedScoreImpact ?? 0}
                        </span>
                      </div>
                      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Expected outcome: {item.expectedOutcome}</p>
                      {item.rationale && (
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Why this matters: {item.rationale}</p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
            {actionPlan.length === 0 && (!fixMode.checklist || fixMode.checklist.length === 0) && aiFixes.length === 0 && (
              <SectionCard
                title="Fixes"
                icon={<Wrench className="h-5 w-5 text-primary-600" />}
                description="Improvement suggestions will appear here when the analysis identifies follow-up work."
              >
                <EmptyPanel
                  title="No structured fixes highlighted"
                  copy="This report does not currently include a prioritized fix list or starter tasks. You can still review the overview and advanced details for context."
                />
              </SectionCard>
            )}

            {fixMode.enabled && (fixMode.checklist?.length > 0 || fixMode.starterTasks?.length > 0) && (
              <SectionCard
                title="Fix Mode"
                icon={<Wrench className="h-5 w-5 text-primary-600" />}
                description="A checklist for follow-up work, plus starter tasks for implementation."
              >
                {fixMode.checklist?.length > 0 && (
                  <div className="mb-6 space-y-3">
                    {fixMode.checklist.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</p>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getSeverityStyles(item.severity)}`}>
                            {item.severity}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getEffortStyles(item.effort)}`}>
                            {item.effort}
                          </span>
                        </div>
                        <p className="mt-2 text-slate-600 dark:text-slate-300">{item.task}</p>
                      </div>
                    ))}
                  </div>
                )}

                {fixMode.starterTasks?.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {fixMode.starterTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">{task.title}</p>
                        <p className="mt-1 text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">{task.category}</p>
                        <p className="mt-3 text-slate-600 dark:text-slate-300">{task.suggestion}</p>
                        {task.codeExample && (
                          <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{task.codeExample}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            {aiFixes.length > 0 && (
              <SectionCard
                title="AI Fix Generator"
                icon={<Sparkles className="h-5 w-5 text-primary-600" />}
                description="Practical suggestions with implementation-ready examples where possible."
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {aiFixes.map((fix, index) => (
                    <div key={`${fix.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-dark-border dark:bg-dark-surface">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{fix.title}</p>
                      <p className="mb-3 mt-1 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{fix.category}</p>
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getSeverityStyles(fix.severity)}`}>
                          Severity: {fix.severity || 'Medium'}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getEffortStyles(fix.effort)}`}>
                          Effort: {fix.effort || 'Medium'}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                          Impact: +{fix.estimatedScoreImpact ?? 0}
                        </span>
                      </div>
                      <p className="mb-4 leading-7 text-slate-700 dark:text-slate-200">{fix.suggestion}</p>
                      {fix.whyItMatters && (
                        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Why it matters: {fix.whyItMatters}</p>
                      )}
                      {fix.codeExample && (
                        <div className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-slate-100">
                          <pre className="whitespace-pre-wrap break-words text-xs">{fix.codeExample}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {(interviewSummary.projectDescription || interviewSummary.resumeBullets?.length || interviewSummary.techStackSummary || interviewSummary.challengesSolved?.length) && (
              <SectionCard
                title="Reusable Summary"
                icon={<Briefcase className="h-5 w-5 text-primary-600" />}
                description="Useful for sharing context with teammates, clients, or stakeholders."
              >
                <div className="space-y-4">
                  {interviewSummary.projectDescription && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-dark-border dark:bg-dark-surface">
                      <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Project description</p>
                      <p className="mt-2 leading-7 text-slate-700 dark:text-slate-200">{interviewSummary.projectDescription}</p>
                    </div>
                  )}
                  {interviewSummary.resumeBullets?.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-dark-border dark:bg-dark-surface">
                      <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Key takeaways</p>
                      <ul className="list-disc space-y-3 pl-5">
                        {interviewSummary.resumeBullets.map((bullet, index) => (
                          <li key={index} className="leading-6 text-slate-700 dark:text-slate-200">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}
          </>
        )}

        {activeSection === 'details' && (
          <>
            <SectionCard
              title="Audit Configuration"
              icon={<ScanLine className="h-5 w-5 text-primary-600" />}
              description="How this report was generated and which profile the scoring model used."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <InsightTile label="Mode" value={analysisConfig.scanMode || 'single'} />
                <InsightTile label="Site type" value={siteProfile.effectiveType || analysisConfig.websiteType || 'general'} />
                <InsightTile label="Profiles" value={(analysisConfig.auditProfiles || []).join(', ') || 'mobile'} />
                <InsightTile label="Crawl limit" value={analysisConfig.crawlMaxPages || 1} />
                <InsightTile label="Fix mode" value={fixMode.enabled ? 'Enabled' : 'Disabled'} />
              </div>
              {(siteProfile.detectedType || roleCoverage.expectedRoles?.length > 0) && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
                  <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Scoring profile</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Requested: <span className="font-semibold capitalize text-slate-900 dark:text-white">{analysisConfig.websiteType || 'auto'}</span> | Detected: <span className="font-semibold capitalize text-slate-900 dark:text-white">{siteProfile.detectedType || siteProfile.effectiveType || 'general'}</span>
                  </p>
                  {roleCoverage.expectedRoles?.length > 0 && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Expected roles: {roleCoverage.expectedRoles.join(', ')} | Missing: {roleCoverage.missingRoles?.length ? roleCoverage.missingRoles.join(', ') : 'none'}
                    </p>
                  )}
                </div>
              )}
            </SectionCard>

            {(benchmarkData.entries?.length > 0 || benchmarkData.summary) && (
              <SectionCard
                title="Competitor Benchmark"
                icon={<Target className="h-5 w-5 text-primary-600" />}
                description="Optional benchmark context for how this site performed against selected competitors."
              >
                <p className="mb-4 text-slate-600 dark:text-slate-300">{benchmarkData.summary || 'Benchmark not available.'}</p>
                {benchmarkData.entries?.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {benchmarkData.entries.map((entry, index) => (
                      <div key={`${entry.url}-${index}`} className={`rounded-xl border p-4 ${
                        entry.isTarget
                          ? 'border-primary-300 bg-primary-50/70 dark:border-primary-800 dark:bg-primary-900/10'
                          : 'border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="break-all font-semibold text-slate-900 dark:text-white">{entry.label}</p>
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                            #{index + 1}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{entry.pageType || 'unknown'}</p>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div><span className="text-slate-500 dark:text-slate-400">Overall</span><p className="font-semibold text-slate-900 dark:text-white">{entry.overallScore}</p></div>
                          <div><span className="text-slate-500 dark:text-slate-400">Performance</span><p className="font-semibold text-slate-900 dark:text-white">{entry.scores?.performance}</p></div>
                          <div><span className="text-slate-500 dark:text-slate-400">SEO</span><p className="font-semibold text-slate-900 dark:text-white">{entry.scores?.seo}</p></div>
                          <div><span className="text-slate-500 dark:text-slate-400">Accessibility</span><p className="font-semibold text-slate-900 dark:text-white">{entry.scores?.accessibility}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            {(crawlData.totalPagesDiscovered || report.puppeteerData?.pageType) && (
              <SectionCard
                title="Crawl Intelligence"
                icon={<Globe className="h-5 w-5 text-primary-600" />}
                description="Multi-page context, role coverage, and crawl findings."
              >
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <InsightTile label="Primary page type" value={report.puppeteerData?.pageType || 'unknown'} />
                  <InsightTile label="Pages reviewed" value={crawlData.totalPagesDiscovered || 1} />
                  <InsightTile label="Broken links" value={report.puppeteerData?.brokenLinks?.length || 0} />
                </div>
                {crawlData.roleCounts && Object.keys(crawlData.roleCounts).length > 0 && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Page roles</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(crawlData.roleCounts)
                        .filter(([, count]) => count > 0)
                        .map(([role, count]) => (
                          <span key={role} className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                            {role}: {count}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                {crawlData.pages?.length > 0 && (
                  <div className="space-y-3">
                    {crawlData.pages.map((page, index) => (
                      <div key={`${page.url}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="break-all font-medium text-slate-900 dark:text-white">{page.url}</p>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {(page.pageRole || 'other')} | {page.pageType || 'unknown'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            {(fieldData.available || fieldData.reason) && (
              <SectionCard
                title="Field Data"
                icon={<Zap className="h-5 w-5 text-primary-600" />}
                description="Chrome UX Report data when it is available."
              >
                {fieldData.available ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[
                      ['LCP p75', fieldData.metrics?.largestContentfulPaint],
                      ['INP p75', fieldData.metrics?.interactionToNextPaint],
                      ['CLS p75', fieldData.metrics?.cumulativeLayoutShift],
                      ['FCP p75', fieldData.metrics?.firstContentfulPaint]
                    ].map(([label, value]) => (
                      <InsightTile key={label} label={label} value={formatPrimitiveValue(value)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600 dark:text-slate-300">{fieldData.reason}</p>
                )}
              </SectionCard>
            )}

            {report.lighthouseData?.profileScores && (
              <SectionCard
                title="Audit Profiles"
                icon={<Zap className="h-5 w-5 text-primary-600" />}
                description="A compact view of the scores for each enabled device profile."
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {Object.entries(report.lighthouseData.profileScores).map(([profile, profileScores]) => (
                    <div key={profile} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                      <p className="text-lg font-semibold capitalize text-slate-900 dark:text-white">{profile}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        {Object.entries(profileScores).map(([metric, value]) => (
                          <div key={metric}>
                            <p className="text-slate-500 dark:text-slate-400">{formatLabel(metric)}</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard
              title="Advanced Data"
              icon={<Eye className="h-5 w-5 text-primary-600" />}
              description="Raw sections stay available, but they are kept out of the way by default."
            >
              {report.lighthouseData && Object.keys(report.lighthouseData).length > 0 && (
                <details className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-white">
                    <span>Lighthouse Metrics</span>
                    <ChevronDown className="h-4 w-4" />
                  </summary>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(report.lighthouseData).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-slate-950/20">
                        <p className="mb-1 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                        {renderDetailValue(value)}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {report.puppeteerData && Object.keys(report.puppeteerData).length > 0 && (
                <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-white">
                    <span>Puppeteer Analysis</span>
                    <ChevronDown className="h-4 w-4" />
                  </summary>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(report.puppeteerData).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-slate-950/20">
                        <p className="mb-1 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{formatLabel(key)}</p>
                        {renderDetailValue(value)}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
};
