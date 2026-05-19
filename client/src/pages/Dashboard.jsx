import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analysisApi } from '../api/analysis.api';
import { downloadReportHtml } from '../utils/reportExport';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Copy,
  Download,
  ExternalLink,
  Filter,
  RefreshCcw,
  ScanLine,
  Search,
  Share2,
  Trash2
} from 'lucide-react';

const defaultFilters = {
  search: '',
  status: 'all',
  minScore: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'newest',
  page: 1
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedIds, setSelectedIds] = useState([]);
  const [shareMessage, setShareMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', filters],
    queryFn: () => analysisApi.listReports(filters)
  });
  const { data: insightsData } = useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: () => analysisApi.getDashboardInsights()
  });

  const reports = data?.data?.reports || [];
  const pagination = data?.data?.pagination;
  const insights = insightsData?.data;

  const totals = useMemo(() => {
    const completed = reports.filter((report) => report.status === 'completed');
    const averageScore = completed.length
      ? Math.round(completed.reduce((sum, report) => sum + (report.overallScore || 0), 0) / completed.length)
      : 0;

    return {
      total: pagination?.total || 0,
      completed: completed.length,
      averageScore
    };
  }, [pagination?.total, reports]);

  const deleteMutation = useMutation({
    mutationFn: analysisApi.deleteReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['compare-reports'] });
    }
  });

  const shareMutation = useMutation({
    mutationFn: analysisApi.shareReport,
    onSuccess: async (response, reportId) => {
      await navigator.clipboard.writeText(response.data.shareUrl);
      setShareMessage(`Public link copied for report ${reportId.slice(-6)}`);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });

  const unshareMutation = useMutation({
    mutationFn: analysisApi.unshareReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const toggleSelected = (reportId) => {
    setSelectedIds((prev) => {
      if (prev.includes(reportId)) {
        return prev.filter((id) => id !== reportId);
      }

      if (prev.length === 2) {
        return [prev[1], reportId];
      }

      return [...prev, reportId];
    });
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm('Delete this report permanently?')) {
      return;
    }

    await deleteMutation.mutateAsync(reportId);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 mb-4">
              <BarChart3 className="w-4 h-4" />
              Analysis history dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Review past audits, compare runs, manage public share links, and export reports.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto">
            <button onClick={() => navigate('/analysis')} className="btn-primary w-full">
              <ScanLine className="w-4 h-4 mr-2" />
              New Analysis
            </button>
            <button
              onClick={() => {
                if (selectedIds.length === 2) {
                  navigate(`/compare?left=${selectedIds[0]}&right=${selectedIds[1]}`);
                }
              }}
              disabled={selectedIds.length !== 2}
              className="btn-secondary w-full"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Compare Selected
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total reports</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{totals.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500 dark:text-slate-400">Completed in current view</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{totals.completed}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500 dark:text-slate-400">Average score</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{totals.averageScore}</p>
          </div>
        </div>

        {insights?.trend?.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card xl:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Progress Over Time</h2>
              <div className="h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={insights.trend.map((item) => ({
                      ...item,
                      date: new Date(item.createdAt).toLocaleDateString()
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="overallScore" stroke="#2563eb" strokeWidth={3} name="Technical score" />
                    <Line type="monotone" dataKey="portfolioReadinessScore" stroke="#f59e0b" strokeWidth={3} name="Portfolio readiness" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card">
                <p className="text-sm text-slate-500 dark:text-slate-400">Improvement streak</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{insights.improvementStreak}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500 dark:text-slate-400">Best score</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{insights.bestReport?.overallScore ?? 0}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 break-all">{insights.bestReport?.url || 'N/A'}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500 dark:text-slate-400">Lowest score</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{insights.worstReport?.overallScore ?? 0}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 break-all">{insights.worstReport?.url || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {insights?.repeatedIssues?.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Repeated Issues</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.repeatedIssues}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="issue" hide />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {insights.repeatedIssues.map((item) => (
                  <div key={item.issue} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-slate-700 dark:text-slate-200">{item.issue}</p>
                      <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                        {item.count} reports
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className="xl:col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Search URL</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={filters.search}
                  onChange={(event) => handleFilterChange('search', event.target.value)}
                  className="input-field pl-10"
                  placeholder="example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Status</label>
              <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)} className="input-field">
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Min score</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.minScore}
                onChange={(event) => handleFilterChange('minScore', event.target.value)}
                className="input-field"
                placeholder="70"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">From</label>
              <input type="date" value={filters.dateFrom} onChange={(event) => handleFilterChange('dateFrom', event.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">To</label>
              <input type="date" value={filters.dateTo} onChange={(event) => handleFilterChange('dateTo', event.target.value)} className="input-field" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select value={filters.sortBy} onChange={(event) => handleFilterChange('sortBy', event.target.value)} className="input-field w-full sm:max-w-xs">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest-score">Highest score</option>
              <option value="lowest-score">Lowest score</option>
            </select>
            <button onClick={() => setFilters(defaultFilters)} className="btn-secondary w-full sm:w-auto">
              Reset Filters
            </button>
          </div>
        </div>

        {shareMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {shareMessage}
          </div>
        )}

        <div className="space-y-4">
          {isLoading ? (
            <div className="card text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">Loading analysis history...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">No reports match the current filters.</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(report.id)}
                      onChange={() => toggleSelected(report.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-dark-border dark:text-slate-300">
                          {report.status}
                        </span>
                        {report.grade && (
                          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                            Grade {report.grade}
                          </span>
                        )}
                        {report.isPublic && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Public link enabled
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white break-all">{report.url}</h3>
                      <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-500 dark:text-slate-400 min-[420px]:grid-cols-2 md:grid-cols-4">
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200">Overall score</p>
                          <p>{report.overallScore}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200">Portfolio readiness</p>
                          <p>{report.portfolioReadinessScore ?? 0}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200">Created</p>
                          <p>{new Date(report.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200">Tech stack</p>
                          <p className="break-words">{report.techStack?.slice(0, 3).join(', ') || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:flex xl:flex-wrap lg:justify-end">
                    <button onClick={() => navigate(`/reports/${report.id}`)} className="btn-secondary w-full px-4 py-2 text-sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open
                    </button>
                    <button
                      onClick={async () => {
                        const response = await analysisApi.getReport(report.id);
                        downloadReportHtml(response.data);
                      }}
                      className="btn-secondary w-full px-4 py-2 text-sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </button>
                    <button
                      onClick={async () => {
                        if (report.isPublic) {
                          await navigator.clipboard.writeText(`${window.location.origin}/shared/${report.publicShareToken}`);
                          setShareMessage(`Copied public share link for ${report.url}`);
                        } else {
                          await shareMutation.mutateAsync(report.id);
                        }
                      }}
                      className="btn-secondary w-full px-4 py-2 text-sm"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      {report.isPublic ? 'Copy Share Link' : 'Create Share Link'}
                    </button>
                    {report.isPublic && (
                      <button
                        onClick={() => unshareMutation.mutate(report.id)}
                        className="btn-secondary w-full px-4 py-2 text-sm"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Disable Share
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="inline-flex w-full items-center justify-center px-4 py-2 rounded-lg bg-red-50 text-red-600 font-semibold hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-4 card sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                className="btn-secondary disabled:opacity-50"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
