import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAnalysis } from '../hooks/useAnalysis';
import { AIAnalysisLoader } from '../components/loaders/AIAnalysisLoader';

export const Report = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { status, isPolling, isStreaming, isComplete, isFailed, progress, report } = useAnalysis(jobId);
  const targetUrl = report?.url || status?.report?.url || '';

  useEffect(() => {
    const reportId = report?.id || status?.report?.id;

    if (reportId) {
      navigate(`/reports/${reportId}?jobId=${jobId}`, { replace: true });
    }
  }, [jobId, navigate, report?.id, status?.report?.id]);

  if (isFailed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="text-center max-w-md card">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Analysis Failed
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {report?.errorMessage || 'Something went wrong while analyzing the website. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  if ((isPolling && !report) || !isComplete || !report) {
    return <AIAnalysisLoader targetUrl={targetUrl} progress={progress} isStreaming={isStreaming} />;
  }

  return <AIAnalysisLoader targetUrl={targetUrl} progress={progress} isStreaming={isStreaming} />;
};
