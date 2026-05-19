import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ReportContent } from '../components/ReportContent';
import { analysisApi } from '../api/analysis.api';
import { downloadReportHtml, printReport } from '../utils/reportExport';
import { Download, Printer, Share2 } from 'lucide-react';

export const ReportDetails = () => {
  const { reportId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => analysisApi.getReport(reportId),
    enabled: !!reportId
  });

  const report = data?.data;

  if (isLoading || !report) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

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
      <button
        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/reports/${report.id}`)}
        className="btn-secondary px-4 py-2 text-sm"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Copy Internal Link
      </button>
    </div>
  );

  return (
    <ReportContent
      report={report}
      heading="Saved Analysis Report"
      backTo="/dashboard"
      backLabel="Back to Dashboard"
      headerActions={headerActions}
    />
  );
};
