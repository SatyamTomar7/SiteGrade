import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { analysisApi } from '../api/analysis.api';
import { buildAssetUrl } from '../api/axios';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AlertCircle, ArrowLeftRight, ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';

export const CompareReports = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const left = searchParams.get('left');
  const right = searchParams.get('right');

  const { data, isLoading, error } = useQuery({
    queryKey: ['compare-reports', left, right],
    queryFn: () => analysisApi.compareReports(left, right),
    enabled: !!left && !!right
  });

  const comparison = data?.data;
  const [sliderValue, setSliderValue] = useState(50);
  const [visualMode, setVisualMode] = useState('slider');
  const diffCanvasRef = useRef(null);

  const highlights = useMemo(() => {
    if (!comparison) {
      return [];
    }

    return comparison.scoreComparison.filter((item) => item.metric !== 'overallScore');
  }, [comparison]);

  if (!left || !right) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="card max-w-lg text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Comparison Needs Two Reports</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Select two completed reports from the dashboard, then open compare again.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="card">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Unable to Compare Reports</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  {error?.response?.data?.message || 'The selected reports could not be compared. Please choose two completed reports and try again.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const deltaIcon = (delta) => {
    if (delta > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (delta < 0) return <TrendingDown className="w-4 h-4 text-rose-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const leftScreenshot = comparison?.changes?.screenshots?.left
    ? buildAssetUrl(`/screenshots/${comparison.changes.screenshots.left}`)
    : '';
  const rightScreenshot = comparison?.changes?.screenshots?.right
    ? buildAssetUrl(`/screenshots/${comparison.changes.screenshots.right}`)
    : '';

  useEffect(() => {
    if (visualMode !== 'diff' || !leftScreenshot || !rightScreenshot || !diffCanvasRef.current) {
      return;
    }

    let cancelled = false;
    const leftImage = new Image();
    const rightImage = new Image();
    leftImage.crossOrigin = 'anonymous';
    rightImage.crossOrigin = 'anonymous';

    const renderDiff = () => {
      if (!leftImage.complete || !rightImage.complete || cancelled) {
        return;
      }

      const width = Math.min(leftImage.naturalWidth || leftImage.width, rightImage.naturalWidth || rightImage.width, 1400);
      const height = Math.min(leftImage.naturalHeight || leftImage.height, rightImage.naturalHeight || rightImage.height);
      if (!width || !height) {
        return;
      }

      const leftCanvas = document.createElement('canvas');
      const rightCanvas = document.createElement('canvas');
      const outputCanvas = diffCanvasRef.current;
      leftCanvas.width = width;
      leftCanvas.height = height;
      rightCanvas.width = width;
      rightCanvas.height = height;
      outputCanvas.width = width;
      outputCanvas.height = height;

      const leftContext = leftCanvas.getContext('2d');
      const rightContext = rightCanvas.getContext('2d');
      const outputContext = outputCanvas.getContext('2d');
      if (!leftContext || !rightContext || !outputContext) {
        return;
      }

      leftContext.drawImage(leftImage, 0, 0, width, height);
      rightContext.drawImage(rightImage, 0, 0, width, height);
      const leftData = leftContext.getImageData(0, 0, width, height);
      const rightData = rightContext.getImageData(0, 0, width, height);
      const outputData = outputContext.createImageData(width, height);

      for (let i = 0; i < leftData.data.length; i += 4) {
        const diffR = Math.abs(leftData.data[i] - rightData.data[i]);
        const diffG = Math.abs(leftData.data[i + 1] - rightData.data[i + 1]);
        const diffB = Math.abs(leftData.data[i + 2] - rightData.data[i + 2]);
        const intensity = Math.min(255, diffR + diffG + diffB);

        outputData.data[i] = intensity;
        outputData.data[i + 1] = Math.max(0, 180 - intensity);
        outputData.data[i + 2] = 255 - Math.min(255, intensity / 2);
        outputData.data[i + 3] = 255;
      }

      outputContext.putImageData(outputData, 0, 0);
    };

    leftImage.onload = renderDiff;
    rightImage.onload = renderDiff;
    leftImage.src = leftScreenshot;
    rightImage.src = rightScreenshot;

    return () => {
      cancelled = true;
    };
  }, [leftScreenshot, rightScreenshot, visualMode]);

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-6xl space-y-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="card">
          <div className="section-kicker mb-4">
            <ArrowLeftRight className="h-4 w-4" />
            Comparison view
          </div>
          <h1 className="section-title text-3xl sm:text-4xl">Before vs After Comparison</h1>
          <p className="section-copy mt-2">
            Compare score deltas, grade movement, tech stack changes, and console quality between two analyses.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="surface-subtle">
              <p className="eyebrow-label">Step 1</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Start with the summary</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Check whether the latest run improved, regressed, or stayed stable.</p>
            </div>
            <div className="surface-subtle">
              <p className="eyebrow-label">Step 2</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Scan changed metrics</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Focus on the biggest score shifts before reading every detail.</p>
            </div>
            <div className="surface-subtle">
              <p className="eyebrow-label">Step 3</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Open visual diff if needed</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Use screenshots only when you need visual confirmation of what changed.</p>
            </div>
          </div>
          {comparison.summary && (
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {comparison.summary.sameUrl ? 'Same URL comparison.' : 'Cross-site comparison.'} Strongest changes: {comparison.summary.strongestChanges?.length ? comparison.summary.strongestChanges.join(', ') : 'no major metric movement'}.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[comparison.leftReport, comparison.rightReport].map((report, index) => (
            <div key={report.id} className="card">
              <p className="eyebrow-label">{index === 0 ? 'Baseline' : 'Latest'}</p>
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
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Site type</p>
                  <p className="font-semibold text-slate-900 dark:text-white capitalize">{report.siteProfile?.effectiveType || 'general'}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Roles covered</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{report.siteProfile?.roleCoverage?.presentRoles?.length || 1}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {leftScreenshot && rightScreenshot && (
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Visual Diff</h3>
            <div className="mb-4 flex flex-wrap gap-3">
              <button
                onClick={() => setVisualMode('slider')}
                className={visualMode === 'slider' ? 'btn-primary' : 'btn-secondary'}
              >
                Slider Compare
              </button>
              <button
                onClick={() => setVisualMode('diff')}
                className={visualMode === 'diff' ? 'btn-primary' : 'btn-secondary'}
              >
                Pixel Diff
              </button>
            </div>
            {visualMode === 'slider' ? (
              <>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Drag the slider to compare the previous and latest screenshots visually.
                </p>
                <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-dark-border">
                  <img src={leftScreenshot} alt="Baseline screenshot" className="block w-full" />
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-white"
                    style={{ width: `${sliderValue}%` }}
                  >
                    <img src={rightScreenshot} alt="Latest screenshot" className="block w-full max-w-none" />
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderValue}
                  onChange={(event) => setSliderValue(Number(event.target.value))}
                  className="mt-4 w-full"
                />
              </>
            ) : (
              <>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  The heatmap highlights changed pixels between the two screenshots.
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-dark-border bg-slate-950 p-2">
                  <canvas ref={diffCanvasRef} className="block h-auto w-full" />
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {highlights.map((item) => (
            <div key={item.metric} className="card">
              <div className="flex items-center justify-between">
                <p className="eyebrow-label">
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
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Scoring Profile</h3>
            <div className="space-y-4 text-slate-700 dark:text-slate-200">
              <p>
                Site type: <span className="font-semibold capitalize">{comparison.changes.siteProfile.left.effectiveType}</span> {'->'} <span className="font-semibold capitalize">{comparison.changes.siteProfile.right.effectiveType}</span>
              </p>
              <p>
                Missing expected roles: {(comparison.changes.siteProfile.left.missingRoles.length ? comparison.changes.siteProfile.left.missingRoles.join(', ') : 'none')} {'->'} {(comparison.changes.siteProfile.right.missingRoles.length ? comparison.changes.siteProfile.right.missingRoles.join(', ') : 'none')}
              </p>
            </div>
          </div>

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
              <p>Pages reviewed: {comparison.changes.crawlCoverage.left.successfulPages}/{comparison.changes.crawlCoverage.left.totalPagesDiscovered} {'->'} {comparison.changes.crawlCoverage.right.successfulPages}/{comparison.changes.crawlCoverage.right.totalPagesDiscovered}</p>
            </div>
          </div>
        </div>

        {comparison.changes.crawlCoverage.pageRoleComparison?.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Page Role Coverage</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {comparison.changes.crawlCoverage.pageRoleComparison.map((item) => (
                <div key={item.role} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4">
                  <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.role}</p>
                  <p className="mt-2 text-slate-700 dark:text-slate-200">
                    {item.left} {'->'} {item.right} ({item.delta > 0 ? '+' : ''}{item.delta})
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
