import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { analysisApi } from '../api/analysis.api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeftRight, ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';

export const CompareReports = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const left = searchParams.get('left');
  const right = searchParams.get('right');

  const { data, isLoading } = useQuery({
    queryKey: ['compare-reports', left, right],
    queryFn: () => analysisApi.compareReports(left, right),
    enabled: !!left && !!right
  });

  const comparison = data?.data;

  const highlights = useMemo(() => {
    if (!comparison) {
      return [];
    }

    return comparison.scoreComparison.filter((item) => item.metric !== 'overallScore');
  }, [comparison]);

  if (isLoading || !comparison) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  const deltaIcon = (delta) => {
    if (delta > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (delta < 0) return <TrendingDown className="w-4 h-4 text-rose-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="card">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Before vs After Comparison</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Compare score deltas, grade movement, tech stack changes, and console quality between two analyses.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[comparison.leftReport, comparison.rightReport].map((report, index) => (
            <div key={report.id} className="card">
              <p className="text-sm text-slate-500 dark:text-slate-400">{index === 0 ? 'Baseline' : 'Latest'}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white break-all">{report.url}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Overall score</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{report.overallScore}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Grade</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{report.grade || 'N/A'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {highlights.map((item) => (
            <div key={item.metric} className="card">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {item.metric.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                {deltaIcon(item.delta)}
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Before</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{item.left}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300" />
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">After</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{item.right}</p>
                </div>
              </div>
              <p className={`mt-4 break-words text-sm font-semibold ${item.delta > 0 ? 'text-emerald-600' : item.delta < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                Delta: {item.delta > 0 ? '+' : ''}{item.delta}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Tech Stack Changes</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-emerald-600 mb-2">Added technologies</p>
                <ul className="list-disc pl-5 text-slate-700 dark:text-slate-200">
                  {(comparison.changes.addedTech.length ? comparison.changes.addedTech : ['None']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-rose-600 mb-2">Removed technologies</p>
                <ul className="list-disc pl-5 text-slate-700 dark:text-slate-200">
                  {(comparison.changes.removedTech.length ? comparison.changes.removedTech : ['None']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Operational Changes</h3>
            <div className="space-y-3 text-slate-700 dark:text-slate-200">
              <p>Console errors: {comparison.changes.consoleErrors.left} {'->'} {comparison.changes.consoleErrors.right} ({comparison.changes.consoleErrors.delta > 0 ? '+' : ''}{comparison.changes.consoleErrors.delta})</p>
              <p>Load time: {comparison.changes.loadTime.left} {'->'} {comparison.changes.loadTime.right}</p>
              <p>Grade: {comparison.changes.grade.left} {'->'} {comparison.changes.grade.right}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
