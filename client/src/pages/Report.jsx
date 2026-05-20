import { useParams } from 'react-router-dom';
import { ReportContent } from '../components/ReportContent';
import { useAnalysis } from '../hooks/useAnalysis';
import { downloadReportHtml, printReport } from '../utils/reportExport';
import { Download, Share2 } from 'lucide-react';
import { AIAnalysisLoader } from '../components/loaders/AIAnalysisLoader';

export const Report = () => {
  const { jobId } = useParams();
  const { status, isPolling, isComplete, isFailed, progress, report } = useAnalysis(jobId);
  const targetUrl = report?.url || status?.report?.url || '';

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
    return <AIAnalysisLoader targetUrl={targetUrl} progress={progress} />;
  }

  const headerActions = (
    <div className="flex flex-wrap justify-end gap-2">
      <button onClick={() => downloadReportHtml(report)} className="btn-secondary px-4 py-2 text-sm">
        <Download className="w-4 h-4 mr-2" />
        Download HTML
      </button>
      <button onClick={() => printReport(report)} className="btn-secondary px-4 py-2 text-sm">
        <Share2 className="w-4 h-4 mr-2" />
        Print / Save PDF
      </button>
    </div>
  );

  return (
    <ReportContent
      report={report}
      heading="Latest Analysis Report"
      backTo="/dashboard"
      backLabel="Go to Dashboard"
      headerActions={headerActions}
    />
  );
};
