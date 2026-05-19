import api, { publicApi } from './axios';

export const analysisApi = {
  createAnalysis: async (url) => {
    const response = await api.post('/analysis', { url });
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
  }
};
