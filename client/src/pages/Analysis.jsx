import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAnalysis } from '../hooks/useAnalysis';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence } from 'framer-motion';
import { urlSchema } from '../utils/validators';
import { 
  ScanLine, 
  Globe, 
  ArrowRight, 
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AIAnalysisLoader } from '../components/loaders/AIAnalysisLoader';

export const Analysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { createAnalysisAsync, isCreating, createError } = useAnalysis();
  const prefillUrl = location.state?.url;
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTargetUrl, setCurrentTargetUrl] = useState(prefillUrl || '');
  const isMountedRef = useRef(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: prefillUrl || ''
    }
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (prefillUrl) {
      setValue('url', prefillUrl);
    }
  }, [prefillUrl, setValue]);

  const onSubmit = async (data) => {
    setCurrentTargetUrl(data.url);
    setIsGenerating(true);

    try {
      const auditProfiles = [
        data.includeMobile !== false ? 'mobile' : null,
        data.includeDesktop ? 'desktop' : null
      ].filter(Boolean);
      const competitorUrls = String(data.competitorUrls || '')
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);

      const response = await createAnalysisAsync({
        url: data.url,
        scanMode: data.scanMode || 'single',
        crawlMaxPages: Number(data.crawlMaxPages) || 1,
        auditProfiles: auditProfiles.length ? auditProfiles : ['mobile'],
        competitorUrls,
        websiteType: data.websiteType || 'auto',
        enableFixMode: data.enableFixMode !== false
      });
      navigate(`/reports/${response.data.reportId}?jobId=${response.data.jobId}`);
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isGenerating && (
          <AIAnalysisLoader key="ai-analysis-loader" targetUrl={currentTargetUrl} />
        )}
      </AnimatePresence>

      {!isGenerating && (
        <div className="page-shell">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 max-w-3xl">
              <div className="section-kicker mb-5">
                <ScanLine className="h-4 w-4" />
                New website audit
              </div>
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-white shadow-sm dark:bg-primary-900/30 mb-6">
                <ScanLine className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="section-title text-3xl sm:text-4xl mb-4">
                Website Analysis
              </h1>
              <p className="section-copy text-base sm:text-lg">
                Set the audit scope, choose the signals you care about, and generate a report that is easier to read on both desktop and mobile.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="card">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Website URL
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        {...register('url')}
                        type="text"
                        className="input-field pl-12 py-4 text-lg"
                        placeholder="https://example.com"
                        disabled={isCreating}
                        inputMode="url"
                        autoComplete="url"
                        autoCapitalize="none"
                        spellCheck="false"
                        aria-invalid={errors.url ? 'true' : 'false'}
                      />
                    </div>
                    {errors.url && (
                      <p className="mt-2 flex items-center gap-1 text-sm text-red-500" role="alert">
                        <AlertCircle className="w-4 h-4" />
                        {errors.url.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Scan Mode
                      </label>
                      <select
                        {...register('scanMode')}
                        className="input-field"
                        defaultValue="single"
                      >
                        <option value="single">Single page audit</option>
                        <option value="crawl">Sitewide crawl</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Website Type
                      </label>
                      <select
                        {...register('websiteType')}
                        className="input-field"
                        defaultValue="auto"
                      >
                        <option value="auto">Auto detect</option>
                        <option value="general">General website</option>
                        <option value="portfolio">Portfolio</option>
                        <option value="saas">SaaS</option>
                        <option value="ecommerce">Ecommerce</option>
                        <option value="blog">Blog</option>
                        <option value="docs">Documentation</option>
                        <option value="business">Business</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Crawl Pages
                      </label>
                      <input
                        {...register('crawlMaxPages')}
                        type="number"
                        min="1"
                        max="10"
                        defaultValue="5"
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Audit Profiles
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          {...register('includeMobile')}
                          type="checkbox"
                          defaultChecked
                          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        Mobile audit
                      </label>
                      <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          {...register('includeDesktop')}
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        Desktop audit
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Competitor URLs
                    </label>
                    <textarea
                      {...register('competitorUrls')}
                      rows={4}
                      className="input-field"
                      placeholder={'https://competitor-one.com\nhttps://competitor-two.com'}
                      spellCheck="false"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Add up to 3 competitor URLs, one per line, for automatic benchmarking.
                    </p>
                  </div>

                  <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      {...register('enableFixMode')}
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Generate fix mode checklist and starter implementation tasks
                  </label>

                  {createError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400" role="alert">
                      <AlertCircle className="w-5 h-5" />
                      {createError.response?.data?.message || 'Failed to start analysis. Please try again.'}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>~30 seconds</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4" />
                      <span>Real-time updates</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="btn-primary w-full py-4 text-lg"
                  >
                    {isCreating ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner size="sm" className="text-white" />
                        Queuing Analysis...
                      </span>
                    ) : (
                      <>
                        Start Analysis
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <div className="card border-slate-200/80 bg-slate-950 text-white dark:bg-slate-950">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-200">
                    What this run can include
                  </p>
                  <div className="mt-5 space-y-4">
                    {[
                      ['Performance', 'Mobile and optional desktop scoring, plus a clearer technical summary.'],
                      ['Crawl coverage', 'Multi-page structure review for broader site understanding.'],
                      ['Fix mode', 'Implementation tasks and starter suggestions you can hand off quickly.']
                    ].map(([title, desc]) => (
                      <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <h3 className="font-semibold">{title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recommended setup</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    <li>Use `Single page audit` for quick checks and focused regressions.</li>
                    <li>Switch to `Sitewide crawl` when navigation, role coverage, or template consistency matters.</li>
                    <li>Keep `Fix mode` enabled if you want implementation-ready follow-up tasks in the report.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
