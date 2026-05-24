import api, { publicApi } from './axios';

export const analysisApi = {
  createAnalysis: async (payload) => {
    const requestBody = typeof payload === 'string' ? { url: payload } : payload;
    const response = await api.post('/analysis', requestBody);
    return response.data;
  },
  
  getAnalysisStatus: async (jobId) => {
    const response = await api.get(`/analysis/${jobId}`);
    return response.data;
  },

  listReports: async (params) => {
    const response = await api.get('/analysis/reports', { params });
    return response.data;
  },

  getDashboardInsights: async () => {
    const response = await api.get('/analysis/insights');
    return response.data;
  },

  getReport: async (reportId) => {
    const response = await api.get(`/analysis/reports/${reportId}`);
    return response.data;
  },

  getReportRegression: async (reportId) => {
    const response = await api.get(`/analysis/reports/${reportId}/regression`);
    return response.data;
  },

  rerunReport: async (reportId) => {
    const response = await api.post(`/analysis/reports/${reportId}/rerun`);
    return response.data;
  },

  deleteReport: async (reportId) => {
    const response = await api.delete(`/analysis/reports/${reportId}`);
    return response.data;
  },

  shareReport: async (reportId) => {
    const response = await api.post(`/analysis/reports/${reportId}/share`);
    return response.data;
  },

  unshareReport: async (reportId) => {
    const response = await api.delete(`/analysis/reports/${reportId}/share`);
    return response.data;
  },

  getSharedReport: async (shareToken) => {
    const response = await publicApi.get(`/analysis/shared/${shareToken}`);
    return response.data;
  },

  compareReports: async (left, right) => {
    const response = await api.get('/analysis/reports/compare', {
      params: { left, right }
    });
    return response.data;
  },

  listSchedules: async () => {
    const response = await api.get('/schedules');
    return response.data;
  },

  createSchedule: async (payload) => {
    const response = await api.post('/schedules', payload);
    return response.data;
  },

  updateSchedule: async ({ scheduleId, ...payload }) => {
    const response = await api.put(`/schedules/${scheduleId}`, payload);
    return response.data;
  },

  deleteSchedule: async (scheduleId) => {
    const response = await api.delete(`/schedules/${scheduleId}`);
    return response.data;
  },

  listNotifications: async () => {
    const response = await api.get('/schedules/notifications/list');
    return response.data;
  },

  markNotificationRead: async (notificationId) => {
    const response = await api.patch(`/schedules/notifications/${notificationId}/read`);
    return response.data;
  },

  addReportComment: async ({ reportId, message }) => {
    const response = await api.post(`/analysis/reports/${reportId}/comments`, { message });
    return response.data;
  },

  addReportTask: async ({ reportId, ...payload }) => {
    const response = await api.post(`/analysis/reports/${reportId}/tasks`, payload);
    return response.data;
  },

  updateReportTask: async ({ reportId, taskId, ...payload }) => {
    const response = await api.patch(`/analysis/reports/${reportId}/tasks/${taskId}`, payload);
    return response.data;
  },

  createGitHubIssues: async ({ reportId, ...payload }) => {
    const response = await api.post(`/analysis/reports/${reportId}/github-issues`, payload);
    return response.data;
  },

  listDeployHooks: async () => {
    const response = await api.get('/hooks');
    return response.data;
  },

  createDeployHook: async (payload) => {
    const response = await api.post('/hooks', payload);
    return response.data;
  },

  updateDeployHook: async ({ hookId, ...payload }) => {
    const response = await api.put(`/hooks/${hookId}`, payload);
    return response.data;
  },

  deleteDeployHook: async (hookId) => {
    const response = await api.delete(`/hooks/${hookId}`);
    return response.data;
  },

  listWorkspaces: async () => {
    const response = await api.get('/workspaces');
    return response.data;
  },

  createWorkspace: async (payload) => {
    const response = await api.post('/workspaces', payload);
    return response.data;
  },

  updateWorkspace: async ({ workspaceId, ...payload }) => {
    const response = await api.put(`/workspaces/${workspaceId}`, payload);
    return response.data;
  },

  deleteWorkspace: async (workspaceId) => {
    const response = await api.delete(`/workspaces/${workspaceId}`);
    return response.data;
  },

  assignReportToWorkspace: async ({ reportId, workspaceId }) => {
    const response = await api.patch(`/workspaces/reports/${reportId}/assign`, { workspaceId });
    return response.data;
  }
};
