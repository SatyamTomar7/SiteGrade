import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ReportContent } from '../components/ReportContent';
import { analysisApi } from '../api/analysis.api';
import { useAnalysis } from '../hooks/useAnalysis';
import { downloadReportHtml, printReport } from '../utils/reportExport';
import { Download, Printer, RefreshCcw, Share2, TrendingDown, TrendingUp } from 'lucide-react';
import { AIAnalysisLoader } from '../components/loaders/AIAnalysisLoader';

export const ReportDetails = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reportId } = useParams();
  const [searchParams] = useSearchParams();
  const [comment, setComment] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    detail: '',
    assigneeName: '',
    assigneeEmail: '',
    severity: 'Medium'
  });
  const [branding, setBranding] = useState({
    brandName: 'SiteGrade',
    accentColor: '#2563eb',
    logoUrl: '',
    hideSiteGrade: false
  });
  const [githubRepo, setGithubRepo] = useState({
    repoOwner: '',
    repoName: ''
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const jobId = searchParams.get('jobId');
  const {
    status: liveStatus,
    isComplete,
    isFailed,
    isStreaming,
    progress,
    report: liveReport
  } = useAnalysis(jobId);
  const { data, isLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => analysisApi.getReport(reportId),
    enabled: !!reportId
  });
  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => analysisApi.listWorkspaces()
  });
  const savedReport = data?.data;
  const isReportPending = savedReport && ['pending', 'processing'].includes(savedReport.status);
  const isLiveReportPending = liveReport && ['pending', 'processing'].includes(liveReport.status);
  const regressionEnabled = !!reportId && (
    savedReport?.status === 'completed' || liveReport?.status === 'completed'
  );
  const { data: regressionData } = useQuery({
    queryKey: ['report-regression', reportId],
    queryFn: () => analysisApi.getReportRegression(reportId),
    enabled: regressionEnabled
  });
  const rerunMutation = useMutation({
    mutationFn: analysisApi.rerunReport,
    onSuccess: (response) => {
      navigate(`/reports/${response.data.reportId}?jobId=${response.data.jobId}`);
    }
  });
  const addCommentMutation = useMutation({
    mutationFn: analysisApi.addReportComment,
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    }
  });
  const addTaskMutation = useMutation({
    mutationFn: analysisApi.addReportTask,
    onSuccess: () => {
      setTaskForm({
        title: '',
        detail: '',
        assigneeName: '',
        assigneeEmail: '',
        severity: 'Medium'
      });
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    }
  });
  const updateTaskMutation = useMutation({
    mutationFn: analysisApi.updateReportTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    }
  });
  const githubIssuesMutation = useMutation({
    mutationFn: analysisApi.createGitHubIssues
  });
  const assignWorkspaceMutation = useMutation({
    mutationFn: analysisApi.assignReportToWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });

  const regression = regressionData?.data;
  const report = liveReport?.status === 'completed' ? liveReport : savedReport;
  const targetUrl = report?.url || savedReport?.url || liveStatus?.report?.url || '';
  const collaboration = report?.collaboration || {};
  const workspaces = workspacesData?.data || [];

  useEffect(() => {
    setSelectedWorkspaceId(report?.workspaceContext?.workspaceId || '');
  }, [report?.workspaceContext?.workspaceId]);

  if (jobId && isFailed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="text-center max-w-md card">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Analysis Failed
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {liveReport?.errorMessage || savedReport?.errorMessage || 'Something went wrong while analyzing the website. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  if (jobId && (!savedReport || isReportPending || isLiveReportPending || (!isComplete && !liveReport?.status))) {
    return <AIAnalysisLoader targetUrl={targetUrl} progress={progress} isStreaming={isStreaming} />;
  }

  if (isLoading || !report) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  const headerActions = (
    <div className="flex flex-wrap justify-end gap-2">
      <button onClick={() => downloadReportHtml(report, branding)} className="btn-secondary px-4 py-2 text-sm">
        <Download className="w-4 h-4 mr-2" />
        Download HTML
      </button>
      <button onClick={() => printReport(report, branding)} className="btn-secondary px-4 py-2 text-sm">
        <Printer className="w-4 h-4 mr-2" />
        Print / Save PDF
      </button>
      <button
        onClick={() => rerunMutation.mutate(report.id)}
        className="btn-secondary px-4 py-2 text-sm"
      >
        <RefreshCcw className="w-4 h-4 mr-2" />
        Re-run Analysis
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

  const regressionBanner = regression?.hasBaseline ? (
    <div className={`mb-8 rounded-2xl border px-5 py-4 ${
      regression.summary.overallDirection === 'improved'
        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10'
        : regression.summary.overallDirection === 'regressed'
        ? 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/10'
        : 'border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface'
    }`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Regression Tracking
          </p>
          <p className="mt-1 text-slate-900 dark:text-white">
            Compared against the previous completed scan from {new Date(regression.baselineReport.createdAt).toLocaleDateString()}.
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Improvements: {regression.summary.improvementCount} | Regressions: {regression.summary.regressionCount}
          </p>
        </div>
        <button
          onClick={() => navigate(`/compare?left=${regression.baselineReport.id}&right=${regression.currentReport.id}`)}
          className="btn-secondary px-4 py-2 text-sm"
        >
          {regression.summary.overallDirection === 'regressed' ? <TrendingDown className="w-4 h-4 mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
          Open Comparison
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <ReportContent
        report={report}
        heading="Saved Analysis Report"
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        headerActions={headerActions}
        banner={regressionBanner}
      />

      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Comments</h3>
            <div className="space-y-3 mb-4">
              {(collaboration.comments || []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</p>
              ) : (
                collaboration.comments.map((item) => (
                  <div key={item._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{item.authorName || item.authorEmail || 'Teammate'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">{item.message}</p>
                  </div>
                ))
              )}
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              className="input-field"
              placeholder="Add a review note or handoff comment..."
            />
            <button
              onClick={() => addCommentMutation.mutate({ reportId, message: comment })}
              disabled={!comment.trim() || addCommentMutation.isPending}
              className="btn-primary mt-3"
            >
              Add Comment
            </button>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Workspace</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Current workspace: {report.workspaceContext?.workspaceName || 'Unassigned'}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedWorkspaceId}
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                className="input-field sm:max-w-sm"
              >
                <option value="">No workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
              <button
                onClick={() => assignWorkspaceMutation.mutate({ reportId, workspaceId: selectedWorkspaceId || null })}
                className="btn-primary"
              >
                Save Workspace
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Assignments</h3>
            <div className="space-y-3 mb-4">
              {(collaboration.tasks || []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No tasks yet.</p>
              ) : (
                collaboration.tasks.map((task) => (
                  <div key={task._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{task.assigneeName || task.assigneeEmail || 'Unassigned'} | {task.severity}</p>
                      </div>
                      <select
                        value={task.status}
                        onChange={(event) => updateTaskMutation.mutate({
                          reportId,
                          taskId: task._id,
                          status: event.target.value
                        })}
                        className="input-field sm:max-w-[180px]"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    {task.detail && <p className="mt-2 text-slate-600 dark:text-slate-300">{task.detail}</p>}
                  </div>
                ))
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} className="input-field md:col-span-2" placeholder="Task title" />
              <textarea value={taskForm.detail} onChange={(event) => setTaskForm((prev) => ({ ...prev, detail: event.target.value }))} rows={3} className="input-field md:col-span-2" placeholder="Task detail" />
              <input value={taskForm.assigneeName} onChange={(event) => setTaskForm((prev) => ({ ...prev, assigneeName: event.target.value }))} className="input-field" placeholder="Assignee name" />
              <input value={taskForm.assigneeEmail} onChange={(event) => setTaskForm((prev) => ({ ...prev, assigneeEmail: event.target.value }))} className="input-field" placeholder="Assignee email" />
              <select value={taskForm.severity} onChange={(event) => setTaskForm((prev) => ({ ...prev, severity: event.target.value }))} className="input-field">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <button
              onClick={() => addTaskMutation.mutate({ reportId, ...taskForm })}
              disabled={!taskForm.title.trim() || addTaskMutation.isPending}
              className="btn-primary mt-3"
            >
              Add Task
            </button>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">GitHub Issues</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={githubRepo.repoOwner} onChange={(event) => setGithubRepo((prev) => ({ ...prev, repoOwner: event.target.value }))} className="input-field" placeholder="Repo owner" />
              <input value={githubRepo.repoName} onChange={(event) => setGithubRepo((prev) => ({ ...prev, repoName: event.target.value }))} className="input-field" placeholder="Repo name" />
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                onClick={() => githubIssuesMutation.mutate({ reportId, ...githubRepo, createLive: false })}
                className="btn-secondary"
              >
                Generate Issue Drafts
              </button>
              <button
                onClick={() => githubIssuesMutation.mutate({ reportId, ...githubRepo, createLive: true })}
                className="btn-primary"
                disabled={!githubRepo.repoOwner || !githubRepo.repoName}
              >
                Create GitHub Issues
              </button>
            </div>
            {githubIssuesMutation.data?.data && (
              <div className="mt-4 space-y-3">
                {(githubIssuesMutation.data.data.createdIssues || githubIssuesMutation.data.data.issues || []).map((issue, index) => (
                  <div key={issue.url || issue.title || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                    <p className="font-semibold text-slate-900 dark:text-white">{issue.title}</p>
                    {issue.url ? (
                      <a href={issue.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm text-primary-600 hover:text-primary-700">
                        Open GitHub issue
                      </a>
                    ) : (
                      <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">{issue.body}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Branded Export</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={branding.brandName} onChange={(event) => setBranding((prev) => ({ ...prev, brandName: event.target.value }))} className="input-field" placeholder="Brand name" />
              <input value={branding.logoUrl} onChange={(event) => setBranding((prev) => ({ ...prev, logoUrl: event.target.value }))} className="input-field" placeholder="Logo URL" />
              <input value={branding.accentColor} onChange={(event) => setBranding((prev) => ({ ...prev, accentColor: event.target.value }))} className="input-field" placeholder="#2563eb" />
              <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={branding.hideSiteGrade}
                  onChange={(event) => setBranding((prev) => ({ ...prev, hideSiteGrade: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                Hide SiteGrade footer line
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={() => downloadReportHtml(report, branding)} className="btn-primary">Download Branded HTML</button>
              <button onClick={() => printReport(report, branding)} className="btn-secondary">Print Branded Report</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
