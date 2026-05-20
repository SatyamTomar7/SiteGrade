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
    error,
    login,
    logout,
    setUser,
    setLoading,
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
    }
  }, [setUser, userData]);

  useEffect(() => {
    if (userError) {
      logout();
    }
  }, [logout, userError]);

  const registerMutation = useMutation({
    mutationFn: authApi.register,
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
      setError(error.response?.data?.message || 'Registration failed');
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
      setError(error.response?.data?.message || 'Login failed');
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
    error,
    register: registerMutation.mutate,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    clearError
  };
};
