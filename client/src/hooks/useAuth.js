import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { login, logout, setUser, setLoading, setError, clearError } = useAuthStore();

  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe(),
    enabled: useAuthStore.getState().isAuthenticated,
    retry: false,
    onSuccess: (data) => {
      setUser(data.data);
    },
    onError: () => {
      logout();
    }
  });

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
      navigate('/dashboard');
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
      navigate('/dashboard');
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
    user: userData?.data || useAuthStore.getState().user,
    isAuthenticated: useAuthStore.getState().isAuthenticated,
    isLoading: useAuthStore.getState().isLoading,
    error: useAuthStore.getState().error,
    register: registerMutation.mutate,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    clearError
  };
};