import axios from 'axios';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../store/authStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const publicApi = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers = [];
let hasForcedRedirect = false;

const onRefreshed = (token) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

const isTokenExpired = (token) => {
  if (!token) {
    return false;
  }

  try {
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(window.atob(payload));
    return decodedPayload.exp ? decodedPayload.exp * 1000 <= Date.now() : false;
  } catch {
    return false;
  }
};

const clearClientSession = () => {
  useAuthStore.getState().logout();
  queryClient.clear();
};

// Attach the access token when it is still valid. If the token has already
// expired, let the request fail once and rely on the refresh flow below instead
// of repeatedly sending known-bad credentials to the backend.
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    const requestUrl = config.url || '';
    const isRefreshRequest = requestUrl.includes('/auth/refresh');

    if (token && !isRefreshRequest) {
      if (isTokenExpired(token)) {
        delete config.headers.Authorization;
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isAuthRoute = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/refresh');
    const isPublicSharedRoute = requestUrl.includes('/analysis/shared/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute && !isPublicSharedRoute) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data.data;
        useAuthStore.getState().setToken(accessToken);
        hasForcedRedirect = false;

        onRefreshed(accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        clearClientSession();

        const isAlreadyOnPublicShare = window.location.pathname.startsWith('/shared/');
        if (!isAlreadyOnPublicShare && !hasForcedRedirect) {
          hasForcedRedirect = true;
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
