import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ReportContent } from '../components/ReportContent';
import { analysisApi } from '../api/analysis.api';
import { downloadReportHtml, printReport } from '../utils/reportExport';
import { Download, Globe, Printer } from 'lucide-react';

export const SharedReport = () => {
  const { shareToken } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['shared-report', shareToken],
    queryFn: () => analysisApi.getSharedReport(shareToken),
    enabled: !!shareToken,
    retry: false
  });

  const report = data?.data;

  if (isLoading || !report) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  const banner = (
    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5" />
        Public share view: this report is visible without login.
      </div>
    </div>
  );

  const headerActions = (
    <div className="flex flex-wrap justify-end gap-2">
      <button onClick={() => downloadReportHtml(report)} className="btn-secondary px-4 py-2 text-sm">
        <Download className="w-4 h-4 mr-2" />
        Download HTML
      </button>
      <button onClick={() => printReport(report)} className="btn-secondary px-4 py-2 text-sm">
        <Printer className="w-4 h-4 mr-2" />
        Print / Save PDF
      </button>
    </div>
  );

  return (
    <ReportContent
      report={report}
      heading="Shared Analysis Report"
      backTo="/"
      backLabel="Back to Home"
      headerActions={headerActions}
      banner={banner}
    />
  );
};
