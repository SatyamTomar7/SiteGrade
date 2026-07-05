import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    user: storedUser,
    isAuthenticated,
    isLoading,
    authChecked,
    hasHydrated,
    error,
    errorCode,
    login,
    logout,
    setUser,
    setLoading,
    setAuthChecked,
    setError,
    clearError
  } = useAuthStore();

  const { data: userData, error: userError } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe(),
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (userData?.data) {
      setUser(userData.data);
      setAuthChecked(true);
    }
  }, [setAuthChecked, setUser, userData]);

  useEffect(() => {
    const statusCode = userError?.response?.status;

    if (statusCode === 401 || statusCode === 403) {
      logout();
      return;
    }

    if (userError) {
      setAuthChecked(true);
    }
  }, [logout, setAuthChecked, userError]);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      setAuthChecked(true);
    }
  }, [hasHydrated, isAuthenticated, setAuthChecked]);

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onMutate: () => {
      setLoading(true);
      clearError();
    },
    onSuccess: (data) => {
      setLoading(false);
    },
    onError: (error) => {
      setError(
        error.response?.data?.message || 'Registration failed',
        error.response?.data?.code || null
      );
      setLoading(false);
    }
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onMutate: () => {
      setLoading(true);
      clearError();
    },
    onSuccess: (data) => {
      const { user, accessToken } = data.data;
      login(user, accessToken);
      setLoading(false);
    },
    onError: (error) => {
      setError(
        error.response?.data?.message || 'Login failed',
        error.response?.data?.code || null
      );
      setLoading(false);
    }
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      logout();
      queryClient.clear();
      navigate('/');
    },
    onError: () => {
      logout();
      queryClient.clear();
      navigate('/');
    }
  });

  return {
    user: userData?.data || storedUser,
    isAuthenticated,
    isLoading,
    authChecked,
    hasHydrated,
    error,
    errorCode,
    register: registerMutation.mutate,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    clearError
  };
};
