import { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  Bell,
  CalendarClock,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Link2,
  RefreshCcw,
  ScanLine,
  Search,
  Share2,
  Trash2,
  TrendingDown
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

const formatDate = (value) => new Date(value).toLocaleDateString();
const formatDateTime = (value) => new Date(value).toLocaleString();

const getStatusStyles = (status) => {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  if (status === 'failed') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  }

  if (status === 'processing') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }

  return 'bg-slate-100 text-slate-700 dark:bg-dark-border dark:text-slate-300';
};

const DashboardStatCard = ({ label, value, caption }) => (
  <div className="card">
    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
    {caption && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{caption}</p>}
  </div>
);

const DashboardSectionHeading = ({ icon, title, description, action = null }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
      </div>
      {description && <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {action}
  </div>
);

const EmptyMessage = ({ children }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:border-dark-border dark:bg-dark-surface dark:text-slate-400">
    {children}
  </div>
);

export const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedIds, setSelectedIds] = useState([]);
  const [shareMessage, setShareMessage] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    url: '',
    frequency: 'weekly',
    slackWebhook: ''
  });
  const [deployHookForm, setDeployHookForm] = useState({
    name: '',
    url: ''
  });
  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    description: '',
    memberEmails: ''
  });
  const deferredFilters = useDeferredValue(filters);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', deferredFilters],
    queryFn: () => analysisApi.listReports(deferredFilters)
  });
  const { data: insightsData } = useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: () => analysisApi.getDashboardInsights()
  });
  const { data: schedulesData } = useQuery({
    queryKey: ['scan-schedules'],
    queryFn: () => analysisApi.listSchedules()
  });
  const { data: notificationsData } = useQuery({
    queryKey: ['schedule-notifications'],
    queryFn: () => analysisApi.listNotifications()
  });
  const { data: deployHooksData } = useQuery({
    queryKey: ['deploy-hooks'],
    queryFn: () => analysisApi.listDeployHooks()
  });
  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => analysisApi.listWorkspaces()
  });

  const reports = data?.data?.reports || [];
  const pagination = data?.data?.pagination;
  const insights = insightsData?.data;
  const schedules = schedulesData?.data || [];
  const notifications = notificationsData?.data || [];
  const deployHooks = deployHooksData?.data || [];
  const workspaces = workspacesData?.data || [];
  const selectedReports = reports.filter((report) => selectedIds.includes(report.id));
  const canCompareSelected = selectedReports.length === 2 && selectedReports.every((report) => report.status === 'completed');

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => reports.some((report) => report.id === id)));
  }, [reports]);

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
    onSuccess: (_, reportId) => {
      setSelectedIds((prev) => prev.filter((id) => id !== reportId));
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['compare-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-insights'] });
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
      queryClient.invalidateQueries({ queryKey: ['dashboard-insights'] });
    }
  });

  const rerunMutation = useMutation({
    mutationFn: analysisApi.rerunReport,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-insights'] });
      navigate(`/reports/${response.data.reportId}?jobId=${response.data.jobId}`);
    }
  });

  const createScheduleMutation = useMutation({
    mutationFn: analysisApi.createSchedule,
    onSuccess: () => {
      setScheduleForm({ name: '', url: '', frequency: 'weekly', slackWebhook: '' });
      queryClient.invalidateQueries({ queryKey: ['scan-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-notifications'] });
    }
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: analysisApi.updateSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scan-schedules'] });
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: analysisApi.deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scan-schedules'] });
    }
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: analysisApi.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-notifications'] });
    }
  });

  const createDeployHookMutation = useMutation({
    mutationFn: analysisApi.createDeployHook,
    onSuccess: () => {
      setDeployHookForm({ name: '', url: '' });
      queryClient.invalidateQueries({ queryKey: ['deploy-hooks'] });
    }
  });

  const deleteDeployHookMutation = useMutation({
    mutationFn: analysisApi.deleteDeployHook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deploy-hooks'] });
    }
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: analysisApi.createWorkspace,
    onSuccess: () => {
      setWorkspaceForm({
        name: '',
        description: '',
        memberEmails: ''
      });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    }
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: analysisApi.deleteWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
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
    <div className="page-shell">
      <div className="page-container space-y-10">
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-dark-border dark:bg-dark-surface/90 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="section-kicker mb-4">
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </div>
              <h1 className="section-title text-3xl sm:text-4xl">Clean analysis history and clearer analytics.</h1>
              <p className="section-copy mt-3">
                Track how scores change over time, understand repeated issues, and manage the workflows around reporting without digging through a crowded screen.
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:w-auto">
              <button onClick={() => navigate('/analysis')} className="btn-primary w-full">
                <ScanLine className="h-4 w-4" />
                New Analysis
              </button>
              <button
                onClick={() => {
                  if (canCompareSelected) {
                    navigate(`/compare?left=${selectedIds[0]}&right=${selectedIds[1]}`);
                  }
                }}
                disabled={!canCompareSelected}
                className="btn-secondary w-full"
              >
                <RefreshCcw className="h-4 w-4" />
                Compare Selected
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard label="Reports in current results" value={totals.total} caption="Based on your active filters." />
          <DashboardStatCard label="Completed reports" value={totals.completed} caption="Ready to open, compare, or export." />
          <DashboardStatCard label="Average score" value={totals.averageScore} caption="Average overall score in this view." />
          <DashboardStatCard
            label="Compare selection"
            value={selectedIds.length}
            caption={canCompareSelected ? 'Two completed reports selected.' : 'Select two completed reports to compare.'}
          />
        </section>

        {insights && (
          <section className="content-auto space-y-6">
            <DashboardSectionHeading
              icon={<BarChart3 className="h-5 w-5 text-primary-600" />}
              title="Analytics Overview"
              description="Use these charts to understand trend direction, repeated friction points, and the regressions that need attention first."
            />

            {insights?.trend?.length > 0 && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.8fr]">
                <div className="card">
                  <DashboardSectionHeading
                    icon={<BarChart3 className="h-5 w-5 text-primary-600" />}
                    title="Score trend"
                    description="Technical score and portfolio readiness over time."
                  />
                  <div className="h-72 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={insights.trend.map((item) => ({
                          ...item,
                          date: formatDate(item.createdAt)
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="overallScore" stroke="#2563eb" strokeWidth={3} name="Overall score" />
                        <Line type="monotone" dataKey="portfolioReadinessScore" stroke="#f59e0b" strokeWidth={3} name="Portfolio readiness" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                  <DashboardStatCard label="Improvement streak" value={insights.improvementStreak} caption="Consecutive runs that improved." />
                  <DashboardStatCard
                    label="Best score"
                    value={insights.bestReport?.overallScore ?? 0}
                    caption={insights.bestReport?.url || 'No best-scoring report yet.'}
                  />
                  <DashboardStatCard
                    label="Lowest score"
                    value={insights.worstReport?.overallScore ?? 0}
                    caption={insights.worstReport?.url || 'No lowest-scoring report yet.'}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {insights?.repeatedIssues?.length > 0 && (
                <div className="card">
                  <DashboardSectionHeading
                    icon={<Filter className="h-5 w-5 text-primary-600" />}
                    title="Repeated issues"
                    description="Problems showing up again and again across completed reports."
                  />
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
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
                        <div key={item.issue} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{item.issue}</p>
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

              {insights?.recentRegressions?.length > 0 && (
                <div className="card">
                  <DashboardSectionHeading
                    icon={<TrendingDown className="h-5 w-5 text-rose-500" />}
                    title="Recent regressions"
                    description="The most important recent drops worth opening in compare view."
                  />
                  <div className="space-y-3">
                    {insights.recentRegressions.map((item) => (
                      <button
                        key={`${item.reportId}-${item.baselineReportId}`}
                        onClick={() => navigate(`/compare?left=${item.baselineReportId}&right=${item.reportId}`)}
                        className="flex w-full items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-left transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/10"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white break-all">{item.url}</p>
                          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
                            Score delta {item.overallScoreDelta} across {item.regressionCount} regressed metrics
                          </p>
                        </div>
                        <TrendingDown className="mt-1 h-4 w-4 shrink-0 text-rose-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="content-auto space-y-6">
          <DashboardSectionHeading
            icon={<ScanLine className="h-5 w-5 text-primary-600" />}
            title="Report History"
            description="Filter the audits you care about, select two to compare, and open each report with less visual noise."
          />

          <div className="card">
            <DashboardSectionHeading
              icon={<Filter className="h-5 w-5 text-primary-600" />}
              title="Filter reports"
              description="Narrow the list by URL, status, minimum score, date range, or sort order."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Search URL</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={filters.search}
                    onChange={(event) => handleFilterChange('search', event.target.value)}
                    className="input-field pl-10"
                    placeholder="example.com"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Status</label>
                <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)} className="input-field">
                  <option value="all">All</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Min score</label>
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
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">From</label>
                <input type="date" value={filters.dateFrom} onChange={(event) => handleFilterChange('dateFrom', event.target.value)} className="input-field" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">To</label>
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
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {shareMessage}
            </div>
          )}

          {selectedIds.length > 0 && !canCompareSelected && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Select exactly two completed reports to use compare view.
            </div>
          )}

          <div className="space-y-4">
            {isLoading ? (
              <div className="card py-12 text-center">
                <p className="text-slate-500 dark:text-slate-400">Loading analysis history...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="card py-12 text-center">
                <p className="text-slate-500 dark:text-slate-400">No reports match the current filters.</p>
              </div>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="card">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(report.id)}
                        onChange={() => toggleSelected(report.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusStyles(report.status)}`}>
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
                          {report.workspaceContext?.workspaceName && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {report.workspaceContext.workspaceName}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white break-all">{report.url}</h3>

                        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall score</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{report.overallScore ?? 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Portfolio readiness</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{report.portfolioReadinessScore ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created</p>
                            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{formatDate(report.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tech stack</p>
                            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 break-words">{report.techStack?.slice(0, 3).join(', ') || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:w-[18rem]">
                      <button onClick={() => navigate(`/reports/${report.id}`)} className="btn-secondary w-full px-4 py-2 text-sm">
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </button>
                      <button onClick={() => rerunMutation.mutate(report.id)} className="btn-secondary w-full px-4 py-2 text-sm">
                        <RefreshCcw className="h-4 w-4" />
                        Re-run
                      </button>
                      <button
                        onClick={async () => {
                          const response = await analysisApi.getReport(report.id);
                          downloadReportHtml(response.data);
                        }}
                        className="btn-secondary w-full px-4 py-2 text-sm"
                      >
                        <Download className="h-4 w-4" />
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
                        <Share2 className="h-4 w-4" />
                        {report.isPublic ? 'Copy Share Link' : 'Create Share Link'}
                      </button>
                      {report.isPublic && (
                        <button onClick={() => unshareMutation.mutate(report.id)} className="btn-secondary w-full px-4 py-2 text-sm">
                          <Copy className="h-4 w-4" />
                          Disable Share
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="content-auto space-y-6">
          <DashboardSectionHeading
            icon={<CalendarClock className="h-5 w-5 text-primary-600" />}
            title="Automation and collaboration"
            description="Recurring scans, notifications, deploy-triggered checks, and shared workspaces live here."
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card">
              <DashboardSectionHeading
                icon={<CalendarClock className="h-5 w-5 text-primary-600" />}
                title="Scheduled scans"
                description="Set recurring checks and optional Slack delivery."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  value={scheduleForm.name}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="input-field"
                  placeholder="Weekly homepage"
                />
                <input
                  value={scheduleForm.url}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, url: event.target.value }))}
                  className="input-field md:col-span-2"
                  placeholder="https://example.com"
                />
              </div>
              <input
                value={scheduleForm.slackWebhook}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, slackWebhook: event.target.value }))}
                className="input-field mt-3"
                placeholder="Optional Slack webhook URL"
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <select
                  value={scheduleForm.frequency}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, frequency: event.target.value }))}
                  className="input-field sm:max-w-xs"
                >
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
                <button
                  onClick={() => createScheduleMutation.mutate({
                    name: scheduleForm.name || `Scheduled scan for ${scheduleForm.url}`,
                    url: scheduleForm.url,
                    frequency: scheduleForm.frequency,
                    deliveryChannels: [
                      { type: 'in_app', enabled: true },
                      ...(scheduleForm.slackWebhook ? [{ type: 'slack', enabled: true, target: scheduleForm.slackWebhook }] : [])
                    ]
                  })}
                  disabled={!scheduleForm.url || createScheduleMutation.isPending}
                  className="btn-primary"
                >
                  Create Schedule
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {schedules.length === 0 ? (
                  <EmptyMessage>No recurring scans configured yet.</EmptyMessage>
                ) : (
                  schedules.map((schedule) => (
                    <div key={schedule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">{schedule.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 break-all">{schedule.url}</p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {[schedule.frequency, `next run ${formatDateTime(schedule.nextRunAt)}`, schedule.lastStatus].join(' | ')}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleScheduleMutation.mutate({
                              scheduleId: schedule.id,
                              active: !schedule.active
                            })}
                            className="btn-secondary px-4 py-2 text-sm"
                          >
                            {schedule.active ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                            className="inline-flex items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <DashboardSectionHeading
                icon={<Bell className="h-5 w-5 text-primary-600" />}
                title="Alerts"
                description="Unread items are highlighted so you can triage them quickly."
              />
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <EmptyMessage>No schedule alerts yet.</EmptyMessage>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => {
                        if (!notification.read) {
                          markNotificationReadMutation.mutate(notification.id);
                        }
                      }}
                      className={`w-full rounded-2xl border p-4 text-left ${
                        notification.read
                          ? 'border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface'
                          : 'border-primary-200 bg-primary-50/60 dark:border-primary-800 dark:bg-primary-900/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{notification.title}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(notification.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card">
              <DashboardSectionHeading
                icon={<Link2 className="h-5 w-5 text-primary-600" />}
                title="Deploy hooks"
                description="Trigger fresh analysis from your deployment flow."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  value={deployHookForm.name}
                  onChange={(event) => setDeployHookForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="input-field"
                  placeholder="Production deploy hook"
                />
                <input
                  value={deployHookForm.url}
                  onChange={(event) => setDeployHookForm((prev) => ({ ...prev, url: event.target.value }))}
                  className="input-field md:col-span-2"
                  placeholder="https://example.com"
                />
              </div>
              <button
                onClick={() => createDeployHookMutation.mutate({
                  name: deployHookForm.name || `Deploy hook for ${deployHookForm.url}`,
                  url: deployHookForm.url,
                  analysisConfig: {
                    scanMode: 'single',
                    crawlMaxPages: 1,
                    auditProfiles: ['mobile', 'desktop'],
                    enableFixMode: true
                  }
                })}
                disabled={!deployHookForm.url || createDeployHookMutation.isPending}
                className="btn-primary mt-3"
              >
                Create Deploy Hook
              </button>
              <div className="mt-5 space-y-3">
                {deployHooks.length === 0 ? (
                  <EmptyMessage>No deploy hooks configured yet.</EmptyMessage>
                ) : (
                  deployHooks.map((hook) => (
                    <div key={hook.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">{hook.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 break-all">{hook.url}</p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 break-all">{hook.webhookUrl}</p>
                          <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{`# GitHub Actions
curl -X POST "${hook.webhookUrl}" -H "Content-Type: application/json" -d "{\\"deployment\\":\\"production\\"}"

# Vercel / Netlify build hook follow-up
fetch("${hook.webhookUrl}", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deployment: "production" }) });`}</pre>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(hook.webhookUrl);
                              setShareMessage(`Copied deploy hook for ${hook.name}`);
                            }}
                            className="btn-secondary px-4 py-2 text-sm"
                          >
                            Copy Hook URL
                          </button>
                          <button
                            onClick={() => deleteDeployHookMutation.mutate(hook.id)}
                            className="inline-flex items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <DashboardSectionHeading
                icon={<BarChart3 className="h-5 w-5 text-primary-600" />}
                title="Workspaces"
                description="Group shared audits by team, project, or client."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={workspaceForm.name}
                  onChange={(event) => setWorkspaceForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="input-field"
                  placeholder="Frontend Team"
                />
                <input
                  value={workspaceForm.description}
                  onChange={(event) => setWorkspaceForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="input-field"
                  placeholder="Shared audits for the web team"
                />
                <textarea
                  value={workspaceForm.memberEmails}
                  onChange={(event) => setWorkspaceForm((prev) => ({ ...prev, memberEmails: event.target.value }))}
                  rows={3}
                  className="input-field md:col-span-2"
                  placeholder={'designer@example.com\npm@example.com'}
                />
              </div>
              <button
                onClick={() => createWorkspaceMutation.mutate({
                  name: workspaceForm.name,
                  description: workspaceForm.description,
                  memberEmails: workspaceForm.memberEmails.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
                })}
                disabled={!workspaceForm.name.trim() || createWorkspaceMutation.isPending}
                className="btn-primary mt-3"
              >
                Create Workspace
              </button>
              <div className="mt-5 space-y-3">
                {workspaces.length === 0 ? (
                  <EmptyMessage>No workspaces yet.</EmptyMessage>
                ) : (
                  workspaces.map((workspace) => (
                    <div key={workspace.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{workspace.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{workspace.description || 'No description'}</p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Members: {workspace.memberEmails?.length ? workspace.memberEmails.join(', ') : 'None added'}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteWorkspaceMutation.mutate(workspace.id)}
                          className="inline-flex items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
