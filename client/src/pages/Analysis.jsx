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
      const response = await createAnalysisAsync(data.url);
      navigate(`/report/${response.data.jobId}`);
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
        <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-6">
                <ScanLine className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
                Website Analysis
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Enter a URL to start a comprehensive analysis of any website.
              </p>
            </div>

            <div className="card">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                    />
                  </div>
                  {errors.url && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.url.message}
                    </p>
                  )}
                </div>

                {createError && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
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

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Performance', desc: 'Core Web Vitals & speed' },
                { label: 'SEO', desc: 'Meta tags & structure' },
                { label: 'Security', desc: 'Headers & HTTPS' }
              ].map((item, i) => (
                <div key={i} className="card p-4 text-center">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{item.label}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
