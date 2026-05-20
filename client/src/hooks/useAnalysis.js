import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { analysisApi } from '../api/analysis.api';
import { useAuthStore } from '../store/authStore';

export const useAnalysis = (initialJobId = null) => {
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentReportId, setCurrentReportId] = useState(null);
  const activeJobId = currentJobId || initialJobId;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const createMutation = useMutation({
    mutationFn: (url) => analysisApi.createAnalysis(url),
    onSuccess: (data) => {
      setCurrentJobId(data.data.jobId);
      setCurrentReportId(data.data.reportId);
    }
  });

  const { data: statusData, isLoading: isPolling } = useQuery({
    queryKey: ['analysis', activeJobId],
    queryFn: () => analysisApi.getAnalysisStatus(activeJobId),
    enabled: !!activeJobId && isAuthenticated,
    refetchInterval: (query) => {
      const state = query.state.data?.data?.state;
      const statusCode = query.state.error?.response?.status;

      if (!useAuthStore.getState().isAuthenticated || statusCode === 401 || statusCode === 403) {
        return false;
      }

      if (state === 'completed' || state === 'failed') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
    refetchIntervalInBackground: true,
    retry: false
  });

  const isComplete = statusData?.data?.state === 'completed';
  const isFailed = statusData?.data?.state === 'failed';
  const report = statusData?.data?.report;
  const progress = Math.min(Math.max(Number(statusData?.data?.progress) || 0, 0), 100);

  return {
    createAnalysis: createMutation.mutate,
    createAnalysisAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    status: statusData?.data,
    isPolling,
    isComplete,
    isFailed,
    progress,
    report,
    currentJobId: activeJobId,
    currentReportId,
    reset: () => {
      setCurrentJobId(null);
      setCurrentReportId(null);
    }
  };
};
