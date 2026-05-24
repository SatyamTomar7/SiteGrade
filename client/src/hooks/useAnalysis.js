import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { analysisApi } from '../api/analysis.api';
import { getApiBaseUrl } from '../api/axios';
import { useAuthStore } from '../store/authStore';

export const useAnalysis = (initialJobId = null) => {
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentReportId, setCurrentReportId] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const activeJobId = currentJobId || initialJobId;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);

  const createMutation = useMutation({
    mutationFn: (payload) => analysisApi.createAnalysis(payload),
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
      if (isStreaming) {
        return false;
      }

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

  useEffect(() => {
    setLiveStatus(null);
  }, [activeJobId]);

  useEffect(() => {
    if (!activeJobId || !isAuthenticated || !token || typeof window === 'undefined') {
      setIsStreaming(false);
      return undefined;
    }

    let isCancelled = false;
    const abortController = new AbortController();
    const streamUrl = `${getApiBaseUrl()}/analysis/stream/${activeJobId}`;

    const startStream = async () => {
      try {
        const response = await fetch(streamUrl, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`
          },
          credentials: 'include',
          signal: abortController.signal
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed with status ${response.status}`);
        }

        setIsStreaming(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!isCancelled) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const rawEvent of events) {
            const lines = rawEvent.split('\n');
            const dataLine = lines.find((line) => line.startsWith('data: '));

            if (!dataLine) {
              continue;
            }

            try {
              const payload = JSON.parse(dataLine.slice(6));
              setLiveStatus({ data: payload });

              if (payload.state === 'completed' || payload.state === 'failed') {
                setIsStreaming(false);
                abortController.abort();
                return;
              }
            } catch {
              // Ignore malformed events and keep the stream open.
            }
          }
        }
      } catch {
        if (!isCancelled) {
          setIsStreaming(false);
        }
      }
    };

    startStream();

    return () => {
      isCancelled = true;
      setIsStreaming(false);
      abortController.abort();
    };
  }, [activeJobId, isAuthenticated, token]);

  const effectiveStatus = liveStatus || statusData;
  const isComplete = effectiveStatus?.data?.state === 'completed';
  const isFailed = effectiveStatus?.data?.state === 'failed';
  const report = effectiveStatus?.data?.report;
  const progress = Math.min(Math.max(Number(effectiveStatus?.data?.progress) || 0, 0), 100);

  return {
    createAnalysis: createMutation.mutate,
    createAnalysisAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    status: effectiveStatus?.data,
    isPolling,
    isStreaming,
    isComplete,
    isFailed,
    progress,
    report,
    currentJobId: activeJobId,
    currentReportId,
    reset: () => {
      setCurrentJobId(null);
      setCurrentReportId(null);
      setLiveStatus(null);
    }
  };
};
